/**
 * @fileoverview chatWireModels.ts
 * @description chat｜数据层 wire contract：HTTP/WS snake_case payload models。
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
  announcement?: ChatChannelAnnouncementWire;
  category_id?: string;
  category_name?: string;
  order?: number;
  type?: string;
  joined?: boolean;
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

export type ChatMessageMentionWire = {
  uid: string;
  display_name: string;
  type?: "user" | "everyone" | "here";
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
 * 消息实体的 wire 表示。
 */
export type ChatMessageWire = {
  mid: string;
  cid: string;
  uid: string;
  sender?: ChatUserWire;
  send_time: number;
  domain: string;
  domain_version: string;
  data: unknown;
  preview?: string;
  reply_to_mid?: string;
  reply_to?: ChatMessageReplyWire;
  quote_reply?: ChatQuoteReplyWire;
  mentions?: ChatMessageMentionWire[];
  reactions?: ChatMessageReactionWire[];
  edited_at?: number;
  edit_version?: number;
  forwarded_from?: ChatForwardedFromWire;
  forwarded_messages?: ChatForwardedFromWire[];
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
 * 分页消息列表的 wire 表示。
 */
export type ChatMessagePageWire = {
  items: ChatMessageWire[];
  next_cursor?: string;
  has_more?: boolean;
};

/**
 * 发送消息请求体的 wire 表示。
 */
export type ChatSendMessageWire = {
  domain: string;
  domain_version: string;
  data: unknown;
  reply_to_mid?: string;
  reply_to?: ChatMessageReplyWire;
  quote_reply?: ChatQuoteReplyWire;
  mentions?: ChatMessageMentionWire[];
  client_message_id?: string;
};

/**
 * 未读状态记录的 wire 表示。
 */
export type ChatUnreadStateWire = {
  cid: string;
  unread_count: number;
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

export type ChatMessageSearchQueryWire = {
  q: string;
  cursor?: string;
  limit?: number;
  sender_uid?: string;
  domain?: string;
  before_mid?: string;
  after_mid?: string;
};

export type ChatMessageEditWire = {
  domain: string;
  domain_version: string;
  data: unknown;
  mentions?: Array<{ type: string; uid: string }>;
  expected_edit_version?: number;
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
