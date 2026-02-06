/**
 * @fileoverview plugins｜领域类型：pluginRuntimeTypes。
 * @description
 * 插件运行时与宿主交互的“契约类型”（不包含实现细节）。
 *
 * 说明：
 * - 这些类型用于让 chat（宿主）与 plugins（运行时加载器）在类型层面对齐；
 * - 该文件不依赖 Vue/Tauri 等平台库，便于跨层复用与测试。
 */

/**
 * 插件编辑器（composer）提交给宿主的载荷格式。
 *
 * 说明：
 * - `domain/domain_version` 用于让宿主路由到正确的消息通道/协议处理；
 * - `data` 由具体 domain contract 定义（宿主仅透传，不做强校验）；
 * - `reply_to_mid` 用于回复链路（可选）。
 */
export type PluginComposerPayload = {
  domain: string;
  domain_version: string;
  data: unknown;
  reply_to_mid?: string;
};

/**
 * 注入给插件的运行时上下文（Host API）。
 *
 * 说明：
 * - 该类型描述“宿主允许插件做什么”，是插件权限与能力边界的核心；
 * - 其中 `host.network` 为可选：只有在插件声明并通过宿主校验后才会注入。
 */
export type PluginContext = {
  server_socket: string;
  server_id: string;
  plugin_id: string;
  plugin_version: string;
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
  };
};

