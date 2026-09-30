/**
 * @fileoverview domainRegistryContext 插件主机上下文装配单测。
 * @description
 * 回归重点：`host.messages`（messages:read 门控）必须由真实 chat 读取桥装配，
 * 且整个 plugins → chat 公共 API → 聊天时间线的导入链在运行时可用、无 TDZ/循环依赖问题。
 */

import { describe, expect, it } from "vitest";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import type { LoadedPluginModule } from "@/features/plugins/presentation/runtime/pluginRuntime";
import { createDomainRegistryContextResolver } from "./domainRegistryContext";

/**
 * 构造插件运行时条目。
 *
 * @param permissions - 插件声明权限。
 * @returns 运行时条目。
 */
function runtimeEntry(permissions: string[]): PluginRuntimeEntry {
  return {
    serverId: "s1",
    pluginId: "p",
    version: "0.1.0",
    entry: "/plugins/p/0.1.0/index.js",
    permissions,
    providesDomains: [],
    minHostVersion: "0.0.0",
  };
}

/**
 * 构造已加载插件模块。
 *
 * @param permissions - 插件声明权限。
 * @returns 已加载模块。
 */
function loadedModule(permissions: string[]): LoadedPluginModule {
  return {
    pluginId: "p",
    version: "0.1.0",
    manifest: {},
    permissions,
    providesDomains: [],
    renderers: {},
    composers: {},
    contracts: [],
  };
}

/**
 * 用给定权限装配一次插件主机上下文。
 *
 * @param permissions - 插件声明权限。
 * @returns 上下文构建结果。
 */
function buildContext(permissions: string[]) {
  const resolver = createDomainRegistryContextResolver({
    serverKey: "127.0.0.1:8080",
    runtimeLoadingDisabled: false,
    runtimeById: { p: runtimeEntry(permissions) },
    loadedById: { p: loadedModule(permissions) },
    bindingByDomain: {},
    getHostBridge: () => ({
      getCid: () => "",
      sendMessage: async () => {},
    }),
    resolvePluginScope: () => null,
  });
  const runtime = resolver.buildPluginContext(runtimeEntry(permissions), loadedModule(permissions));
  return runtime;
}

describe("createDomainRegistryContextResolver / host.messages", () => {
  it("声明 messages:read：注入真实读取桥并可读取当前频道快照", async () => {
    const ctx = buildContext(["storage", "messages:read"]);

    expect(ctx.host.messages).toBeDefined();
    // 真实桥 → 聊天时间线：返回结构合法的快照（不依赖测试环境是否已选中频道）。
    const snapshot = await ctx.host.messages!.readCurrentChannel();
    expect(typeof snapshot.channelId).toBe("string");
    expect(typeof snapshot.channelName).toBe("string");
    expect(Array.isArray(snapshot.messages)).toBe(true);
    expect(snapshot.totalCount).toBeGreaterThanOrEqual(snapshot.messages.length);
    // 聊天多选范围：同一权限下的附带信息，聊天 store 未就绪时降级为空选择。
    expect(Array.isArray(snapshot.selectedMessageIds)).toBe(true);
    expect(Number.isFinite(snapshot.selectedTotalCount)).toBe(true);
    for (const message of snapshot.messages) {
      expect(message.messageId.length).toBeGreaterThan(0);
      expect(message.text.length).toBeGreaterThan(0);
      expect(message.senderName.length).toBeGreaterThan(0);
    }

    const loadResult = await ctx.host.messages!.loadMoreHistory();
    expect(Number.isFinite(loadResult.loadedCount)).toBe(true);
    expect(Number.isFinite(loadResult.loadedDelta)).toBe(true);
    expect(typeof loadResult.hasMore).toBe("boolean");
  });

  it("未声明 messages:read：不注入 host.messages", () => {
    const ctx = buildContext(["storage", "ai"]);

    expect(ctx.host.messages).toBeUndefined();
    // 其余默认能力不受影响。
    expect(ctx.host.storage).toBeDefined();
  });
});
