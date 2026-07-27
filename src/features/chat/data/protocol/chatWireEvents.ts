/**
 * @fileoverview chatWireEvents.ts
 * @description chat｜数据层 wire contract：WS event envelope models。
 */

import type { ChatMessageWire, ChatMessageReactionWire } from "./chatWireModels";

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
 * 服务端目前不发布 `message.deleted` 事件，本结构仅用于协议兼容兜底。
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
 * 服务端目前不发布 `message.reactions_updated` 事件，本结构仅用于协议兼容兜底。
 */
export type ChatMessageReactionsUpdatedEventPayloadWire = {
  cid: string;
  mid: string;
  reactions: ChatMessageReactionWire[];
};

/**
 * 服务端目前不发布 `message.updated` 事件。本结构复用 `message.created` 形态。
 */
export type ChatMessageUpdatedEventPayloadWire = ChatMessageCreatedEventPayloadWire;

/**
 * `message.pinned` 事件 payload。
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
 * `message.recalled` 事件 payload。
 *
 * 注意：服务端事件字段为 `recall_time`，不携带 `recalled_by_uid`。
 */
export type ChatMessageRecalledEventPayloadWire = {
  cid: string;
  mid: string;
  recall_time: number;
};

/**
 * `message.unpinned` 事件 payload。
 */
export type ChatMessageUnpinnedEventPayloadWire = {
  cid: string;
  mid: string;
  pin_id: string;
  unpinned_by_uid: string;
  unpinned_at: number;
};

/**
 * `mention.created` 事件 payload 的 wire 结构。
 *
 * 与 HTTP `/api/mentions` 列表项结构不同：事件 payload 是扁平结构，直接以 `uid` 表示
 * 被提及的目标用户；不携带 `target` 嵌套与 `read` 字段（read 状态需通过列表接口查询）。
 */
export type MentionCreatedEventPayloadWire = {
  mention_id: string;
  cid: string;
  mid: string;
  from_uid: string;
  uid: string;
  created_at: number;
};

/**
 * 服务端目前不发布 `audit_log.created` 事件，本结构仅用于协议兼容兜底。
 */
export type AuditLogCreatedEventPayloadWire = {
  audit_id: string;
  cid: string;
  actor_uid: string;
  action: string;
  created_at: number;
};

/**
 * 服务端目前不发布 `channel.category_changed` 事件，本结构仅用于协议兼容兜底。
 */
export type ChannelCategoryChangedEventPayloadWire = {
  cid: string;
  category_id: string;
  category_name: string;
  order: number;
  type: string;
};