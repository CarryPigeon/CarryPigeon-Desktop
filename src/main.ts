/**
 * @fileoverview 应用启动入口（Vue + Router + i18n + Tauri bridge）。
 *
 * 主要职责：
 * 1) 创建并挂载 Vue 应用。
 * 2) 首帧渲染前将持久化主题写入 DOM（`data-theme`），避免主题闪烁。
 * 3) 处理多窗口路由（popover/aux window 通过 query 参数 `?window=...` 传递上下文）。
 * 4) 注册用户资料相关的 Tauri bridge（由其它窗口 / 原生侧发起请求）。
 *
 * 架构说明：
 * 该文件是 WebView 展示层的 composition root：负责组装 router/i18n，并把 UI 与 ports/adapters
 * 通过工厂/bridge 连接起来。
 */
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./app/router";
import { i18n } from "./app/i18n";
import "tdesign-vue-next/es/style/index.css";
import { listenUserProfileRequest, emitUserProfileResponse } from "@/shared/tauri";
import { currentServerSocket, setServerSocket } from "@/features/servers/presentation/store/currentServer";
import { serverRacks } from "@/features/servers/presentation/store/serverList";
import { createUserService } from "@/features/user/data/userServiceFactory";
import { createAuthService, createEmailService } from "@/features/auth/data/authServiceFactory";
import { setCurrentUser, currentUser } from "@/features/user/presentation/store/userData";
import { readAuthSession, writeAuthSession } from "@/shared/utils/localState";
import { getStoredTheme, setTheme } from "@/shared/utils/theme";
import { connectWithRetry } from "@/features/network/presentation/store/connectionStore";
import { useServerInfoStore } from "@/features/servers/presentation/store/serverInfoStore";
import { isApiRequestError } from "@/shared/net/http/apiErrors";
import { setMissingRequiredPlugins } from "@/features/auth/presentation/store/requiredGate";
import { USE_MOCK_API } from "@/shared/config/runtime";
import { MOCK_PLUGIN_CATALOG } from "@/shared/mock/mockPluginCatalog";
import { getMockPluginsState } from "@/shared/mock/mockPluginState";
import { getPluginManagerPort } from "@/features/plugins/di/plugins.di";

/**
 * 当该 WebView 以“辅助窗口”启动时，将其路由到正确页面。
 *
 * 说明：Tauri 可以打开独立窗口，并通过 query 参数传递上下文，例如：
 * - `?window=user-info-popover`
 * - `?window=channel-info-popover`
 * - `?window=channel-info`
 * - `?window=user-profile`
 *
 * @param searchParams - 当前 location 的 URLSearchParams。
 * @returns 当该实例应被视作子窗口时返回 `true`。
 */
function routeIfSubWindow(searchParams: URLSearchParams): boolean {
  const windowType = searchParams.get("window");
  const isSubWindow = Boolean(windowType);
  if (!windowType) return false;

  if (windowType === "user-info-popover") {
    router.replace({
      path: "/user-info-popover",
      query: {
        avatar: searchParams.get("avatar") ?? "",
        name: searchParams.get("name") ?? "",
        email: searchParams.get("email") ?? "",
        bio: searchParams.get("bio") ?? searchParams.get("description") ?? "",
      },
    });
    return true;
  }

  if (windowType === "channel-info-popover") {
    router.replace({
      path: "/channel-info-popover",
      query: {
        avatar: searchParams.get("avatar") ?? "",
        name: searchParams.get("name") ?? "",
        bio: searchParams.get("bio") ?? searchParams.get("description") ?? "",
      },
    });
    return true;
  }

  if (windowType === "channel-info") {
    router.replace({
      path: "/channel-info",
      query: {
        avatar: searchParams.get("avatar") ?? "",
        name: searchParams.get("name") ?? "",
        bio: searchParams.get("bio") ?? searchParams.get("description") ?? "",
        owner: searchParams.get("owner") ?? "",
      },
    });
    return true;
  }

  if (windowType === "user-profile") {
    router.replace({
      path: "/user_info",
      query: {
        uid: searchParams.get("uid") ?? "",
        avatar: searchParams.get("avatar") ?? "",
        name: searchParams.get("name") ?? "",
        email: searchParams.get("email") ?? "",
        bio: searchParams.get("bio") ?? searchParams.get("description") ?? "",
        sex: searchParams.get("sex") ?? "",
        birthday: searchParams.get("birthday") ?? "",
        avatar_id: searchParams.get("avatar_id") ?? "",
        editable: searchParams.get("editable") ?? "",
      },
    });
    return true;
  }

  return isSubWindow;
}

