/**
 * @fileoverview app session startup process.
 * @description
 * 收敛应用启动时的默认 server 选择、required-gate 检查与用户会话恢复。
 */

import type { Router } from "vue-router";
import { getAuthFlowCapabilities } from "@/features/account/auth-flow/api";
import { getServerConnectionCapabilities } from "@/features/server-connection/api";
import { getAccountCapabilities } from "@/features/account/api";
import { isApiRequestError } from "@/shared/net/http/apiErrors";
import { IS_STORE_MOCK, MOCK_DISABLE_REQUIRED_GATE } from "@/shared/config/runtime";
import { MOCK_PLUGIN_CATALOG } from "@/shared/mock/mockPluginCatalog";
import { getMockPluginsState } from "@/shared/mock/mockPluginState";
import { readAuthSession, writeAuthSession } from "@/shared/utils/localState";

const serverConnectionCapabilities = getServerConnectionCapabilities();
const accountCapabilities = getAccountCapabilities();
const authFlowCapabilities = getAuthFlowCapabilities();

function redirectToRequiredSetup(router: Router): void {
  if (router.currentRoute.value.path !== "/required-setup") void router.replace("/required-setup");
}

function collectMockMissingRequiredPluginIds(serverSocket: string): string[] {
  const required = MOCK_PLUGIN_CATALOG.filter((p) => p.required).map((p) => p.pluginId);
  const installedStateById = getMockPluginsState(serverSocket);
  return required.filter((id) => {
    const state = installedStateById[id];
    // 对于 mock catalog 中的 required 插件，如果没有存储状态，默认视为已启用且状态正常
    if (!state) return false;
    // 已有状态的情况下，才检查 enabled 和 status
    return !(state.enabled && state.status === "ok");
  });
}

async function ensureServerConnectivity(serverSocket: string): Promise<boolean> {
  const outcome = await serverConnectionCapabilities.workspace.activate(serverSocket, {
    connect: true,
    refreshInfo: true,
    connectOptions: { maxAttempts: 3 },
  });
  return outcome.ok;
}

async function redirectIfRequiredSetupNeeded(router: Router, serverSocket: string): Promise<boolean> {
  if (MOCK_DISABLE_REQUIRED_GATE) return false;
  try {
    const missing = IS_STORE_MOCK ? collectMockMissingRequiredPluginIds(serverSocket) : null;
    if (missing) {
      if (missing.length <= 0) return false;
      accountCapabilities.authFlow.updateMissingRequiredPlugins(missing);
      redirectToRequiredSetup(router);
      return true;
    }
    const outcome = await authFlowCapabilities.forServer(serverSocket).checkRequiredSetup();
    if (!outcome.ok) return false;
    if (outcome.kind !== "required_setup_required") return false;
    accountCapabilities.authFlow.updateMissingRequiredPlugins([...outcome.missingPluginIds]);
    redirectToRequiredSetup(router);
    return true;
  } catch {
    return false;
  }
}

async function restoreCurrentUserFromSession(router: Router, serverSocket: string): Promise<void> {
  const session = readAuthSession(serverSocket);
  const accessToken = session?.accessToken ?? "";
  if (!accessToken.trim()) return;

  try {
    const nextCurrentUser = await accountCapabilities.forServer(serverSocket).syncCurrentUserSnapshot(accessToken);
    if (!session?.uid || session.uid !== nextCurrentUser.id) {
      writeAuthSession(serverSocket, {
        ...(session ?? { accessToken, refreshToken: "" }),
        uid: nextCurrentUser.id,
      });
    }

    if (router.currentRoute.value.path === "/") {
      void router.replace("/chat");
    }
  } catch (e) {
    let status: number | null = null;
    if (isApiRequestError(e)) {
      status = e.status;
    } else if (accountCapabilities.profileErrors.isProfileError(e) && typeof (e as { status?: unknown }).status === "number") {
      status = (e as { status: number }).status;
    }
    if (status === 401 || status === 403) {
      writeAuthSession(serverSocket, null);
      accountCapabilities.currentUser.clearSnapshot();
      return;
    }
  }
}

export function ensureInitialServerSelection(): void {
  if (serverConnectionCapabilities.workspace.readSocket()) return;
  const racks = serverConnectionCapabilities.workspace.listDirectory();
  if (!Array.isArray(racks) || racks.length === 0) return;
  const pinned = racks.find((rack) => Boolean(rack.pinned)) ?? null;
  const socket = String(pinned?.serverSocket ?? racks[0]?.serverSocket ?? "").trim();
  if (socket) serverConnectionCapabilities.workspace.selectSocket(socket);
}

export async function restoreStartupSession(router: Router): Promise<void> {
  const socket = serverConnectionCapabilities.workspace.readSocket();
  if (!socket) return;

  if (!(await ensureServerConnectivity(socket))) return;
  if (await redirectIfRequiredSetupNeeded(router, socket)) return;
  await restoreCurrentUserFromSession(router, socket);
}
