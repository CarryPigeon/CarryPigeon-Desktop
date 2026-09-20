/**
 * @fileoverview authorNameResolution.ts
 * @description chat｜view-model：消息作者昵称（发送者 / 提及目标）解析的纯函数助手。
 *
 * 说明：
 * - 服务端 canonical 消息信封可能只携带 uid（昵称由 users/members 接口补齐），mapper 在
 *   昵称缺失时会生成 `用户 1001` / `u:1001` 这类占位名；
 * - 展示层在消息投影阶段把占位名替换为目录解析结果，缺失时保留占位名等待异步补拉；
 * - 本模块保持纯函数：不做 IO、不持有状态，异步补拉由调用方（useChatCenterModel）编排。
 */

import type { ChatMessage } from "@/features/chat/message-flow/api-types";
import type { MessageMention, MessageQuoteSummary } from "@/features/chat/message-flow/message/domain/messageModels";

/**
 * mapper 在昵称缺失时生成的占位名形态：
 * `用户 1001`（`用户` + 空格 + uid）、`u:1001`（成员目录兜底）、`未知用户`（uid 缺失）。
 *
 * 说明：刻意要求分隔符，避免把真实昵称（如「用户小张」「User 1001」）误判为占位名而被覆盖。
 */
const PLACEHOLDER_SENDER_NAME_RE = /^(?:u:\S+|用户\s\S+|未知用户)$/i;

/**
 * 判断发送者名是否为「昵称缺失」的占位形态。
 *
 * @param raw - 待判断的发送者名。
 * @returns 空串或占位形态时为 `true`。
 */
export function isPlaceholderSenderName(raw: string): boolean {
  const name = String(raw ?? "").trim();
  if (!name) return true;
  return PLACEHOLDER_SENDER_NAME_RE.test(name);
}

/**
 * 用解析器把消息发送者的占位名替换为真实昵称。
 *
 * @param m - 原始消息。
 * @param resolveName - uid → 昵称解析器；返回空串表示不可解析。
 * @returns 解析成功时返回浅拷贝（不改写原对象）；无需变更时原样返回。
 */
export function withResolvedSenderName(
  m: ChatMessage,
  resolveName: (uid: string) => string,
): ChatMessage {
  if (!isPlaceholderSenderName(m.from.name)) return m;
  const uid = String(m.from.id ?? "").trim();
  if (!uid) return m;
  const name = String(resolveName(uid) ?? "").trim();
  if (!name || name === m.from.name || isPlaceholderSenderName(name)) return m;
  const clone = { ...m } as ChatMessage;
  clone.from = { ...m.from, name };
  return clone;
}

/**
 * 为缺少 `displayName` 的消息提及补充解析后的昵称（`everyone` / `here` 等系统提及不解析）。
 *
 * @param m - 原始消息。
 * @param resolveName - uid → 昵称解析器；返回空串表示不可解析。
 * @returns 任一提及解析成功时返回浅拷贝（不改写原对象）；无需变更时原样返回。
 */
export function withResolvedMentionNames(
  m: ChatMessage,
  resolveName: (uid: string) => string,
): ChatMessage {
  const mentions = m.mentions;
  if (!mentions?.length) return m;

  let changed = false;
  const next = mentions.map((mention: MessageMention): MessageMention => {
    if (mention.type === "everyone" || mention.type === "here") return mention;
    if (String(mention.displayName ?? "").trim()) return mention;
    const uid = String(mention.userId ?? "").trim();
    if (!uid) return mention;
    const name = String(resolveName(uid) ?? "").trim();
    if (!name) return mention;
    changed = true;
    return { ...mention, displayName: name };
  });

  if (!changed) return m;
  const clone = { ...m } as ChatMessage & { mentions?: MessageMention[] };
  clone.mentions = next;
  return clone;
}

/**
 * 为缺少 `senderName` 的内联引用补充解析后的昵称。
 *
 * @param m - 原始消息。
 * @param resolveName - uid → 昵称解析器；返回空串表示不可解析。
 * @returns 解析成功时返回浅拷贝（不改写原对象）；无需变更时原样返回。
 */
export function withResolvedQuoteReplyName(
  m: ChatMessage,
  resolveName: (uid: string) => string,
): ChatMessage {
  const quote = m.quoteReply;
  if (!quote) return m;
  if (String(quote.senderName ?? "").trim()) return m;
  const uid = String(quote.userId ?? "").trim();
  if (!uid) return m;
  const name = String(resolveName(uid) ?? "").trim();
  if (!name) return m;
  const clone = { ...m } as ChatMessage & { quoteReply?: MessageQuoteSummary };
  clone.quoteReply = { ...quote, senderName: name };
  return clone;
}

/**
 * 收集消息列表中尚未解析出昵称的作者 uid（发送者与提及目标；去重、保序）。
 *
 * @param messages - 消息列表（可为已经过投影解析的消息）。
 * @param hasName - 判断某 uid 是否已有可用昵称。
 * @returns 需要补拉的 uid 列表；无缺失时为空数组。
 */
export function collectUnresolvedAuthorUids(
  messages: readonly ChatMessage[],
  hasName: (uid: string) => boolean,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (rawUid: string, needsName: boolean): void => {
    const uid = String(rawUid ?? "").trim();
    if (!uid || seen.has(uid)) return;
    seen.add(uid);
    if (needsName && !hasName(uid)) out.push(uid);
  };

  for (const m of messages) {
    visit(m.from.id, isPlaceholderSenderName(m.from.name));
    for (const mention of m.mentions ?? []) {
      if (mention.type === "everyone" || mention.type === "here") continue;
      visit(mention.userId, !String(mention.displayName ?? "").trim());
    }
    if (m.quoteReply) visit(m.quoteReply.userId, !String(m.quoteReply.senderName ?? "").trim());
  }
  return out;
}
