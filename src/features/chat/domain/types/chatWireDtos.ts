/**
 * @fileoverview chatWireDtos.ts
 * @description Data-transfer types aligned with the HTTP+WebSocket protocol.
 *
 * Notes:
 * - Field names intentionally keep `snake_case` to mirror the on-the-wire contract.
 * - IDs are Snowflake strings and must be treated as opaque strings in JS/TS.
 */

export type ChannelDto = {
  cid: string;
  name: string;
  brief?: string;
  avatar?: string;
  owner_uid?: string;
};

export type UserLiteDto = {
  uid: string;
  nickname: string;
  avatar?: string;
};

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

export type ListMessagesResponseDto = {
  items: MessageDto[];
  next_cursor?: string;
  has_more?: boolean;
};

export type SendMessageRequestDto = {
  domain: string;
  domain_version: string;
  data: unknown;
  reply_to_mid?: string;
};

export type UnreadItemDto = {
  cid: string;
  unread_count: number;
  last_read_time: number;
};

export type ReadStateRequestDto = {
  last_read_mid: string;
  last_read_time: number;
};
