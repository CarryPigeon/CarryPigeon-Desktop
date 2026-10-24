/**
 * @fileoverview mockPluginManager 默认启用单元测试。
 * @description 从插件中心数据源视角（queryPort.listInstalled）验证：
 * 四个默认插件开箱即 installed+enabled，且用户显式 disable/uninstall 不被补齐覆盖。
 */

import { beforeEach, describe, expect, it } from "vitest";
import { mockPluginInstallQueryAdapter, mockPluginLifecycleCommandAdapter } from "./mockPluginManager";
import { DEFAULT_ENABLED_PLUGIN_IDS, getLocalPluginRuntimeEntry } from "@/features/plugins/data/localPluginSource";
import { clearMockPluginsState, setMockPluginsState } from "@/shared/mock/mockPluginState";

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

  it("历史落盘的旧版本记录被对齐到本地源版本（防运行时反复重挂）", async () => {
    // 回归场景：mock 状态在首次运行时按当时目录版本（如 0.1.0）落盘且不再更新；
    // 插件随宿主升级（0.2.0）后，若安装态仍报 0.1.0，运行时协调器会因
    // 「已加载版本 ≠ 安装记录版本」在每次 ensureLoaded 时卸载并重挂插件，
    // 设置页「插件设置」分区随之反复消失/重置。
    const localVersion = getLocalPluginRuntimeEntry(SERVER, "ai-summary").version;
    expect(localVersion).not.toBe("0.1.0");
    setMockPluginsState(SERVER, {
      "ai-summary": {
        installedVersions: ["0.1.0"],
        currentVersion: "0.1.0",
        enabled: true,
        status: "ok",
        lastError: "",
      },
    });
    // 已有补齐 marker：确保不会被默认启用逻辑覆盖，模拟真实历史数据。
    localStorage.setItem(`carrypigeon:mock:pluginDefaultEnabled:${SERVER}:ai-summary`, "applied");

    const list = await mockPluginInstallQueryAdapter.listInstalled(SERVER);
    const item = list.find((x) => x.pluginId === "ai-summary");
    expect(item?.currentVersion).toBe(localVersion);
    expect(item?.installedVersions).toEqual([localVersion]);
    expect(item?.enabled).toBe(true);

    const single = await mockPluginInstallQueryAdapter.getInstalledState(SERVER, "ai-summary");
    expect(single?.currentVersion).toBe(localVersion);
  });

  it("版本对齐保留用户的停用意图与失败态", async () => {
    setMockPluginsState(SERVER, {
      "ai-summary": {
        installedVersions: ["0.1.0"],
        currentVersion: "0.1.0",
        enabled: false,
        status: "failed",
        lastError: "boom",
      },
    });
    localStorage.setItem(`carrypigeon:mock:pluginDefaultEnabled:${SERVER}:ai-summary`, "applied");

    const item = (await mockPluginInstallQueryAdapter.listInstalled(SERVER)).find(
      (x) => x.pluginId === "ai-summary",
    );
    expect(item?.currentVersion).toBe(getLocalPluginRuntimeEntry(SERVER, "ai-summary").version);
    expect(item?.enabled).toBe(false);
    expect(item?.status).toBe("failed");
    expect(item?.lastError).toBe("boom");
  });
});
