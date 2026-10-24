/**
 * @fileoverview chatFloatingLayout.test.ts
 * @description 样式契约：聊天主窗口采用「无缝紧凑」的玻璃面板变体。
 *
 * 说明：jsdom 无布局引擎，无法断言真实渲染结果，因此沿用 patchbayNarrowLayout.test.ts 的做法，
 * 以「样式源码 / 页面源码中的声明」为契约，经 Vite 的 `?raw` 导入读取文本。只钉住本次重构的
 * 结构性视觉决策：
 * 1) 聊天主窗口复用 `cp-workspace`：8px 页面留白 + 无列间距 + 透明背景，玻璃表面由 mixin 的
 *    `::before` 统一承载，供全应用页面共享同一配方；
 * 2) rail/center 不再各自套 `cp-glass-panel`，全部透明地铺在同一张表面上（无描边/圆角/投影）；
 * 3) resizer 8px 宽、左右 -4px 负 margin，净占 0 宽叠在交界处，静态无引导线，仅悬停/拖拽时显示高亮线；
 * 4) 栏头/栏脚/搜索区/顶栏/工具条/行列表不画分割线，行列表 padding 4/6、gap 1；
 * 5) 消息区收紧密度（signalPane 10/8、meta 4、气泡 8/10）；
 * 6) 布局预算按内容盒宽度计算，固定开销 resizers 0 / gaps 0；
 * 7) 频道 Tabs、顶栏标题、接收气泡、窄宽度断点等既有契约保留。
 */

import { describe, expect, it } from "vitest";
import patchbayScss from "./patchbay.scss?raw";
import uiScss from "@/styles/_ui.scss?raw";
import appSource from "@/App.vue?raw";
import mainPageSource from "../page/MainPage.vue?raw";
import channelRailSource from "../components/layout/ChannelRail.vue?raw";
import serverRailSource from "../components/layout/ServerRail.vue?raw";
import searchPanelSource from "../components/search/SearchPanel.vue?raw";
import pinListBarSource from "../components/layout/PinListBar.vue?raw";
import multiSelectToolbarSource from "../components/menus/MultiSelectToolbar.vue?raw";

/** 转义正则元字符，便于用字面量拼接选择器/声明。 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 取某选择器的全部规则块声明体。
 *
 * @param source - 样式源码。
 * @param selector - 选择器字面量（如 `.cp-main`）。
 * @returns 每个匹配规则块的声明体；无匹配返回空数组。
 */
function ruleBodies(source: string, selector: string): string[] {
  const re = new RegExp(`(?:^|[\\s,])${escapeRegExp(selector)}\\s*\\{([\\s\\S]*?)\\n\\}`, "g");
  const bodies: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) bodies.push(match[1] ?? "");
  return bodies;
}

/**
 * 判断声明体中是否含指定声明。
 *
 * @param body - 规则块声明体。
 * @param declaration - 声明前缀（如 `gap: 4px`）。
 * @returns 含该声明返回 `true`。
 */
function declares(body: string, declaration: string): boolean {
  return new RegExp(`${escapeRegExp(declaration)}\\s*;`).test(body);
}

/**
 * 取多选择器共享规则块的声明体（用于 `.cp-rail, .cp-center` 这类共享外壳）。
 *
 * @param source - 样式源码。
 * @param selectorList - 逗号分隔的选择器列表（允许空白差异）。
 * @returns 声明体；未按预期写在一起时返回空串。
 */
