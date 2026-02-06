/**
 * @fileoverview 服务器机架列表 Store（serverList.ts）。
 * @description 展示层 store：用于管理机架（rack）列表与当前 server socket 选择。
 */

import { computed, ref } from "vue";
import { MOCK_SERVER_SOCKET, USE_MOCK_API } from "@/shared/config/runtime";
import { readJson, writeJson } from "@/shared/utils/localStore";
import { MOCK_KEYS } from "@/shared/mock/mockKeys";
import { currentServerSocket, setServerSocket } from "./currentServer";
import { setServerTlsConfigProvider } from "@/shared/net/tls/serverTlsConfigProvider";

/**
 * 服务端机架（Rack）记录（展示层模型）。
 *
 * 说明：
 * - 该结构用于 server rail、quick switcher、以及连接层的 TLS 配置解析；
 * - 当前持久化实现以 localStorage 为主（mock/开发态）。
 */
export type ServerRack = {
  id: string;
  name: string;
  serverSocket: string;
  pinned: boolean;
  note: string;
  tlsPolicy: "strict" | "trust_fingerprint" | "insecure";
  tlsFingerprint: string;
  notifyMode: "notify" | "silent" | "none";
};

type StoredServersState = {
  servers: ServerRack[];
};

/**
 * 将可能不完整的持久化 rack 记录归一化为完整的 `ServerRack`。
 *
 * 目的：随着字段逐步增加，保证 localStorage 迁移过程安全、可向后兼容。
 *
 * @param raw - 持久化记录（形状未知/可能缺字段）。
 * @returns 字段完整的 `ServerRack` 对象。
 */
function normalizeRack(raw: Partial<ServerRack> & { id?: unknown; serverSocket?: unknown; name?: unknown }): ServerRack {
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id : `rack-${Date.now()}`;
  const serverSocket = typeof raw.serverSocket === "string" ? raw.serverSocket.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const pinned = Boolean(raw.pinned);
  const note = typeof raw.note === "string" ? raw.note : "";
  const tlsPolicy =
    raw.tlsPolicy === "strict" || raw.tlsPolicy === "trust_fingerprint" || raw.tlsPolicy === "insecure" ? raw.tlsPolicy : "strict";
  const tlsFingerprint = typeof raw.tlsFingerprint === "string" ? raw.tlsFingerprint : "";
  const notifyMode = raw.notifyMode === "notify" || raw.notifyMode === "silent" || raw.notifyMode === "none" ? raw.notifyMode : "notify";

  return {
    id,
    name: name || "Unnamed Rack",
    serverSocket,
    pinned,
    note,
    tlsPolicy,
    tlsFingerprint,
    notifyMode,
  };
}

/**
 * 已持久化的机架列表状态。
 *
 * 存储策略：
 * - mock UI：通过 `readJson/writeJson` 存在 `localStorage`。
 * - 非 mock：当前默认从空列表开始（待接入真实持久化）。
 */
const state = ref<StoredServersState>(
  readJson<StoredServersState>(MOCK_KEYS.serversState, {
    servers: USE_MOCK_API
      ? [
          {
            id: "rack-0",
            name: "Mock Rack",
            serverSocket: MOCK_SERVER_SOCKET,
            pinned: true,
            note: "",
            tlsPolicy: "strict",
            tlsFingerprint: "",
            notifyMode: "notify",
          },
        ]
      : [],
  }),
);

/**
 * 从存储读取后，确保 state 结构被归一化。
 *
 * @returns 无返回值。
 */
function normalizeState(): void {
  const next: ServerRack[] = [];
  for (const s of state.value.servers) next.push(normalizeRack(s));
  state.value.servers = next;
}

normalizeState();

/**
 * 将当前机架列表状态写入本地存储。
 */
function persist(): void {
  writeJson(MOCK_KEYS.serversState, state.value);
}

/**
 * 计算 rails / quick switcher 使用的机架列表。
 *
 * @returns 当前机架列表。
 */
function computeServerRacks(): ServerRack[] {
  return state.value.servers;
}

/**
 * 用于服务器 rail / quick switcher 的计算属性列表（view-model）。
 *
 * @constant
 */
export const serverRacks = computed(computeServerRacks);

/**
 * 某个 server socket 对应的 TLS 配置（从 rack 记录解析）。
 */
export type ServerTlsConfig = { tlsPolicy: ServerRack["tlsPolicy"]; tlsFingerprint: string };

/**
 * 从 rack store 中解析指定 socket 的 TLS 配置。
 *
 * @param serverSocket - 服务器 Socket 地址（作为 rack 的唯一 key）。
 * @returns TLS 配置（默认 strict + 空指纹）。
 */
export function getTlsConfigForSocket(serverSocket: string): ServerTlsConfig {
  const key = serverSocket.trim();
  const rack = state.value.servers.find((r) => r.serverSocket.trim() === key) ?? null;
  if (!rack) return { tlsPolicy: "strict", tlsFingerprint: "" };
  return { tlsPolicy: rack.tlsPolicy, tlsFingerprint: rack.tlsFingerprint };
}

// 依赖倒置：由 servers feature 提供 per-server TLS 配置，供 shared/net 基础设施消费。
setServerTlsConfigProvider(getTlsConfigForSocket);

/**
 * 按 pinned 标记比较 rack（pinned 优先）。
 *
 * @param a - rack A。
 * @param b - rack B。
 * @returns 排序结果（负数表示 A 在 B 前）。
 */
function comparePinnedFirst(a: ServerRack, b: ServerRack): number {
  return Number(b.pinned) - Number(a.pinned);
}

