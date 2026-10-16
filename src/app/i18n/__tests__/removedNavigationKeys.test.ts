/**
 * @fileoverview removedNavigationKeys.test.ts
 * @description i18n：已移除的「进入聊天 / 返回聊天」入口文案不得回潮（各页面只保留统一返回按钮）。
 */

import { describe, expect, it } from "vitest";
import { zh_cn } from "../messages/zh_cn";
import { en_us } from "../messages/en_us";

/** 已随入口按钮一并删除的 i18n 键。 */
const REMOVED_KEYS = ["back_to_patchbay", "settings_open_patchbay"] as const;

describe("removed navigation i18n keys", () => {
  it.each(REMOVED_KEYS)("zh_cn 不再包含 %s", (key) => {
    expect(Object.prototype.hasOwnProperty.call(zh_cn, key)).toBe(false);
  });

  it.each(REMOVED_KEYS)("en_us 不再包含 %s", (key) => {
    expect(Object.prototype.hasOwnProperty.call(en_us, key)).toBe(false);
  });
});
