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
 * `host.ai.summarize` 的失败原因分类。
 *
 * - `not-configured`：用户选择"跟随服务端"，插件应回退到服务端端点；
 * - `incomplete-config`：已选客户端 provider 但 base URL / 模型名为空；
 * - `api-key-missing`：需要密钥但尚未配置（或安全存储不可用）；
 * - `request-failed`：请求已发出但失败（含上游错误码与传输错误）。
 */
export type PluginAiFailureCode =
  | "not-configured"
  | "incomplete-config"
  | "api-key-missing"
  | "request-failed";

/**
 * `host.ai.summarize` 的结果。
 */
export type PluginAiSummarizeResult =
  | {
      ok: true;
      /** 总结正文。 */
      summary: string;
      /** 参与总结的消息条数。 */
      messageCount: number;
      /** provider 展示名（例如 `DeepSeek`）。 */
      provider: string;
      /** 实际使用的模型名。 */
      model: string;
    }
  | {
      ok: false;
      code: PluginAiFailureCode;
      /** 面向开发者的错误描述（已脱敏，不含密钥）。 */
      error: string;
      /** 上游 HTTP 状态码；传输失败时为 0/缺省。 */
      status?: number;
      /** 当前客户端 provider 展示名（用于拼装可操作提示）。 */
      provider?: string;
    };

/**
 * `host.ai` 能力面（最小权限）。
 *
 * 安全约束：
 * - 只暴露"总结"这一窄能力，插件无法用任意提示词把客户端当作通用 LLM 代理；
 * - API Key 由宿主从系统凭据管理器读取，插件既拿不到也无法读取明文；
 * - 用户选择"跟随服务端"时返回 `not-configured`，插件应自行回退到服务端端点；
 * - 提示词、温度、超时等采样参数一律由宿主按客户端设置决定，插件不可覆盖。
 */
export type PluginAiApi = {
  /** 客户端 AI 是否已配置且就绪（不发起网络请求）。 */
  isConfigured(): Promise<boolean>;
  /** 以宿主的客户端 AI 配置生成总结。 */
  summarize(input: {
    channelId: string;
    messages: readonly string[];
  }): Promise<PluginAiSummarizeResult>;
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
 * - 其中 `host.network` / `host.ai` 为可选：只有在插件声明并通过宿主校验后才会注入。
 */
export type PluginContext = {
  serverSocket: string;
  serverId: string;
  pluginId: string;
  pluginVersion: string;
  cid: string;
  uid: string;
  lang: string;
  /** 注册插件级清理回调（scope dispose 时触发，用于自动释放插件持有的资源） */
  onDispose?: (cb: () => void) => void;
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
    /**
     * 客户端 AI 总结能力（"ai" 权限门控）。
     *
     * 说明：仅在用户配置了客户端 AI provider 时才有实际效果；未配置时
     * `summarize` 返回 `not-configured`，插件应回退服务端端点。
     */
    ai?: PluginAiApi;
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
