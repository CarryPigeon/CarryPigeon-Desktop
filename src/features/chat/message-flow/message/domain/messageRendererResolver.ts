/**
 * @fileoverview 消息渲染决策器（MessageRendererResolver）。
 * @description
 * 将聊天消息映射为统一渲染模型，页面层只消费结果，不再直接编排分支。
 */

import type { MessageContentModel, MessageEnvelope, MessageRenderModel, RenderableChatMessage } from "../domain/messageModels";

/**
 * domain registry 的最小能力契约（渲染决策所需）。
 */
export type MessageRendererRegistry = {
  getBinding(domainId: string): {
    pluginId: string;
    composer?: unknown;
    renderer?: unknown;
  } | null;
  getContextForDomain(domainId: string): unknown;
};

/**
 * 将聊天消息封装为统一 envelope。
 *
 * @param message - 原始聊天消息。
 * @returns 统一外壳。
 */
export function createMessageEnvelope(message: RenderableChatMessage): MessageEnvelope {
  return {
    messageId: message.id,
    from: message.from,
    timeMs: message.timeMs,
    domain: message.domain,
    raw: message,
  };
}

/**
 * 将 envelope 归一化为内容语义模型。
 *
 * @param envelope - 消息外壳。
 * @returns 语义模型。
 */
export function toMessageContentModel(envelope: MessageEnvelope): MessageContentModel {
  const message = envelope.raw;
  if (message.kind === "core_text") {
    return {
      kind: "core",
      text: message.text,
      replyToId: message.replyToId,
    };
  }
  return {
    kind: "plugin",
    domainId: message.domain.id,
    domainVersion: message.domain.version || "",
    pluginIdHint: message.domain.pluginIdHint,
    preview: message.preview,
    data: message.data,
    replyToId: message.replyToId,
  };
}

/**
 * 基于 domain registry 决定最终渲染模型。
 *
 * @param message - 原始聊天消息。
 * @param replyText - 回复预览文本（仅 core-text 使用）。
 * @param registry - domain registry。
 * @returns 可直接渲染的消息模型。
 */
export function resolveMessageRenderModel(
  message: RenderableChatMessage,
  replyText: string,
  registry: MessageRendererRegistry,
): MessageRenderModel {
  const envelope = createMessageEnvelope(message);
  const content = toMessageContentModel(envelope);

  if (content.kind === "core") {
    return {
      kind: "core",
      messageId: envelope.messageId,
      text: content.text,
      replyText: replyText || "",
    };
  }

  const binding = registry.getBinding(content.domainId);
  if (binding?.renderer) {
    return {
      kind: "plugin",
      messageId: envelope.messageId,
      renderer: binding.renderer,
      context: registry.getContextForDomain(content.domainId),
      domainId: content.domainId,
      domainVersion: content.domainVersion,
      preview: content.preview,
      data: content.data,
      from: envelope.from,
      timeMs: envelope.timeMs,
      replyToMid: content.replyToId,
    };
  }

  return {
    kind: "unknown",
    domainId: content.domainId,
    domainVersion: content.domainVersion,
    pluginIdHint: content.pluginIdHint,
    preview: content.preview,
  };
}
