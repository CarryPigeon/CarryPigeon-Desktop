/**
 * @fileoverview serverListStore.ts 文件职责说明。
 */
import { reactive } from "vue";

export type ServerNotifyMode = "notify" | "silent" | "mute";

export type ServerItem = {
  socket: string;
  name: string;
  note?: string;
  pinned?: boolean;
  notifyMode?: ServerNotifyMode;
  avatarUrl?: string;
  onlineCount?: number | null;
  brief?: string;
};

const state = reactive<{ servers: ServerItem[] }>({
  servers: [],
});

/**
 * normalizeSocket 方法说明。
 * @param socket - 参数说明。
 * @returns 返回值说明。
 */
function normalizeSocket(socket: string): string {
  return socket.trim();
}

/**
 * useServerListStore 方法说明。
 * @returns 返回值说明。
 */
export function useServerListStore() {
  return {
    servers: state.servers,
    upsertServer,
    removeServer,
    updateServer,
    setNotifyMode,
    setPinned,
    setServerInfo,
    getServerBySocket,
  };
}

/**
 * getServerBySocket 方法说明。
 * @param socket - 参数说明。
 * @returns 返回值说明。
 */
export function getServerBySocket(socket: string): ServerItem | undefined {
  const key = normalizeSocket(socket);
  return state.servers.find((item) => item.socket === key);
}

/**
 * upsertServer 方法说明。
 * @param payload - 参数说明。
 * @returns 返回值说明。
 */
export function upsertServer(payload: Partial<ServerItem> & { socket: string }) {
  const key = normalizeSocket(payload.socket);
  if (!key) return;

  const existing = state.servers.find((item) => item.socket === key);
  if (existing) {
    Object.assign(existing, payload, { socket: key });
    if (!existing.name) existing.name = key;
    return;
  }

  state.servers.push({
    socket: key,
    name: payload.name?.trim() || key,
    note: payload.note,
    pinned: payload.pinned ?? false,
    notifyMode: payload.notifyMode ?? "notify",
    avatarUrl: payload.avatarUrl,
    onlineCount: payload.onlineCount ?? null,
    brief: payload.brief ?? "",
  });
}

/**
 * removeServer 方法说明。
 * @param socket - 参数说明。
 * @returns 返回值说明。
 */
export function removeServer(socket: string) {
  const key = normalizeSocket(socket);
  const index = state.servers.findIndex((item) => item.socket === key);
  if (index >= 0) state.servers.splice(index, 1);
}

/**
 * updateServer 方法说明。
 * @param socket - 参数说明。
 * @param patch - 参数说明。
 * @returns 返回值说明。
 */
export function updateServer(socket: string, patch: Partial<ServerItem>) {
  const existing = getServerBySocket(socket);
  if (!existing) return;
  Object.assign(existing, patch);
}

/**
 * setNotifyMode 方法说明。
 * @param socket - 参数说明。
 * @param mode - 参数说明。
 * @returns 返回值说明。
 */
export function setNotifyMode(socket: string, mode: ServerNotifyMode) {
  updateServer(socket, { notifyMode: mode });
}

/**
 * setPinned 方法说明。
 * @param socket - 参数说明。
 * @param pinned - 参数说明。
 * @returns 返回值说明。
 */
export function setPinned(socket: string, pinned: boolean) {
  updateServer(socket, { pinned });
}

/**
 * setServerInfo 方法说明。
 * @param socket - 参数说明。
 * @param info - 参数说明。
 * @returns 返回值说明。
 */
export function setServerInfo(socket: string, info: Partial<ServerItem>) {
  updateServer(socket, info);
}
