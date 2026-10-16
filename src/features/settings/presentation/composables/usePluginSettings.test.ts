/**
 * @fileoverview settings｜usePluginSettings 单测。
 * @description 覆盖：按当前 server 读取插件设置项与分组、切服务器后清空、无 server 时不调用能力面、
 * `ensureLoaded` 触发一次运行时加载且失败被吞。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import type { Component } from "vue";
import type { PluginSettingsContribution } from "@/features/plugins/api-types";

const ensureRuntimeLoaded = vi.fn(async () => {});
const listPluginSettingsItems = vi.fn<() => readonly PluginSettingsContribution[]>(() => []);
const forServer = vi.fn(() => ({ ensureRuntimeLoaded, listPluginSettingsItems }));

vi.mock("@/features/plugins/api", () => ({
  getPluginsCapabilities: () => ({ forServer }),
}));

/** 构造一条插件设置项。 */
function contribution(pluginId: string, id: string, order = 0): PluginSettingsContribution {
  return {
    id,
    title: `title-${id}`,
    description: "",
    keywords: [],
    order,
    component: { name: id } as unknown as Component,
    pluginId,
    serverSocket: "srv-a",
  };
}

describe("usePluginSettings", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    listPluginSettingsItems.mockReturnValue([]);
    const { currentServerSocket } = await import("@/features/server-connection/api");
    currentServerSocket.value = "";
  });

  it("按当前 server 读取设置项并按插件分组", async () => {
    const { currentServerSocket } = await import("@/features/server-connection/api");
    currentServerSocket.value = "srv-a";
    listPluginSettingsItems.mockReturnValue([
      contribution("ai-summary", "backend"),
      contribution("theme", "appearance", 5),
      contribution("ai-summary", "scope"),
    ]);

    const { usePluginSettings } = await import("./usePluginSettings");
    const model = usePluginSettings();
    await nextTick();

    expect(model.socket.value).toBe("srv-a");
    // 读取 items 才会真正触发能力面（computed 惰性求值）。
    expect(model.items.value.map((item) => item.id)).toEqual(["backend", "appearance", "scope"]);
    expect(model.groups.value.map((group) => `${group.pluginId}:${group.items.length}`)).toEqual([
      "ai-summary:2",
      "theme:1",
    ]);
    expect(forServer).toHaveBeenCalledWith("srv-a");
  });

  it("无当前 server 时不读取能力面且列表为空", async () => {
    const { usePluginSettings } = await import("./usePluginSettings");
    const model = usePluginSettings();

    expect(model.socket.value).toBe("__no_server__");
    expect(model.items.value).toEqual([]);
    expect(model.groups.value).toEqual([]);
    expect(forServer).not.toHaveBeenCalled();
  });

  it("切换 server 后重新读取（不同 server 各自一份设置项）", async () => {
    const { currentServerSocket } = await import("@/features/server-connection/api");
    currentServerSocket.value = "srv-a";
    listPluginSettingsItems.mockReturnValue([contribution("ai-summary", "backend")]);

    const { usePluginSettings } = await import("./usePluginSettings");
    const model = usePluginSettings();
    expect(model.items.value).toHaveLength(1);

    listPluginSettingsItems.mockReturnValue([]);
    currentServerSocket.value = "srv-b";
    await nextTick();
    expect(model.socket.value).toBe("srv-b");
    expect(model.items.value).toEqual([]);
  });

  it("ensureLoaded 触发运行时加载；失败只告警不抛错", async () => {
    const { currentServerSocket } = await import("@/features/server-connection/api");
    currentServerSocket.value = "srv-a";
    ensureRuntimeLoaded.mockRejectedValueOnce(new Error("boom"));

    const { usePluginSettings } = await import("./usePluginSettings");
    const model = usePluginSettings();

    expect(() => model.ensureLoaded()).not.toThrow();
    await nextTick();
    expect(ensureRuntimeLoaded).toHaveBeenCalledTimes(1);
  });

  it("无当前 server 时 ensureLoaded 不触发加载", async () => {
    const { usePluginSettings } = await import("./usePluginSettings");
    const model = usePluginSettings();
    model.ensureLoaded();
    expect(ensureRuntimeLoaded).not.toHaveBeenCalled();
  });
});
