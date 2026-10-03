/**
 * @fileoverview plugins 运行时：v1 → Cordis 兼容适配器。
 * @description
 * 把传统契约（`activate`/`deactivate` + 静态 `renderers`/`composers`/`contracts`）
 * 包装为 Cordis 插件对象，使远端已发布的 v1 插件在 Cordis runtime 下零改动继续运行。
 *
 * 安全说明：
 * - 能力服务仍由宿主按 manifest 权限注入；适配器只是把服务重新投影为旧 `PluginContext.host`；
 * - `host.sendMessage` / `host.invoke` / `host.onEvent` 的权限校验在服务内部完成，适配器不做放宽。
 */

import type { Context, Plugin } from "@cordisjs/core";
import { markRaw, type Component } from "vue";
import type {
  PluginComposerPayload,
  PluginContext,
} from "@/features/plugins/domain/types/pluginRuntimeTypes";
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";
import { createPluginRuntimeError } from "@/features/plugins/presentation/runtime/pluginRuntimeError";
import type { PluginDomainsService } from "./types";

/** v1 插件模块原始形状（`import()` 命名空间）。 */
export type PluginRuntimeModuleV1 = {
  manifest?: unknown;
  renderers?: unknown;
  composers?: unknown;
  contracts?: unknown;
  activate?: (ctx: PluginContext) => unknown;
  deactivate?: () => unknown;
};

/** 归一化组件映射（markRaw，避免存入 Vue 响应式时被深度代理）。 */
export function normalizeComponentRecord(raw: unknown): Record<string, Component> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, Component> = {};
  for (const [domain, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value) continue;
    out[String(domain)] = markRaw(value as Component);
  }
  return out;
}

/** 归一化 v1 契约列表。 */
export function normalizeContracts(raw: unknown): Array<{ domain: string; domainVersion: string; payloadSchema?: unknown; constraints?: unknown }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ domain: string; domainVersion: string; payloadSchema?: unknown; constraints?: unknown }> = [];
  for (const item of raw) {
    const record = (item ?? {}) as Record<string, unknown>;
    const domain = String(record.domain ?? "").trim();
    if (!domain) continue;
    out.push({
      domain,
      domainVersion: String(record.domainVersion ?? record.domain_version ?? "").trim() || "1.0.0",
      payloadSchema: record.payloadSchema ?? record.payload_schema,
      constraints: record.constraints,
    });
  }
  return out;
}

/**
 * 把 v1 模块注册的 renderers / composers / contracts 写入 Cordis `domains` 服务。
 */
function registerLegacyDomains(domains: PluginDomainsService, mod: PluginRuntimeModuleV1): void {
  for (const [domain, component] of Object.entries(normalizeComponentRecord(mod.renderers))) {
    domains.renderer(domain, component);
  }
  for (const [domain, component] of Object.entries(normalizeComponentRecord(mod.composers))) {
    domains.composer(domain, component);
  }
  for (const contract of normalizeContracts(mod.contracts)) {
    domains.contract(contract);
  }
}

/**
 * 由 Cordis 能力服务重建旧式 `PluginContext`。
 *
 * 说明：仅当对应能力服务可见时才挂到 `host` 上，保持旧插件"未授权即 undefined"的判空逻辑。
 */
function buildLegacyContext(ctx: Context, runtime: PluginRuntimeEntry): PluginContext {
  const server = ctx.server;
  const messages = ctx.messages;
  const ipc = ctx.ipc;
  const ui = ctx.ui;
  const network = ctx.network;
  const ai = ctx.ai;

  const host: PluginContext["host"] = {
    sendMessage: async (payload: PluginComposerPayload): Promise<void> => {
      if (!messages) {
        throw createPluginRuntimeError(
          "plugin_permission_denied",
          `plugin ${runtime.pluginId} host.sendMessage unavailable (missing messages permission)`,
          { pluginId: runtime.pluginId },
        );
      }
      await messages.send(payload);
    },
    storage: {
      get: (key: string) => ctx.storage.get(key),
      set: (key: string, value: unknown) => ctx.storage.set(key, value),
    },
    network: network ? { fetch: network.fetch.bind(network) } : undefined,
    ai: ai ? { isConfigured: ai.isConfigured.bind(ai), summarize: ai.summarize.bind(ai) } : undefined,
    messages: messages
      ? {
          readCurrentChannel: messages.readCurrentChannel.bind(messages),
          loadMoreHistory: messages.loadMoreHistory.bind(messages),
        }
      : undefined,
    invoke: ipc ? (ipc.invoke.bind(ipc) as unknown as PluginContext["host"]["invoke"]) : undefined,
    onEvent: ipc ? (ipc.onEvent.bind(ipc) as unknown as PluginContext["host"]["onEvent"]) : undefined,
    mountOverlay: ui
      ? (ui.mountOverlay.bind(ui) as unknown as PluginContext["host"]["mountOverlay"])
      : undefined,
    registerToolbarAction: ui
      ? (ui.registerToolbarAction.bind(ui) as unknown as PluginContext["host"]["registerToolbarAction"])
      : undefined,
  };

  const context: PluginContext = {
    serverSocket: server.serverSocket,
    serverId: server.serverId,
    pluginId: runtime.pluginId,
    pluginVersion: runtime.version,
    cid: server.getCid(),
    uid: server.getUid(),
    lang: server.lang,
    onDispose: (cb: () => void) => {
      ctx.on("dispose", cb);
    },
    host,
  };
  return context;
}

/**
 * 将 v1 模块包装为 Cordis 插件。
 *
 * @param mod - v1 模块命名空间。
 * @param runtime - 插件 runtime entry（提供 pluginId / 权限）。
 * @returns Cordis 插件对象。
 */
export function legacyToCordis(mod: PluginRuntimeModuleV1, runtime: PluginRuntimeEntry): Plugin.Object {
  // 声明可选依赖：让 Cordis 认为这些服务"已知"，从而在未注入时不产生未声明访问告警，
  // 同时保持旧插件"未授权即 undefined"的运行时语义。
  const inject: Record<string, { required: boolean }> = {
    storage: { required: true },
    domains: { required: true },
    server: { required: true },
    network: { required: false },
    ai: { required: false },
    messages: { required: false },
    ui: { required: false },
    ipc: { required: false },
  };
  return {
    name: `legacy:${runtime.pluginId}@${runtime.version}`,
    inject,
    apply(ctx: Context) {
      registerLegacyDomains(ctx.domains, mod);
      const legacyContext = buildLegacyContext(ctx, runtime);
      const result = mod.activate?.(legacyContext);
      if (result && typeof (result as PromiseLike<unknown>).then === "function") {
        // v1 契约中 activate 为同步；若插件误返回 Promise，等待其完成以便失败可见。
        void Promise.resolve(result).catch((error) => {
          ctx.emit(ctx, "internal/error", error);
        });
      }
      ctx.on("dispose", () => {
        mod.deactivate?.();
      });
    },
  };
}
