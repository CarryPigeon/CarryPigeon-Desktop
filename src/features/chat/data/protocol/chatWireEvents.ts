/**
 * @fileoverview chatWireEvents.ts
 * @description chat｜数据层 wire contract：WS event envelope models。
 */

import type { ChatMessageWire, ChatMessageReactionWire, ChatMentionWire } from "./chatWireModels";

/**
 * 服务端推送事件的原始 wire envelope。
 */
export type ChatWsEventWire = {
  event_id: string;
  event_type: string;
  server_time: number;
  payload: unknown;
};

/**
 * `message.created` 事件 payload 的 wire 结构。
 */
export type ChatMessageCreatedEventPayloadWire = {
  cid: string;
  message: ChatMessageWire;
};

/**
 * `message.deleted` 事件 payload 的 wire 结构。
 */
export type ChatMessageDeletedEventPayloadWire = {
  cid: string;
  mid: string;
};

/**
 * `read_state.updated` 事件 payload 的 wire 结构。
 */
export type ChatReadStateUpdatedEventPayloadWire = {
  cid: string;
  uid: string;
  last_read_mid: string;
  last_read_time: number;
};

/**
 * `channel.changed` 事件 payload 的 wire 结构。
 */
export type ChatChannelChangedEventPayloadWire = {
  cid: string;
  scope?: string;
};

/**
 * `message.reactions_updated` 事件 payload 的 wire 结构。
 */
export type ChatMessageReactionsUpdatedEventPayloadWire = {
  cid: string;
  mid: string;
  reactions: ChatMessageReactionWire[];
};

/**
 * `message.updated` event payload — reuses message.created structure.
 */
export type ChatMessageUpdatedEventPayloadWire = ChatMessageCreatedEventPayloadWire;

/**
 * `message.pinned` event payload.
 */
export type ChatMessagePinnedEventPayloadWire = {
  cid: string;
  mid: string;
  pin_id: string;
  pinned_by_uid: string;
  pinned_at: number;
  note?: string;
};

/**
 * `message.unpinned` event payload.
 */
export type ChatMessageUnpinnedEventPayloadWire = {
  cid: string;
  mid: string;
  pin_id: string;
  unpinned_by_uid: string;
  unpinned_at: number;
};

/**
 * `mention.created` event payload — reuses ChatMentionWire structure.
 */
export type MentionCreatedEventPayloadWire = ChatMentionWire;

/**
 * `audit_log.created` event payload.
 */
export type AuditLogCreatedEventPayloadWire = {
  audit_id: string;
  cid: string;
  actor_uid: string;
  action: string;
  created_at: number;
};

/**
 * `channel.category_changed` event payload.
 */
export type ChannelCategoryChangedEventPayloadWire = {
  cid: string;
  category_id: string;
  category_name: string;
  order: number;
  type: string;
};
