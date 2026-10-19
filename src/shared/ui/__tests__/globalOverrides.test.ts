/**
 * @fileoverview globalOverrides.test.ts
 * @description 全局 TDesign 覆盖的样式契约：抽屉定位根节点不得有背景/模糊。
 *
 * 背景：`.t-drawer` 是覆盖全屏的定位根节点，关闭时仍留在 DOM 中（仅内容面板隐藏）。
 * 若给它加背景/backdrop-filter，关闭态会像一层半透明遮罩盖住整页；玻璃只应加在
 * `.t-drawer__content-wrapper` 上。
 */

import { describe, expect, it } from "vitest";
import appSource from "@/App.vue?raw";

/** 取 App.vue 中某选择器的第一条规则声明体。 */
function ruleBody(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(source);
  return match?.[1] ?? "";
}

describe("TDesign 抽屉全局覆盖契约", () => {
  it("`.t-drawer` 根节点保持透明，不覆盖整页", () => {
    const body = ruleBody(appSource, ".t-drawer");
    expect(body).not.toBe("");
    expect(body).toContain("background: transparent !important");
    expect(body).toContain("backdrop-filter: none");
    expect(body).not.toMatch(/background:\s*var\(--cp-panel\)/);
  });

  it("玻璃面板加在 `.t-drawer__content-wrapper` 上", () => {
    const body = ruleBody(appSource, ".t-drawer__content-wrapper");
    expect(body).not.toBe("");
    expect(body).toContain("background: var(--cp-panel) !important");
    expect(body).toContain("backdrop-filter: var(--cp-glass-blur)");
  });
});
