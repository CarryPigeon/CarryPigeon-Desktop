/**
 * @fileoverview 安全聊天缓存桥接（前端缓存 + Rust 加密存储）。
 */

import { invokeTauri } from "@/shared/tauri/invokeClient";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import {
  KEY_AUTH_SESSION_PREFIX,
  KEY_AUTH_TOKEN_PREFIX,
  KEY_LAST_EVENT_ID_PREFIX,
  KEY_SERVER_ID_BY_SOCKET,
} from "@/shared/utils/storageKeys";

type SecureChatCacheKey =
  | `${typeof KEY_AUTH_SESSION_PREFIX}${string}`
  | `${typeof KEY_AUTH_TOKEN_PREFIX}${string}`
  | `${typeof KEY_LAST_EVENT_ID_PREFIX}${string}`
  | typeof KEY_SERVER_ID_BY_SOCKET;

type SecureChatCacheEntryHandler = (key: string, value: string) => void;

const cache = new Map<string, string>();
let readyPromise: Promise<void> | null = null;
let ready = false;
const trustedKeyReads = new Set<string>();
const hydrationHandlers = new Set<SecureChatCacheEntryHandler>();

function logSecureChatCacheFailure(action: string, key: string, error: unknown): void {
  console.error(action, {
    key,
    error: error instanceof Error ? error.message : String(error ?? "unknown_error"),
  });
}

function isTrustedSecureChatCacheKey(key: string): key is SecureChatCacheKey {
  return (
    key === KEY_SERVER_ID_BY_SOCKET ||
    key.startsWith(KEY_AUTH_SESSION_PREFIX) ||
    key.startsWith(KEY_AUTH_TOKEN_PREFIX) ||
    key.startsWith(KEY_LAST_EVENT_ID_PREFIX)
  );
}

function assertTrustedSecureChatCacheKey(key: string): SecureChatCacheKey {
  if (!isTrustedSecureChatCacheKey(key)) {
    throw new Error(`Unsupported secure chat cache key: ${key}`);
  }
  return key;
}

function persistSecureChatCachePut(key: SecureChatCacheKey, value: string): Promise<void> {
  return invokeSecureChatCacheCommand<void>(TAURI_COMMANDS.chatCachePut, { key, value });
}

function persistSecureChatCacheRemove(key: SecureChatCacheKey): Promise<void> {
  return invokeSecureChatCacheCommand<void>(TAURI_COMMANDS.chatCacheRemove, { key });
}

function persistSecureChatCacheRemoveMany(keys: SecureChatCacheKey[]): Promise<void> {
  return invokeSecureChatCacheCommand<void>(TAURI_COMMANDS.chatCacheRemoveMany, { keys: [...keys] });
}

function persistSecureChatCacheClearAll(): Promise<void> {
  return invokeSecureChatCacheCommand<void>(TAURI_COMMANDS.chatCacheClearAll);
}

function hydrateCacheEntry(key: string, value: string): void {
  for (const handler of hydrationHandlers) {
    try {
      handler(key, value);
    } catch {
      // Hydration handlers must not break secure-cache initialization.
    }
  }
}

export function registerSecureChatCacheEntryHandler(handler: SecureChatCacheEntryHandler): () => void {
  hydrationHandlers.add(handler);
  return () => {
    hydrationHandlers.delete(handler);
  };
}

async function invokeSecureChatCacheCommand<T>(command: string, payload?: Record<string, unknown>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await invokeTauri<T>(command, payload ?? {});
    } catch (error) {
      lastError = error;
      if (attempt === 0) continue;
    }
  }
  console.error("Action: secure_chat_cache_command_failed", {
    command,
    key: typeof payload?.key === "string" ? payload.key : undefined,
    error: lastError instanceof Error ? lastError.message : String(lastError ?? "unknown_error"),
  });
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "Secure chat cache command failed"));
}

function legacyKeysForPrefix(prefix: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const value = localStorage.getItem(key);
    if (value != null) out.push([key, value]);
  }
  return out;
}

function collectLegacyEntries(): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  const direct = localStorage.getItem(KEY_SERVER_ID_BY_SOCKET);
  if (direct != null) entries.push([KEY_SERVER_ID_BY_SOCKET, direct]);
  entries.push(...legacyKeysForPrefix(KEY_AUTH_SESSION_PREFIX));
  entries.push(...legacyKeysForPrefix(KEY_AUTH_TOKEN_PREFIX));
  entries.push(...legacyKeysForPrefix(KEY_LAST_EVENT_ID_PREFIX));
  return entries;
}

function removeLegacyEntry(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore legacy cleanup failures; secure data already lives in the encrypted cache.
  }
}

export function clearLegacySecureChatCacheAll(): void {
  const keys = new Set<string>([KEY_SERVER_ID_BY_SOCKET]);
  for (const [key] of legacyKeysForPrefix(KEY_AUTH_SESSION_PREFIX)) keys.add(key);
  for (const [key] of legacyKeysForPrefix(KEY_AUTH_TOKEN_PREFIX)) keys.add(key);
  for (const [key] of legacyKeysForPrefix(KEY_LAST_EVENT_ID_PREFIX)) keys.add(key);
  for (const key of keys) removeLegacyEntry(key);
}

async function persistEntries(entries: Array<[string, string]>): Promise<Array<[string, string]>> {
  const settled = await Promise.allSettled(
    entries.map(([key, value]) => invokeSecureChatCacheCommand<void>(TAURI_COMMANDS.chatCachePut, { key, value })),
  );
  const failed: Array<[string, string]> = [];
  for (let i = 0; i < settled.length; i += 1) {
    const item = settled[i];
    if (item?.status === "rejected") {
      const entry = entries[i]!;
      console.error("Action: secure_chat_cache_import_failed", { key: entry[0], error: String(item.reason) });
      failed.push(entry);
    }
  }
  return failed;
}

