/**
 * @fileoverview chatApiModels.ts
 * @description chat｜领域契约：chat API models。
 *
 * 说明：
 * - 该文件定义 chat feature 在 domain/application/presentation 内部流转的标准 camelCase 契约；
 * - transport wire / snake_case 字段只能停留在 `data/wire/*`；
 * - 各类 id 在 JS/TS 中必须始终被视为不透明字符串。
 */

export type ChatLinkPreview = {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  faviconUrl?: string;
  siteName?: string;
};

export type ChatChannelRecord = {
  id: string;
  name: string;
  brief?: string;
  avatar?: string;
  ownerUserId?: string;
  announcement?: ChatChannelAnnouncementRecord;
  categoryId?: string;
  categoryName?: string;
  order?: number;
  type?: string;
  joined?: boolean;
  joinRequested?: boolean;
};

export type ChatMessageReplyRecord = {
  messageId: string;
  senderName: string;
  preview: string;
  createdAt: number;
  unavailable?: boolean;
};

export type ChatQuoteReplyRecord = {
  messageId: string;
  userId: string;
  preview: string;
};

export type ChatMessageMentionRecord = {
  userId: string;
  displayName: string;
  type?: "user" | "everyone" | "here";
};

export type ChatChannelAnnouncementRecord = {
  content: string;
  updatedAt: number;
  updatedBy?: string;
};

/**
 * chat 领域中的用户快照。
 */
export type ChatUserRecord = {
  id: string;
  nickname: string;
  avatar?: string;
};

/**
 * 频道成员快照。
 */
export type ChatChannelMemberRecord = {
  userId: string;
  role: "owner" | "admin" | "member" | string;
  nickname: string;
  avatar?: string;
  joinTime: number;
};

/**
 * 入群申请快照。
 */
export type ChatChannelApplicationRecord = {
  applicationId: string;
  channelId: string;
  userId: string;
  reason: string;
  applyTime: number;
  status: "pending" | "approved" | "rejected" | string;
};

/**
 * 频道封禁快照。
 */
export type ChatChannelBanRecord = {
  channelId: string;
  userId: string;
  until: number;
  reason: string;
  createTime?: number;
};

export type ChatForwardedFromRecord = {
  messageId: string;
  channelId: string;
  userId: string;
  preview: string;
  sentTime: number;
};

/**
 * 消息快照。
 *
 * 说明：
 * - `data` 保留 domain payload 原始内容；
 * - 具体展示投影由 message-flow 子域负责。
 */
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
  replyTo?: ChatMessageReplyRecord;
  quoteReply?: ChatQuoteReplyRecord;
  mentions?: ChatMessageMentionRecord[];
  reactions?: ChatReactionRecord[];
  editedAt?: number;
  editVersion?: number;
  forwardedFrom?: ChatForwardedFromRecord;
  forwardedMessages?: ChatForwardedFromRecord[];
  recalledAt?: number;   // 非空表示消息已被撤回；值为服务器分配的 Unix 毫秒时间戳
  threadRootId?: string;      // 非空 = 此消息是线程回复；值 = 根消息 ID
  threadReplyCount?: number;  // 根消息上的回复计数
  linkPreview?: ChatLinkPreview;
};

/** 消息回应领域模型。 */
export type ChatReactionRecord = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

/**
 * 消息分页结果。
 */
export type ChatMessagePage = {
  items: ChatMessageRecord[];
  nextCursor?: string;
  hasMore?: boolean;
};

/**
 * 发送消息命令输入。
 */
export type ChatSendMessageInput = {
  domain: string;
  domainVersion: string;
  data: unknown;
  replyToMessageId?: string;
  replyTo?: ChatMessageReplyRecord;
  quoteReply?: ChatQuoteReplyRecord;
  mentions?: ChatMessageMentionRecord[];
  clientMessageId?: string;
  linkPreview?: ChatLinkPreview;
};

/**
 * 频道未读状态快照。
 */
export type ChatUnreadState = {
  channelId: string;
  unreadCount: number;
  mentionUnreadCount?: number;
  lastReadTime: number;
};

/**
 * 已读状态上报输入。
 */
export type ChatReadStateInput = {
  lastReadMessageId: string;
  lastReadTime: number;
};

/**
 * 已读状态上报响应。
 */
export type ChatReadStateResponse = {
  channelId: string;
  userId: string;
  lastReadMid: string;
  lastReadTime: number;
};

/**
 * 更新频道元信息的输入。
 */
export type ChatChannelPatchInput = {
  name?: string;
  brief?: string;
  avatar?: string;
  announcement?: string;
};

/**
 * 创建频道的输入。
 */
export type ChatChannelCreateInput = {
  name: string;
  brief?: string;
  avatar?: string;
};

export type ChatPinRecord = {
  channelId: string;
  messageId: string;
  pinnedByUserId: string;
  pinnedAt: number;
  note?: string;
};

export type ChatMentionRecord = {
  mentionId: string;
  channelId: string;
  messageId: string;
  fromUserId: string;
  target: { type: string; uid: string };
  createdAt: number;
  read: boolean;
};

export type ChatMentionPage = {
  items: ChatMentionRecord[];
  nextCursor?: string;
  hasMore?: boolean;
};
