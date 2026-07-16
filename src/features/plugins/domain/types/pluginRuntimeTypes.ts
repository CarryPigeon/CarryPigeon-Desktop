/**
 * @fileoverview plugins｜领域类型：pluginRuntimeTypes。
 * @description
 * 插件运行时与宿主交互的“契约类型”（不包含实现细节）。
 *
 * 说明：
 * - 这些类型用于让 chat（宿主）与 plugins（运行时加载器）在类型层面对齐；
 * - 该文件不依赖 Vue/Tauri 等平台库，便于跨层复用与测试。
 */

import type { Component, ComponentPublicInstance } from "vue";

/**
 * 插件在 chat 工具栏点击时接收到的实时聊天上下文。
 *
 * 说明：
 * - `channelId` 即当前频道 id（用于语音/视频通话的 roomId）；
 * - `targetUserId` 为一对一通话对象（群聊/会议场景通常为空）；
 * - 该上下文由宿主在调用 `ToolbarAction.onClick` 时实时注入，插件无需自行维护。
 */
export type PluginChatContext = {
  channelId: string;
  channelName?: string;
  targetUserId?: string;
};

/**
 * `host.mountOverlay` 的返回值句柄。
 *
 * 说明：
 * - `unmount` 用于卸载浮层；
 * - `instance` 为挂载浮层组件的公开实例（含插件 `defineExpose` 暴露的方法），
 *   组件尚未完成挂载时为 `null`，调用方应在点击等异步时机读取。
 */
export type PluginOverlayMountHandle = {
  unmount: () => void;
  instance: ComponentPublicInstance | null;
};

/**
 * 插件编辑器（composer）提交给宿主的载荷格式。
 *
 * 说明：
 * - `domain/domainVersion` 用于让宿主路由到正确的消息通道/协议处理；
 * - `data` 由具体 domain contract 定义（宿主仅透传，不做强校验）；
 * - `replyToMessageId` 用于回复链路（可选）。
 */
export type PluginComposerPayload = {
  domain: string;
  domainVersion: string;
  data: unknown;
  replyToMessageId?: string;
};

/**
 * 插件运行时对外声明的 domain contract。
 */
export type PluginRuntimeContract = {
  domain: string;
  domainVersion: string;
  payloadSchema?: unknown;
  constraints?: unknown;
};

/**
 * 注入给插件的运行时上下文（Host API）。
 *
 * 说明：
 * - 该类型描述“宿主允许插件做什么”，是插件权限与能力边界的核心；
 * - 其中 `host.network` 为可选：只有在插件声明并通过宿主校验后才会注入。
 */
export type PluginContext = {
  serverSocket: string;
  serverId: string;
  pluginId: string;
  pluginVersion: string;
  cid: string;
  uid: string;
  lang: string;
  host: {
    sendMessage(payload: PluginComposerPayload): Promise<void>;
    storage: {
      get(key: string): Promise<unknown>;
      set(key: string, value: unknown): Promise<void>;
    };
    network?: {
      fetch(
        input: string,
        init?: { method?: string; headers?: Record<string, string>; body?: string },
      ): Promise<{
        ok: boolean;
        status: number;
        headers: Record<string, string>;
        bodyText: string;
      }>;
    };
    /** 泛型命令调用（权限 + 命令白名单，建议前缀 voice_call:*） */
    invoke?: <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;
    /** 订阅宿主 Tauri 事件（权限 + 事件白名单），返回取消函数 */
    onEvent?: <T = unknown>(event: string, handler: (payload: T) => void) => () => void;
    /** 挂载全局浮层组件，返回卸载函数与组件实例句柄 */
    mountOverlay?: (component: Component, opts?: { zIndex?: number; props?: Record<string, unknown> }) => PluginOverlayMountHandle;
    /** 注册聊天头部/工具栏入口，返回注销函数 */
    registerToolbarAction?: (action: {
      id: string;
      label: string;
      icon?: Component;
      order?: number;
      onClick: (ctx: PluginChatContext) => void;
    }) => () => void;
  };
};
