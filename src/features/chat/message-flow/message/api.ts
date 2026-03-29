/**
 * @fileoverview chat/message-flow/message 对外 API。
 * @description
 * 统一暴露消息语义模型与渲染辅助能力。
 */

import {
  createMessageEnvelope,
  resolveMessageRenderModel,
  toMessageContentModel,
  type MessageRendererRegistry,
} from "./application/messageRendererResolver";
export type { CoreTextPart } from "./domain/coreTextFileSyntax";
export type { MessageContentModel, MessageDomainRef, MessageEnvelope, MessageRenderModel, RenderableChatMessage } from "./domain/messageModels";

export type MessageRenderCapabilities = {
  createEnvelope: typeof createMessageEnvelope;
  resolveRenderModel: typeof resolveMessageRenderModel;
  toContentModel: typeof toMessageContentModel;
};

/**
 * 创建消息渲染能力对象。
 */
export function createMessageRenderCapabilities(): MessageRenderCapabilities {
  return {
    createEnvelope: createMessageEnvelope,
    resolveRenderModel: resolveMessageRenderModel,
    toContentModel: toMessageContentModel,
  };
}

let messageRenderCapabilitiesSingleton: MessageRenderCapabilities | null = null;

/**
 * 获取消息渲染共享能力对象。
 */
export function getMessageRenderCapabilities(): MessageRenderCapabilities {
  messageRenderCapabilitiesSingleton ??= createMessageRenderCapabilities();
  return messageRenderCapabilitiesSingleton;
}

export type { MessageRendererRegistry };
