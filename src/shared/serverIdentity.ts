/**
 * @fileoverview 服务端身份映射（server_socket ↔ server_id）。
 * @description 本地维护 `server_socket` 与稳定 `server_id` 的映射关系。
 *
 * 背景：
 * - PRD 要求本地数据按 `server_id`（稳定 UUID）隔离。
 * - 同一服务器的 socket 可能被用户编辑；若以 `server_socket` 作为存储 key，会导致身份被拆分，
 *   进而产生数据泄漏/重复。
 *
 * 本模块以 best-effort 方式将映射存入 localStorage，并提供“稳定 scope key”的推导工具，
 * 供本地持久化使用。
 */

const KEY_SERVER_ID_BY_SOCKET = "carrypigeon:serverIdBySocket:v1";

const KEY_TOKEN_PREFIX = "carrypigeon:authToken:";
const KEY_SESSION_PREFIX = "carrypigeon:authSession:";
const KEY_LAST_EVENT_ID_PREFIX = "carrypigeon:lastEventId:";

type ServerIdBySocket = Record<string, string>;

/**
 * 从 localStorage 读取已持久化的 socket → server_id 映射表。
 *
 * @returns 映射对象（缺失/非法时返回空对象）。
 */
function safeReadMap(): ServerIdBySocket {
  try {
    const raw = localStorage.getItem(KEY_SERVER_ID_BY_SOCKET);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as ServerIdBySocket;
  } catch {
    return {};
  }
}

/**
 * 将 socket → server_id 映射表写入 localStorage（best-effort）。
 *
 * @param map - 要写入的映射对象。
 * @returns void
 */
function safeWriteMap(map: ServerIdBySocket): void {
  try {
    localStorage.setItem(KEY_SERVER_ID_BY_SOCKET, JSON.stringify(map));
  } catch {
    // 忽略存储失败（例如 quota/隐私模式）。
  }
}

/**
 * 归一化 server socket 字符串。
 *
 * @param serverSocket - 原始 server socket。
 * @returns 裁剪后的 socket。
 */
function normalizeSocket(serverSocket: string): string {
  return String(serverSocket ?? "").trim();
}

/**
 * 归一化 server_id 字符串。
 *
 * @param serverId - 原始 server_id。
 * @returns 裁剪后的 server_id。
 */
function normalizeServerId(serverId: string): string {
  return String(serverId ?? "").trim();
}

/**
 * 获取 socket 对应的已缓存 server_id（未知时返回空字符串）。
 *
 * @param serverSocket - server socket 字符串。
 * @returns 已缓存的 server_id；未知时为空字符串。
 */
export function getKnownServerId(serverSocket: string): string {
  const socket = normalizeSocket(serverSocket);
  if (!socket) return "";
  const map = safeReadMap();
  return String(map[socket] ?? "").trim();
}

/**
 * 获取本地持久化使用的稳定 scope key。
 *
 * 规则：优先使用已知 `server_id`；在未解析前退化为 `server_socket`。
 *
 * @param serverSocket - server socket 字符串。
 * @returns scope key 字符串。
 */
export function getServerScopeKey(serverSocket: string): string {
  const socket = normalizeSocket(serverSocket);
  if (!socket) return "";
  return getKnownServerId(socket) || socket;
}

/**
 * 将单个 localStorage 条目从旧 scope key 迁移到新 scope key。
 *
 * @param prefix - key 前缀。
 * @param oldScope - 旧 scope 后缀。
 * @param newScope - 新 scope 后缀。
 * @returns void
 */
function migrateKey(prefix: string, oldScope: string, newScope: string): void {
  if (!oldScope || !newScope || oldScope === newScope) return;
  const oldKey = `${prefix}${oldScope}`;
  const newKey = `${prefix}${newScope}`;
  try {
    const oldVal = localStorage.getItem(oldKey);
    if (oldVal == null) return;
    const newVal = localStorage.getItem(newKey);
    if (newVal == null) localStorage.setItem(newKey, oldVal);
    localStorage.removeItem(oldKey);
  } catch {
    // 忽略迁移失败（best-effort）。
  }
}

/**
 * 记住 socket 已解析出的 `server_id`，并将关键 localStorage 记录从 socket scope 迁移到 server_id scope（best-effort）。
 *
 * @param serverSocket - server socket 字符串。
 * @param serverId - 稳定的 server_id。
 * @returns void
 */
export function rememberServerId(serverSocket: string, serverId: string): void {
  const socket = normalizeSocket(serverSocket);
  const sid = normalizeServerId(serverId);
  if (!socket || !sid) return;

  const map = safeReadMap();
  const prev = String(map[socket] ?? "").trim();
  if (prev === sid) return;
  map[socket] = sid;
  safeWriteMap(map);

  // 尽力而为（best-effort）：迁移常见的 per-server key，避免 server_id 可用后用户“丢失”会话/断点续传状态。
  migrateKey(KEY_TOKEN_PREFIX, socket, sid);
  migrateKey(KEY_SESSION_PREFIX, socket, sid);
  migrateKey(KEY_LAST_EVENT_ID_PREFIX, socket, sid);
}

/**
 * 忘记 socket 的 server_id 映射记录。
 *
 * 注意：不会删除 DB 或其他存储，仅清除映射表。
 *
 * @param serverSocket - server socket 字符串。
 * @returns void
 */
export function forgetServerIdentity(serverSocket: string): void {
  const socket = normalizeSocket(serverSocket);
  if (!socket) return;
  const map = safeReadMap();
  if (!(socket in map)) return;
  delete map[socket];
  safeWriteMap(map);
}
