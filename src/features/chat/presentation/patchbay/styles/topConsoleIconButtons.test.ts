/**
 * @fileoverview topConsoleIconButtons.test.ts
 * @description 样式契约：顶栏右侧图标按钮（搜索 / 固定成员栏 / 频道设置）静态态不得再有可见外框。
 *
 * 说明：jsdom 无布局引擎，因此沿用 patchbayNarrowLayout.test.ts 的做法，以「样式源码中的声明」为契约。
 * 历史上三个按钮各自带 `border: 1px solid var(--cp-border)` + `--cp-panel-muted` 底色，
 * 顶栏每排图标都像套了一个按钮盒；现统一为无外框图标按钮，仅悬停/聚焦时给出底色与描边反馈。
 */

import { describe, expect, it } from "vitest";
import patchbayScss from "./patchbay.scss?raw";

/**
 * 取顶栏三个图标按钮共用的基础规则声明体。
 *
 * @param source - 样式源码。
 * @returns 声明体；未按预期写在同一组选择器里时返回空串。
 */
function sharedRuleBody(source: string): string {
  const match =
    /\.cp-topConsole__search,\s*\.cp-topConsole__pinMembers,\s*\.cp-topConsole__settings\s*\{([\s\S]*?)\n\}/.exec(
      source,
    );
  return match?.[1] ?? "";
}

describe("顶栏图标按钮样式契约", () => {
  it("三个按钮共用同一条基础规则（尺寸/观感一致）", () => {
    expect(sharedRuleBody(patchbayScss)).not.toBe("");
  });

  it("静态态：透明边框 + 透明底色，不画外框", () => {
    const body = sharedRuleBody(patchbayScss);
    expect(body).toMatch(/border:\s*1px solid transparent;/);
    expect(body).toMatch(/background:\s*transparent;/);
  });

  it("不回归「可见边框 + panel-muted 底色」的按钮盒写法", () => {
    const visibleFrame =
      /\.cp-topConsole__(?:search|pinMembers|settings)\s*\{[^}]*border:\s*1px solid var\(--cp-border\)/;
    const solidFill = /\.cp-topConsole__(?:search|pinMembers|settings)\s*\{[^}]*background:\s*var\(--cp-panel-muted\)/;
    expect(patchbayScss).not.toMatch(visibleFrame);
    expect(patchbayScss).not.toMatch(solidFill);
  });

  it("悬停态才给出底色与描边反馈", () => {
    const hover =
      /\.cp-topConsole__search:hover,\s*\.cp-topConsole__pinMembers:hover,\s*\.cp-topConsole__settings:hover\s*\{([\s\S]*?)\n\}/.exec(
        patchbayScss,
      );
    expect(hover?.[1] ?? "").toMatch(/background:\s*var\(--cp-hover-bg\);/);
  });
});
