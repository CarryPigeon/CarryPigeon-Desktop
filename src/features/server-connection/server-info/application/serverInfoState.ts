/**
 * @fileoverview server-info 子域应用层门面
 * @description
 * 收敛 server-info 子域的运行时管理与快照读取能力，提供简洁的面向 capability 的接口。
 *
 * 设计作用：
 * - 隔离展示层 store 实现细节，避免 capability 直接依赖 Vue 响应式 API
 * - 提供 plain function 风格的接口，适配 capability 契约
 * - 统一入口，简化上层调用
 */

import type { ServerInfo } from "../domain/types/serverInfo";
import {
  startServerInfoRuntime,
  stopServerInfoRuntime,
  useServerInfoStore,
} from "../presentation/store/serverInfoStore";

/**
 * 内部工具方法：获取指定 socket 的 store 实例
 *
 * @param serverSocket - 服务器 socket 地址
 * @returns 对应 store 实例
 */
function getServerInfoStore(serverSocket: string) {
  return useServerInfoStore(serverSocket);
}

/**
 * 启动 server-info 状态管理运行时
 *
 * 必须调用此方法才能启用缓存自动清理功能。
 * 幂等操作，重复调用无副作用。
 */
export function startServerInfoStateRuntime(): void {
  startServerInfoRuntime();
}

/**
 * 停止 server-info 状态管理运行时
 *
 * 清理所有缓存并注销清理处理器。
 */
export function stopServerInfoStateRuntime(): void {
  stopServerInfoRuntime();
}

/**
 * 刷新指定服务器的信息
 *
 * 从远程服务器获取最新的 /api/server 信息并更新缓存。
 *
 * @param serverSocket - 目标服务器 socket 地址
 * @returns 刷新完成 Promise
 */
export function refreshServerInfo(serverSocket: string): Promise<void> {
  return getServerInfoStore(serverSocket).refresh();
}

/**
 * 获取指定服务器当前缓存的信息快照
 *
 * @param serverSocket - 目标服务器 socket 地址
 * @returns 服务器信息快照，未获取时返回 null
 */
export function getServerInfoSnapshot(serverSocket: string): ServerInfo | null {
  return getServerInfoStore(serverSocket).info.value;
}

/**
 * 获取指定服务器当前刷新状态（是否正在加载）
 *
 * @param serverSocket - 目标服务器 socket 地址
 * @returns true 表示正在刷新，false 表示空闲
 */
export function getServerInfoLoading(serverSocket: string): boolean {
  return getServerInfoStore(serverSocket).loading.value;
}

/**
 * 获取指定服务器刷新失败后的错误信息
 *
 * @param serverSocket - 目标服务器 socket 地址
 * @returns 错误信息字符串，无错误时返回空字符串
 */
export function getServerInfoError(serverSocket: string): string {
  return getServerInfoStore(serverSocket).error.value;
}
