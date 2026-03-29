/**
 * @fileoverview chatWireEvents.ts
 * @description chat｜数据层 wire contract：WS event envelope models。
 */

import type { ChatMessageWire } from "./chatWireModels";

export type ChatWsEventWire = {
  event_id: string;
  event_type: string;
  server_time: number;
  payload: unknown;
};

export type ChatMessageCreatedEventPayloadWire = {
  cid: string;
  message: ChatMessageWire;
};

export type ChatMessageDeletedEventPayloadWire = {
  cid: string;
  mid: string;
};

export type ChatReadStateUpdatedEventPayloadWire = {
  cid: string;
  uid: string;
  last_read_mid: string;
  last_read_time: number;
};

export type ChatChannelChangedEventPayloadWire = {
  cid: string;
  scope?: string;
};
