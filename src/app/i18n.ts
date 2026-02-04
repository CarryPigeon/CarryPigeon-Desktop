/**
 * @fileoverview i18n 启动与实例创建（vue-i18n）。
 *
 * i18n 实例在此处创建一次，并在 `src/main.ts` 中注册到应用。
 * 展示层组件通过 `useI18n()` 读取本地化文案。
 *
 * 设计说明：将 i18n 初始化与各 feature 隔离，避免跨模块耦合，也便于未来扩展语言切换能力。
 */
import { createI18n } from "vue-i18n";
import { zh_cn } from "./i18n/messages/zh_cn";
import { en_us } from "./i18n/messages/en_us";

/**
 * 应用级 i18n 单例。
 *
 * - `legacy: false`：启用 Composition API（`useI18n`）。
 * - 默认语言：`zh_cn`（符合当前 UI 规格）。
 *
 * @constant
 */
export const i18n = createI18n({
  legacy: false,
  locale: "zh_cn",
  messages: {
    zh_cn,
    en_us,
  },
});