/**
 * 注册 user-profile 请求/响应桥接（native ↔ webview）。
 *
 * 用途：允许其他窗口或原生侧发起用户操作请求，并获得结构化响应，例如：
 * - `send_email_code`：发送邮箱验证码
 * - `logout`：撤销 token（best-effort）并清空本地登录态
 * - `update_profile`：更新资料，并可选更新邮箱
 *
 * 副作用：
 * - 触发网络请求（通过 data-layer 的 service factory）。
 * - 将 auth token 持久化到本地存储。
 * - 更新展示层 store：`currentUser`。
 * - 退出登录时触发路由跳转。
 *
 * 约束：为避免重复注册 handler，子窗口不注册该 bridge。
 */
function registerUserProfileBridge(): void {
  void listenUserProfileRequest(async (event) => {
    const payload = event.payload;
    const socket = currentServerSocket.value;
    if (!socket) {
      await emitUserProfileResponse({
        id: payload.id,
        ok: false,
        message: "Missing server socket",
      });
      return;
    }

    try {
      if (payload.type === "send_email_code") {
        await createEmailService(socket).sendCode(payload.email);
        await emitUserProfileResponse({ id: payload.id, ok: true });
        return;
      }

      if (payload.type === "logout") {
        const session = readAuthSession(socket);
        const refreshToken = session?.refreshToken ?? "";
        if (refreshToken) {
          await createAuthService(socket).revokeRefreshToken(refreshToken);
        }
        writeAuthSession(socket, null);
        setCurrentUser({ id: "", username: "", email: "", description: "" });
        setServerSocket("");
        void router.replace("/");
        await emitUserProfileResponse({ id: payload.id, ok: true });
        return;
      }

      if (payload.type === "update_profile") {
        const userService = createUserService(socket);
        if (payload.emailUpdate) {
          await userService.updateUserEmail(payload.emailUpdate.email, payload.emailUpdate.code);
        }
        await userService.updateUserProfile(
          payload.profile.username,
          payload.profile.avatar,
          payload.profile.sex,
          payload.profile.brief,
          payload.profile.birthday,
        );

        setCurrentUser({
          username: payload.profile.username,
          description: payload.profile.brief,
          email: payload.emailUpdate?.email ?? currentUser.email,
        });

        await emitUserProfileResponse({ id: payload.id, ok: true });
      }
    } catch (e) {
      await emitUserProfileResponse({
        id: payload.id,
        ok: false,
        message: String(e),
      });
    }
  });
}

/**
 * 启动时选择一个合理的默认 server socket。
 *
 * 规则：
 * - 若 `currentServerSocket` 已设置：保持不变。
 * - 否则：优先选择 pinned rack；再退化为第一个 rack。
 */
function ensureInitialServerSocket(): void {
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
 * 行为：
 * - 执行 required-gate（缺少必需插件时阻止进入聊天）。
 * - 通过调用 `GET /api/users/me` 校验 access token 是否仍有效。
 * - 成功后写入 `currentUser`，并在当前路由为 `/` 时跳转到 `/chat`。
 *
 * @returns Promise<void>
 */
async function tryRestoreSession(): Promise<void> {
  const socket = currentServerSocket.value.trim();
  if (!socket) return;

  // 确保连接/DB 命名空间已就绪（best-effort）。
  await connectWithRetry(socket, { maxAttempts: 3 });

  // 刷新 server-info（并刷新 server_id 映射缓存）。
  const serverInfoStore = useServerInfoStore(socket);
  try {
    await serverInfoStore.refresh();
  } catch {
    // 忽略 server-info 刷新失败：在 mock/protocol 模式下会话恢复仍可能成功。
  }

  // 会话恢复前先执行 required-gate。
  try {
    if (USE_MOCK_API) {
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
    const me = await createUserService(socket).getMe(accessToken);
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

const app = createApp(App);
app.use(router).use(i18n);

// 首帧渲染前应用主题，尽量减少主题切换的“闪烁”。
setTheme(getStoredTheme() ?? "patchbay");

const searchParams = new URLSearchParams(window.location.search);
const isSubWindow = routeIfSubWindow(searchParams);

if (!isSubWindow) {
  registerUserProfileBridge();
}

router.isReady().then(() => {
  app.mount("#app");

  if (!isSubWindow) {
    ensureInitialServerSocket();
    void tryRestoreSession();
  }
});
