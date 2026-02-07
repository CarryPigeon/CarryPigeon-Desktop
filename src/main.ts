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
import "@/features/chat/presentation/styles/patchbay.scss";
import { getStoredTheme, setTheme } from "@/shared/utils/theme";
import { routeIfSubWindow } from "@/app/bootstrap/subWindowRouting";
import { registerUserProfileBridge } from "@/app/bootstrap/userProfileBridge";
import { ensureInitialServerSocket, tryRestoreSession } from "@/app/bootstrap/startupSession";

const app = createApp(App);
app.use(router).use(i18n);

// 首帧渲染前应用主题，尽量减少主题切换的“闪烁”。
setTheme(getStoredTheme() ?? "patchbay");

const searchParams = new URLSearchParams(window.location.search);
const isSubWindow = routeIfSubWindow(router, searchParams);

if (!isSubWindow) {
  registerUserProfileBridge(router);
}

router.isReady().then(() => {
  app.mount("#app");

  if (!isSubWindow) {
    ensureInitialServerSocket();
    void tryRestoreSession(router);
  }
});
