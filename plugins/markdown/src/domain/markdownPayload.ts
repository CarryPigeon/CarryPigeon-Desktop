/**
 * @fileoverview markdown 插件｜领域纯函数：composer payload 构造。
 * @description
 * 与宿主 PluginComposerPayload 契约对齐（不依赖宿主类型，保持 domain 纯净），
 * 供 composer 组件与单测复用，保证 payload 形状稳定。
 */

export const MARKDOWN_DOMAIN = "markdown";
export const MARKDOWN_DOMAIN_VERSION = "1";

export type MarkdownComposerPayload = {
  domain: string;
  domainVersion: string;
  data: { text: string };
  replyToMessageId?: string;
};

/** 由草稿文本构造提交 payload；空文本返回 null（composer 不应提交空消息）。 */
export function buildMarkdownComposerPayload(
  text: string,
  replyToMid?: string,
): MarkdownComposerPayload | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const payload: MarkdownComposerPayload = {
    domain: MARKDOWN_DOMAIN,
    domainVersion: MARKDOWN_DOMAIN_VERSION,
    data: { text: trimmed },
  };
  const reply = replyToMid?.trim();
  if (reply) payload.replyToMessageId = reply;
  return payload;
}