/**
 * 原地排序机架列表：pinned 项优先。
 *
 * @returns 无返回值。
 */
function sortRacksPinnedFirst(): void {
  state.value.servers.sort(comparePinnedFirst);
}

/**
 * 按 id 查找 rack。
 *
 * @param id - rack id。
 * @returns 找到则返回 rack；否则返回 `null`。
 */
function findRackById(id: string): ServerRack | null {
  for (const s of state.value.servers) {
    if (s.id === id) return s;
  }
  return null;
}

/**
 * 按 server socket 查找 rack。
 *
 * @param socket - 服务器 Socket 地址（必须已 `trim()`）。
 * @returns 找到则返回 rack；否则返回 `null`。
 */
function findRackBySocket(socket: string): ServerRack | null {
  for (const s of state.value.servers) {
    if (s.serverSocket === socket) return s;
  }
  return null;
}

/**
 * 判断是否存在使用指定 socket 的 rack。
 *
 * @param socket - 服务器 Socket 地址（必须已 `trim()`）。
 * @returns 当存在 rack 使用该 socket 时返回 `true`。
 */
function hasRackWithSocket(socket: string): boolean {
  return Boolean(findRackBySocket(socket));
}

/**
 * 添加一个 rack（或聚焦已有 rack）。
 *
 * 行为：
 * - 对 socket 做 `trim()` 归一化。
 * - 若 socket 已存在：直接切换为当前 active server。
 * - 新 rack 会插入到列表头部。
 *
 * @param serverSocket - 要添加/选择的服务器 Socket 地址。
 * @param name - 可选展示名称。
 */
export function addServer(serverSocket: string, name: string): void {
  const socket = serverSocket.trim();
  if (!socket) return;
  if (hasRackWithSocket(socket)) {
    setServerSocket(socket);
    return;
  }
  state.value.servers.unshift({
    id: `rack-${Date.now()}`,
    name: name.trim() || "Unnamed Rack",
    serverSocket: socket,
    pinned: false,
    note: "",
    tlsPolicy: "strict",
    tlsFingerprint: "",
    notifyMode: "notify",
  });
  persist();
  setServerSocket(socket);
}

/**
 * 按 id 原地更新 rack。
 *
 * 注意：
 * - `serverSocket` 视为唯一键：变更时若新 socket 已被其他 rack 使用，则更新会被拒绝。
 * - 若当前选中的 socket 等于旧 socket，则会同步切换到新 socket。
 *
 * @param id - rack id。
 * @param patch - 要更新的部分字段。
 * @returns 更新成功返回 `true`；否则返回 `false`。
 */
export function updateServerRack(
  id: string,
  patch: Partial<Pick<ServerRack, "name" | "serverSocket" | "note" | "tlsPolicy" | "tlsFingerprint" | "notifyMode" | "pinned">>,
): boolean {
  const rack = findRackById(id);
  if (!rack) return false;

  const nextSocket = typeof patch.serverSocket === "string" ? patch.serverSocket.trim() : rack.serverSocket;
  if (!nextSocket) return false;
  if (nextSocket !== rack.serverSocket && hasRackWithSocket(nextSocket)) return false;

  const prevSocket = rack.serverSocket;
  rack.serverSocket = nextSocket;
  if (typeof patch.name === "string") rack.name = patch.name.trim() || rack.name;
  if (typeof patch.note === "string") rack.note = patch.note;
  if (patch.tlsPolicy === "strict" || patch.tlsPolicy === "trust_fingerprint" || patch.tlsPolicy === "insecure") rack.tlsPolicy = patch.tlsPolicy;
  if (typeof patch.tlsFingerprint === "string") rack.tlsFingerprint = patch.tlsFingerprint;
  if (patch.notifyMode === "notify" || patch.notifyMode === "silent" || patch.notifyMode === "none") rack.notifyMode = patch.notifyMode;
  if (typeof patch.pinned === "boolean") rack.pinned = patch.pinned;

  sortRacksPinnedFirst();
  persist();

  if (currentServerSocket.value === prevSocket) setServerSocket(nextSocket);
  return true;
}

/**
 * 按 socket 移除 rack。
 *
 * 若被移除的 rack 当前处于激活态，则将剩余列表中的第一个 rack 设为激活。
 *
 * @param serverSocket - 要移除的 server socket。
 */
export function removeServer(serverSocket: string): void {
  const socket = serverSocket.trim();
  const next: ServerRack[] = [];
  for (const s of state.value.servers) {
    if (s.serverSocket !== socket) next.push(s);
  }
  state.value.servers = next;
  persist();
  if (currentServerSocket.value === socket) {
    setServerSocket(state.value.servers[0]?.serverSocket ?? "");
  }
}

/**
 * 按 id 移除 rack。
 *
 * @param id - 要移除的 rack id。
 */
export function removeServerById(id: string): void {
  const rack = findRackById(id);
  if (!rack) return;
  removeServer(rack.serverSocket);
}

/**
 * 切换 rack 的 pinned 标记，并保持 pinned rack 排在前面。
 *
 * @param serverSocket - 目标 server socket。
 */
export function togglePinServer(serverSocket: string): void {
  const socket = serverSocket.trim();
  const item = findRackBySocket(socket);
  if (!item) return;
  item.pinned = !item.pinned;
  sortRacksPinnedFirst();
  persist();
}

/**
 * 按 id 切换 rack 的 pinned 标记。
 *
 * @param id - rack id。
 */
export function togglePinServerById(id: string): void {
  const item = findRackById(id);
  if (!item) return;
  togglePinServer(item.serverSocket);
}
