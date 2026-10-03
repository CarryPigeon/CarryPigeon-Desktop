/**
 * @fileoverview Cordis 运行时核心单测。
 * @description
 * 覆盖：能力服务按插件隔离、renderer 注册与销毁、权限 → 服务可见性、
 * IPC 前缀白名单、v1 兼容适配器、入口契约分流与非法入口拒绝。
 */

import { describe, expect, it, vi } from "vitest";
import type { Component } from "vue";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import type { Context, Plugin } from "@cordisjs/core";
import { applyPlugin } from "./applyPlugin";
import { createServerRuntime } from "./createServerContext";
import { createDomainsRegistry } from "./domainsRegistry";
import { legacyToCordis } from "./legacyAdapter";
import { normalizePluginRuntimeModule } from "./loadPluginModule";
import { assertRequiredPermissions, isServiceVisible, normalizePermissions } from "./permissions";
import { createIpcService, resolveIpcPrefixes } from "./services/ipc";

const RENDERER = { name: "TestRenderer" } as unknown as Component;

function runtimeOf(pluginId: string, overrides: Partial<PluginRuntimeEntry> = {}): PluginRuntimeEntry {
  return {
    serverId: "srv",
    pluginId,
    version: "1.0.0",
    entry: "index.js",
    permissions: ["storage"],
    providesDomains: [{ domain: "d", domainVersion: "1" }],
    minHostVersion: "0.0.0",
    entryApiVersion: 2,
    ipcPrefixes: [],
    ...overrides,
  };
}

function makeServer() {
  return createServerRuntime({
    serverSocket: "srv",
    serverId: "srv",
    getCid: () => "c1",
    getUid: () => "u1",
    lang: "en",
  });
}

describe("applyPlugin", () => {
  it("注册 renderer 到共享注册表，dispose 触发插件清理钩子", async () => {
    const server = makeServer();
    const disposed = vi.fn();
    const plugin = {
      name: "p1",
      inject: ["domains"],
      apply(ctx: Context) {
        ctx.domains.renderer("d", RENDERER);
        ctx.on("dispose", disposed);
      },
    };
    const applied = await applyPlugin(server.ctx, { serverSocket: "srv", registry: server.registry }, runtimeOf("p1"), plugin);

    expect(server.registry.get("d")?.renderer).toBe(RENDERER);
    expect(disposed).not.toHaveBeenCalled();

    await applied.dispose();
    expect(disposed).toHaveBeenCalledTimes(1);

    // 注册表反注册由 store 层负责（applyPlugin 只负责 fiber 生命周期）。
    server.registry.unregister("p1");
    expect(server.registry.get("d")).toBeNull();
  });

  it("不同插件实例的能力服务互相隔离（storage 各自独立）", async () => {
    const server = makeServer();
    const seen: Record<string, unknown> = {};
    const mk = (id: string) => ({
      name: id,
      inject: ["storage"],
      apply(ctx: Context) {
        seen[id] = ctx.storage;
      },
    });
    await applyPlugin(server.ctx, { serverSocket: "srv", registry: server.registry }, runtimeOf("a"), mk("a"));
    await applyPlugin(server.ctx, { serverSocket: "srv", registry: server.registry }, runtimeOf("b"), mk("b"));

    expect(seen.a).toBeDefined();
    expect(seen.b).toBeDefined();
    expect(seen.a).not.toBe(seen.b);
  });

  it("插件 apply 抛错时 applyPlugin 会抛出，不静默成功", async () => {
    const server = makeServer();
    const plugin = {
      name: "boom",
      inject: ["domains"],
      apply() {
        throw new Error("boom-in-apply");
      },
    };
    await expect(
      applyPlugin(server.ctx, { serverSocket: "srv", registry: server.registry }, runtimeOf("boom"), plugin),
    ).rejects.toThrow(/boom-in-apply/);
  });

  it("缺少必需权限时 apply 立即失败（不静默 pending）", async () => {
    const server = makeServer();
    const plugin = {
      name: "need-net",
      inject: ["network"],
      apply(ctx: Context) {
        void ctx.network;
      },
    };
    await expect(
      applyPlugin(server.ctx, { serverSocket: "srv", registry: server.registry }, runtimeOf("need-net", { permissions: [] }), plugin),
    ).rejects.toThrow(/lacks permission/);
  });
});

describe("permissions", () => {
  it("isServiceVisible 按权限映射（基础服务始终可见）", () => {
    const none = new Set<string>();
    expect(isServiceVisible("storage", none)).toBe(true);
    expect(isServiceVisible("domains", none)).toBe(true);
    expect(isServiceVisible("network", none)).toBe(false);
    // 未登记的服务名视为基础能力（始终可见）。
    expect(isServiceVisible("custom-service", none)).toBe(true);
  });

  it("assertRequiredPermissions 忽略可选依赖、拒绝必需且缺失的依赖", () => {
    const base = runtimeOf("p", { permissions: [] });
    const withInject = (inject: unknown): Plugin => ({ inject } as unknown as Plugin);
    expect(() => assertRequiredPermissions(withInject(["network"]), base)).toThrow();
    expect(() =>
      assertRequiredPermissions(withInject(["network"]), runtimeOf("p", { permissions: ["network"] })),
    ).not.toThrow();
    expect(() =>
      assertRequiredPermissions(withInject({ network: { required: false } }), base),
    ).not.toThrow();
  });

  it("normalizePermissions 去重 trim 去空", () => {
    expect(normalizePermissions([" ui ", "ui", "", "storage"])).toEqual(["ui", "storage"]);
  });
});

