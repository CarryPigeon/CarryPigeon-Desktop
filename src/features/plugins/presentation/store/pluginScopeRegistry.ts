/**
 * @fileoverview plugins｜展示层状态（store）：pluginScopeRegistry。
 * @description
 * 维护"每个 server_id 一个父 PluginScope、每个已加载插件实例一个子 scope"的作用域树注册表：
 *
 * - `serverId -> PluginScope`：服务器级父 scope，runtime 停止 / 服务器切换时整棵销毁；
 * - `serverId + pluginId + version -> PluginScope`：插件实例级子 scope，
 *   在插件 activate 前创建，disable / uninstall / switchVersion 移除实例时先销毁；
 * - 父 scope 销毁时会级联销毁其下全部子 scope（由 PluginScope 内核保证）。
 */

import { createPluginScope, type PluginScope } from "@/features/plugins/presentation/runtime/pluginScope";

/** 插件实例 scope 的复合 key（serverId + pluginId + version） */
export type PluginScopeKey = {
  serverId: string;
  pluginId: string;
  version: string;
};

/** 服务器父 scope 表：serverId -> scope */
const serverScopes = new Map<string, PluginScope>();
/** 插件实例子 scope 表：复合 key -> scope */
const pluginScopes = new Map<string, PluginScope>();

/** 归一化字符串（trim，空值返回空串） */
function normalize(value: string | undefined): string {
  return String(value ?? "").trim();
}

/** 生成插件实例 scope 的复合 key */
function toPluginScopeKeyString(key: PluginScopeKey): string {
  return `${normalize(key.serverId)}\n${normalize(key.pluginId)}\n${normalize(key.version)}`;
}

/**
 * 获取（或创建）服务器父 scope。
 *
 * @param serverId - 服务器 id（这里复用 registry store 的 server key）。
 * @returns 服务器父 scope。
 */
export function getOrCreateServerScope(serverId: string): PluginScope {
  const id = normalize(serverId);
  const existing = serverScopes.get(id);
  if (existing) return existing;
  const scope = createPluginScope(`server:${id || "<none>"}`);
  serverScopes.set(id, scope);
  return scope;
}

/**
 * 查询服务器父 scope（不创建）。
 *
 * @param serverId - 服务器 id。
 * @returns 已存在的父 scope；不存在时返回 `null`。
 */
export function getServerScope(serverId: string): PluginScope | null {
  return serverScopes.get(normalize(serverId)) ?? null;
}

/**
 * 获取（或创建）插件实例子 scope。
 *
 * 说明：
 * - 若同 key 的子 scope 已存在且未销毁，直接复用（幂等）；
 * - 若已销毁，则丢弃旧映射并基于当前父 scope 重建；
 * - 父 scope 已销毁时会先重建父 scope，保证树结构可用。
 *
 * @param key - 插件实例复合 key（serverId + pluginId + version）。
 * @returns 插件实例子 scope。
 */
export function getOrCreatePluginScope(key: PluginScopeKey): PluginScope {
  const keyStr = toPluginScopeKeyString(key);
  const existing = pluginScopes.get(keyStr);
  if (existing && !existing.disposed) return existing;

  const parent = getOrCreateServerScope(key.serverId);
  const scopeId = `plugin:${normalize(key.pluginId) || "<unknown>"}@${normalize(key.version) || "0.0.0"}`;
  const child = parent.disposed
    ? // 父 scope 意外已销毁：重建父树，避免把子 scope 挂到已死节点
      getOrCreateServerScopeForce(key.serverId).createChildScope(scopeId)
    : parent.createChildScope(scopeId);
  pluginScopes.set(keyStr, child);
  return child;
}

/**
 * 强制重建服务器父 scope（内部使用：旧父 scope 已销毁但表项仍残留时）。
 */
function getOrCreateServerScopeForce(serverId: string): PluginScope {
  const id = normalize(serverId);
  serverScopes.delete(id);
  return getOrCreateServerScope(id);
}

/**
 * 查询插件实例子 scope（不创建）。
 *
 * @param key - 插件实例复合 key（version 可传空串表示任意版本兜底）。
 * @returns 已存在的子 scope；不存在时返回 `null`。
 */
export function getPluginScope(key: PluginScopeKey): PluginScope | null {
  const version = normalize(key.version);
  if (version) {
    const exact = pluginScopes.get(toPluginScopeKeyString(key));
    if (exact) return exact;
  }
  // 未携带 version（或精确 key 未命中）时的兜底查询：返回该 server + plugin 下任意版本的 scope
  const prefix = `${normalize(key.serverId)}\n${normalize(key.pluginId)}\n`;
  for (const [keyStr, scope] of pluginScopes.entries()) {
    if (keyStr.startsWith(prefix)) return scope;
  }
  return null;
}

/**
 * 销毁单个插件实例子 scope（幂等；未创建时为 no-op）。
 *
 * @param key - 插件实例复合 key。
 */
export async function disposePluginScope(key: PluginScopeKey): Promise<void> {
  const keyStr = toPluginScopeKeyString(key);
  const scope = pluginScopes.get(keyStr);
  if (!scope) return;
  pluginScopes.delete(keyStr);
  await scope.dispose();
}

/**
 * 销毁某服务器下指定插件的全部版本 scope（disable / uninstall / switchVersion 场景兜底）。
 *
 * @param serverId - 服务器 id。
 * @param pluginId - 插件 id。
 */
export async function disposePluginScopesForPlugin(serverId: string, pluginId: string): Promise<void> {
  const prefix = `${normalize(serverId)}\n${normalize(pluginId)}\n`;
  const victims: PluginScope[] = [];
  for (const [keyStr, scope] of pluginScopes.entries()) {
    if (!keyStr.startsWith(prefix)) continue;
    pluginScopes.delete(keyStr);
    victims.push(scope);
  }
  for (const scope of victims) {
    await scope.dispose();
  }
}

/**
 * 销毁整棵服务器 scope 树（父 scope 级联销毁全部子 scope）。
 *
 * @param serverId - 服务器 id。
 */
export async function disposeServerScopeTree(serverId: string): Promise<void> {
  const id = normalize(serverId);
  const scope = serverScopes.get(id);
  if (!scope) return;
  // 先清理插件实例映射，避免残留已销毁 scope 的表项
  const prefix = `${id}\n`;
  for (const keyStr of pluginScopes.keys()) {
    if (keyStr.startsWith(prefix)) pluginScopes.delete(keyStr);
  }
  serverScopes.delete(id);
  await scope.dispose();
}

/**
 * 销毁全部服务器 scope 树（runtime 全局停止时使用）。
 */
export async function disposeAllServerScopeTrees(): Promise<void> {
  const scopes = Array.from(serverScopes.values());
  serverScopes.clear();
  pluginScopes.clear();
  for (const scope of scopes) {
    await scope.dispose();
  }
}

/**
 * 清空注册表映射（不触发 dispose；仅供测试 / 重置使用）。
 */
export function clearPluginScopeRegistry(): void {
  serverScopes.clear();
  pluginScopes.clear();
}
