/**
 * @fileoverview server-connection Feature 对外公共 API。
 * @description
 * `server-connection` 负责“当前服务器工作区”的选择、连接、server-info 与本地 scope 生命周期。
 *
 * 公共面分层：
 * - capability-first：`createServerConnectionCapabilities()` / `getServerConnectionCapabilities()`；
 * - 首选高层公开入口：`workspace/*`，面向大多数跨 feature 调用；
 * - 目录管理与本地清理通过 `rack/*`、`scopeLifecycle/*` 分组补充；
 * - 稳定公共类型：统一从 `./api-types` 引入，避免调用方深路径依赖子域实现。
 */

import { createConnectivityCapabilities } from "./connectivity/api";
import { createRackCapabilities } from "./rack/api";
import { createScopeLifecycleCapabilities } from "./scope-lifecycle/api";
import { createServerInfoCapabilities } from "./server-info/api";
import { createServerWorkspaceCapabilities } from "./workspace/api";
import { createRuntimeLeaseController } from "@/shared/utils/runtimeLease";
import type {
  ServerConnectionCapabilities,
} from "./api-types";

/**
 * 创建 server-connection capability 对象。
 *
 * 说明：
 * - capability 以“当前 server workspace”语义分组，优先提供高层入口；
 * - `rack` / `scopeLifecycle` 仅补充跨 feature 确实需要的最小目录管理与清理能力。
 */
export function createServerConnectionCapabilities(): ServerConnectionCapabilities {
  const connectivityCapabilities = createConnectivityCapabilities();
  const rackCapabilities = createRackCapabilities();
  const scopeLifecycleCapabilities = createScopeLifecycleCapabilities();
  const serverInfoCapabilities = createServerInfoCapabilities();
  const serverWorkspaceCapabilities = createServerWorkspaceCapabilities();

  async function startServerConnectionRuntime(): Promise<void> {
    rackCapabilities.startRuntime();
    serverInfoCapabilities.startRuntime();
    try {
      await connectivityCapabilities.startRuntime();
    } catch (error) {
      await Promise.allSettled([
        connectivityCapabilities.stopRuntime(),
        Promise.resolve().then(() => serverInfoCapabilities.stopRuntime()),
        Promise.resolve().then(() => rackCapabilities.stopRuntime()),
      ]);
      throw error;
    }
  }

  async function stopServerConnectionRuntime(): Promise<void> {
    await Promise.allSettled([
      connectivityCapabilities.stopRuntime(),
      Promise.resolve().then(() => serverInfoCapabilities.stopRuntime()),
      Promise.resolve().then(() => rackCapabilities.stopRuntime()),
    ]);
  }
  const runtimeLeaseController = createRuntimeLeaseController({
    start: startServerConnectionRuntime,
    stop: stopServerConnectionRuntime,
  });

  return {
    runtime: {
      acquireLease() {
        return runtimeLeaseController.acquireLease();
      },
    },
    workspace: {
      getSnapshot: serverWorkspaceCapabilities.getSnapshot,
      observeSnapshot: serverWorkspaceCapabilities.observeSnapshot,
      readSocket: serverWorkspaceCapabilities.readSocket,
      readInfo: serverWorkspaceCapabilities.readInfo,
      listDirectory: serverWorkspaceCapabilities.listDirectory,
      readTlsPolicy: serverWorkspaceCapabilities.readTlsPolicy,
      selectSocket: serverWorkspaceCapabilities.selectSocket,
      activate: serverWorkspaceCapabilities.activate,
      connect: serverWorkspaceCapabilities.connect,
      retryConnect: serverWorkspaceCapabilities.retryConnect,
      refreshInfo: serverWorkspaceCapabilities.refreshInfo,
    },
    rack: {
      addServer: rackCapabilities.addServer,
    },
    scopeLifecycle: {
      registerCleanupHandler: scopeLifecycleCapabilities.registerCleanupHandler,
    },
  };
}

let cachedServerConnectionCapabilities: ServerConnectionCapabilities | null = null;

/**
 * 获取应用级共享 server-connection capability 对象。
 */
export function getServerConnectionCapabilities(): ServerConnectionCapabilities {
  if (!cachedServerConnectionCapabilities) {
    cachedServerConnectionCapabilities = createServerConnectionCapabilities();
  }
  return cachedServerConnectionCapabilities;
}
