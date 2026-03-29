/**
 * @fileoverview chatWireModels.ts
 * @description chat｜数据层 wire contract：HTTP/WS snake_case payload models。
 */

export type ChatChannelWire = {
  cid: string;
  name: string;
  brief?: string;
  avatar?: string;
  owner_uid?: string;
};

export type ChatUserWire = {
  uid: string;
  nickname: string;
  avatar?: string;
};

export type ChatChannelMemberWire = {
  uid: string;
  role: "owner" | "admin" | "member" | string;
  nickname: string;
  avatar?: string;
  join_time: number;
};

export type ChatChannelApplicationWire = {
  application_id: string;
  cid: string;
  uid: string;
  reason: string;
  apply_time: number;
  status: "pending" | "approved" | "rejected" | string;
};

export type ChatChannelBanWire = {
  cid: string;
  uid: string;
  until: number;
  reason: string;
  create_time?: number;
};

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

export type ChatMessagePageWire = {
  items: ChatMessageWire[];
  next_cursor?: string;
  has_more?: boolean;
};

export type ChatSendMessageWire = {
  domain: string;
  domain_version: string;
  data: unknown;
  reply_to_mid?: string;
};

export type ChatUnreadStateWire = {
  cid: string;
  unread_count: number;
  last_read_time: number;
};

export type ChatReadStateWire = {
  last_read_mid: string;
  last_read_time: number;
};
