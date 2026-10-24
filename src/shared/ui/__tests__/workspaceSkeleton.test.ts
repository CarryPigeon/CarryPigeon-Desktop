/**
 * @fileoverview workspaceSkeleton.test.ts
 * @description 样式契约：全应用统一使用「无缝工作台」骨架（单张玻璃面 + 8px 留白 + 紧凑头部）。
 *
 * 背景：聊天主窗口原本是唯一例外，现将其视觉语言提升为全应用基准：
 * 1) 页面根节点使用 `cp-workspace`，玻璃面由 mixin 的固定伪元素统一承载；
 * 2) `PageHeader` 去掉独立玻璃面板，改用 `cp-console` 紧凑控制台；
 * 3) `SectionHead` / `PanelGroup` / `PanelRow` 收紧密度并去掉版式分隔线；
 * 4) 迁移后的页面不得再使用 `cp-page` / `cp-glass-panel` 作为页面级外壳。
 */

import { describe, expect, it } from "vitest";
import appSource from "@/App.vue?raw";
import uiScss from "@/styles/_ui.scss?raw";
import pageHeaderSource from "../PageHeader.vue?raw";
import sectionHeadSource from "../SectionHead.vue?raw";
import panelGroupSource from "../panel/PanelGroup.vue?raw";
import panelRowSource from "../panel/PanelRow.vue?raw";
import fileListTableSource from "@/features/files/presentation/components/FileListTable.vue?raw";
import settingsSource from "@/features/settings/presentation/pages/SettingsPage.vue?raw";
import emojiSource from "@/features/settings/presentation/pages/EmojiManagePage.vue?raw";
import pluginCenterSource from "@/features/plugins/presentation/pages/PluginCenterPage.vue?raw";
import pluginDetailSource from "@/features/plugins/presentation/pages/PluginDetailPage.vue?raw";
import domainCatalogSource from "@/features/plugins/presentation/pages/DomainCatalogPage.vue?raw";
import fileManagerSource from "@/features/files/presentation/pages/FileManagerPage.vue?raw";
import serverManagerSource from "@/features/server-connection/rack/presentation/pages/ServerManagerPage.vue?raw";
import aboutSource from "@/features/about/presentation/pages/AboutPage.vue?raw";
import savedMessagesSource from "@/features/chat/message-flow/bookmark/presentation/SavedMessagesPage.vue?raw";
import channelInfoSource from "@/features/chat/presentation/channel-info/ChannelInfoPage.vue?raw";
import governanceShellSource from "@/features/chat/room-governance/presentation/components/GovernancePageShell.vue?raw";
import userInfoSource from "@/features/account/profile/presentation/pages/UserInfoPage.vue?raw";
import requiredSetupSource from "@/features/account/auth-flow/presentation/pages/RequiredSetupPage.vue?raw";
import loginSource from "@/features/account/auth-flow/presentation/pages/LoginPage.vue?raw";
import registerSource from "@/features/account/auth-flow/presentation/pages/RegisterPage.vue?raw";

/** 取源码中某选择器的第一条规则声明体。 */
function ruleBody(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(source);
  return match?.[1] ?? "";
}

/** 断言页面使用工作台骨架，且不再出现页面级玻璃面板。 */
function expectWorkspace(source: string): void {
  expect(source).toContain("@include cp-workspace");
  expect(source).not.toContain("@include cp-glass-panel");
}

describe("无缝工作台骨架契约", () => {
  it("App.vue 声明 8px 工作台留白与 14px 分区头间距", () => {
    expect(appSource).toMatch(/--cp-workspace-pad:\s*8px;/);
    expect(appSource).toMatch(/--cp-section-head-gap:\s*14px;/);
  });

  it("_ui.scss 提供工作台/区域/控制台/行列表 mixin，玻璃面固定到视口", () => {
    for (const mixin of [
      "cp-workspace",
      "cp-region",
      "cp-console",
      "cp-console-title",
      "cp-console-sub",
      "cp-rail-list",
      "cp-nav-row",
    ]) {
      expect(uiScss).toContain(`@mixin ${mixin}`);
    }

    expect(uiScss).toMatch(/position:\s*fixed;/);
    expect(uiScss).toMatch(/inset:\s*\$pad;/);
    expect(uiScss).toMatch(/border-radius:\s*var\(--cp-radius-lg\);/);
    expect(uiScss).toMatch(/background:\s*var\(--cp-surface\);/);
    expect(uiScss).toMatch(/backdrop-filter:\s*var\(--cp-glass-blur\);/);
    expect(uiScss).toMatch(/box-shadow:\s*var\(--cp-shadow-soft\);/);
    expect(uiScss).toMatch(/pointer-events:\s*none;/);
  });

  it("共享组件按工作台规格收紧：头部无玻璃面、分区头 28px、行无分隔线", () => {
    expect(pageHeaderSource).not.toContain("cp-glass-panel");
    expect(pageHeaderSource).toContain("@include cp-console");
    expect(pageHeaderSource).toContain("@include cp-console-title");

    const sectionHeadBody = ruleBody(sectionHeadSource, ".cp-section-head__icon");
    expect(sectionHeadBody).toMatch(/width:\s*28px;/);
    expect(sectionHeadBody).toMatch(/height:\s*28px;/);
    expect(sectionHeadSource).toContain("@include cp-section-title");

    const navRowMixins = uiScss.match(/@mixin cp-nav-row\s*\{([\s\S]*?)\n\}/);
    expect(navRowMixins?.[1] ?? "").toMatch(/min-height:\s*30px;/);

    expect(panelRowSource).not.toContain("border-top");
    expect(panelRowSource).toContain("@include cp-list-row");
    expect(panelGroupSource).not.toContain("border-bottom");
    expect(panelGroupSource).not.toContain("border-top");
    expect(panelGroupSource).toContain("@include cp-card");
  });

  it("工作台密度：分区标题 14px、列表行 10/12、文件行 44px 无分隔线", () => {
    expect(uiScss).toMatch(/@mixin cp-section-title\s*\{[\s\S]*?font-size:\s*14px;/);
    expect(uiScss).toMatch(/@mixin cp-list-row\s*\{[\s\S]*?padding:\s*10px 12px;/);

    const fileRow = ruleBody(fileListTableSource, ".cp-fileTable__row");
    expect(fileRow).toMatch(/min-height:\s*44px;/);
    expect(fileRow).not.toMatch(/border-bottom\s*:/);
  });

  it("所有主窗口页面使用 cp-workspace，不再保留页面级玻璃面板", () => {
    for (const source of [
      settingsSource,
      emojiSource,
      pluginCenterSource,
      pluginDetailSource,
      domainCatalogSource,
      fileManagerSource,
      serverManagerSource,
      aboutSource,
      savedMessagesSource,
      channelInfoSource,
      governanceShellSource,
      userInfoSource,
      requiredSetupSource,
      loginSource,
      registerSource,
    ]) {
      expectWorkspace(source);
    }
  });
});
