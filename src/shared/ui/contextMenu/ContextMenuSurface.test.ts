/**
 * @fileoverview ContextMenuSurface.test.ts
 * @description shared/ui｜统一右键菜单面板必须是**不透明**底色。
 *
 * 说明：jsdom 无布局/合成引擎，半透明与否无法由 `getComputedStyle` 体现，因此沿用
 * `topConsoleIconButtons.test.ts` 的做法，以「样式源码中的声明」为契约：
 * 面板曾使用 `--cp-surface`（暗色 `rgba(17, 24, 39, 0.62)`、亮色 `rgba(255, 253, 248, 0.65)`），
 * 导致菜单下半层消息、头像、按钮透出来（截图中可看到「hi」头像与输入框边框穿过菜单）。
 */

import { describe, expect, it } from "vitest";
import surfaceSource from "./ContextMenuSurface.vue?raw";
import appSource from "@/App.vue?raw";

/**
 * 取 `.cp-menu` 面板规则的声明体。
 *
 * @param source - 组件源码。
 * @returns 声明体；未按预期出现该规则时返回空串。
 */
function panelRuleBody(source: string): string {
  const match = /\.cp-menu\s*\{([\s\S]*?)\n\}/.exec(source);
  return match?.[1] ?? "";
}

describe("统一右键菜单面板样式契约", () => {
  it("面板 `.cp-menu` 规则存在", () => {
    expect(panelRuleBody(surfaceSource)).not.toBe("");
  });

  it("面板底色使用不透明 token `--cp-panel-solid`", () => {
    const body = panelRuleBody(surfaceSource);
    expect(body).toMatch(/background:\s*var\(--cp-panel-solid\);/);
  });

  it("不回归半透明毛玻璃底色", () => {
    const body = panelRuleBody(surfaceSource);
    expect(body).not.toMatch(/background:\s*var\(--cp-surface\)/);
    expect(body).not.toMatch(/background:\s*var\(--cp-panel\)/);
    // 也不允许直接写 rgba()/color-mix(... transparent) 等半透明底色
    expect(body).not.toMatch(/background:\s*rgba?\(/);
    expect(body).not.toMatch(/background:\s*color-mix\([^)]*transparent/);
  });

  it("`--cp-panel-solid` 在亮/暗主题下都是不透明色值", () => {
    const opaque = appSource.match(/--cp-panel-solid:\s*#[0-9a-fA-F]{3,8};/g) ?? [];
    // 亮色（:root）与暗色（:root[data-theme="dark"]）各一处
    expect(opaque.length).toBeGreaterThanOrEqual(2);
    expect(appSource).not.toMatch(/--cp-panel-solid:\s*rgba?\(/);
  });
});
