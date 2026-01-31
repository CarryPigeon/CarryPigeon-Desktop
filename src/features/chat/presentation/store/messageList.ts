/**
 * @fileoverview messageList.ts 文件职责说明。
 */
import { ref } from "vue";
import type { Message } from "../../domain/types/Message";
import { getServerSocket } from "@/features/servers/presentation/store/currentServer";
import { getChannelId } from "./chatContext";

/**
 * Exported constant.
 * @constant
 */
export const messageList = ref<Message[]>([]);

const messageBuckets = new Map<string, Message[]>();

let activeKey = contextKey("local", 0);

export const activeMessageContext = ref<{ serverSocket: string; channelId: number }>({
  serverSocket: "local",
  channelId: 0,
});

/**
 * contextKey 方法说明。
 * @param serverSocket - 参数说明。
 * @param channelId - 参数说明。
 * @returns 返回值说明。
 */
function contextKey(serverSocket: string, channelId: number): string {
  const safeSocket = serverSocket.trim() || "local";
  return `${safeSocket}::${channelId}`;
}

/**
 * resolveContext function.
 * @param serverSocket - TODO.
 * @param channelId - TODO.
 * @returns TODO.
 */
function resolveContext(
  serverSocket?: string,
  channelId?: number,
): { key: string; serverSocket: string; channelId: number } {
  const socket = (serverSocket ?? getServerSocket()).trim();
  const channel = Number.isFinite(channelId) ? (channelId as number) : getChannelId();
  const safeSocket = socket || "local";
  const safeChannel = Number.isFinite(channel) ? channel : 0;
  return { key: contextKey(safeSocket, safeChannel), serverSocket: safeSocket, channelId: safeChannel };
}

/**
 * getBucket 方法说明。
 * @param key - 参数说明。
 * @returns 返回值说明。
 */
function getBucket(key: string): Message[] {
  let bucket = messageBuckets.get(key);
  if (!bucket) {
    bucket = [];
    messageBuckets.set(key, bucket);
  }
  return bucket;
}

/**
 * setActiveMessageContext 方法说明。
 * @param serverSocket - 参数说明。
 * @param channelId - 参数说明。
 * @returns 返回值说明。
 */
export function setActiveMessageContext(serverSocket: string, channelId: number): void {
  const ctx = resolveContext(serverSocket, channelId);
  activeKey = ctx.key;
  activeMessageContext.value = { serverSocket: ctx.serverSocket, channelId: ctx.channelId };
  messageList.value = [...getBucket(activeKey)];
}

/**
 * importMessage 方法说明。
 * @param value - 参数说明。
 * @param serverSocket? - 参数说明。
 * @param channelId? - 参数说明。
 * @returns 返回值说明。
 */
export function importMessage(value: Message[], serverSocket?: string, channelId?: number) {
  const ctx = resolveContext(serverSocket, channelId);
  messageBuckets.set(ctx.key, [...value]);
  if (ctx.key === activeKey) {
    messageList.value = [...value];
  }
}

/**
 * addMessage 方法说明。
 * @param value - 参数说明。
 * @param serverSocket? - 参数说明。
 * @param channelId? - 参数说明。
 * @returns 返回值说明。
 */
export function addMessage(value: Message, serverSocket?: string, channelId?: number) {
  const ctx = resolveContext(serverSocket, channelId);
  const bucket = getBucket(ctx.key);
  if (!bucket.some((item) => item.id === value.id)) {
    bucket.push(value);
  }
  if (ctx.key === activeKey) {
    messageList.value = [...bucket];
  }
}

/**
 * addMessages 方法说明。
 * @param values - 参数说明。
 * @param serverSocket? - 参数说明。
 * @param channelId? - 参数说明。
 * @returns 返回值说明。
 */
export function addMessages(values: Message[], serverSocket?: string, channelId?: number) {
  const ctx = resolveContext(serverSocket, channelId);
  const bucket = getBucket(ctx.key);
  let changed = false;
  for (const value of values) {
    if (!bucket.some((item) => item.id === value.id)) {
      bucket.push(value);
      changed = true;
    }
  }
  if (changed && ctx.key === activeKey) {
    messageList.value = [...bucket];
  }
}

/**
 * getLatestMessageTime 方法说明。
 * @param serverSocket? - 参数说明。
 * @param channelId? - 参数说明。
 * @returns 返回值说明。
 */
export function getLatestMessageTime(serverSocket?: string, channelId?: number): number {
  const ctx = resolveContext(serverSocket, channelId);
  const bucket = getBucket(ctx.key);
  let latest = 0;
  for (const message of bucket) {
    const ts = resolveTimestamp(message);
    if (ts > latest) latest = ts;
  }
  return latest;
}

/**
 * resolveTimestamp 方法说明。
 * @param message - 参数说明。
 * @returns 返回值说明。
 */
function resolveTimestamp(message: Message): number {
  const payload = message as unknown as Record<string, unknown>;
  const raw = payload.timestamp;

  if (typeof raw === "number") return raw;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "string" && raw.length > 0) {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}
