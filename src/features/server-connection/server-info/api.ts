/**
 * @fileoverview server-info 子域 capability 对外 API
 * @description
 * server-info 子域是 server-connection 的低层子域，负责按 serverSocket 获取并缓存 `/api/server` 接口响应。
 *
 * 核心职责：
 * - 从目标服务器获取服务器基本信息（serverId、requiredPlugins、capabilities 等）
 * - 按 serverSocket 缓存获取结果，避免重复请求
 * - 提供 loading/error 状态跟踪
 *
 * 架构说明：
 * - `server-info` 只负责按 socket 维度处理，不关心"当前激活哪个 workspace"
 * - "当前 workspace" 的语义由上层 `workspace/api.ts` 处理
 * - 跨 feature 消费优先通过 `workspace` capability，而非直接使用此入口
 * - 仅当确实需要按任意 socket 维度查询时（多服务器同时展示场景），才直接使用此 capability
 */

import type { ServerInfo } from "./domain/types/serverInfo";
import {
  getServerInfoError,
  getServerInfoLoading,
  getServerInfoSnapshot,
  refreshServerInfo,
  startServerInfoStateRuntime,
  stopServerInfoStateRuntime,
} from "./application/serverInfoState";

/**
 * server-info 子域 capability 接口契约
 *
 * 定义了 server-info 提供的所有能力：
 * - 运行生命周期管理（start/stop）
 * - 刷新指定服务器信息
 * - 查询当前缓存快照、加载状态、错误信息
 */
export type ServerInfoCapabilities = {
  /** 启动运行时，必须调用后才能正常工作 */
  startRuntime(): void;
  /** 停止运行时，清理资源 */
  stopRuntime(): void;
  /** 刷新指定服务器信息，从远程获取最新数据 */
  refresh(serverSocket: string): Promise<void>;
  /** 获取指定服务器当前缓存的信息快照 */
  getSnapshot(serverSocket: string): ServerInfo | null;
  /** 获取指定服务器是否正在刷新中 */
  getLoading(serverSocket: string): boolean;
  /** 获取指定服务器刷新失败的错误信息 */
  getError(serverSocket: string): string;
};

/**
 * 创建 server-info 子域能力对象实例
 *
 * 遵循 capability-first 设计原则，每次调用创建新实例。
 * 应用级通常使用单例 `getServerInfoCapabilities()`。
 *
 * @returns 新的 capability 实例
 */
export function createServerInfoCapabilities(): ServerInfoCapabilities {
  return {
    startRuntime: startServerInfoStateRuntime,
    stopRuntime: stopServerInfoStateRuntime,
    refresh: refreshServerInfo,
    getSnapshot: getServerInfoSnapshot,
    getLoading: getServerInfoLoading,
    getError: getServerInfoError,
  };
}

/** 应用级共享 capability 单例 */
let serverInfoCapabilitiesSingleton: ServerInfoCapabilities | null = null;

/**
 * 获取应用级共享的 server-info 子域能力对象（单例模式）
 *
 * 大多数场景使用此单例入口即可，无需重复创建实例。
 * 首次调用会自动惰性初始化。
 *
 * @returns 共享的 capability 单例
 */
export function getServerInfoCapabilities(): ServerInfoCapabilities {
  serverInfoCapabilitiesSingleton ??= createServerInfoCapabilities();
  return serverInfoCapabilitiesSingleton;
}
