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
};

/**
 * 用户实体的 wire 表示。
 */
export type ChatUserWire = {
  uid: string;
  nickname: string;
  avatar?: string;
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
};

/**
 * 未读状态记录的 wire 表示。
 */
export type ChatUnreadStateWire = {
  cid: string;
  unread_count: number;
  last_read_time: number;
};

/**
 * 已读状态上报请求体的 wire 表示。
 */
export type ChatReadStateWire = {
  last_read_mid: string;
  last_read_time: number;
};
