/**
 * @fileoverview chat workspace coordinator
 * @description
 * 收敛 chat 当前工作区的启动、切服、插件桥接与依赖刷新链路，避免页面层手工编排跨 feature 调用顺序。
 */

import type { ServerWorkspaceActivationOutcome } from "@/features/server-connection/api-types";

export type ChatWorkspacePort = {
  getCurrentSocket(): string;
  switchWorkspace(serverSocket: string): Promise<ServerWorkspaceActivationOutcome>;
};

export type ChatPluginRuntimePort = {
  attachPluginHostBridge(): void;
  refreshCatalog(): Promise<void>;
  refreshDomainCatalog(serverSocket: string): Promise<void>;
  refreshRequiredPluginsState(): Promise<void>;
  ensureRuntime(serverSocket: string): Promise<void>;
  detachBridge(): void;
};

export type ChatSessionBootstrapPort = {
  ensureChatReady(): Promise<void>;
};

export type ChatWorkspaceCoordinatorDeps = {
  workspace: ChatWorkspacePort;
  plugins: ChatPluginRuntimePort;
  session: ChatSessionBootstrapPort;
  onAsyncError(action: string, error: unknown): void;
};

export type ChatWorkspaceCoordinator = {
  bootstrapCurrentWorkspace(): Promise<void>;
  switchWorkspace(serverSocket: string): void;
  syncBridgeForCurrentSocket(): void;
  dispose(): void;
};

/**
 * 构建 chat 工作区协调器。
 */
export function createChatWorkspaceCoordinator(deps: ChatWorkspaceCoordinatorDeps): ChatWorkspaceCoordinator {
  async function runWorkspacePipeline(serverSocket: string): Promise<boolean> {
    const socket = String(serverSocket ?? "").trim();
    if (!socket) return false;
    const activationOutcome = await deps.workspace.switchWorkspace(socket);
    if (!activationOutcome.ok) {
      deps.onAsyncError("chat_switch_server_rejected", activationOutcome.error);
      return false;
    }
    await deps.plugins.refreshCatalog();
    await deps.plugins.refreshDomainCatalog(socket);
    await deps.plugins.refreshRequiredPluginsState();
    await deps.plugins.ensureRuntime(socket);
    await deps.session.ensureChatReady();
    return true;
  }

  function syncBridgeForCurrentSocket(): void {
    deps.plugins.attachPluginHostBridge();
  }

  async function bootstrapCurrentWorkspace(): Promise<void> {
    syncBridgeForCurrentSocket();
    await runWorkspacePipeline(deps.workspace.getCurrentSocket());
  }

  function switchWorkspace(serverSocket: string): void {
    syncBridgeForCurrentSocket();
    void runWorkspacePipeline(serverSocket).catch((error) => {
      deps.onAsyncError("chat_switch_server_failed", error);
    });
  }

  function dispose(): void {
    deps.plugins.detachBridge();
  }

  return {
    bootstrapCurrentWorkspace,
    switchWorkspace,
    syncBridgeForCurrentSocket,
    dispose,
  };
}
