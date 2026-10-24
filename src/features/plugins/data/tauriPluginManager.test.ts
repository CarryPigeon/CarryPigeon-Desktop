/**
 * @fileoverview tauriPluginManager 单元测试。
 * @description
 * 验证安装态查询端口的本地源权威性：本地源（自带）插件的安装态必须由
 * 本地源注册表 + localStorage 停用标记推导，Rust 侧返回的同名条目
 * （幻影 storage 目录或历史安装记录）不得覆盖，否则会出现
 * 「启用后又被下一次刷新打回已禁用」（release 下自带插件无法启用）。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = {
  invokeTauri: vi.fn(),
};

vi.mock("@/shared/tauri/invokeClient", () => ({
  invokeTauri: (...args: unknown[]) => invokeMock.invokeTauri(...args),
}));

vi.mock("@/shared/net/tls/tauriTlsArgs", () => ({
  buildTauriTlsArgs: () => ({}),
}));

import { tauriPluginInstallQueryAdapter } from "./tauriPluginManager";
import { getLocalPluginRuntimeEntry } from "./localPluginSource";

const SERVER = "http://server.example:8080";

describe("tauriPluginManager 安装态查询（本地源权威）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubEnv("VITE_USE_LOCAL_PLUGINS", "theme,markdown,group-notice,ai-summary");
    vi.stubEnv("VITE_USE_LOCAL_VOICE_CALL_PLUGIN", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("Rust 返回的本地源插件条目被本地源安装态覆盖（enabled 恢复为 true）", async () => {
    // 回归：本地源插件的 storage.json 会创建插件目录，Rust list_installed
    // 曾据此返回 enabled:false 的幻影记录，导致 release 下插件反复回到已禁用。
    const localVersion = getLocalPluginRuntimeEntry(SERVER, "ai-summary").version;
    invokeMock.invokeTauri.mockResolvedValue([
      {
        pluginId: "ai-summary",
        installedVersions: [],
        currentVersion: null,
        enabled: false,
        status: "ok",
        lastError: "",
      },
    ]);

    const states = await tauriPluginInstallQueryAdapter.listInstalled(SERVER);
    const aiSummary = states.find((s) => s.pluginId === "ai-summary");
    expect(aiSummary).toBeDefined();
    expect(aiSummary?.enabled).toBe(true);
    expect(aiSummary?.currentVersion).toBe(localVersion);
    expect(states.filter((s) => s.pluginId === "ai-summary")).toHaveLength(1);
  });

  it("历史安装记录（current.json）残留的本地源插件条目同样被覆盖", async () => {
    invokeMock.invokeTauri.mockResolvedValue([
      {
        pluginId: "markdown",
        installedVersions: ["0.1.0"],
        currentVersion: "0.1.0",
        enabled: false,
        status: "ok",
        lastError: "",
      },
    ]);

    const states = await tauriPluginInstallQueryAdapter.listInstalled(SERVER);
    const markdown = states.find((s) => s.pluginId === "markdown");
    expect(markdown?.enabled).toBe(true);
  });

  it("停用标记生效时本地源插件以 enabled:false 出现在列表中", async () => {
    invokeMock.invokeTauri.mockResolvedValue([]);
    localStorage.setItem(`carrypigeon:localPluginDisabled:${SERVER}:ai-summary`, "1");

    const states = await tauriPluginInstallQueryAdapter.listInstalled(SERVER);
    const aiSummary = states.find((s) => s.pluginId === "ai-summary");
    expect(aiSummary?.enabled).toBe(false);
    // 其余自带插件不受影响。
    expect(states.find((s) => s.pluginId === "theme")?.enabled).toBe(true);
  });

  it("非本地源插件条目原样透传", async () => {
    invokeMock.invokeTauri.mockResolvedValue([
      {
        pluginId: "custom",
        installedVersions: ["1.0.0"],
        currentVersion: "1.0.0",
        enabled: true,
        status: "ok",
        lastError: "",
      },
    ]);

    const states = await tauriPluginInstallQueryAdapter.listInstalled(SERVER);
    const custom = states.find((s) => s.pluginId === "custom");
    expect(custom?.currentVersion).toBe("1.0.0");
    expect(custom?.enabled).toBe(true);
  });

  it("getInstalledState 对本地源插件不发起 Rust 查询", async () => {
    const state = await tauriPluginInstallQueryAdapter.getInstalledState(SERVER, "ai-summary");
    expect(invokeMock.invokeTauri).not.toHaveBeenCalled();
    expect(state?.enabled).toBe(true);
    expect(state?.currentVersion).toBe(getLocalPluginRuntimeEntry(SERVER, "ai-summary").version);
  });

  it("getInstalledState 对非本地源插件走 Rust 查询", async () => {
    invokeMock.invokeTauri.mockResolvedValue({
      pluginId: "custom",
      installedVersions: ["1.0.0"],
      currentVersion: "1.0.0",
      enabled: false,
      status: "ok",
      lastError: "",
    });

    const state = await tauriPluginInstallQueryAdapter.getInstalledState(SERVER, "custom");
    expect(invokeMock.invokeTauri).toHaveBeenCalledTimes(1);
    expect(state?.enabled).toBe(false);
    expect(state?.currentVersion).toBe("1.0.0");
  });
});
