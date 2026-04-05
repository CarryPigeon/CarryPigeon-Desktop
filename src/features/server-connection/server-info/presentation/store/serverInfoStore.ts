/**
 * @fileoverview server-info 子域展示层状态缓存 store
 * @description
 * server-connection/server-info｜按 serverSocket 缓存服务器信息的响应式 store。
 *
 * 核心职责：
 * - 为每个 serverSocket 维护独立的服务器信息缓存（info/loading/error 状态）
 * - 提供 Vue 响应式引用供 UI 组件直接消费
 * - 自动处理服务器作用域清理（切换服务器时清除对应缓存）
 *
 * 设计约束（PRD）：
 * - `server_id` 用于插件隔离（详见 `docs/design/protocol/PROTOCOL-OVERVIEW.md`）
 * - 若 `server_id` 缺失，则必须禁用插件安装/启用/更新，并在 UI 给出原因提示
 *
 * 重构说明：
 * - 原来直接依赖低层领域入口 `getGetServerInfoUsecase`，现在改为通过 capability 统一访问
 * - 遵循"优先走 capability 入口"的架构原则，减少对低层实现细节的直接依赖
 */

import { ref, type Ref } from "vue";
import type { ServerInfo } from "../../domain/types/serverInfo";
import { getServerInfoCapabilities } from "../../api"; // 通过 capability 统一入口访问
import { createLogger } from "@/shared/utils/logger";
import { getOrCreateServerScopedStore } from "@/shared/utils/scopedStoreCache";
import { registerServerScopeCleanupHandler } from "@/shared/utils/serverScopeLifecycle";

/**
 * server-info store 接口定义
 *
 * 提供服务器信息的响应式状态和刷新操作：
 * - info: 当前服务器信息快照（可为 null 表示未获取）
 * - loading: 是否正在刷新中
 * - error: 刷新失败时的错误信息
 * - refresh: 手动触发刷新方法
 */
export type ServerInfoStore = {
  info: Readonly<Ref<ServerInfo | null>>;
  loading: Readonly<Ref<boolean>>;
  error: Readonly<Ref<string>>;
  refresh(): Promise<void>;
};

const logger = createLogger("serverInfoStore");
/** 所有 store 实例的缓存（按 serverSocket 分组） */
const stores = new Map<string, ServerInfoStore>();
/** 运行时启动标志（支持幂等启动） */
let runtimeStarted = false;
/** 清理处理器注销函数 */
let unregisterServerScopeCleanupHandler: (() => void) | null = null;

/**
 * 获取 server-info capability 单例
 *
 * 内部工具方法，统一通过 capability 入口访问 server-info 能力
 * 避免直接依赖低层领域层入口
 */
function getCapabilities() {
  return getServerInfoCapabilities();
}

/**
 * 启动 server-info 运行时（幂等操作）。
 *
 * 设计说明：
 * - 显式启动，避免模块加载时就注册清理处理器带来的副作用
 * - 幂等保证：重复调用不会重复注册
 */
export function startServerInfoRuntime(): void {
  if (runtimeStarted) return;
  runtimeStarted = true;
  // 注册服务器作用域清理回调，切换服务器时自动清除对应缓存
  unregisterServerScopeCleanupHandler = registerServerScopeCleanupHandler((event) => {
    if (event.type === "all") {
      stores.clear();
      return;
    }
    stores.delete(event.key);
  });
}

/**
 * 停止 server-info 运行时（尽力而为停止）。
 *
 * 清理所有缓存并注销清理处理器
 */
export function stopServerInfoRuntime(): void {
  if (!runtimeStarted) return;
  runtimeStarted = false;
  if (unregisterServerScopeCleanupHandler) {
    unregisterServerScopeCleanupHandler();
    unregisterServerScopeCleanupHandler = null;
  }
  stores.clear();
}

/**
 * 获取（或创建）指定 serverSocket 的缓存 server info store。
 *
 * 这是主要入口方法，使用缓存策略：
 * - 如果对应 serverSocket 已有 store 实例，直接返回缓存
 * - 如果没有，创建新实例并缓存
 *
 * @param serverSocket - 目标服务器的 socket 字符串（地址）
 * @returns 对应 serverSocket 的 store 实例
 */
export function useServerInfoStore(serverSocket: string): ServerInfoStore {
  return getOrCreateServerScopedStore(stores, serverSocket, () => {
    const info = ref<ServerInfo | null>(null);
    const loading = ref(false);
    const error = ref("");

    /**
     * 刷新指定服务器信息。
     *
     * 通过 capability 统一入口获取最新服务器信息，更新本地响应式状态。
     * 刷新完成后（无论成功失败）都会更新 loading/error/info 状态。
     *
     * @returns Promise<void> 刷新完成 Promise
     */
    async function refresh(): Promise<void> {
      const socket = serverSocket.trim();
      if (!socket) {
        info.value = null;
        error.value = "Missing server socket";
        return;
      }
      loading.value = true;
      error.value = "";
      try {
        // 通过 capability 统一入口刷新，不直接依赖低层 usecase
        await getCapabilities().refresh(socket);
        // 刷新完成后从 capability 获取最新快照更新到本地状态
        info.value = getCapabilities().getSnapshot(socket);
      } catch (e) {
        logger.error("Action: servers_info_refresh_failed", { socket, error: String(e) });
        info.value = null;
        error.value = String(e);
      } finally {
        loading.value = false;
      }
    }

    const store: ServerInfoStore = { info, loading, error, refresh };
    return store;
  });
}
