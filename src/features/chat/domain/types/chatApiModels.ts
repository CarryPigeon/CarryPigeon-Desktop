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
  /** 客户端兼容字段；当前服务端 ChannelSummary 不返回公告。 */
  announcement?: ChatChannelAnnouncementRecord;
  /** 客户端兼容字段；当前服务端 ChannelSummary 不返回分类。 */
  categoryId?: string;
  /** 客户端兼容字段；当前服务端 ChannelSummary 不返回分类。 */
  categoryName?: string;
  order?: number;
  type?: string;
  /** 客户端兼容字段；当前服务端 ChannelSummary 不返回加入状态。 */
  joined?: boolean;
  /** 客户端兼容字段；当前服务端 ChannelSummary 不返回申请状态。 */
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

/**
 * Core:ReplyText 包装域的 data payload。
 *
 * 说明：
 * - 消息顶层 domain 为 "Core:ReplyText"；
 * - data 封装嵌套内容、回复/引用关系元数据（reply_to_mid / reply_to / quote_reply）与 link_preview；
 * - mentions 与 Core:Text 语义一致，在消息顶层 `string[]` 承载，不再放入 data；
 * - 嵌套内容 domain 固定为 "Core:Text"（版本 1.0.0），因此 data 中不再保留嵌套 domain/version；
 * - 顶层 ChatMessageRecord 仍保留 replyToMessageId / replyTo / quoteReply / linkPreview 字段，
 *   由 mapper 从 data 解包后回填，便于渲染层复用。
 */
export type ChatReplyMessageData = {
  content: unknown;
  replyToMessageId?: string;
  replyTo?: ChatMessageReplyRecord;
  quoteReply?: ChatQuoteReplyRecord;
  linkPreview?: ChatLinkPreview;
};

/**
 * Core:Forward 包装域的 data payload。
 *
 * single forward 通过 `forwardedFrom` 承载源消息快照；merge forward 通过 `forwardedMessages`
 * 承载若干源消息快照。Mapper 会把它们回填到 ChatMessageRecord 顶层 forward 元字段。
 */
export type ChatForwardMessageData = {
  domain: string;
  domainVersion: string;
  content?: unknown;
  forwardedFrom?: ChatForwardedFromRecord;
  forwardedMessages?: ChatForwardedFromRecord[];
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
 * - 服务端 canonical 信封不携带 sender/profile（author 信息由 members 等接口解析），
 *   保留 `sender?` 作 domain 占位以兼容现有 mapper 入参；新协议下恒为 undefined。
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
  recalledAt?: number;   // 非空表示消息已被撤回；值为服务器分配的 Unix 毫秒时间戳
  threadRootId?: string;      // 非空 = 此消息是线程回复；值 = 根消息 ID（服务端尚未实现 thread 功能）
  threadReplyCount?: number;  // 根消息上的回复计数（服务端尚未实现 thread 功能）
  forwardedFrom?: ChatForwardedFromRecord;
  forwardedMessages?: ChatForwardedFromRecord[];
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
  /** 客户端兼容字段；当前服务端 Unread 响应不返回 @ 未读计数。 */
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
 *
 * 服务端 `UpdateChannelProfileRequest` 当前仅接受 `name` 与 `brief`；
 * 修改公告 / 头像暂不支持，待服务端扩展后恢复。
 */
export type ChatChannelPatchInput = {
  name?: string;
  brief?: string;
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

/**
 * 频道消息附件上传结果（`POST /channels/{cid}/messages/attachments`）。
 */
export type ChatMessageAttachmentUploadResult = {
  objectKey: string;
  shareKey: string;
  filename: string;
  mimeType: string;
  size: number;
};

/**
 * 消息附件类型（multipart `message_type`）。
 */
export type ChatMessageAttachmentType = "file" | "voice";