describe("resolveIpcPrefixes（IPC 白名单双重约束）", () => {
  it("仅保留宿主可暴露命名空间下的前缀", () => {
    expect(resolveIpcPrefixes(["voice_call:"])).toEqual(["voice_call:"]);
    expect(resolveIpcPrefixes(["voice_call:extra"])).toEqual(["voice_call:extra"]);
    expect(resolveIpcPrefixes(["*"])).toEqual([]);
    expect(resolveIpcPrefixes([""])).toEqual([]);
    expect(resolveIpcPrefixes(["voice"])).toEqual([]);
    expect(resolveIpcPrefixes(["evil:"])).toEqual([]);
  });

  it("invoke / onEvent 分别按权限门控，互不越权", async () => {
    const fakeCtx = { effect: () => () => {} } as unknown as Context;
    const eventsOnly = createIpcService("srv", "p", ["voice_call:"], new Set(["events"]), fakeCtx, { disposed: false });
    await expect(eventsOnly.invoke("voice_call:x")).rejects.toThrow(/lacks "invoke"/);

    const invokeOnly = createIpcService("srv", "p", ["voice_call:"], new Set(["invoke"]), fakeCtx, { disposed: false });
    expect(() => invokeOnly.onEvent("voice_call:x", () => {})).toThrow(/lacks "events"/);
  });
});

describe("legacyToCordis（v1 兼容）", () => {
  it("注册静态 renderers 并透传 activate/deactivate", async () => {
    const server = makeServer();
    const activate = vi.fn();
    const deactivate = vi.fn();
    const mod = { renderers: { d: RENDERER }, composers: {}, activate, deactivate };
    const runtime = runtimeOf("legacy-p", { entryApiVersion: 1 });
    const plugin = legacyToCordis(mod, runtime);

    const applied = await applyPlugin(server.ctx, { serverSocket: "srv", registry: server.registry }, runtime, plugin);

    expect(activate).toHaveBeenCalledTimes(1);
    // 适配器重建的旧式上下文应包含 host.storage 与基础字段。
    const legacyCtx = activate.mock.calls[0]?.[0] as { pluginId: string; host: { storage: unknown } };
    expect(legacyCtx.pluginId).toBe("legacy-p");
    expect(legacyCtx.host.storage).toBeDefined();
    expect(server.registry.get("d")?.renderer).toBe(RENDERER);

    await applied.dispose();
    expect(deactivate).toHaveBeenCalledTimes(1);
  });
});

describe("createDomainsRegistry", () => {
  it("seed 为无渲染器的 providesDomain 也建立 binding，unregister 可清理", () => {
    const registry = createDomainsRegistry();
    registry.seed(runtimeOf("p", { providesDomains: [{ domain: "x", domainVersion: "1" }] }));
    expect(registry.get("x")?.pluginId).toBe("p");
    expect(registry.get("x")?.renderer).toBeUndefined();
    registry.unregister("p");
    expect(registry.get("x")).toBeNull();
  });
});

describe("normalizePluginRuntimeModule（入口契约分流）", () => {
  it("v2 契约要求 apply 导出", () => {
    const runtime = runtimeOf("p2");
    expect(() => normalizePluginRuntimeModule(runtime, {})).toThrow(/no apply/);
    const loaded = normalizePluginRuntimeModule(runtime, { apply: () => {} });
    expect(loaded.apiVersion).toBe(2);
    expect(loaded.plugin).toBeTruthy();
  });

  it("v1 契约包装为 Cordis 插件并保留 legacy 模块", () => {
    const runtime = runtimeOf("p1", { entryApiVersion: 1 });
    const mod = { renderers: {}, composers: {}, activate: () => {} };
    const loaded = normalizePluginRuntimeModule(runtime, mod as Record<string, unknown>);
    expect(loaded.apiVersion).toBe(1);
    expect(loaded.legacy).toBe(mod);
    expect(typeof (loaded.plugin as { apply?: unknown }).apply).toBe("function");
  });

  it("权限以 Rust 清单为准，忽略 JS 模块中的 manifest", () => {
    const runtime = runtimeOf("p3", { permissions: ["storage"] });
    const loaded = normalizePluginRuntimeModule(runtime, {
      apply: () => {},
      manifest: { permissions: ["network", "admin"] },
    });
    expect(loaded.permissions).toEqual(["storage"]);
  });
});
