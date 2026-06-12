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
import { startLogPersistence, stopLogPersistence } from "@/shared/utils/logPersist";
import { isTauriRuntimeAvailable } from "@/shared/tauri/runtime";
import type { WatchStopHandle } from "vue";
import {
  clearTrayUnreadFlashing,
  registerTrayUnreadBridge,
  registerTrayHoverBridge,
  syncTrayLocaleOnStartup,
} from "@/app/bootstrap/trayIntegration";
import { checkForUpdateSilently } from "@/shared/updater/checkUpdate";

import { resolveStartup } from '@/app/bootstrap/startupState';

const UPDATE_CHECK_DELAY_MS = 5000;

const app = createApp(App);
app.use(router).use(i18n);
const logger = createLogger("main");
const accountCapabilities = getAccountCapabilities();
const authFlowCapabilities = getAuthFlowCapabilities();
const pluginsCapabilities = getPluginsCapabilities();
const serverConnectionCapabilities = getServerConnectionCapabilities();
let pluginsRuntimeLease: Awaited<ReturnType<typeof pluginsCapabilities.runtime.acquireLease>> | null = null;
let serverConnectionRuntimeLease: Awaited<ReturnType<typeof serverConnectionCapabilities.runtime.acquireLease>> | null = null;
let trayUnreadBridgeStop: WatchStopHandle | null = null;

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
const hasTauriRuntime = isTauriRuntimeAvailable();

async function startMainWindowRuntimes(): Promise<boolean> {
  try {
    const [serverLease, pluginLease] = await Promise.all([
      serverConnectionCapabilities.runtime.acquireLease(),
      pluginsCapabilities.runtime.acquireLease(),
    ]);
    serverConnectionRuntimeLease = serverLease;
    pluginsRuntimeLease = pluginLease;
  } catch (e) {
    logger.error("Action: api_main_start_runtime_failed", { error: String(e) });
    releaseMainWindowRuntimes();
    resolveStartup('failed');
    return false;
  }

  try {
    await registerUserProfileBridge(router);
  } catch (e) {
    logger.error("Action: api_main_register_user_profile_bridge_failed", { error: String(e) });
  }

  trayUnreadBridgeStop = registerTrayUnreadBridge();
  registerTrayHoverBridge();
  syncTrayLocaleOnStartup();

    resolveStartup('ready');
  return true;
}

function releaseMainWindowRuntimes(): void {
  if (trayUnreadBridgeStop) {
    trayUnreadBridgeStop();
    trayUnreadBridgeStop = null;
  }
  clearTrayUnreadFlashing();

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

window.addEventListener("beforeunload", () => {
  releaseMainWindowRuntimes();
  stopLogPersistence();
});

// Mount first to unblock LCP
app.mount("#app");
startLogPersistence();

// Async startup after mount (fire-and-forget)
if (hasTauriRuntime) {
  void ensureSecureChatCacheReady().catch((e) => {
    logger.error("Action: api_main_ensure_cache_failed", { error: String(e) });
  });
}
if (!isSubWindow && hasTauriRuntime) {
  void startMainWindowRuntimes().then((ok) => {
    if (ok) {
      ensureInitialServerSelection();
      // 启动后 5 秒静默检查更新
      window.setTimeout(() => {
        void checkForUpdateSilently((version, body) => {
          logger.info('Action: http_update_available', { version });
          // 动态挂载 UpdatePrompt 组件
          import('@/shared/updater/UpdatePrompt.vue').then(async ({ default: UpdatePrompt }) => {
            const { createApp } = await import('vue');
            const mount = document.createElement('div');
            mount.id = 'update-prompt-mount';
            document.body.appendChild(mount);
            const promptApp = createApp(UpdatePrompt, {
              version,
              body,
              onInstall: () => {
                // UpdatePrompt handles its own download+install flow
                // Keep the prompt visible during download (it auto-closes on install success)
              },
              onDismiss: () => { promptApp.unmount(); mount.remove(); },
            });
            promptApp.mount(mount);
          }).catch(() => {
            // 如果 UpdatePrompt 加载失败，静默跳过
          });
        });
      }, UPDATE_CHECK_DELAY_MS);
      void restoreStartupSession(router);
    }
  });
} else if (!isSubWindow) {
  // 无 Tauri runtime（纯前端 dev 模式）：立即标记就绪
  resolveStartup('ready');
}
