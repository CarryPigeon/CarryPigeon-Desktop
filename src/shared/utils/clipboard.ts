/**
 * @fileoverview 剪贴板工具函数（兼容降级）。
 * @description 优先使用 `navigator.clipboard`，失败后回退到 `document.execCommand("copy")`；
 * 读取优先走 Tauri 剪贴板插件（WebView2 默认拒绝 `clipboard-read` 权限）。
 */

import { isTauriRuntimeAvailable } from "@/shared/tauri/runtime";
import { readText as readClipboardTextFromPlugin } from "@tauri-apps/plugin-clipboard-manager";

/**
 * 将文本复制到剪贴板，并提供安全降级。
 *
 * 策略：
 * 1) 优先使用 `navigator.clipboard.writeText`（需要安全上下文）。
 * 2) 失败后使用隐藏 textarea + `document.execCommand("copy")` 降级复制。
 *
 * @param text - 要复制的文本。
 * @returns 复制成功返回 `true`；否则返回 `false`。
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "-9999px";
      textarea.setAttribute("readonly", "");
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * 是否具备读取剪贴板的能力。
 *
 * 说明：Windows 的 WebView2 默认拒绝 `clipboard-read` 权限，浏览器 Clipboard API
 * 可能不可用，因此 Tauri 运行时优先使用剪贴板插件。
 *
 * @returns 可用返回 `true`。
 */
export function canReadClipboardText(): boolean {
  if (isTauriRuntimeAvailable()) return true;
  try {
    return typeof navigator.clipboard?.readText === "function";
  } catch {
    return false;
  }
}

/**
 * 读取剪贴板文本。
 *
 * 策略：Tauri 运行时走官方剪贴板插件；纯浏览器环境回退 `navigator.clipboard.readText`。
 *
 * @returns 剪贴板文本。
 * @throws 读取通道不可用或读取失败时抛错（由调用方提示用户改用 Ctrl+V）。
 */
export async function readClipboardText(): Promise<string> {
  if (isTauriRuntimeAvailable()) {
    return readClipboardTextFromPlugin();
  }
  const read = navigator.clipboard?.readText;
  if (typeof read !== "function") throw new Error("clipboard_read_unavailable");
  return read.call(navigator.clipboard);
}