function sharedRuleBody(source: string, selectorList: string): string {
  const joined = selectorList
    .split(",")
    .map((selector) => escapeRegExp(selector.trim()))
    .join(",\\s*");
  const match = new RegExp(`${joined}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(source);
  return match?.[1] ?? "";
}

describe("聊天主窗口无缝紧凑布局契约", () => {
  it("聊天主窗口复用 cp-workspace：8px 留白 + 无列间距 + 单张玻璃面", () => {
    const body = ruleBodies(patchbayScss, ".cp-main")[0] ?? "";
    expect(body).toContain("@include cp-workspace;");
    expect(declares(body, "flex-direction: row")).toBe(true);
    // 配方已收敛到 mixin，页面选择器不再重复声明留白/玻璃面
    expect(declares(body, "padding: 8px")).toBe(false);
    expect(patchbayScss).not.toContain(".cp-main::before");

    // 单一真源：留白 token 在 App.vue，玻璃面配方在 _ui.scss 的 cp-workspace
    expect(appSource).toMatch(/--cp-workspace-pad:\s*8px;/);
    expect(uiScss).toContain("@mixin cp-workspace");
    expect(uiScss).toMatch(/padding:\s*\$pad;/);
    expect(uiScss).toMatch(/position:\s*fixed;/);
    expect(uiScss).toMatch(/inset:\s*\$pad;/);
    expect(uiScss).toMatch(/gap:\s*0;/);
    expect(uiScss).toMatch(/isolation:\s*isolate;/);
    expect(uiScss).toMatch(/background:\s*transparent;/);
    expect(uiScss).toMatch(/z-index:\s*-1;/);
    expect(uiScss).toMatch(/border-radius:\s*var\(--cp-radius-lg\);/);
    expect(uiScss).toMatch(/background:\s*var\(--cp-surface\);/);
    expect(uiScss).toMatch(/backdrop-filter:\s*var\(--cp-glass-blur\);/);
    expect(uiScss).toMatch(/box-shadow:\s*var\(--cp-shadow-soft\);/);
    expect(uiScss).toMatch(/pointer-events:\s*none;/);
  });

  it("rail 与 center 不再各自成为玻璃面板，透明铺在共享表面上", () => {
    const shell = sharedRuleBody(patchbayScss, ".cp-rail, .cp-center");
    expect(shell).not.toBe("");
    expect(shell).not.toContain("@include cp-glass-panel;");
    expect(declares(shell, "background: transparent")).toBe(true);
    expect(declares(shell, "border: 0")).toBe(true);
    expect(declares(shell, "border-radius: 0")).toBe(true);
    expect(declares(shell, "box-shadow: none")).toBe(true);
    expect(declares(shell, "overflow: hidden")).toBe(true);
  });

  it("resizer 8px 宽、负 margin 净占 0 宽叠在交界处，仅悬停/拖拽显示引导线", () => {
    const bodies = ruleBodies(patchbayScss, ".cp-resizer");
    expect(bodies.length).toBeGreaterThan(0);
    const body = bodies[0] ?? "";
    expect(declares(body, "flex: 0 0 8px")).toBe(true);
    // 8px 宽度由左右各 -4px 负 margin 抵扣 → 净占 0 宽，栏间不留缝隙
    expect(declares(body, "margin: 0 -4px")).toBe(true);

    const guide = ruleBodies(patchbayScss, ".cp-resizer::before")[0] ?? "";
    expect(guide).not.toBe("");
    expect(declares(guide, "background: transparent")).toBe(true);
    expect(patchbayScss).toMatch(
      /\.cp-resizer:hover::before,\s*\.cp-resizer\[data-active="true"\]::before\s*\{[\s\S]*?background:\s*var\(--cp-highlight-border-strong\)/,
    );
  });

  it("MainPage 布局预算改按内容盒宽度：无 horizontalPadding，窗口路径减计算 padding", () => {
    expect(mainPageSource).not.toContain("horizontalPadding");
    // ResizeObserver 直接以 contentRect.width 为预算基准
    expect(mainPageSource).toContain("contentRect.width");
    // 窗口/拖拽路径用 getComputedStyle 的左右 padding 从 border-box 宽度还原内容盒宽度
    expect(mainPageSource).toContain("getComputedStyle");
    expect(mainPageSource).toContain("paddingLeft");
    expect(mainPageSource).toContain("paddingRight");
    // 不再直接拿 border-box 宽度当预算
    expect(mainPageSource).not.toMatch(
      /fitSideRailsToContainer\(\s*mainEl\.value\.getBoundingClientRect\(\)\.width/,
    );
    // 固定开销：resizer 与栏间距净占 0、消息区最小 240
    expect(mainPageSource).toMatch(/resizers:\s*0,/);
    expect(mainPageSource).toMatch(/gaps:\s*0,/);
    expect(mainPageSource).toMatch(/messageMin:\s*240,/);
  });

  it("rail 行列表改为紧凑行列表（padding 4/6、gap 1）", () => {
    for (const selector of [".cp-rackList", ".cp-channelList", ".cp-memberList"]) {
      const bodies = ruleBodies(patchbayScss, selector);
      expect(bodies.length).toBeGreaterThan(0);
      const body = bodies[0] ?? "";
      expect(declares(body, "padding: 4px 6px")).toBe(true);
      expect(declares(body, "gap: 1px")).toBe(true);
    }
  });

  it("行透明底且不再逐行画卡片边框 / 不做错峰入场动画", () => {
    for (const selector of [".cp-rack", ".cp-channelRow", ".cp-member"]) {
      const bodies = ruleBodies(patchbayScss, selector);
      expect(bodies.length).toBeGreaterThan(0);
      const body = bodies[0] ?? "";
      // 常驻边框必须是透明的，行与行之间不再用分隔线（父级伪元素）
      expect(declares(body, "border: 1px solid transparent")).toBe(true);
      expect(declares(body, "background: transparent")).toBe(true);
      expect(declares(body, "box-shadow: inset 2px 0 0 var(--cp-highlight)")).toBe(false);
    }
    // active 行才使用 highlight inset
    const channelActive = ruleBodies(patchbayScss, '.cp-channelRow[data-active="true"]');
    expect(
      channelActive.some((body) => declares(body, "box-shadow: inset 2px 0 0 var(--cp-highlight)")),
    ).toBe(true);
    // 三组行分隔伪元素已删除
    expect(patchbayScss).not.toContain(".cp-rack + .cp-rack::before");
    expect(patchbayScss).not.toContain(".cp-channelRow + .cp-channelRow::before");
    expect(patchbayScss).not.toContain(".cp-member + .cp-member::before");
    expect(patchbayScss).not.toContain("cp-fade-slide-in");
    expect(patchbayScss).not.toMatch(/cp-channelRow:nth-child/);
  });

  it("workspace 分区与工具条不再画 border-top/bottom", () => {
    const dividerRules = [
      [patchbayScss, ".cp-rail__head"],
      [patchbayScss, ".cp-rail__foot"],
      [patchbayScss, ".cp-topConsole"],
      [patchbayScss, ".cp-channelSearch"],
      [channelRailSource, ".cp-serverCard"],
      [serverRailSource, ".cp-rail__top-actions"],
      [searchPanelSource, ".cp-searchPanel"],
      [pinListBarSource, ".cp-pinListBar"],
      [multiSelectToolbarSource, ".cp-multiSelectToolbar"],
    ] as const;

    for (const [source, selector] of dividerRules) {
      const bodies = ruleBodies(source, selector);
      expect(bodies.length, `${selector} 规则应存在`).toBeGreaterThan(0);
      for (const body of bodies) {
        expect(body, `${selector} 不应再声明 border-top/bottom`).not.toMatch(
          /border-(top|bottom)\s*:/,
        );
      }
    }

    // 空状态卡也不再用描边充当分割线
    for (const selector of [".cp-rail__empty", ".cp-channelEmpty"]) {
      const bodies = ruleBodies(patchbayScss, selector);
      expect(bodies.length).toBeGreaterThan(0);
      for (const body of bodies) expect(body).not.toMatch(/border\s*:/);
    }
  });

  it("消息区收紧密度：10/8 内边距与行距、meta 4、气泡 8/10", () => {
    const pane = ruleBodies(patchbayScss, ".cp-signalPane")[0] ?? "";
    expect(pane).not.toBe("");
    expect(declares(pane, "padding: 10px")).toBe(true);
    expect(declares(pane, "gap: 8px")).toBe(true);

    const msg = ruleBodies(patchbayScss, ".cp-msg")[0] ?? "";
    expect(msg).not.toBe("");
    expect(declares(msg, "gap: 8px")).toBe(true);

    const metaBodies = ruleBodies(patchbayScss, ".cp-msg__meta");
    const meta = metaBodies.find((body) => declares(body, "width: 100%")) ?? "";
    expect(meta).not.toBe("");
    expect(declares(meta, "margin-bottom: 4px")).toBe(true);

    const bubble = ruleBodies(patchbayScss, ".cp-bubble")[0] ?? "";
    expect(bubble).not.toBe("");
    expect(declares(bubble, "padding: 8px 10px")).toBe(true);
  });

  it("频道 Tabs 使用 cp-segmented 分段控件", () => {
    const tabs = ruleBodies(patchbayScss, ".cp-channelTabs");
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs.some((body) => body.includes("@include cp-segmented;"))).toBe(true);

    const items = ruleBodies(patchbayScss, ".cp-channelTabs__btn");
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((body) => body.includes("@include cp-segmented-item;"))).toBe(true);
  });

  it("顶栏标题 14px/700 display，不做 uppercase", () => {
    const bodies = ruleBodies(patchbayScss, ".cp-topConsole__title");
    expect(bodies.length).toBeGreaterThan(0);
    const body = bodies[0] ?? "";
    expect(declares(body, "font-size: 14px")).toBe(true);
    expect(declares(body, "font-weight: 700")).toBe(true);
    expect(declares(body, "text-transform: none")).toBe(true);
    expect(body).not.toMatch(/text-transform:\s*uppercase/);
  });

  it("顶栏图标按钮复用 cp-icon-button 规格", () => {
    const body = sharedRuleBody(
      patchbayScss,
      ".cp-topConsole__search, .cp-topConsole__pinMembers, .cp-topConsole__settings",
    );
    expect(body).not.toBe("");
    expect(body).toContain("@include cp-icon-button;");
  });

  it("接收气泡使用 panel + border-light，自己的消息保留 accent 12%", () => {
    const bubbles = ruleBodies(patchbayScss, ".cp-bubble");
    expect(bubbles.length).toBeGreaterThan(0);
    const body = bubbles[0] ?? "";
    expect(declares(body, "background: var(--cp-panel)")).toBe(true);
    expect(declares(body, "border: 1px solid var(--cp-border-light)")).toBe(true);
    expect(patchbayScss).toMatch(
      /\.cp-msg\[data-mine="true"\] \.cp-bubble\s*\{[\s\S]*?background:\s*color-mix\(in oklab, var\(--cp-accent\) 12%, var\(--cp-panel\)\)/,
    );
  });

  it("保留 @container 520/400 窄宽度断点（消息密度契约）", () => {
    expect(patchbayScss).toContain("@container (max-width: 520px)");
    expect(patchbayScss).toContain("@container (max-width: 400px)");
  });
});
