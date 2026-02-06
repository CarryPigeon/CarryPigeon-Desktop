/**
 * @fileoverview chatWireDtos.ts
 * @description chat｜领域类型：chatWireDtos。
 *
 * 说明：
 * - 字段名保持 `snake_case`，用于与“线上协议（wire contract）”一一对应。
 * - 各类 id 为 Snowflake 字符串，在 JS/TS 中必须当作不透明字符串处理（禁止转 number）。
 */

/**
 * 频道 DTO（wire contract）。
 */
export type ChannelDto = {
  cid: string;
  name: string;
  brief?: string;
  avatar?: string;
  owner_uid?: string;
};

/**
 * 用户轻量 DTO（wire contract）。
 */
export type UserLiteDto = {
  uid: string;
  nickname: string;
  avatar?: string;
};

/**
 * 频道成员 DTO（wire contract）。
 */
export type ChannelMemberDto = {
  uid: string;
  role: "owner" | "admin" | "member" | string;
  nickname: string;
  avatar?: string;
  join_time: number;
};

/**
 * 入群申请 DTO（wire contract）。
 */
export type ChannelApplicationDto = {
  application_id: string;
  cid: string;
  uid: string;
  reason: string;
  apply_time: number;
  status: "pending" | "approved" | "rejected" | string;
};

/**
 * 频道封禁/禁言条目 DTO（wire contract）。
 */
export type ChannelBanDto = {
  cid: string;
  uid: string;
  until: number;
  reason: string;
  create_time?: number;
};

/**
 * 消息 DTO（wire contract）。
 */
export type MessageDto = {
  mid: string;
  cid: string;
  uid: string;
  sender?: UserLiteDto;
  send_time: number;
  domain: string;
  domain_version: string;
  data: unknown;
  preview?: string;
  reply_to_mid?: string;
};

/**
 * 分页拉取消息列表响应 DTO（wire contract）。
 */
export type ListMessagesResponseDto = {
  items: MessageDto[];
  next_cursor?: string;
  has_more?: boolean;
};

/**
 * 发送消息请求 DTO（wire contract）。
 */
export type SendMessageRequestDto = {
  domain: string;
  domain_version: string;
  data: unknown;
  reply_to_mid?: string;
};

/**
 * 未读计数条目 DTO（wire contract）。
 */
export type UnreadItemDto = {
  cid: string;
  unread_count: number;
  last_read_time: number;
};

/**
 * 上报读状态请求 DTO（wire contract）。
 */
export type ReadStateRequestDto = {
  last_read_mid: string;
  last_read_time: number;
};
