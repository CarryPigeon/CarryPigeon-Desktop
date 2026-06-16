/**
 * @fileoverview toast.ts
 * @description 统一 Toast 工具 — 对 TDesign MessagePlugin 的类型安全包装。
 *
 * 约束：
 * - 所有面向用户的文案必须经过 i18n；
 * - 错误对象自动提取 message 并格式化；
 * - 禁止直接使用 MessagePlugin（静态检查可检测 `MessagePlugin` 的直接 import）。
 */

import { MessagePlugin } from "tdesign-vue-next";

/**
 * 将任意错误提取为人类可读字符串。
 *
 * @param e - 未知错误。
 * @returns 可展示的错误文本。
 */
function errorToString(e: unknown): string {
  if (e instanceof Error) return e.message || String(e);
  if (typeof e === "string") return e;
  return String(e) || "Unknown error";
}

/**
 * 统一 toast 工具。
 *
 * 说明：
 * - 提供 `success/warning/error/info` 四个级别；
 * - 所有文案强制走 i18n key 或已翻译文本；
 * - 对 try/catch 场景提供 `fromError` 便捷方法。
 */
export const toast = {
  /** 成功提示 */
  success(message: string): void {
    void MessagePlugin.success(message);
  },

  /** 警告提示 */
  warning(message: string): void {
    void MessagePlugin.warning(message);
  },

  /** 错误提示（通用） */
  error(message: string): void {
    void MessagePlugin.error(message);
  },

  /** 信息提示 */
  info(message: string): void {
    void MessagePlugin.info(message);
  },

  /**
   * 从 try/catch 捕获的错误中显示 toast。
   *
   * @param e - 捕获的错误对象。
   * @param fallback - 当错误消息为空时的回退文案。
   */
  fromError(e: unknown, fallback?: string): void {
    const msg = errorToString(e);
    if (msg) {
      void MessagePlugin.error(msg);
    } else if (fallback) {
      void MessagePlugin.error(fallback);
    }
  },

  /**
   * 复制到剪贴板成功 toast。
   *
   * @param message - i18n 翻译后的文案。
   */
  copied(message: string): void {
    void MessagePlugin.success(message);
  },
};
