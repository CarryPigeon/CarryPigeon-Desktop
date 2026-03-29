/**
 * @fileoverview ClearCurrentServerWorkspace
 * @description server-connection/scope-lifecycle｜应用层用例：清理当前 server scope 本地数据。
 */

import { removeServerDb } from "@/shared/db";
import { clearMockPluginsState } from "@/shared/mock/mockPluginState";
import { forgetServerIdentity, getServerScopeKey } from "@/shared/serverIdentity";
import { clearAuthAndResumeState } from "@/shared/utils/localState";
import { createLogger, type Logger } from "@/shared/utils/logger";
import { refreshServerInfo } from "@/features/server-connection/server-info/application/serverInfoState";
import { selectRackSocket } from "@/features/server-connection/rack/application/rackDirectoryService";
import { ClearCurrentServerWorkspaceError } from "./ClearCurrentServerWorkspaceError";
import { clearCurrentServerWorkspaceFlow } from "./clearCurrentServerWorkspaceFlow";
import { runCurrentServerWorkspaceCleanupHandlers } from "./currentServerWorkspaceCleanupHandlers";

type ClearCurrentServerWorkspaceDeps = {
  logger: Pick<Logger, "warn">;
  refreshServerInfo(serverSocket: string): Promise<void>;
  clearLocalAuth(serverSocket: string): Promise<void> | void;
  clearMockPlugins(serverSocket: string, scopeKey: string): Promise<void> | void;
  removeServerDb(serverSocket: string): Promise<void> | void;
  forgetServerIdentity(serverSocket: string): Promise<void> | void;
  resetCurrentWorkspaceSelection(): Promise<void> | void;
  runPostClearHooks(): Promise<void> | void;
};

type ClearCurrentServerWorkspaceOptions = Partial<ClearCurrentServerWorkspaceDeps>;

function createDefaultDeps(): ClearCurrentServerWorkspaceDeps {
  return {
    logger: createLogger("ClearCurrentServerWorkspace"),
    refreshServerInfo,
    clearLocalAuth: (serverSocket: string) => clearAuthAndResumeState(serverSocket),
    clearMockPlugins: (serverSocket: string, scopeKey: string) => {
      clearMockPluginsState(serverSocket);
      if (scopeKey && scopeKey !== serverSocket) clearMockPluginsState(scopeKey);
    },
    removeServerDb: (serverSocket: string) => removeServerDb(serverSocket),
    forgetServerIdentity: (serverSocket: string) => forgetServerIdentity(serverSocket),
    resetCurrentWorkspaceSelection: () => selectRackSocket(""),
    runPostClearHooks: () => runCurrentServerWorkspaceCleanupHandlers(),
  };
}

/**
 * 清理当前 server scope 本地数据的应用层用例。
 */
export class ClearCurrentServerWorkspace {
  private readonly deps: ClearCurrentServerWorkspaceDeps;

  constructor(deps: ClearCurrentServerWorkspaceOptions = {}) {
    this.deps = { ...createDefaultDeps(), ...deps };
  }

  /**
   * 执行清理流程。
   */
  async execute(serverSocket: string): Promise<void> {
    const socket = String(serverSocket ?? "").trim();
    if (!socket) {
      throw new ClearCurrentServerWorkspaceError({
        code: "missing_server_socket",
        message: "Missing server socket.",
      });
    }
    const scopeKey = getServerScopeKey(socket);

    await clearCurrentServerWorkspaceFlow(this.buildFlowDeps(socket, scopeKey));
  }

  private buildFlowDeps(socket: string, scopeKey: string) {
    return {
      logger: this.deps.logger,
      refreshServerInfo: () => this.deps.refreshServerInfo(socket),
      clearLocalAuth: () => this.deps.clearLocalAuth(socket),
      clearMockPlugins: () => this.deps.clearMockPlugins(socket, scopeKey),
      removeServerDb: () => this.deps.removeServerDb(socket),
      forgetServerIdentity: () => this.deps.forgetServerIdentity(socket),
      resetCurrentWorkspaceSelection: () => this.deps.resetCurrentWorkspaceSelection(),
      runPostClearHooks: () => this.deps.runPostClearHooks(),
    };
  }
}
