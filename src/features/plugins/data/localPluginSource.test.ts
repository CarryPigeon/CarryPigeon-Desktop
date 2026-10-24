/**
 * @fileoverview localPluginSource 单元测试。
 * @description 验证本地插件源注册表、开关解析与默认启用安装态推导。
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ENABLED_PLUGIN_IDS,
  alignInstalledStateWithLocalSource,
  getEnabledLocalPluginIds,
  getLocalInstalledState,
  getLocalPluginRuntimeEntry,
  getDefaultLocalEnabledPluginIds,
  isLocalPluginDisabled,
  isLocalPluginSourceEnabled,
  listLocalDefaultInstalledStates,
  listLocalInstalledStates,
  listLocalPluginCatalogEntries,
  resolveEnabledLocalPluginIds,
  setLocalPluginDisabled,
} from "./localPluginSource";

const VALID_IDS = ["voice-call", "theme", "markdown", "group-notice", "ai-summary"];

describe("localPluginSource", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("默认启用列表只包含四个新插件", () => {
    expect([...DEFAULT_ENABLED_PLUGIN_IDS]).toEqual(["theme", "markdown", "group-notice", "ai-summary"]);
  });

  it("VITE_USE_LOCAL_PLUGINS 支持逗号分隔且去重", () => {
    vi.stubEnv("VITE_USE_LOCAL_PLUGINS", " theme , markdown,,theme ");
    expect([...getEnabledLocalPluginIds()]).toEqual(["theme", "markdown"]);
  });

  it("旧开关 VITE_USE_LOCAL_VOICE_CALL_PLUGIN 仍可单独启用 voice-call", () => {
    vi.stubEnv("VITE_USE_LOCAL_PLUGINS", "");
    vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "true");
    expect(getEnabledLocalPluginIds()).toContain("voice-call");
  });

  it("注册表内的插件可构造 runtime entry", () => {
    for (const id of VALID_IDS) {
      const entry = getLocalPluginRuntimeEntry("server-1", id);
      expect(entry.pluginId).toBe(id);
      expect(entry.entry).toBe(`/plugins/${id}/index.js`);
      expect(entry.serverId).toBe("server-1");
      expect(entry.minHostVersion).toBe("0.0.0");
    }
  });

  it("注册表外的插件构造 entry 时抛错", () => {
    expect(() => getLocalPluginRuntimeEntry("server-1", "unknown.plugin")).toThrow(/not found/i);
  });

  it("未设置 env 时（dev 与 release 一致）默认启用自带插件", () => {
    // 回归：release 下 import.meta.env.DEV === false，不得再据此关闭自带插件，
    // 否则打包后的插件中心看不到任何自带插件。
    vi.stubEnv("VITE_USE_LOCAL_PLUGINS", undefined as unknown as string);
    vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "false");
    expect([...getEnabledLocalPluginIds()]).toEqual([...DEFAULT_ENABLED_PLUGIN_IDS]);
    expect([...resolveEnabledLocalPluginIds(undefined)]).toEqual([...DEFAULT_ENABLED_PLUGIN_IDS]);
    expect([...resolveEnabledLocalPluginIds(null)]).toEqual([...DEFAULT_ENABLED_PLUGIN_IDS]);
  });

  it("显式设置空字符串可关闭本地源", () => {
    vi.stubEnv("VITE_USE_LOCAL_PLUGINS", "");
    vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "false");
    expect(getEnabledLocalPluginIds()).toEqual([]);
  });

  it("isLocalPluginSourceEnabled 按开关列表判断", () => {
    vi.stubEnv("VITE_USE_LOCAL_PLUGINS", "theme");
    vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "false");
    expect(isLocalPluginSourceEnabled("theme")).toBe(true);
    expect(isLocalPluginSourceEnabled("markdown")).toBe(false);
    expect(isLocalPluginSourceEnabled("")).toBe(false);
  });

  it("未启用本地源时默认安装态列表为空", () => {
    vi.stubEnv("VITE_USE_LOCAL_PLUGINS", "");
    vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "false");
    expect(listLocalDefaultInstalledStates("server-1")).toEqual([]);
  });

  it("启用本地源时默认插件被推导为 installed+enabled", () => {
    vi.stubEnv("VITE_USE_LOCAL_PLUGINS", "theme,markdown,group-notice,ai-summary");
    vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "false");
    const states = listLocalDefaultInstalledStates("server-1");
    expect(states.map((s) => s.pluginId)).toEqual([...getDefaultLocalEnabledPluginIds()]);
    for (const state of states) {
      expect(state.enabled).toBe(true);
      expect(state.status).toBe("ok");
      expect(state.currentVersion).toBe(state.installedVersions[0]);
    }
  });

  it("仅列出开关中启用的默认插件（voice-call 不参与默认启用）", () => {
    vi.stubEnv("VITE_USE_LOCAL_PLUGINS", "voice-call,markdown");
    vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "false");
    const states = listLocalDefaultInstalledStates("server-1");
    expect(states.map((s) => s.pluginId)).toEqual(["markdown"]);
  });

  it("目录条目注入：启用的本地源插件生成 catalog entry", () => {
    vi.stubEnv("VITE_USE_LOCAL_PLUGINS", "theme,markdown,group-notice,ai-summary");
    vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "false");
    const entries = listLocalPluginCatalogEntries();
    expect(entries.map((e) => e.pluginId)).toEqual([
      "theme",
      "markdown",
      "group-notice",
      "ai-summary",
    ]);
    for (const entry of entries) {
      expect(entry.versions.length).toBeGreaterThan(0);
      expect(entry.versionEntries.length).toBe(entry.versions.length);
      expect(entry.name).not.toBe("");
      expect(entry.description).not.toBe("");
    }
    const markdown = entries.find((e) => e.pluginId === "markdown")!;
    expect(markdown.providesDomains.some((d) => d.id === "markdown")).toBe(true);
  });

  it("目录条目注入：未启用本地源时为空", () => {
    vi.stubEnv("VITE_USE_LOCAL_PLUGINS", "");
    vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "false");
    expect(listLocalPluginCatalogEntries()).toEqual([]);
  });

  it("停用标记：disable 后安装态列表排除该插件，重新启用后恢复", () => {
    vi.stubEnv("VITE_USE_LOCAL_PLUGINS", "theme,markdown");
    vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "false");
    localStorage.clear();
    expect(listLocalDefaultInstalledStates("server-1").map((s) => s.pluginId)).toEqual(["theme", "markdown"]);
    setLocalPluginDisabled("server-1", "theme", true);
    expect(isLocalPluginDisabled("server-1", "theme")).toBe(true);
    expect(listLocalDefaultInstalledStates("server-1").map((s) => s.pluginId)).toEqual(["markdown"]);
    expect(getLocalInstalledState("server-1", "theme")?.enabled).toBe(false);
    setLocalPluginDisabled("server-1", "theme", false);
    expect(listLocalDefaultInstalledStates("server-1").map((s) => s.pluginId)).toEqual(["theme", "markdown"]);
  });

  it("停用标记按 server key 隔离", () => {
    vi.stubEnv("VITE_USE_LOCAL_PLUGINS", "theme");
    vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "false");
    localStorage.clear();
    setLocalPluginDisabled("server-1", "theme", true);
    expect(isLocalPluginDisabled("server-2", "theme")).toBe(false);
  });

  it("getLocalInstalledState 对非本地源插件返回 null", () => {
    vi.stubEnv("VITE_USE_LOCAL_PLUGINS", "theme");
    vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "false");
    localStorage.clear();
    expect(getLocalInstalledState("server-1", "markdown")).toBeNull();
    expect(getLocalInstalledState("server-1", "unknown")).toBeNull();
  });

  it("listLocalInstalledStates 覆盖全部本地源插件（含被停用的）", () => {
    // 回归：本地源插件安装态以本地源为权威（覆盖 Rust 残留记录），
    // 停用条目需以 enabled:false 出现（而非从列表中消失）。
    vi.stubEnv("VITE_USE_LOCAL_PLUGINS", "theme,markdown");
    vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "false");
    localStorage.clear();
    let states = listLocalInstalledStates("server-1");
    expect(states.map((s) => s.pluginId)).toEqual(["theme", "markdown"]);
    expect(states.every((s) => s.enabled)).toBe(true);

    setLocalPluginDisabled("server-1", "theme", true);
    states = listLocalInstalledStates("server-1");
    expect(states.map((s) => s.pluginId)).toEqual(["theme", "markdown"]);
    expect(states.find((s) => s.pluginId === "theme")?.enabled).toBe(false);
    expect(states.find((s) => s.pluginId === "markdown")?.enabled).toBe(true);

    setLocalPluginDisabled("server-1", "theme", false);
    states = listLocalInstalledStates("server-1");
    expect(states.every((s) => s.enabled)).toBe(true);
  });

  it("listLocalInstalledStates 仅列出开关中启用的本地源插件", () => {
    vi.stubEnv("VITE_USE_LOCAL_PLUGINS", "ai-summary");
    vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "false");
    localStorage.clear();
    const states = listLocalInstalledStates("server-1");
    expect(states.map((s) => s.pluginId)).toEqual(["ai-summary"]);
    expect(states[0]?.currentVersion).toBe(getLocalPluginRuntimeEntry("server-1", "ai-summary").version);
  });

  describe("alignInstalledStateWithLocalSource", () => {
    it("本地源插件的旧版本安装态被对齐到本地源版本", () => {
      // 回归：历史落盘的 0.1.0 与本地源 0.2.0 不一致时，协调器会反复重挂插件。
      const localVersion = getLocalPluginRuntimeEntry("server-1", "ai-summary").version;
      const stale = {
        pluginId: "ai-summary",
        installedVersions: ["0.1.0"],
        currentVersion: "0.1.0",
        enabled: true,
        status: "ok" as const,
        lastError: "",
      };
      const aligned = alignInstalledStateWithLocalSource(stale);
      expect(aligned.currentVersion).toBe(localVersion);
      expect(aligned.installedVersions).toEqual([localVersion]);
      expect(aligned.enabled).toBe(true);
      expect(aligned.status).toBe("ok");
    });

    it("已对齐的安装态原样返回（引用不变）", () => {
      const localVersion = getLocalPluginRuntimeEntry("server-1", "theme").version;
      const state = {
        pluginId: "theme",
        installedVersions: [localVersion],
        currentVersion: localVersion,
        enabled: true,
        status: "ok" as const,
        lastError: "",
      };
      expect(alignInstalledStateWithLocalSource(state)).toBe(state);
    });

    it("非本地源插件的安装态原样返回（引用不变）", () => {
      const state = {
        pluginId: "some-server-plugin",
        installedVersions: ["0.3.0"],
        currentVersion: "0.3.0",
        enabled: true,
        status: "ok" as const,
        lastError: "",
      };
      expect(alignInstalledStateWithLocalSource(state)).toBe(state);
    });

    it("本地源未启用（env 显式关闭）时不对齐", () => {
      vi.stubEnv("VITE_USE_LOCAL_PLUGINS", "");
      vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "false");
      const state = {
        pluginId: "ai-summary",
        installedVersions: ["0.1.0"],
        currentVersion: "0.1.0",
        enabled: true,
        status: "ok" as const,
        lastError: "",
      };
      expect(alignInstalledStateWithLocalSource(state)).toBe(state);
    });
  });
});
