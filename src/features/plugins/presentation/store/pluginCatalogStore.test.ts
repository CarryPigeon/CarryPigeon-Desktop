/**
 * @fileoverview pluginCatalogStore 单元测试。
 * @description
 * 验证目录拉取失败时的兜底行为：服务端/repo 目录不可用时，插件中心仍保留自带插件条目
 * （回归场景：release 包连不上服务器时，连随宿主分发的自带插件也一起消失）。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ENABLED_PLUGIN_IDS } from "@/features/plugins/data/localPluginSource";

const { listCatalogMock } = vi.hoisted(() => ({ listCatalogMock: vi.fn() }));

vi.mock("@/features/plugins/di/plugins.di", () => ({
  getPluginCatalogPort: () => ({ listCatalog: listCatalogMock }),
  getRepoPluginCatalogPort: () => ({ listCatalog: vi.fn() }),
}));

import { startPluginCatalogRuntime, stopPluginCatalogRuntime, usePluginCatalogStore } from "./pluginCatalogStore";

const SERVER = "mock://handshake";

function useBundledDefaults(): void {
  vi.stubEnv("VITE_USE_LOCAL_PLUGINS", undefined as unknown as string);
  vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "false");
}

describe("pluginCatalogStore", () => {
  beforeEach(() => {
    startPluginCatalogRuntime();
    useBundledDefaults();
  });

  afterEach(() => {
    stopPluginCatalogRuntime();
    listCatalogMock.mockReset();
    vi.unstubAllEnvs();
  });

  it("目录拉取失败时回退为自带插件条目", async () => {
    listCatalogMock.mockRejectedValue(new Error("catalog offline"));
    const store = usePluginCatalogStore(SERVER);

    await store.refresh();

    expect(store.catalog.value.map((entry) => entry.pluginId).sort()).toEqual(
      [...DEFAULT_ENABLED_PLUGIN_IDS].sort(),
    );
    expect(store.error.value).toContain("catalog offline");
    // 兜底条目同样要带上版本信息，避免 UI 显示“无可用版本”。
    for (const entry of store.catalog.value) {
      expect(entry.versions.length).toBeGreaterThan(0);
      expect(entry.versionEntries.length).toBe(entry.versions.length);
    }
  });

  it("目录拉取成功时自带插件与服务端条目合并", async () => {
    listCatalogMock.mockResolvedValue([
      {
        pluginId: "markdown",
        name: "Server Markdown",
        tagline: "server side",
        description: "server side markdown",
        source: "server",
        sha256: "s".repeat(64),
        required: true,
        versions: ["9.9.9"],
        providesDomains: [],
        permissions: [],
      },
    ]);
    const store = usePluginCatalogStore(SERVER);

    await store.refresh();

    const ids = store.catalog.value.map((entry) => entry.pluginId);
    for (const id of DEFAULT_ENABLED_PLUGIN_IDS) expect(ids).toContain(id);
    const markdown = store.catalog.value.find((entry) => entry.pluginId === "markdown")!;
    expect(markdown.versions).toContain("9.9.9");
    expect(markdown.versions).toContain("0.1.0");
    expect(store.error.value).toBe("");
  });
});
