/**
 * @fileoverview localPluginSource 单元测试。
 * @description 验证本地插件源注册表、开关解析与默认启用安装态推导。
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ENABLED_PLUGIN_IDS,
  getEnabledLocalPluginIds,
  getLocalInstalledState,
  getLocalPluginRuntimeEntry,
  getDefaultLocalEnabledPluginIds,
  isLocalPluginDisabled,
  isLocalPluginSourceEnabled,
  listLocalDefaultInstalledStates,
  listLocalPluginCatalogEntries,
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

  it("dev 下未设置 env 时默认启用四个新插件", () => {
    // vitest 运行于 DEV 模式：未设置 VITE_USE_LOCAL_PLUGINS 时回落到 dev 默认列表。
    vi.stubEnv("VITE_USE_LOCAL_PLUGINS", undefined as unknown as string);
    vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "false");
    expect([...getEnabledLocalPluginIds()]).toEqual([...DEFAULT_ENABLED_PLUGIN_IDS]);
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
});
