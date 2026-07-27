/**
 * @fileoverview chatWireModels.ts
 * @description chat｜数据层 wire contract：HTTP/WS snake_case payload models。
 *
 * 说明：
 * - 服务端 canonical 消息 envelope 固定 10 字段（见 `ChannelMessageV1Response`）；
 *   关系元数据（reply / quote / forward / link_preview）只在 `data` 内按 domain 分支约定放置；
 * - `mentions` 在信封顶层为 `string[]`（snowflake UID），服务端只接受 UID 列表；
 * - `status` 取值 `sent` / `recalled`，标识服务端当前存储的消息可见性状态。
 */

/**
 * 频道实体的 wire 表示。
 */
export type ChatChannelWire = {
  cid: string;
  name: string;
  brief?: string;
  avatar?: string;
  owner_uid?: string;
  /** 客户端兼容字段；当前服务端 ChannelSummary 不返回公告。 */
  announcement?: ChatChannelAnnouncementWire;
  /** 客户端兼容字段；当前服务端 ChannelSummary 不返回分类。 */
  category_id?: string;
  /** 客户端兼容字段；当前服务端 ChannelSummary 不返回分类。 */
  category_name?: string;
  order?: number;
  type?: string;
  /** 客户端兼容字段；当前服务端 ChannelSummary 不返回加入状态。 */
  joined?: boolean;
  /** 客户端兼容字段；当前服务端 ChannelSummary 不返回申请状态。 */
  join_requested?: boolean;
};

/**
 * 用户实体的 wire 表示。
 */
export type ChatUserWire = {
  uid: string;
  nickname: string;
  avatar?: string;
};

export type ChatChannelAnnouncementWire = {
  content: string;
  updated_at: number;
  updated_by?: string;
};

export type ChatMessageReplyWire = {
  mid: string;
  sender_name: string;
  preview: string;
  created_at: number;
  unavailable?: boolean;
};

export type ChatQuoteReplyWire = {
  mid: string;
  uid: string;
  preview: string;
};

/**
 * 频道成员实体的 wire 表示。
 */
export type ChatChannelMemberWire = {
  uid: string;
  role: "owner" | "admin" | "member" | string;
  nickname: string;
  avatar?: string;
  join_time: number;
};

/**
 * 入群申请实体的 wire 表示。
 */
export type ChatChannelApplicationWire = {
  application_id: string;
  cid: string;
  uid: string;
  reason: string;
  apply_time: number;
  status: "pending" | "approved" | "rejected" | string;
};

/**
 * 频道封禁实体的 wire 表示。
 */
export type ChatChannelBanWire = {
  cid: string;
  uid: string;
  until: number;
  reason: string;
  create_time?: number;
};

export type ChatForwardedFromWire = {
  mid: string;
  cid: string;
  uid: string;
  preview: string;
  send_time: number;
};

/**
 * Core:ReplyText 包装域的 data payload（snake_case）。
 *
 * 嵌套内容固定为 Core:Text；回复/引用关系元数据与 link_preview 放在 data 内。
 * mentions 与 Core:Text 一样在消息顶层 `string[]`，不再放入 data。
 */
export type ChatReplyMessageWireData = {
  content: unknown;
  reply_to_mid?: string;
  reply_to?: ChatMessageReplyWire;
  quote_reply?: ChatQuoteReplyWire;
  link_preview?: unknown;
};

/**
 * Core:Forward 包装域的 data payload（snake_case）。
 *
 * 服务端在 `data` 内回放源消息快照（single 用 forwarded_from，merge 用 forwarded_messages）；
 * 客户端从 data 内解出后回填到 ChatMessageRecord 的顶层 forwardedFrom / forwardedMessages。
 */
export type ChatForwardMessageWireData = {
  domain: string;
  domain_version: string;
  content?: unknown;
  forwarded_from?: ChatForwardedFromWire;
  forwarded_messages?: ChatForwardedFromWire[];
};

