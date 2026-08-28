/**
 * @fileoverview mention-inbox 领域端口。
 */

import type { MentionInboxItem, MentionInboxPage, MentionInboxQuery } from "./contracts";

export type MentionInboxApiPort = {
  listMentions(serverSocket: string, accessToken: string, query: MentionInboxQuery): Promise<MentionInboxPage>;
  markMentionRead(serverSocket: string, accessToken: string, mentionId: string): Promise<void>;
  batchMarkMentionsRead(serverSocket: string, accessToken: string, beforeMentionId?: string, channelId?: string): Promise<void>;
};

export type MentionInboxStatePort = {
  replaceItems(items: MentionInboxPage["items"], nextCursor?: string, hasMore?: boolean): void;
  appendItems(items: MentionInboxPage["items"], nextCursor?: string, hasMore?: boolean): void;
  setUnreadCount(count: number, hasMore: boolean): void;
  setLoading(loading: boolean): void;
  setError(error: string): void;
  setUnreadOnly(value: boolean): void;
  setChannelId(channelId: string): void;
  markLocalRead(mentionId: string): void;
  markAllLocalRead(): void;
  findItem(mentionId: string): MentionInboxItem | null;
  readNextCursor(): string | undefined;
  readHasMore(): boolean;
  readLoading(): boolean;
  readUnreadOnly(): boolean;
  readChannelId(): string;
};

export type MentionInboxScopePort = {
  getSocketAndValidToken(): Promise<[string | null, string | null]>;
};

export type MentionInboxNavigationPort = {
  selectChannel(channelId: string): Promise<void>;
};
