/**
 * @fileoverview i18n.ts 文件职责说明。
 */
import { createI18n } from "vue-i18n";
import { zh_cn } from "./i18n/messages/zh_cn";
import { en_us } from "./i18n/messages/en_us";

/**
 * Exported constant.
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

