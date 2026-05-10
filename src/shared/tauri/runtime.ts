/**
 * @fileoverview Tauri runtime detection helpers.
 */

/**
 * 判断当前 WebView 是否具备 Tauri 运行时。
 *
 * 浏览器预览环境没有 Tauri bridge，应跳过所有依赖 `invoke` 的启动逻辑。
 */
export function isTauriRuntimeAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}
