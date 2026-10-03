/**
 * @fileoverview plugins Cordis 运行时类型与 SDK 契约。
 * @description
 * 定义宿主注入给插件的能力服务（Cordis Service）与插件作者可用的 `Context` 扩展。
 *
 * 说明：
 * - 本文件是插件作者（v2 契约）与宿主之间的稳定类型边界；
 * - 能力服务按 manifest 权限可见性注入：未授权的能力不会出现在 `ctx` 上；
 * - `declare module "@cordisjs/core"` 让插件在 TS 侧获得 `ctx.storage` / `ctx.domains` 等类型。
 */

import type { Context, Plugin } from "@cordisjs/core";
import type { Component } from "vue";
import type {
  PluginAiApi,
  PluginChannelHistoryLoadResult,
  PluginChatContext,
  PluginComposerPayload,
  PluginCurrentChannelMessagesSnapshot,
  PluginMessagesApi,
  PluginOverlayMountHandle,
  PluginRuntimeContract,
} from "@/features/plugins/domain/types/pluginRuntimeTypes";

/** 宿主网络能力的响应形状（由 Rust 受控 fetch 返回）。 */
export type PluginFetchResponse = {
  ok: boolean;
  status: number;
  bodyText: string;
  headers: Record<string, string>;
};

/**
 * 服务器上下文服务。
 *
 * 说明：`getCid` / `getUid` 为实时读取，插件不应缓存首次取值。
 */
export type PluginServerService = {
  readonly serverSocket: string;
  readonly serverId: string;
  getCid(): string;
  getUid(): string;
  readonly lang: string;
};

/** 存储能力（按 serverId + pluginId 命名空间隔离，Rust 侧持久化）。 */
export type PluginStorageService = {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
};

/** 网络能力（Rust 侧强制同源）。 */
export type PluginNetworkService = {
  fetch(
    input: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ): Promise<PluginFetchResponse>;
};

/** 客户端 AI 能力（密钥宿主代持）。 */
export type PluginAiService = PluginAiApi;

/**
 * 频道消息能力。
 *
 * - `readCurrentChannel` / `loadMoreHistory` 需要 `messages:read`；
 * - `send` 需要 `messages:send`（高危，默认拒绝）。
 * 方法内部按权限二次校验（可见性之外的双重防御）。
 */
export type PluginMessagesService = PluginMessagesApi & {
  send(payload: PluginComposerPayload): Promise<void>;
};

/** 全局 UI 挂载能力（overlay / 工具栏入口）。 */
export type PluginUiService = {
  mountOverlay(
    component: Component,
    opts?: { zIndex?: number; props?: Record<string, unknown> },
  ): PluginOverlayMountHandle;
  registerToolbarAction(action: {
    id: string;
    label: string;
    icon?: Component;
    order?: number;
    onClick: (ctx: PluginChatContext) => void;
  }): () => void;
};

/** 受限 IPC 能力（命令/事件前缀白名单来自已校验的 plugin.json）。 */
export type PluginIpcService = {
  invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T>;
  onEvent<T = unknown>(event: string, handler: (payload: T) => void): () => void;
};

/** domain 渲染/输入注册能力（宿主共享注册表，随插件 fiber 自动反注册）。 */
export type PluginDomainsService = {
  renderer(domain: string, component: Component): void;
  composer(domain: string, component: Component): void;
  contract(contract: PluginRuntimeContract): void;
};

declare module "@cordisjs/core" {
  interface Context {
    /** 服务器上下文（宿主始终注入）。 */
    server: PluginServerService;
    /** 存储能力（宿主始终注入）。 */
    storage: PluginStorageService;
    /** domain 注册能力（宿主始终注入）。 */
    domains: PluginDomainsService;
    /** 网络能力（`network` 权限门控）。 */
    network?: PluginNetworkService;
    /** 客户端 AI 能力（`ai` 权限门控）。 */
    ai?: PluginAiService;
    /** 频道消息能力（`messages:read` / `messages:send` 权限门控）。 */
    messages?: PluginMessagesService;
    /** 全局 UI 能力（`ui` 权限门控）。 */
    ui?: PluginUiService;
    /** 受限 IPC 能力（`invoke` / `events` 权限门控）。 */
    ipc?: PluginIpcService;
  }
}

export type { Context, Plugin, PluginChannelHistoryLoadResult, PluginCurrentChannelMessagesSnapshot };
