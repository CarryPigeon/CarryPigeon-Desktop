/**
 * @fileoverview startupSession.ts
 * @description App startup orchestration: default server selection + session restore.
 */

import type { Router } from "vue-router";
import { currentServerSocket, serverRacks, setServerSocket, useServerInfoStore } from "@/features/servers/api";
import { getGetCurrentUserUsecase, setCurrentUser } from "@/features/user/api";
import { connectWithRetry } from "@/features/network/api";
import { isApiRequestError } from "@/shared/net/http/apiErrors";
import { IS_STORE_MOCK, MOCK_DISABLE_REQUIRED_GATE } from "@/shared/config/runtime";
import { MOCK_PLUGIN_CATALOG } from "@/shared/mock/mockPluginCatalog";
import { getMockPluginsState } from "@/shared/mock/mockPluginState";
import { getPluginManagerPort } from "@/features/plugins/api";
import { setMissingRequiredPlugins } from "@/features/auth/api";
import { readAuthSession, writeAuthSession } from "@/shared/utils/localState";

/**
 * Select a reasonable default server socket on startup.
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
 * Try to restore session on startup (best-effort).
 */
export async function tryRestoreSession(router: Router): Promise<void> {
  const socket = currentServerSocket.value.trim();
  if (!socket) return;

  await connectWithRetry(socket, { maxAttempts: 3 });

  const serverInfoStore = useServerInfoStore(socket);
  try {
    await serverInfoStore.refresh();
  } catch {
    // Ignore server-info refresh failures in mock/protocol mode.
  }

  if (!MOCK_DISABLE_REQUIRED_GATE) {
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
      // Ignore required-gate check failures during restore (best-effort).
    }
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
    // Keep login page on other errors and let user retry manually.
  }
}
