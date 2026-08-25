/**
 * @fileoverview mention-inbox 公共类型。
 */

import type { ReadableCapability } from "@/shared/types/capabilities";
import type { MentionInboxItem } from "./domain/contracts";

export type { MentionInboxItem, MentionInboxPage, MentionInboxQuery } from "./domain/contracts";

export type MentionInboxSnapshot = {
  items: readonly MentionInboxItem[];
  unreadCount: number;
  unreadHasMore: boolean;
  unreadOnly: boolean;
  channelId: string;
  hasMore: boolean;
  loading: boolean;
  error: string;
};

export type MentionInboxCapabilities = ReadableCapability<MentionInboxSnapshot> & {
  refresh(): Promise<void>;
  loadMore(): Promise<void>;
  setUnreadOnly(value: boolean): Promise<void>;
  setChannelId(channelId: string): Promise<void>;
  markRead(mentionId: string): Promise<void>;
  markAllRead(): Promise<void>;
  openMention(mentionId: string): Promise<void>;
};
