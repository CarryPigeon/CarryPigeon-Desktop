/**
 * @fileoverview 从持久化机架状态恢复当前 server socket。
 * @description
 * 旧版本只持久化机架列表、不持久化当前选中项。
 * 恢复规则：优先已记录的 currentServerSocket（且仍存在于列表中），否则回退到置顶项或第一项。
 */

import type { StoredServerRacksState } from "./types/serverRackTypes";

/**
 * 从持久化机架状态解析应激活的 server socket。
 *
 * @param state - 已读取的机架持久化状态。
 * @returns 规范化后的 socket；没有任何可用机架时返回空字符串。
 */
export function resolvePersistedCurrentSocket(state: StoredServerRacksState): string {
  const servers = Array.isArray(state.servers) ? state.servers : [];
  const persisted = String(state.currentServerSocket ?? "").trim();
  if (persisted) {
    const stillExists = servers.some((rack) => String(rack.serverSocket ?? "").trim() === persisted);
    if (stillExists) return persisted;
  }
  const pinned = servers.find((rack) => Boolean(rack.pinned));
  return String(pinned?.serverSocket ?? servers[0]?.serverSocket ?? "").trim();
}
