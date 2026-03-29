/**
 * @fileoverview message 语义模型定义。
 * @description
 * 统一描述消息外壳、内容语义与渲染模型，作为 message-flow 的稳定扩展点。
 */

/**
 * 消息 domain 描述（message 子域独立定义，避免反向依赖 presentation/store）。
 */
export type MessageDomainRef = {
  id: string;
  label: string;
  colorVar:
    | "--cp-domain-core"
    | "--cp-domain-ext-a"
    | "--cp-domain-ext-b"
    | "--cp-domain-ext-c"
    | "--cp-domain-unknown";
  pluginIdHint?: string;
  version?: string;
};

/**
 * 消息渲染链路使用的最小消息模型。
 */
export type RenderableChatMessage =
  | {
      id: string;
      kind: "core_text";
      from: { id: string; name: string };
      timeMs: number;
      domain: MessageDomainRef;
      text: string;
      replyToId?: string;
    }
  | {
      id: string;
      kind: "domain_message";
      from: { id: string; name: string };
      timeMs: number;
      domain: MessageDomainRef;
      preview: string;
      data?: unknown;
      replyToId?: string;
    };

/**
 * 消息外壳（与具体渲染形态解耦）。
 */
export type MessageEnvelope = {
  messageId: string;
  from: { id: string; name: string };
  timeMs: number;
  domain: MessageDomainRef;
  raw: RenderableChatMessage;
};

/**
 * 消息语义模型（纯内容，不携带渲染实现）。
 */
export type MessageContentModel =
  | {
      kind: "core";
      text: string;
      replyToId?: string;
    }
  | {
      kind: "plugin";
      domainId: string;
      domainVersion: string;
      pluginIdHint?: string;
      preview: string;
      data?: unknown;
      replyToId?: string;
    };

/**
 * 消息渲染模型（可直接供渲染层消费）。
 */
export type MessageRenderModel =
  | {
      kind: "core";
      messageId: string;
      text: string;
      replyText?: string;
    }
  | {
      kind: "plugin";
      messageId: string;
      renderer: unknown;
      context: unknown;
      domainId: string;
      domainVersion: string;
      preview: string;
      data?: unknown;
      from: { id: string; name: string };
      timeMs: number;
      replyToMid?: string;
    }
  | {
      kind: "unknown";
      domainId: string;
      domainVersion: string;
      pluginIdHint?: string;
      preview: string;
    };
