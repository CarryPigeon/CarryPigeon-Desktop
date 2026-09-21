/**
 * @fileoverview mockPluginState 默认启用补齐单元测试。
 * @description 验证幂等补齐、显式 disable/uninstall 不被覆盖、clear 后可重新补齐。
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearMockPluginsState,
  ensureDefaultEnabledMockPlugins,
  getMockPluginsState,
  setMockPluginsState,
} from "./mockPluginState";

const SERVER = "mock://unit";

describe("ensureDefaultEnabledMockPlugins", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("首次调用为默认插件补齐 installed+enabled 状态", () => {
    const changed = ensureDefaultEnabledMockPlugins(SERVER, ["theme", "markdown"]);
    expect(changed).toBe(true);
    const state = getMockPluginsState(SERVER);
    expect(state.theme).toMatchObject({ enabled: true, status: "ok", currentVersion: "0.1.0" });
    expect(state.markdown.enabled).toBe(true);
  });

  it("补齐幂等：已有条目或 marker 存在时不重复写入", () => {
    expect(ensureDefaultEnabledMockPlugins(SERVER, ["theme"])).toBe(true);
    expect(ensureDefaultEnabledMockPlugins(SERVER, ["theme"])).toBe(false);
    // 显式 disable 后（条目存在且 enabled=false），不再被补齐覆盖。
    const state = getMockPluginsState(SERVER);
    state.theme.enabled = false;
    setMockPluginsState(SERVER, state);
    expect(ensureDefaultEnabledMockPlugins(SERVER, ["theme"])).toBe(false);
    expect(getMockPluginsState(SERVER).theme.enabled).toBe(false);
  });

  it("uninstall 删除条目后 marker 阻止重新补齐", () => {
    ensureDefaultEnabledMockPlugins(SERVER, ["theme"]);
    const state = getMockPluginsState(SERVER);
    delete state.theme;
    setMockPluginsState(SERVER, state);
    expect(ensureDefaultEnabledMockPlugins(SERVER, ["theme"])).toBe(false);
    expect(getMockPluginsState(SERVER).theme).toBeUndefined();
  });

  it("clear 后 marker 一并清除，默认插件可重新补齐", () => {
    ensureDefaultEnabledMockPlugins(SERVER, ["theme"]);
    clearMockPluginsState(SERVER);
    expect(getMockPluginsState(SERVER).theme).toBeUndefined();
    expect(ensureDefaultEnabledMockPlugins(SERVER, ["theme"])).toBe(true);
    expect(getMockPluginsState(SERVER).theme.enabled).toBe(true);
  });

  it("忽略空白插件 id", () => {
    expect(ensureDefaultEnabledMockPlugins(SERVER, ["", "  "])).toBe(false);
  });
});
