/**
 * @fileoverview chatEventModels.ts
 * @description chat｜领域契约：chat event models。
 *
 * 说明：
 * - WS 事件 envelope 进入 chat 内部后统一转换为 camelCase；
 * - 已知事件 payload 在 data 层完成最小归一化，避免 snake_case 穿透到 application/presentation。
 */

import type { ChatMessageRecord } from "./chatApiModels";

/**
 * 新消息创建事件。
 */
export type ChatMessageCreatedEvent = {
  channelId: string;
  message: ChatMessageRecord;
};

/**
 * 消息删除事件。
 */
export type ChatMessageDeletedEvent = {
  channelId: string;
  messageId: string;
};

/**
 * 已读状态更新事件。
 */
export type ChatReadStateUpdatedEvent = {
  channelId: string;
  userId: string;
  lastReadMessageId: string;
  lastReadTime: number;
};

/**
 * 单个频道元信息变化事件。
 */
export type ChatChannelChangedEvent = {
  channelId: string;
  scope?: string;
};

/**
 * 多频道目录整体变化事件。
 */
export type ChatChannelsChangedEvent = Record<string, never>;

/**
 * chat 领域事件 envelope。
 *
 * 设计目标：
 * - 已知事件使用判别联合承载强语义 payload；
 * - 未知事件保留兜底分支，避免协议新增事件时直接打断现有客户端。
 */
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

/**
 * 事件流连接句柄。
 *
 * 生命周期语义：
 * - `close` 结束当前租约；
 * - `reauth` 在既有连接上刷新凭证，不改变调用方持有的 capability。
 */
export type ChatEventsClient = {
  close(): void;
  reauth(nextAccessToken: string): void;
};

/**
 * 事件流连接选项。
 */
export type ChatEventsConnectOptions = {
  wsUrlOverride?: string;
  onResumeFailed?: (reason: string) => void;
  onAuthError?: (reason: string) => void;
};
