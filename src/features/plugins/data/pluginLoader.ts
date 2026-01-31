/**
 * @fileoverview 插件加载器（前端侧）。
 * @description 从 Rust 侧加载插件产物（WASM/JS/HTML），并提供缓存与编译辅助。
 */
import { invokeTauri, TAURI_COMMANDS, tauriLog } from "../../../shared/tauri";
import { createLogger } from "@/shared/utils/logger";

export interface PluginManifest {
  name: string;
  version: string;

  description?: string | null;
  author?: string | null;
  license?: string | null;

  url: string;
  frontend_sha256: string;
  backend_sha256: string;

  icon?: string | null;
}

export type PluginManifestInput = Partial<Omit<PluginManifest, "name">> & Pick<PluginManifest, "name">;

type PluginLoadResult = {
  frontendWasm: unknown;
  frontendJs: unknown;
  frontendHtml: unknown;
};

const pluginCache = new Map<
  string,
  Promise<{
    frontendWasm: Uint8Array;
    frontendJs: Uint8Array;
    frontendHtml: string;
  }>
>();
const logger = createLogger("pluginLoader");

/**
 * normalizeManifest 方法说明。
 * @param input - 参数说明。
 * @returns 返回值说明。
 */
function normalizeManifest(input: PluginManifestInput): PluginManifest {
  return {
    name: input.name,
    version: input.version ?? "0.0.0",
    description: input.description ?? null,
    author: input.author ?? null,
    license: input.license ?? null,
    url: input.url ?? "",
    frontend_sha256: input.frontend_sha256 ?? "",
    backend_sha256: input.backend_sha256 ?? "",
    icon: input.icon ?? null,
  };
}

/**
 * bytesToUint8Array 方法说明。
 * @param bytes - 参数说明。
 * @returns 返回值说明。
 */
function bytesToUint8Array(bytes: unknown): Uint8Array {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  if (Array.isArray(bytes)) return new Uint8Array(bytes);
  if (typeof bytes === "string") {
    const binary = atob(bytes);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  throw new Error(`Unexpected bytes type: ${Object.prototype.toString.call(bytes)}`);
}

/**
 * decodeUtf8 方法说明。
 * @param bytes - 参数说明。
 * @returns 返回值说明。
 */
function decodeUtf8(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * 加载插件资源（WASM/JS/HTML），并按 `name@version` 缓存。
 * @param manifest - 插件清单（最少需要 `name`）
 * @returns 前端插件资源（WASM/JS/HTML）
 */
/**
 * loadPlugin 方法说明。
 * @param manifest - 参数说明。
 * @returns 返回值说明。
 */
export async function loadPlugin(manifest: PluginManifestInput): Promise<{
  frontendWasm: Uint8Array;
  frontendJs: Uint8Array;
  frontendHtml: string;
}> {
  const normalized = normalizeManifest(manifest);
  const cacheKey = `${normalized.name}@${normalized.version}`;

  const cached = pluginCache.get(cacheKey);
  if (cached) {
    logger.debug("Plugin cache hit", { cacheKey });
    return cached;
  }

/**
 * loading 方法说明。
 * @param async ( - 参数说明。
 * @returns 返回值说明。
 */
  const loading = (async () => {
    logger.info("Loading plugin", { name: normalized.name, version: normalized.version });
    const result = await invokeTauri<PluginLoadResult>(TAURI_COMMANDS.loadPlugin, { manifest: normalized });
    const frontendWasm = bytesToUint8Array(result.frontendWasm);
    const frontendJs = bytesToUint8Array(result.frontendJs);
    const frontendHtml = decodeUtf8(bytesToUint8Array(result.frontendHtml));
    return { frontendWasm, frontendJs, frontendHtml };
  })();

  pluginCache.set(cacheKey, loading);

  try {
    return await loading;
  } catch (err) {
    pluginCache.delete(cacheKey);
    logger.error("Failed to load plugin", { name: normalized.name, version: normalized.version, error: String(err) });
    tauriLog.error("Failed to load plugin", { name: normalized.name, version: normalized.version, error: String(err) });
    return { frontendWasm: Uint8Array.from([]), frontendJs: Uint8Array.from([]), frontendHtml: "" };
  }
}

/**
 * 仅按 name 加载插件 WASM（用于快速获取插件主产物）。
 * @param name - 插件名
 * @returns 插件 WASM 字节
 */
/**
 * loadPluginByName 方法说明。
 * @param name - 参数说明。
 * @returns 返回值说明。
 */
export async function loadPluginByName(name: string): Promise<Uint8Array> {
  const { frontendWasm } = await loadPlugin({ name });
  return frontendWasm;
}

/**
 * 编译插件 WASM（WebAssembly.compile）。
 * @param manifest - 插件清单
 * @returns WASM 模块
 */
/**
 * compilePluginWasm 方法说明。
 * @param manifest - 参数说明。
 * @returns 返回值说明。
 */
export async function compilePluginWasm(manifest: PluginManifestInput): Promise<WebAssembly.Module> {
  const bytes = await loadPlugin(manifest);
  const buffer = bytes.frontendWasm.buffer as ArrayBuffer;
  const arrayBuffer =
    bytes.frontendWasm.byteOffset === 0 && bytes.frontendWasm.byteLength === buffer.byteLength
      ? buffer
      : buffer.slice(bytes.frontendWasm.byteOffset, bytes.frontendWasm.byteOffset + bytes.frontendWasm.byteLength);
  return WebAssembly.compile(arrayBuffer);
}
