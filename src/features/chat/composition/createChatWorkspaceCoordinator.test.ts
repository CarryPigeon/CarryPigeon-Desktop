/**
 * @fileoverview chat workspace coordinator 单元测试。
 */

import { describe, expect, it, vi } from "vitest";
import { createChatWorkspaceCoordinator, type ChatWorkspaceCoordinatorDeps } from "./createChatWorkspaceCoordinator";

function createDeps(overrides?: Partial<ChatWorkspaceCoordinatorDeps>): ChatWorkspaceCoordinatorDeps {
  return {
    workspace: {
      getCurrentSocket: () => "http://127.0.0.1:8080",
      switchWorkspace: vi.fn(async () => ({
        ok: true as const,
        kind: "server_workspace_activated" as const,
        serverSocket: "http://127.0.0.1:8080",
        connected: true,
        infoRefreshed: true,
      })),
    },
    plugins: {
      attachPluginHostBridge: vi.fn(),
      refreshCatalog: vi.fn(async () => undefined),
      refreshDomainCatalog: vi.fn(async () => undefined),
      refreshRequiredPluginsState: vi.fn(async () => undefined),
      ensureRuntime: vi.fn(async () => undefined),
      detachBridge: vi.fn(),
    },
    session: {
      ensureChatReady: vi.fn(async () => undefined),
    },
    ...overrides,
  };
}

describe("createChatWorkspaceCoordinator", () => {
  it("rejects bootstrap when the current socket is missing", async () => {
    const coordinator = createChatWorkspaceCoordinator(
      createDeps({
        workspace: {
          getCurrentSocket: () => "",
          switchWorkspace: vi.fn(async () => ({
            ok: true as const,
            kind: "server_workspace_activated" as const,
            serverSocket: "",
            connected: false,
            infoRefreshed: false,
          })),
        },
      }),
    );
    const outcome = await coordinator.bootstrapCurrentWorkspace();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe("missing_workspace_socket");
  });

  it("still bootstraps chat when optional plugin steps fail", async () => {
    const session = { ensureChatReady: vi.fn(async () => undefined) };
    const coordinator = createChatWorkspaceCoordinator(
      createDeps({
        plugins: {
          attachPluginHostBridge: vi.fn(),
          refreshCatalog: vi.fn(async () => {
            throw new Error("Tauri runtime unavailable");
          }),
          refreshDomainCatalog: vi.fn(async () => {
            throw new Error("catalog failed");
          }),
          refreshRequiredPluginsState: vi.fn(async () => {
            throw new Error("required state failed");
          }),
          ensureRuntime: vi.fn(async () => {
            throw new Error("runtime failed");
          }),
          detachBridge: vi.fn(),
        },
        session,
      }),
    );
    const outcome = await coordinator.bootstrapCurrentWorkspace();
    expect(outcome).toEqual({
      ok: true,
      kind: "chat_workspace_bootstrapped",
      serverSocket: "http://127.0.0.1:8080",
    });
    expect(session.ensureChatReady).toHaveBeenCalledTimes(1);
  });

  it("rejects bootstrap when ensuring chat session readiness fails", async () => {
    const coordinator = createChatWorkspaceCoordinator(
      createDeps({
        session: {
          ensureChatReady: vi.fn(async () => {
            throw new Error("channels failed");
          }),
        },
      }),
    );
    const outcome = await coordinator.bootstrapCurrentWorkspace();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe("chat_session_ready_failed");
  });
});