async function loadPersistedEntries(): Promise<Array<[string, string]>> {
  const loaded = await invokeSecureChatCacheCommand<Record<string, string> | null>(TAURI_COMMANDS.chatCacheLoadAll);
  if (!loaded || typeof loaded !== "object") return [];
  return Object.entries(loaded)
    .map(([key, value]) => [String(key), String(value)] as [string, string])
    .filter(([, value]) => value.length > 0);
}

export async function ensureSecureChatCacheReady(): Promise<void> {
  if (ready) return;
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    cache.clear();
    trustedKeyReads.clear();

    const persistedEntries = await loadPersistedEntries();
    for (const [key, value] of persistedEntries) {
      cache.set(key, value);
      hydrateCacheEntry(key, value);
    }

    const legacyEntries = collectLegacyEntries();
    const imports: Array<[string, string]> = [];
    for (const [key, value] of legacyEntries) {
      if (cache.has(key) || trustedKeyReads.has(key)) {
        continue;
      }
      cache.set(key, value);
      hydrateCacheEntry(key, value);
      imports.push([key, value]);
    }

    if (imports.length > 0) {
      const failedImports = await persistEntries(imports);
      const failedKeys = new Set(failedImports.map(([key]) => key));
      for (const [key] of imports) {
        if (failedKeys.has(key)) continue;
        try {
          localStorage.removeItem(key);
        } catch {
          // Ignore plaintext cleanup failures after secure persistence succeeded.
        }
      }
      if (failedImports.length > 0) {
        console.error("Action: secure_chat_cache_import_partial_failure", {
          failedKeys: failedImports.map(([key]) => key),
        });
      }
    }

    ready = true;
  })();

  try {
    await readyPromise;
  } finally {
    readyPromise = null;
  }
}

export async function readSecureChatCacheValue(key: string): Promise<string> {
  const trustedKey = assertTrustedSecureChatCacheKey(key);
  if (cache.has(trustedKey)) return cache.get(trustedKey) ?? "";
  if (!trustedKeyReads.has(trustedKey)) {
    const value = await invokeSecureChatCacheCommand<string | null>(TAURI_COMMANDS.chatCacheGet, { key: trustedKey });
    if (typeof value === "string" && value.length > 0) {
      cache.set(trustedKey, value);
    }
    trustedKeyReads.add(trustedKey);
    return typeof value === "string" ? value : "";
  }
  return cache.get(trustedKey) ?? "";
}

export function readSecureChatCacheValueSync(key: string): string {
  const trustedKey = assertTrustedSecureChatCacheKey(key);
  if (cache.has(trustedKey)) return cache.get(trustedKey) ?? "";
  return "";
}

export async function setSecureChatCacheValue(key: string, value: string): Promise<void> {
  const trustedKey = assertTrustedSecureChatCacheKey(key);
  const next = String(value ?? "");
  await persistSecureChatCachePut(trustedKey, next);
  cache.set(trustedKey, next);
}

export function setSecureChatCacheValueSync(key: string, value: string): void {
  const trustedKey = assertTrustedSecureChatCacheKey(key);
  const next = String(value ?? "");
  cache.set(trustedKey, next);
  void persistSecureChatCachePut(trustedKey, next).catch((error) => {
    logSecureChatCacheFailure("Action: secure_chat_cache_put_failed", trustedKey, error);
  });
}

export async function writeSecureChatCacheValue(key: string, value: string): Promise<void> {
  await setSecureChatCacheValue(key, value);
}

export async function removeSecureChatCacheValue(key: string): Promise<void> {
  const trustedKey = assertTrustedSecureChatCacheKey(key);
  await persistSecureChatCacheRemove(trustedKey);
  cache.delete(trustedKey);
}

export function removeSecureChatCacheValueSync(key: string): void {
  const trustedKey = assertTrustedSecureChatCacheKey(key);
  cache.delete(trustedKey);
  void persistSecureChatCacheRemove(trustedKey).catch((error) => {
    logSecureChatCacheFailure("Action: secure_chat_cache_remove_failed", trustedKey, error);
  });
}

export async function removeSecureChatCacheValueAsync(key: string): Promise<void> {
  await removeSecureChatCacheValue(key);
}

export async function removeSecureChatCacheValues(keys: string[]): Promise<void> {
  const trustedKeys = keys.map(assertTrustedSecureChatCacheKey);
  await persistSecureChatCacheRemoveMany(trustedKeys);
  for (const key of trustedKeys) cache.delete(key);
}

export function removeSecureChatCacheValuesSync(keys: string[]): void {
  const trustedKeys = keys.map(assertTrustedSecureChatCacheKey);
  for (const key of trustedKeys) cache.delete(key);
  void persistSecureChatCacheRemoveMany(trustedKeys).catch((error) => {
    logSecureChatCacheFailure("Action: secure_chat_cache_remove_many_failed", trustedKeys.join(","), error);
  });
}

export async function removeSecureChatCacheValuesAsync(keys: string[]): Promise<void> {
  await removeSecureChatCacheValues(keys);
}

export async function clearSecureChatCacheAll(): Promise<void> {
  cache.clear();
  trustedKeyReads.clear();
  try {
    await persistSecureChatCacheClearAll();
  } catch (error) {
    logSecureChatCacheFailure("Action: secure_chat_cache_clear_all_failed", "*", error);
  }
  clearLegacySecureChatCacheAll();
}
