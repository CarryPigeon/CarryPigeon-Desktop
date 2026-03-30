/**
 * @fileoverview chatWireEvents.ts
 * @description chat｜数据层 wire contract：WS event envelope models。
 */

import type { ChatMessageWire } from "./chatWireModels";

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
