/**
 * @fileoverview 插件 Host API 工厂。
 * @description plugins｜runtime host API factory：仅负责构造受控 host 能力。
 */

import type { PluginContext, PluginComposerPayload } from "@/features/plugins/domain/types/pluginRuntimeTypes";
import { getAiCapabilities } from "@/features/ai/api";
import { buildTauriTlsArgs } from "@/shared/net/tls/tauriTlsArgs";
import { invokeTauri } from "@/shared/tauri";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { createPluginInvokeApi } from "./pluginInvokeApi";
import { createPluginEventApi } from "./pluginEventApi";
import { createPluginUiApi, type PluginUiBridge } from "./pluginUiApi";
import type { PluginScope } from "./pluginScope";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("plugin-host-api");

export type TauriFetchResponse = {
  ok: boolean;
  status: number;
  bodyText: string;
  headers: Record<string, string>;
};

/**
 * 判断插件 scope 是否已销毁（已销毁时输出英文告警，含 pluginId）。
 * 供各 host API 方法做 dispose 后的 no-op 防御。
 */
function warnIfScopeDisposed(scope: PluginScope | undefined, pluginId: string): boolean {
  if (scope?.disposed) {
    logger.warn("Action: plugins_scope_disposed_call_noop", { pluginId });
    return true;
  }
  return false;
}

/**
 * 创建“权限受控”的 storage API（Rust 侧按 server_id 隔离）。
 *
 * @param scope 可选的插件作用域：已销毁后读写变为 no-op 并告警。
 */
export function createPluginStorageApi(
  serverSocket: string,
  pluginId: string,
  scope?: PluginScope,
): PluginContext["host"]["storage"] {
  return {
    async get(key: string): Promise<unknown> {
      if (warnIfScopeDisposed(scope, pluginId)) return null;
      const k = String(key ?? "").trim();
      if (!k) return null;
      return invokeTauri<unknown>(TAURI_COMMANDS.pluginsStorageGet, { serverSocket, pluginId, key: k, ...buildTauriTlsArgs(serverSocket) });
    },
    async set(key: string, value: unknown): Promise<void> {
      if (warnIfScopeDisposed(scope, pluginId)) return;
      const k = String(key ?? "").trim();
      if (!k) return;
      await invokeTauri<void>(TAURI_COMMANDS.pluginsStorageSet, { serverSocket, pluginId, key: k, value, ...buildTauriTlsArgs(serverSocket) });
    },
  };
}

/**
 * 创建“权限受控”的 network API（Rust 侧强制同源）。
 *
 * @param scope 可选的插件作用域：已销毁后请求变为 no-op（返回 ok:false 空响应）并告警。
 */
