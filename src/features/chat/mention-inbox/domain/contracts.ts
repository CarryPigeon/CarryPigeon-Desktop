/**
 * @fileoverview mention-inbox 领域契约。
 * @description 提及收件箱的展示模型，与 HTTP wire 解耦。
 */

import type { ChatMentionRecord } from "@/features/chat/domain/types/chatApiModels";

export type MentionInboxItem = ChatMentionRecord;

export type MentionInboxPage = {
  items: MentionInboxItem[];
  nextCursor?: string;
  hasMore?: boolean;
};

export type MentionInboxQuery = {
  cursor?: string;
  limit?: number;
  unreadOnly?: boolean;
  channelId?: string;
};
