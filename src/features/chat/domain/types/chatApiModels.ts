/**
 * @fileoverview chatApiModels.ts
 * @description chat｜领域契约：chat API models。
 *
 * 说明：
 * - 该文件定义 chat feature 在 domain/application/presentation 内部流转的标准 camelCase 契约；
 * - transport wire / snake_case 字段只能停留在 `data/wire/*`；
 * - 各类 id 在 JS/TS 中必须始终被视为不透明字符串。
 */

export type ChatChannelRecord = {
  id: string;
  name: string;
  brief?: string;
  avatar?: string;
  ownerUserId?: string;
};

export type ChatUserRecord = {
  id: string;
  nickname: string;
  avatar?: string;
};

export type ChatChannelMemberRecord = {
  userId: string;
  role: "owner" | "admin" | "member" | string;
  nickname: string;
  avatar?: string;
  joinTime: number;
};

export type ChatChannelApplicationRecord = {
  applicationId: string;
  channelId: string;
  userId: string;
  reason: string;
  applyTime: number;
  status: "pending" | "approved" | "rejected" | string;
};

export type ChatChannelBanRecord = {
  channelId: string;
  userId: string;
  until: number;
  reason: string;
  createTime?: number;
};

export type ChatMessageRecord = {
  id: string;
  channelId: string;
  userId: string;
  sender?: ChatUserRecord;
  sentTime: number;
  domain: string;
  domainVersion: string;
  data: unknown;
  preview?: string;
  replyToMessageId?: string;
};

export type ChatMessagePage = {
  items: ChatMessageRecord[];
  nextCursor?: string;
  hasMore?: boolean;
};

export type ChatSendMessageInput = {
  domain: string;
  domainVersion: string;
  data: unknown;
  replyToMessageId?: string;
};

export type ChatUnreadState = {
  channelId: string;
  unreadCount: number;
  lastReadTime: number;
};

export type ChatReadStateInput = {
  lastReadMessageId: string;
  lastReadTime: number;
};

export type ChatChannelPatchInput = {
  name?: string;
  brief?: string;
  avatar?: string;
};

export type ChatChannelCreateInput = {
  name: string;
  brief?: string;
  avatar?: string;
};
