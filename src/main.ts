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
import { getStoredAccent, getStoredTheme, setAccent, setTheme } from "@/shared/utils/theme";
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

import { resolveStartup, setStartupPhaseLabel } from '@/app/bootstrap/startupState';
import { getMemoryMonitor, destroyMemoryMonitor } from "@/shared/monitoring/memoryMonitor";
import { isPerformanceMonitoringEnabled } from "@/shared/config/performance";

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
let memoryMonitorStartTimer: number | null = null;

authFlowCapabilities.configureInstalledPluginsQueryProvider((serverSocket: string) =>
  pluginsCapabilities.forServer(serverSocket).listInstalledPlugins(),
);
serverConnectionCapabilities.scopeLifecycle.registerCleanupHandler(() => {
  accountCapabilities.currentUser.clearSnapshot();
  serverConnectionCapabilities.workspace.selectSocket("");
});

// 首帧渲染前应用主题与强调色，尽量减少主题切换的“闪烁”。
//
// 兼容策略：旧用户可能仅持久化了 `data-theme=patchbay`（无 accent）。
// - 若存储中没有 accent，则根据已存储的 theme 推断默认 accent：
//   - `theme=patchbay` → `accent=patchbay`（沿用原本的视觉）
//   - 其他 → `accent=default`（与新拆分后的默认强调色对齐）
const initialTheme = getStoredTheme() ?? "patchbay";
const initialAccent = getStoredAccent() ?? (initialTheme === "patchbay" ? "patchbay" : "default");
setTheme(initialTheme);
setAccent(initialAccent);

const searchParams = new URLSearchParams(window.location.search);
const isSubWindow = routeIfSubWindow(router, searchParams);
const hasTauriRuntime = isTauriRuntimeAvailable();

async function startMainWindowRuntimes(): Promise<boolean> {
  setStartupPhaseLabel("startup_phase_runtime");
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
  if (memoryMonitorStartTimer !== null) {
    clearTimeout(memoryMonitorStartTimer);
    memoryMonitorStartTimer = null;
  }
  destroyMemoryMonitor();
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
  void startMainWindowRuntimes().then(async (ok) => {
    if (ok) {
      setStartupPhaseLabel("startup_phase_connect");
      ensureInitialServerSelection();
      await restoreStartupSession(router);
      resolveStartup('ready');
      if (isPerformanceMonitoringEnabled()) {
        const durationMs = Math.round(performance.now() - performance.timeOrigin);
        logger.info("Action: api_app_startup_ready", { duration_ms: durationMs });
      }
      // 启动后 5 秒静默检查更新
      window.setTimeout(() => {
        void checkForUpdateSilently((version, releaseUrl) => {
          logger.info('Action: http_update_available', { version });
          // 动态挂载 UpdatePrompt 组件
          import('@/shared/updater/UpdatePrompt.vue').then(async ({ default: UpdatePrompt }) => {
            const { createApp } = await import('vue');
            const mount = document.createElement('div');
            mount.id = 'update-prompt-mount';
            document.body.appendChild(mount);
            const promptApp = createApp(UpdatePrompt, {
              version,
              releaseUrl,
              onDismiss: () => { promptApp.unmount(); mount.remove(); },
            });
            promptApp.mount(mount);
          }).catch(() => {
            // 如果 UpdatePrompt 加载失败，静默跳过
          });
        });
      }, UPDATE_CHECK_DELAY_MS);
    }
  });
} else if (!isSubWindow) {
  // 无 Tauri runtime（纯前端 dev 模式）：立即标记就绪
  resolveStartup('ready');
} else {
  // 子窗口（如截图遮罩、popover 等）：无需主窗口运行时，立即标记就绪以渲染 UI
  resolveStartup('ready');
}

// 启动内存监控（延迟启动，避免干扰首帧渲染和关键启动流程）
// release 构建中默认关闭性能监控，因此不创建监控实例也不启动定时器。
if (hasTauriRuntime && isPerformanceMonitoringEnabled()) {
  const memoryMonitor = getMemoryMonitor();
  memoryMonitorStartTimer = window.setTimeout(() => {
    memoryMonitor.start();
  }, 10000); // 应用初始化后 10 秒启动
}

// dev-only：暴露内存长测入口，便于开发/诊断时手动调用
if (import.meta.env.DEV) {
  void import("@/shared/monitoring/memoryLongTest").then((m) => {
    (window as unknown as Record<string, unknown>).runMemoryLongTest = m.runMemoryLongTest;
  });
}