/**
 * 消息实体的 wire 表示（对齐服务端 `ChannelMessageV1Response`）。
 *
 * - 顶层固定 10 字段：mid / uid / cid / domain / domain_version / data / send_time /
 *   mentions / preview / status。其余可选字段（reactions 等）仍保留以便扩展。
 * - 服务端目前不在 canonical 信封携带 sender/nickname/avatar，作者信息由客户端
 *   通过 channel members 等接口自行解析。
 */
export type ChatMessageWire = {
  mid: string;
  uid: string;
  cid: string;
  domain: string;
  domain_version: string;
  data: unknown;
  send_time: number;
  mentions?: string[];
  preview?: string;
  status?: "sent" | "recalled";
  // 可选扩展：服务端尚未推送 reactions，但本地乐观更新用到时仍可承载。
  reactions?: ChatMessageReactionWire[];
};

/**
 * 消息回应 wire 模型。
 */
export type ChatMessageReactionWire = {
  emoji: string;
  count: number;
  reacted_by_me: boolean;
};

/**
 * 消息附件上传响应 wire（`POST /channels/{cid}/messages/attachments`）。
 */
export type ChatMessageAttachmentUploadWire = {
  object_key: string;
  share_key: string;
  filename: string;
  mime_type: string;
  size: number;
};

/**
 * 分页消息列表的 wire 表示。
 */
export type ChatMessagePageWire = {
  items: ChatMessageWire[];
  next_cursor?: string;
  has_more?: boolean;
};

/**
 * 发送消息请求体的 wire 表示（对齐服务端 `SendChannelMessageRequest`）。
 *
 * 服务端只接受顶层 `domain` / `domain_version` / `data` / `mentions`(string[]) /
 * `client_message_id`；reply/quote/link_preview 关系元数据由 `data` 承载，不能放顶层。
 */
export type ChatSendMessageWire = {
  domain: string;
  domain_version: string;
  data: unknown;
  mentions?: string[];
  client_message_id?: string;
};

/**
 * 未读状态记录的 wire 表示。
 */
export type ChatUnreadStateWire = {
  cid: string;
  unread_count: number;
  /** 客户端兼容字段；当前服务端 Unread 响应不返回 @ 未读计数。 */
  mention_unread_count?: number;
  last_read_time: number;
};

/**
 * 已读状态上报请求体的 wire 表示。
 */
export type ChatReadStateWire = {
  last_read_mid: string;
  last_read_time: number;
};

/**
 * 已读状态上报响应 wire 表示。
 */
export type ChatReadStateResponseWire = {
  cid: string;
  uid: string;
  last_read_mid: string;
  last_read_time: number;
};

export type ChatMessageSearchQueryWire = {
  q: string;
  cursor?: string;
  limit?: number;
  sender_uid?: string;
  domain?: string;
  before_mid?: string;
  after_mid?: string;
};

export type ChatPinWire = {
  cid: string;
  mid: string;
  pinned_by_uid: string;
  pinned_at: number;
  note?: string;
};

export type ChatPinListWire = {
  items: ChatPinWire[];
  next_cursor?: string;
  has_more?: boolean;
};

export type ChatMessageForwardWire = {
  target_cid: string;
  comment?: string;
  idempotency_key?: string;
  merged_mids?: string[];
};

/**
 * HTTP 列表中的提及记录 wire 表示（对齐服务端 `MentionItemResponse`）。
 *
 * 注意：WS `mention.created` 事件 payload 不使用本结构（事件 payload 是扁平结构，
 * 见 `chatWireEvents.ts`）。
 */
export type ChatMentionWire = {
  mention_id: string;
  cid: string;
  mid: string;
  from_uid: string;
  target: { type: string; uid: string };
  created_at: number;
  read: boolean;
};

export type ChatMentionPageWire = {
  items: ChatMentionWire[];
  next_cursor?: string;
  has_more?: boolean;
};

export type ChatReactionRequestWire = {
  emoji: string;
};

export type ChatReactionResponseWire = {
  reactions: ChatMessageReactionWire[];
};