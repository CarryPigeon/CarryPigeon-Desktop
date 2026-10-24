/**
 * @fileoverview domainRegistryReconciler 单元测试。
 * @description 验证协调器的核心对齐规则：
 * - 已加载版本与安装记录版本一致时跳过重挂（防「反复卸载重挂」回归）；
 * - 版本不一致时触发 enable（支持插件中心切版本）；
 * - enable 失败时标记 failed 并同步运行时状态。
 */

import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import type { InstalledPluginState } from "@/features/plugins/domain/types/pluginTypes";
import type { LoadedPluginRuntime } from "@/features/plugins/runtime";
import { createDomainRegistryReconciler } from "./domainRegistryReconciler";

type ReconcilerDeps = Parameters<typeof createDomainRegistryReconciler>[0];

function mkInstalled(pluginId: string, version: string, overrides: Partial<InstalledPluginState> = {}): InstalledPluginState {
  return {
    pluginId,
    installedVersions: [version],
    currentVersion: version,
    enabled: true,
    status: "ok",
    lastError: "",
    ...overrides,
  };
}

function mkLoaded(pluginId: string, version: string): LoadedPluginRuntime {
  return {
    pluginId,
    version,
    apiVersion: 2,
    manifest: null,
    permissions: [],
    providesDomains: [],
    ipcPrefixes: [],
    plugin: { name: pluginId, apply: vi.fn() },
  } as unknown as LoadedPluginRuntime;
}

function mkDeps(): ReconcilerDeps {
  return {
    key: "server-1",
    runtimeLoadingDisabled: false,
    loadedById: {},
    loading: ref(false),
    error: ref(""),
    logger: { error: vi.fn() },
    listInstalled: vi.fn<() => Promise<InstalledPluginState[]>>().mockResolvedValue([]),
    enablePluginRuntime: vi.fn<(pluginId: string) => Promise<void>>().mockResolvedValue(undefined),
    disablePluginRuntime: vi.fn<(pluginId: string) => Promise<void>>().mockResolvedValue(undefined),
    markFailed: vi.fn<(pluginId: string, message: string) => Promise<void>>().mockResolvedValue(undefined),
    notifyRuntimeStateChanged: vi.fn(),
  };
}

describe("domainRegistryReconciler", () => {
  it("已加载版本与安装记录版本一致时跳过 enable（防反复重挂）", async () => {
    // 回归：本地源插件升级（如 ai-summary 0.1.0 → 0.2.0）后，若安装态
    // 仍报旧版本，该跳过分支永不命中，每次 ensureLoaded 都会卸载重挂插件，
    // 导致设置页「插件设置」分区反复消失、编辑中的表单被重置。
    const deps = mkDeps();
    deps.loadedById["ai-summary"] = mkLoaded("ai-summary", "0.2.0");
    vi.mocked(deps.listInstalled).mockResolvedValue([mkInstalled("ai-summary", "0.2.0")]);

    await createDomainRegistryReconciler(deps).ensureLoaded();

    expect(deps.enablePluginRuntime).not.toHaveBeenCalled();
    expect(deps.disablePluginRuntime).not.toHaveBeenCalled();
  });

  it("版本不一致时触发 enable（支持切换版本后重挂）", async () => {
    const deps = mkDeps();
    deps.loadedById["ai-summary"] = mkLoaded("ai-summary", "0.1.0");
    vi.mocked(deps.listInstalled).mockResolvedValue([mkInstalled("ai-summary", "0.2.0")]);

    await createDomainRegistryReconciler(deps).ensureLoaded();

    expect(deps.enablePluginRuntime).toHaveBeenCalledWith("ai-summary");
  });

  it("enable 失败时标记 failed 并通知运行时状态变化", async () => {
    const deps = mkDeps();
    vi.mocked(deps.listInstalled).mockResolvedValue([mkInstalled("ai-summary", "0.2.0")]);
    vi.mocked(deps.enablePluginRuntime).mockRejectedValue(new Error("boom"));

    await createDomainRegistryReconciler(deps).ensureLoaded();

    expect(deps.markFailed).toHaveBeenCalledWith("ai-summary", expect.stringContaining("boom"));
    expect(deps.notifyRuntimeStateChanged).toHaveBeenCalled();
  });

  it("安装态为停用或失败时不自动加载", async () => {
    const deps = mkDeps();
    vi.mocked(deps.listInstalled).mockResolvedValue([
      mkInstalled("a", "1.0.0", { enabled: false }),
      mkInstalled("b", "1.0.0", { status: "failed" }),
      mkInstalled("c", "1.0.0", { currentVersion: null }),
    ]);

    await createDomainRegistryReconciler(deps).ensureLoaded();

    expect(deps.enablePluginRuntime).not.toHaveBeenCalled();
  });
});
