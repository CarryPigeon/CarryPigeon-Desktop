/**
 * @fileoverview 剪贴板工具函数（兼容降级）。
 * @description 优先使用 `navigator.clipboard`，失败后回退到 `document.execCommand("copy")`。
 */
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
