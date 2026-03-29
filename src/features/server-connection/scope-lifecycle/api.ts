/**
 * @fileoverview server-connection/scope-lifecycle 对外 API。
 * @description
 * 暴露当前 server workspace 的本地生命周期操作。
 *
 * 说明：
 * - `scope-lifecycle` 负责“离开某个 server scope 时本地需要清什么”；
 * - 不负责 server 选择、连接状态或 server-info 查询。
 */

import { ClearCurrentServerWorkspace } from "./application/ClearCurrentServerWorkspace";
import {
  registerCurrentServerWorkspaceCleanupHandler,
  type CurrentServerWorkspaceCleanupHandler,
} from "./application/currentServerWorkspaceCleanupHandlers";

export type ScopeLifecycleCapabilities = {
  clearCurrentWorkspace(serverSocket: string): Promise<void>;
  registerCleanupHandler(handler: CurrentServerWorkspaceCleanupHandler): () => void;
};

/**
 * 获取清理当前 server workspace 的用例实例。
 */
function getClearCurrentServerWorkspaceUsecase(): ClearCurrentServerWorkspace {
  return new ClearCurrentServerWorkspace();
}

/**
 * 创建 scope-lifecycle 子域能力对象。
 */
export function createScopeLifecycleCapabilities(): ScopeLifecycleCapabilities {
  return {
    clearCurrentWorkspace: (serverSocket: string) => {
      return getClearCurrentServerWorkspaceUsecase().execute(serverSocket);
    },
    registerCleanupHandler: (handler: CurrentServerWorkspaceCleanupHandler) => {
      return registerCurrentServerWorkspaceCleanupHandler(handler);
    },
  };
}

let scopeLifecycleCapabilitiesSingleton: ScopeLifecycleCapabilities | null = null;

/**
 * 获取 scope-lifecycle 子域共享能力对象。
 */
export function getScopeLifecycleCapabilities(): ScopeLifecycleCapabilities {
  scopeLifecycleCapabilitiesSingleton ??= createScopeLifecycleCapabilities();
  return scopeLifecycleCapabilitiesSingleton;
}

export type { CurrentServerWorkspaceCleanupHandler };
