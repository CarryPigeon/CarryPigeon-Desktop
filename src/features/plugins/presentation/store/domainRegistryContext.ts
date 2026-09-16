/**
 * @fileoverview domain registry context resolver
 * @description
 * 提供插件上下文构建与按 plugin/domain 解析上下文的能力，降低 registry store 的内部职责密度。
 */

import { NO_SERVER_KEY } from "@/shared/serverKey";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import type { PluginComposerPayload, PluginContext } from "@/features/plugins/domain/types/pluginRuntimeTypes";
import type { LoadedPluginModule } from "@/features/plugins/presentation/runtime/pluginRuntime";
import { createHostApi } from "@/features/plugins/presentation/runtime/hostApiFactory";
import type { PluginUiBridge } from "@/features/plugins/presentation/runtime/pluginUiApi";
import type { PluginScope } from "@/features/plugins/presentation/runtime/pluginScope";
import { chatPluginUiBridge } from "@/features/chat/public/api";
import { getCurrentPluginUserId } from "@/features/plugins/integration/accountSession";
import type { DomainBinding, DomainRegistryHostBridge } from "@/features/plugins/contracts/domainRegistry";
import { createPluginRuntimeError } from "@/features/plugins/presentation/runtime/pluginRuntimeError";

export type DomainRegistryContextResolverDeps = {
  serverKey: string;
  runtimeLoadingDisabled: boolean;
  runtimeById: Record<string, PluginRuntimeEntry>;
  loadedById: Record<string, LoadedPluginModule>;
  bindingByDomain: Record<string, DomainBinding>;
  getHostBridge: () => DomainRegistryHostBridge | null;
  /** 插件实例作用域解析：activate 前由注册表创建，供 host API 自动清理使用 */
  resolvePluginScope: (pluginId: string, version: string) => PluginScope | null;
};

export function createDomainRegistryContextResolver(deps: DomainRegistryContextResolverDeps) {
  function buildPluginContext(
    runtime: PluginRuntimeEntry,
    plugin: LoadedPluginModule,
    scope?: PluginScope | null,
  ): PluginContext {
    const socket = deps.serverKey === NO_SERVER_KEY ? "" : deps.serverKey;
    const cid = String(deps.getHostBridge()?.getCid() ?? "").trim();
    const uid = getCurrentPluginUserId();
    const lang = navigator.language || "en-US";

    // 去重并清理权限列表，统一交由 createHostApi 做能力门控（storage/network/invoke/onEvent/ui）。
    const permissions = Array.from(
      new Set(plugin.permissions.map((item) => String(item).trim()).filter(Boolean)),
    );

    // sendMessage 依赖宿主运行时桥（非纯数据），无法由 createHostApi 自行构造，
    // 故在此封装并传入：桥未就绪时给出明确的领域错误。
    const hostBridge = deps.getHostBridge();
    const sendMessage = async (payload: PluginComposerPayload): Promise<void> => {
      if (!hostBridge) {
        throw createPluginRuntimeError("missing_plugin_host_bridge", "Host bridge not set: cannot send message", {
          pluginId: plugin.pluginId,
          serverSocket: socket,
          cid,
        });
      }
      await hostBridge.sendMessage(payload);
    };

    // 仅当插件具备 "ui" 权限时注入 chat UI 桥（mountOverlay / registerToolbarAction）。
    const uiBridge: PluginUiBridge | undefined = permissions.includes("ui") ? chatPluginUiBridge : undefined;

    const host = createHostApi(socket, plugin.pluginId, permissions, uiBridge, sendMessage, scope ?? undefined);

    return {
      serverSocket: socket,
      serverId: runtime.serverId,
      pluginId: plugin.pluginId,
      pluginVersion: runtime.version,
      cid,
      uid,
      lang,
      // 注入插件级清理注册：scope dispose 时自动释放插件持有的资源
      ...(scope ? { onDispose: (cb: () => void) => scope.onDispose(cb) } : {}),
      host,
    };
  }

  function getContextForPlugin(pluginId: string): PluginContext | null {
    if (deps.runtimeLoadingDisabled) return null;
    const id = String(pluginId ?? "").trim();
    if (!id) return null;
    const runtime = deps.runtimeById[id] ?? null;
    const loaded = deps.loadedById[id] ?? null;
    if (!runtime || !loaded) return null;
    // 已加载实例在查询时解析其当前 scope（可能因 disable 被销毁，此时返回 null 由调用方处理）
    const scope = deps.resolvePluginScope(id, runtime.version);
    return buildPluginContext(runtime, loaded, scope);
  }

  function getContextForDomain(domain: string): PluginContext | null {
    const normalizedDomain = String(domain ?? "").trim();
    if (!normalizedDomain) return null;
    const binding = deps.bindingByDomain[normalizedDomain] ?? null;
    if (!binding) return null;
    return getContextForPlugin(binding.pluginId);
  }

  return {
    buildPluginContext,
    getContextForPlugin,
    getContextForDomain,
  };
}
