/**
 * @fileoverview chatEventModels.ts
 * @description chat｜领域契约：chat event models。
 *
 * 说明：
 * - WS 事件 envelope 进入 chat 内部后统一转换为 camelCase；
 * - 已知事件 payload 在 data 层完成最小归一化，避免 snake_case 穿透到 application/presentation。
 */

import type { ChatMessageRecord } from "./chatApiModels";

export type ChatMessageCreatedEvent = {
  channelId: string;
  message: ChatMessageRecord;
};

export type ChatMessageDeletedEvent = {
  channelId: string;
  messageId: string;
};

export type ChatReadStateUpdatedEvent = {
  channelId: string;
  userId: string;
  lastReadMessageId: string;
  lastReadTime: number;
};

export type ChatChannelChangedEvent = {
  channelId: string;
  scope?: string;
};

export type ChatChannelsChangedEvent = Record<string, never>;

export type ChatEventEnvelope =
  | {
      eventId: string;
      eventType: "message.created";
      serverTime: number;
      payload: ChatMessageCreatedEvent;
    }
  | {
      eventId: string;
      eventType: "message.deleted";
      serverTime: number;
      payload: ChatMessageDeletedEvent;
    }
  | {
      eventId: string;
      eventType: "read_state.updated";
      serverTime: number;
      payload: ChatReadStateUpdatedEvent;
    }
  | {
      eventId: string;
      eventType: "channel.changed";
      serverTime: number;
      payload: ChatChannelChangedEvent;
    }
  | {
      eventId: string;
      eventType: "channels.changed";
      serverTime: number;
      payload: ChatChannelsChangedEvent;
    }
  | {
      eventId: string;
      eventType: string;
      serverTime: number;
      payload: unknown;
    };
