/**
 * @fileoverview app session startup process.
 * @description
 * 收敛应用启动时的默认 server 选择、required-gate 检查与用户会话恢复。
 */

import type { Router } from "vue-router";
import { getServerConnectionCapabilities } from "@/features/server-connection/api";
import { getAccountCapabilities } from "@/features/account/api";
import { isApiRequestError } from "@/shared/net/http/apiErrors";
import { IS_STORE_MOCK, MOCK_DISABLE_REQUIRED_GATE } from "@/shared/config/runtime";
import { MOCK_PLUGIN_CATALOG } from "@/shared/mock/mockPluginCatalog";
import { getMockPluginsState } from "@/shared/mock/mockPluginState";
import { readAuthSession, writeAuthSession, type AuthSession } from "@/shared/utils/localState";
import { ensureSecureChatCacheReady } from "@/shared/utils/chatSecureCache";
import { ensureValidAuthSession, forceRefreshAuthSession } from "@/shared/net/auth/api";
import { createLogger } from "@/shared/utils/logger";
import { setStartupPhaseLabel } from "@/app/bootstrap/startupState";
import { syncCurrentUserWithRefresh, mergeUidIntoSession } from "./currentUserRestore";

const serverConnectionCapabilities = getServerConnectionCapabilities();
const accountCapabilities = getAccountCapabilities();
const logger = createLogger("appSessionProcess");

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
    const outcome = await accountCapabilities.forServer(serverSocket).checkRequiredSetup();
    if (!outcome.ok) return false;
    if (outcome.kind !== "required_setup_required") return false;
    accountCapabilities.authFlow.updateMissingRequiredPlugins([...outcome.missingPluginIds]);
    redirectToRequiredSetup(router);
    return true;
  } catch {
    return false;
  }
}

/**
 * 判定异常是否为“会话鉴权失败”（HTTP 401/403）。
 *
 * 兼容两类错误来源：统一网络层的 `ApiRequestError`，以及 profile 域包装后的错误对象。
 *
 * @param error - 待判定的异常。
 * @returns 鉴权失败时返回 `true`。
 */
function isSessionAuthFailure(error: unknown): boolean {
  if (isApiRequestError(error)) return error.status === 401 || error.status === 403;
  if (!accountCapabilities.profileErrors.isProfileError(error)) return false;
  const status = typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : null;
  return status === 401 || status === 403;
}

async function restoreCurrentUserFromSession(router: Router, serverSocket: string): Promise<void> {
  // 会话存放在加密缓存里：`readAuthSession` 读的是同步内存缓存，而缓存水合是启动时的
  // 异步流程（main.ts fire-and-forget）。这里先等待水合完成，避免“启动早于水合”时
  // 读到空会话而静默丢失登录态（该函数幂等，已就绪时立即返回）。
  try {
    await ensureSecureChatCacheReady();
  } catch (error) {
    // 水合失败（如 Rust 侧命令异常）不阻塞启动：退化为“读不到会话”，后续启动重试。
    logger.warn("Action: auth_session_cache_hydrate_failed", { error: String(error) });
  }

  // access token 可能已过期：`ensureValidAuthSession` 会在临近/超过过期时间时先刷新。
  const session = await ensureValidAuthSession(serverSocket);
  const accessToken = String(session?.accessToken ?? "").trim();
  if (!accessToken) return;
  // 归一化当前会话：access token 以刷新结果为准（存储中可能仍是旧值）。
  const currentSession: AuthSession = {
    accessToken,
    refreshToken: String(session?.refreshToken ?? ""),
    uid: session?.uid,
    expiresAtMs: session?.expiresAtMs,
  };

  const outcome = await syncCurrentUserWithRefresh({
    initialAccessToken: accessToken,
    sync: (token) => accountCapabilities.forServer(serverSocket).syncCurrentUserSnapshot(token),
    refresh: async () => {
      const refreshed = await forceRefreshAuthSession(serverSocket);
      return String(refreshed?.accessToken ?? "").trim() || null;
    },
    isAuthFailure: isSessionAuthFailure,
  });

  if (!outcome.ok) {
    // 非鉴权错误（网络不可达等）：保留本地会话，等下次启动/连接成功后再恢复。
    if (!outcome.authFailure) return;
    // 刷新后仍鉴权失败：凭证确实失效，清空本地会话避免反复失败。
    try {
      await writeAuthSession(serverSocket, null);
    } catch (error) {
      logger.warn("Action: auth_session_clear_failed", {
        serverSocket,
        error: String(error),
      });
    }
    accountCapabilities.currentUser.clearSnapshot();
    return;
  }

  // 回写 uid：后续启动可据此判断是否需要重新同步用户快照。
  //
  // 必须重新读取存储中的会话，而不是复用进入时的快照——刷新成功后存储里已经是新的
  // access/refresh token，用旧快照回写会把刚刷新的凭证覆盖掉（见 mergeUidIntoSession）。
  const nextCurrentUser = outcome.value;
  const sessionToWrite = mergeUidIntoSession(readAuthSession(serverSocket), currentSession, nextCurrentUser.id);
  if (sessionToWrite) {
    try {
      await writeAuthSession(serverSocket, sessionToWrite);
    } catch (error) {
      logger.warn("Action: auth_session_write_failed", {
        serverSocket,
        error: String(error),
      });
    }
  }

  if (router.currentRoute.value.path === "/") {
    void router.replace("/chat");
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
  if (!socket) {
    // 初次启动且未配置任何服务器：跳转登录页让用户配置服务器
    void router.replace("/login");
    return;
  }

  setStartupPhaseLabel("startup_phase_connect");
  if (!(await ensureServerConnectivity(socket))) return;

  setStartupPhaseLabel("startup_phase_required_setup");
  if (await redirectIfRequiredSetupNeeded(router, socket)) return;

  setStartupPhaseLabel("startup_phase_restore");
  await restoreCurrentUserFromSession(router, socket);
}
