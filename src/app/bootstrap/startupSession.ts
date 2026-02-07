/**
 * @fileoverview startupSession.ts
 * @description 应用启动编排：默认服务器选择与会话恢复。
 */

import type { Router } from "vue-router";
import { currentServerSocket, serverRacks, setServerSocket, useServerInfoStore } from "@/features/servers/api";
import { getGetCurrentUserUsecase, setCurrentUser } from "@/features/user/api";
import { connectWithRetry } from "@/features/network/api";
import { isApiRequestError } from "@/shared/net/http/apiErrors";
import { IS_STORE_MOCK } from "@/shared/config/runtime";
import { MOCK_PLUGIN_CATALOG } from "@/shared/mock/mockPluginCatalog";
import { getMockPluginsState } from "@/shared/mock/mockPluginState";
import { getPluginManagerPort } from "@/features/plugins/api";
import { setMissingRequiredPlugins } from "@/features/auth/api";
import { readAuthSession, writeAuthSession } from "@/shared/utils/localState";

/**
 * 启动时选择一个合理的默认 server socket。
 *
 * @returns 无返回值。
 */
export function ensureInitialServerSocket(): void {
  if (currentServerSocket.value.trim()) return;
  const racks = serverRacks.value;
  if (!Array.isArray(racks) || racks.length === 0) return;
  const pinned = racks.find((r) => Boolean(r.pinned)) ?? null;
  const socket = String(pinned?.serverSocket ?? racks[0]?.serverSocket ?? "").trim();
  if (socket) setServerSocket(socket);
}

/**
 * 启动时尝试恢复登录会话（best-effort）。
 *
 * @param router - 应用路由实例。
 * @returns 无返回值。
 */
export async function tryRestoreSession(router: Router): Promise<void> {
  const socket = currentServerSocket.value.trim();
  if (!socket) return;

  await connectWithRetry(socket, { maxAttempts: 3 });

  const serverInfoStore = useServerInfoStore(socket);
  try {
    await serverInfoStore.refresh();
  } catch {
    // 忽略 server-info 刷新失败：在 mock/protocol 模式下会话恢复仍可能成功。
  }

  try {
    if (IS_STORE_MOCK) {
      const required = MOCK_PLUGIN_CATALOG.filter((p) => p.required).map((p) => p.pluginId);
      const st = getMockPluginsState(socket);
      const missing = required.filter((id) => !(st[id]?.enabled && st[id]?.status === "ok"));
      if (missing.length > 0) {
        setMissingRequiredPlugins(missing);
        if (router.currentRoute.value.path !== "/required-setup") void router.replace("/required-setup");
        return;
      }
    } else {
      const requiredIds = serverInfoStore.info.value?.requiredPlugins ?? [];
      if (Array.isArray(requiredIds) && requiredIds.length > 0) {
        const installed = await getPluginManagerPort().listInstalled(socket);
        const ok = new Set(
          installed
            .filter((p) => Boolean(p.enabled) && p.status === "ok" && Boolean(p.currentVersion))
            .map((p) => p.pluginId),
        );
        const missing = requiredIds.map((x) => String(x).trim()).filter(Boolean).filter((id) => !ok.has(id));
        if (missing.length > 0) {
          setMissingRequiredPlugins(missing);
          if (router.currentRoute.value.path !== "/required-setup") void router.replace("/required-setup");
          return;
        }
      }
    }
  } catch {
    // 若 required-gate 校验失败，仍允许继续尝试恢复会话；必要时由服务端再次强制。
  }

  const session = readAuthSession(socket);
  const accessToken = session?.accessToken ?? "";
  if (!accessToken.trim()) return;

  try {
    const me = await getGetCurrentUserUsecase(socket).execute(accessToken);
    setCurrentUser({
      id: String(me.uid ?? "").trim(),
      username: String(me.nickname ?? "").trim() || String(me.email ?? "").split("@")[0] || "Operator",
      email: String(me.email ?? "").trim(),
      description: "",
    });
    if (!session?.uid || session.uid !== me.uid) {
      writeAuthSession(socket, { ...(session ?? { accessToken, refreshToken: "" }), uid: String(me.uid ?? "").trim() });
    }

    if (router.currentRoute.value.path === "/") {
      void router.replace("/chat");
    }
  } catch (e) {
    if (isApiRequestError(e) && (e.status === 401 || e.status === 403)) {
      writeAuthSession(socket, null);
      setCurrentUser({ id: "", username: "", email: "", description: "" });
      return;
    }
    // 其他错误：保持在登录页，允许用户手动重试。
  }
}

