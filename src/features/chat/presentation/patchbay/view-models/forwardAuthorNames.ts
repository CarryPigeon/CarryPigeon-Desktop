/**
 * @fileoverview forwardAuthorNames.ts
 * @description chat｜view-model：转发条目作者昵称解析的纯函数助手。
 *
 * 说明：
 * - 转发快照（服务端）仅携带 userId，不含昵称；
 * - 展示层在消息投影阶段为每条转发条目补充 `authorName`，缺失时 UI 回退显示 userId；
 * - 本模块保持纯函数：不做 IO、不持有状态，异步补拉由调用方（useChatCenterModel）编排。
 */

import type { ChatMessage } from "@/features/chat/message-flow/api-types";
import type { ForwardedMessageEntry } from "@/features/chat/message-flow/message/domain/messageModels";

/**
 * 为消息中的转发条目补充解析后的作者昵称。
 *
 * @param m - 原始消息。
 * @param resolveName - uid → 昵称解析器；返回空串表示不可解析。
 * @returns 任一条目解析成功时返回浅拷贝（不改写原对象）；无需变更时原样返回。
 */
export function withResolvedForwardAuthorNames(
  m: ChatMessage,
  resolveName: (uid: string) => string,
): ChatMessage {
  const forwardedFrom = m.forwardedFrom;
  const forwardedMessages = m.forwardedMessages;
  if (!forwardedFrom && !forwardedMessages) return m;

  let changed = false;
  const mapEntry = (entry: ForwardedMessageEntry): ForwardedMessageEntry => {
    const name = String(resolveName(entry.userId) ?? "").trim();
    if (!name || entry.authorName === name) return entry;
    changed = true;
    return { ...entry, authorName: name };
  };

  const nextForwardedFrom = forwardedFrom ? mapEntry(forwardedFrom) : undefined;
  const nextForwardedMessages = forwardedMessages
    ? forwardedMessages.map(mapEntry)
    : undefined;

  if (!changed) return m;
  const clone = { ...m } as ChatMessage & {
    forwardedFrom?: ForwardedMessageEntry;
    forwardedMessages?: ForwardedMessageEntry[];
  };
  clone.forwardedFrom = nextForwardedFrom;
  clone.forwardedMessages = nextForwardedMessages;
  return clone;
}

/**
 * 收集消息列表中尚未解析出昵称的转发条目作者 uid（去重、保序）。
 *
 * 说明：条目自身已携带非空 `authorName` 视为已解析，无需再补拉。
 *
 * @param messages - 消息列表。
 * @param hasName - 判断某 uid 是否已有可用昵称。
 * @returns 需要补拉的 uid 列表；无缺失时为空数组。
 */
export function collectUnresolvedForwardAuthorUids(
  messages: readonly ChatMessage[],
  hasName: (uid: string) => boolean,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (rawUid: string, alreadyNamed: boolean): void => {
    const uid = String(rawUid ?? "").trim();
    if (!uid || seen.has(uid)) return;
    seen.add(uid);
    if (!alreadyNamed && !hasName(uid)) out.push(uid);
  };
  for (const m of messages) {
    if (m.forwardedFrom) visit(m.forwardedFrom.userId, Boolean(String(m.forwardedFrom.authorName ?? "").trim()));
    if (m.forwardedMessages) {
      for (const entry of m.forwardedMessages) visit(entry.userId, Boolean(String(entry.authorName ?? "").trim()));
    }
  }
  return out;
}
