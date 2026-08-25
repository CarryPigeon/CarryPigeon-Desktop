/**
 * @fileoverview mention-inbox 领域端口。
 */

import type { MentionInboxPage, MentionInboxQuery } from "./contracts";

export type MentionInboxApiPort = {
  listMentions(serverSocket: string, accessToken: string, query: MentionInboxQuery): Promise<MentionInboxPage>;
  markMentionRead(serverSocket: string, accessToken: string, mentionId: string): Promise<void>;
  batchMarkMentionsRead(serverSocket: string, accessToken: string, beforeMentionId?: string, channelId?: string): Promise<void>;
};

export type MentionInboxStatePort = {
  replaceItems(items: MentionInboxPage["items"], nextCursor?: string, hasMore?: boolean): void;
  setUnreadCount(count: number, hasMore: boolean): void;
  setLoading(loading: boolean): void;
  setError(error: string): void;
  markLocalRead(mentionId: string): void;
  markAllLocalRead(): void;
  findItem(mentionId: string): MentionInboxPage["items"][number] | null;
};

export type MentionInboxScopePort = {
  getSocketAndValidToken(): Promise<[string | null, string | null]>;
};

export type MentionInboxNavigationPort = {
  selectChannel(channelId: string): Promise<void>;
};