export function createPluginNetworkApi(
  serverSocket: string,
  scope?: PluginScope,
): NonNullable<PluginContext["host"]["network"]> {
  return {
    async fetch(input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<TauriFetchResponse> {
      if (warnIfScopeDisposed(scope, "unknown")) {
        return { ok: false, status: 0, bodyText: "", headers: {} };
      }
      const url = String(input ?? "").trim();
      const method = String(init?.method ?? "GET").trim() || "GET";
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const body = typeof init?.body === "string" ? init.body : undefined;
      const res = await invokeTauri<{ ok: boolean; status: number; bodyText: string; headers: Record<string, string> }>(
        TAURI_COMMANDS.pluginsNetworkFetch,
        { serverSocket, url, method, headers, body, ...buildTauriTlsArgs(serverSocket) },
      );
      return res;
    },
  };
}

/**
 * 创建“权限受控”的 ai API（客户端可替换 AI provider，由宿主代持密钥）。
 *
 * 说明：
 * - 只暴露 `isConfigured` / `summarize` 两个窄能力：插件无法用任意提示词把客户端
 *   当作通用 LLM 代理，也无法读取 API Key（密钥只在 Rust 侧凭据管理器中存在）；
 * - 提示词与采样参数由宿主按客户端设置决定，插件不可覆盖；
 * - scope 已销毁后调用变为 no-op：`isConfigured` 返回 false，`summarize` 返回
 *   `not-configured`，让插件自然回退到服务端端点。
 *
 * @param scope 可选的插件作用域：已销毁后调用变为 no-op 并告警。
 */
export function createPluginAiApi(scope?: PluginScope): NonNullable<PluginContext["host"]["ai"]> {
  const notConfigured = {
    ok: false as const,
    code: "not-configured" as const,
    error: "client ai provider is not configured",
  };
  return {
    async isConfigured(): Promise<boolean> {
      if (warnIfScopeDisposed(scope, "ai")) return false;
      try {
        return (await getAiCapabilities().getStatus()).ready;
      } catch (e) {
        logger.warn("Action: plugins_ai_status_failed", { error: String(e) });
        return false;
      }
    },
    async summarize(input) {
      if (warnIfScopeDisposed(scope, "ai")) return notConfigured;
      const channelId = String(input?.channelId ?? "").trim();
      const messages = Array.isArray(input?.messages) ? input.messages.map((m) => String(m ?? "")) : [];
      try {
        return await getAiCapabilities().summarize(channelId, messages);
      } catch (e) {
        // capability 内部已做错误归一化；此处兜底 IPC 层异常，避免异常穿透插件运行时。
        logger.warn("Action: plugins_ai_summarize_failed", { error: String(e) });
        return { ok: false, code: "request-failed", error: String(e) };
      }
    },
  };
}

/**
 * 组装受权限 / 白名单约束的完整插件 host 能力。
 *
 * 说明：
 * - `storage` 始终注入；`network` 仅当 `permissions` 包含 "network" 时注入；
 * - `ai` 仅当 `permissions` 包含 "ai" 时注入（客户端 AI 密钥由宿主代持）；
 * - `invoke` / `onEvent` 分别由 "invoke" / "events" 权限门控，且命令/事件均以
 *   白名单前缀（目前固定为 "voice_call:"）约束，杜绝越权调用；
 * - `mountOverlay` / `registerToolbarAction` 由 "ui" 权限 + 宿主 UI 桥共同门控；
 * - `sendMessage` 由 "messages:send" 权限门控（默认拒绝）：以当前用户身份发言
 *   属高危能力，零权限/未申请该权限的插件不得获得；
 * - 传入 `scope` 后，各子工厂接入作用域自动清理，scope 销毁后方法变为
 *   no-op 并告警（不改变权限门控语义，既有调用不传 scope 保持兼容）。
 *
 * 注：`sendMessage` 的实际实现依赖宿主运行时桥（非纯数据），
 * 由调用方（domainRegistryContext）传入。
 */
export function createHostApi(
  serverSocket: string,
  pluginId: string,
  permissions: string[],
  uiBridge?: PluginUiBridge,
  sendMessage?: (payload: PluginComposerPayload) => Promise<void>,
  scope?: PluginScope,
): PluginContext["host"] {
  const canSendMessages = permissions.includes("messages:send");
  const host: PluginContext["host"] = {
    sendMessage: async (payload) => {
      // scope 已销毁：静默丢弃发送请求（no-op 防御）
      if (warnIfScopeDisposed(scope, pluginId)) return;
      if (!canSendMessages) {
        throw new Error(
          `[PLUGIN_PERMISSION_DENIED] plugin ${pluginId} lacks "messages:send" permission`,
        );
      }
      if (!sendMessage) {
        throw new Error(`plugin ${pluginId} host.sendMessage not provided`);
      }
      await sendMessage(payload);
    },
    storage: createPluginStorageApi(serverSocket, pluginId, scope),
    network: permissions.includes("network") ? createPluginNetworkApi(serverSocket, scope) : undefined,
    ai: permissions.includes("ai") ? createPluginAiApi(scope) : undefined,
  };
  if (permissions.includes("invoke")) {
    host.invoke = createPluginInvokeApi(serverSocket, pluginId, "voice_call:", scope) as never;
  }
  if (permissions.includes("events")) {
    host.onEvent = createPluginEventApi("voice_call:", scope, pluginId) as never;
  }
  if (permissions.includes("ui") && uiBridge) {
    const ui = createPluginUiApi(uiBridge, scope, pluginId);
    host.mountOverlay = ui.mountOverlay as never;
    host.registerToolbarAction = ui.registerToolbarAction as never;
  }
  return host;
}
