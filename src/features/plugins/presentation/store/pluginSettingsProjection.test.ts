/**
 * @fileoverview plugins｜store：插件设置项响应式投影单测。
 * @description
 * 覆盖 domainRegistryStore 的「插件注册设置项 → Vue 响应式投影 → 停用后清空」链路：
 * - 保留真实 `applyPlugin` / `createServerRuntime` / 注册表，只替换入口模块加载与端口/运行时入口查询；
 * - 断言投影条目保留组件原始引用（即已 `markRaw`，未被深度代理）。
 */

import { describe, expect, it, vi } from "vitest";
import type { Component } from "vue";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import { useDomainRegistryStore } from "./domainRegistryStore";

const SETTINGS_CONTROL = { name: "SettingsControlStub" } as unknown as Component;
const PLUGIN_ID = "settings-demo";

/** 已安装插件状态（启用且健康）。 */
const installedState = {
  pluginId: PLUGIN_ID,
  installedVersions: ["1.0.0"],
  currentVersion: "1.0.0",
  enabled: true,
  status: "ok" as const,
  lastError: "",
};

/** 运行时入口（`ui` 权限 + 入口 API v2）。 */
function runtimeEntry(): PluginRuntimeEntry {
  return {
    serverId: "srv-settings",
    pluginId: PLUGIN_ID,
    version: "1.0.0",
    entry: "index.js",
    permissions: ["ui"],
    providesDomains: [],
    minHostVersion: "0.0.0",
    entryApiVersion: 2,
    ipcPrefixes: [],
  };
}

vi.mock("@/features/plugins/di/plugins.di", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/plugins/di/plugins.di")>();
  return {
    ...actual,
    getPluginInstallQueryPort: () => ({ listInstalled: async () => [installedState] }),
    getPluginLifecycleCommandPort: () => ({ setFailed: async () => {} }),
  };
});

vi.mock("@/features/plugins/presentation/runtime/pluginRuntime", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/plugins/presentation/runtime/pluginRuntime")>();
  return {
    ...actual,
    getRuntimeEntry: async () => runtimeEntry(),
    getRuntimeEntryForVersion: async () => runtimeEntry(),
  };
});

// 只替换「入口模块加载」：返回一个会注册设置项的 v2 插件模块，
// 保留真实 applyPlugin / createServerRuntime / 注册表实现。
vi.mock("@/features/plugins/runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/plugins/runtime")>();
  return {
    ...actual,
    loadPluginRuntimeModule: async (runtime: PluginRuntimeEntry) =>
      actual.normalizePluginRuntimeModule(runtime, {
        name: PLUGIN_ID,
        // 声明依赖可避免 Cordis「property ui is not registered」告警。
        inject: ["ui"],
        apply(ctx: { ui?: { registerSettingsItem(input: unknown): () => void } }) {
          ctx.ui?.registerSettingsItem({
            id: "backend",
            title: "AI 摘要后端",
            description: "选择生成总结所走的通道",
            keywords: ["后端", "backend"],
            order: 10,
            component: SETTINGS_CONTROL,
          });
        },
      }),
  };
});

describe("domainRegistryStore 插件设置项投影", () => {
  it("启用插件后投影设置项，停用后清空且保留组件原始引用", async () => {
    // 注意：store 是模块级按 socket 缓存，两个用例使用不同 socket 以避免相互影响。
    const store = useDomainRegistryStore("srv-settings-projection");

    await store.ensureLoaded();

    expect(store.pluginSettingsItems).toHaveLength(1);
    const item = store.pluginSettingsItems[0]!;
    expect(item).toMatchObject({
      pluginId: PLUGIN_ID,
      id: "backend",
      title: "AI 摘要后端",
      description: "选择生成总结所走的通道",
      order: 10,
      serverSocket: "srv-settings-projection",
    });
    expect(item.keywords).toEqual(["后端", "backend"]);
    // markRaw 生效时组件保持原始引用（被深度代理会得到另一个对象）。
    expect(item.component).toBe(SETTINGS_CONTROL);

    await store.disablePluginRuntime(PLUGIN_ID);
    expect(store.pluginSettingsItems).toEqual([]);
    expect(store.loadedById[PLUGIN_ID]).toBeUndefined();
  });

  it("未加载任何插件时投影为空数组", () => {
    const store = useDomainRegistryStore("srv-settings-empty");
    expect(store.pluginSettingsItems).toEqual([]);
  });
});
