/**
 * @fileoverview mockPluginManager 默认启用单元测试。
 * @description 从插件中心数据源视角（queryPort.listInstalled）验证：
 * 四个默认插件开箱即 installed+enabled，且用户显式 disable/uninstall 不被补齐覆盖。
 */

import { beforeEach, describe, expect, it } from "vitest";
import { mockPluginInstallQueryAdapter, mockPluginLifecycleCommandAdapter } from "./mockPluginManager";
import { DEFAULT_ENABLED_PLUGIN_IDS } from "@/features/plugins/data/localPluginSource";
import { clearMockPluginsState } from "@/shared/mock/mockPluginState";

const SERVER = "mock://plugin-center";

describe("mockPluginManager 默认启用（插件中心视角）", () => {
  beforeEach(() => {
    localStorage.clear();
    clearMockPluginsState(SERVER);
  });

  it("listInstalled 首次刷新即包含四个默认插件且均为 installed+enabled", async () => {
    const list = await mockPluginInstallQueryAdapter.listInstalled(SERVER);
    for (const id of DEFAULT_ENABLED_PLUGIN_IDS) {
      const item = list.find((x) => x.pluginId === id);
      expect(item, `plugin ${id} should be listed`).toBeDefined();
      expect(item?.enabled).toBe(true);
      expect(item?.status).toBe("ok");
      expect(item?.currentVersion).toBeTruthy();
    }
  });

  it("getInstalledState 对默认插件返回 enabled 状态", async () => {
    const state = await mockPluginInstallQueryAdapter.getInstalledState(SERVER, "theme");
    expect(state).not.toBeNull();
    expect(state?.enabled).toBe(true);
  });

  it("用户显式 disable 后刷新不会被补齐覆盖", async () => {
    // 插件中心真实流程：先 refresh（补齐默认启用），用户再点击 disable。
    await mockPluginInstallQueryAdapter.listInstalled(SERVER);
    await mockPluginLifecycleCommandAdapter.disable(SERVER, "theme");
    const list = await mockPluginInstallQueryAdapter.listInstalled(SERVER);
    const theme = list.find((x) => x.pluginId === "theme");
    expect(theme?.enabled).toBe(false);
  });

  it("用户显式 uninstall 后刷新不再列出该插件", async () => {
    await mockPluginInstallQueryAdapter.listInstalled(SERVER);
    await mockPluginLifecycleCommandAdapter.uninstall(SERVER, "markdown");
    const list = await mockPluginInstallQueryAdapter.listInstalled(SERVER);
    expect(list.some((x) => x.pluginId === "markdown")).toBe(false);
  });
});
