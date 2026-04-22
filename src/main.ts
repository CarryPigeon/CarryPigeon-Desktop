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
import "@/features/chat/public/styles";
import { getStoredTheme, setTheme } from "@/shared/utils/theme";
import "@/shared/serverIdentity";
import { routeIfSubWindow } from "@/app/bootstrap/subWindowRouting";
import { registerUserProfileBridge } from "@/app/bootstrap/userProfileBridge";
import { ensureInitialServerSelection, restoreStartupSession } from "@/app/processes/session/api";
import { ensureSecureChatCacheReady } from "@/shared/utils/chatSecureCache";
import { getAccountCapabilities } from "@/features/account/api";
import { getAuthFlowCapabilities } from "@/features/account/auth-flow/api";
import { getPluginsCapabilities } from "@/features/plugins/api";
import { getServerConnectionCapabilities } from "@/features/server-connection/api";
import { createLogger } from "@/shared/utils/logger";

const app = createApp(App);
app.use(router).use(i18n);
const logger = createLogger("main");
const accountCapabilities = getAccountCapabilities();
const authFlowCapabilities = getAuthFlowCapabilities();
const pluginsCapabilities = getPluginsCapabilities();
const serverConnectionCapabilities = getServerConnectionCapabilities();
let pluginsRuntimeLease: Awaited<ReturnType<typeof pluginsCapabilities.runtime.acquireLease>> | null = null;
let serverConnectionRuntimeLease: Awaited<ReturnType<typeof serverConnectionCapabilities.runtime.acquireLease>> | null = null;

authFlowCapabilities.configureInstalledPluginsQueryProvider((serverSocket: string) =>
  pluginsCapabilities.forServer(serverSocket).listInstalledPlugins(),
);
serverConnectionCapabilities.scopeLifecycle.registerCleanupHandler(() => {
  accountCapabilities.currentUser.clearSnapshot();
  serverConnectionCapabilities.workspace.selectSocket("");
});

// 首帧渲染前应用主题，尽量减少主题切换的“闪烁”。
setTheme(getStoredTheme() ?? "patchbay");

const searchParams = new URLSearchParams(window.location.search);
const isSubWindow = routeIfSubWindow(router, searchParams);

async function startMainWindowRuntimes(): Promise<boolean> {
  try {
    serverConnectionRuntimeLease = await serverConnectionCapabilities.runtime.acquireLease();
  } catch (e) {
    logger.error("Action: api_main_start_runtime_failed", { error: String(e) });
    return false;
  }

  pluginsRuntimeLease = await pluginsCapabilities.runtime.acquireLease();
  try {
    await registerUserProfileBridge(router);
  } catch (e) {
    logger.error("Action: api_main_register_user_profile_bridge_failed", { error: String(e) });
  }
  return true;
}

function releaseMainWindowRuntimes(): void {
  const releaseTasks: Promise<unknown>[] = [];
  if (pluginsRuntimeLease) {
    releaseTasks.push(pluginsRuntimeLease.release());
    pluginsRuntimeLease = null;
  }
  if (serverConnectionRuntimeLease) {
    releaseTasks.push(serverConnectionRuntimeLease.release());
    serverConnectionRuntimeLease = null;
  }
  if (releaseTasks.length > 0) {
    void Promise.allSettled(releaseTasks);
  }
}

window.addEventListener("beforeunload", releaseMainWindowRuntimes);

async function bootstrap(): Promise<void> {
  await ensureSecureChatCacheReady();
  let serverConnectionReady = false;
  if (!isSubWindow) {
    // Main window owns runtime startup and bridge registration.
    serverConnectionReady = await startMainWindowRuntimes();
  }

  // UI mount waits for router readiness for predictable first render route.
  await router.isReady();
  app.mount("#app");

  if (!isSubWindow && serverConnectionReady) {
    // Session restore starts after mount to avoid blocking first paint.
    ensureInitialServerSelection();
    void restoreStartupSession(router);
  }
}

void bootstrap().catch((e) => {
  logger.error("Action: api_main_bootstrap_failed", { error: String(e) });
});
