/**
 * @fileoverview chat 窗口级交互事件。
 * @description
 * 收敛 chat 页面层内部的窗口事件协议，避免外部继续直接依赖裸字符串事件名或模糊 scope。
 */

const FORWARD_MESSAGE_REQUESTED_EVENT = "carrypigeon:chat/forward-message-requested";
const INSERT_TEXT_REQUESTED_EVENT = "carrypigeon:chat/insert-text-requested";
const CHANNEL_PROJECTION_CHANGED_EVENT = "carrypigeon:chat/channel-projection-changed";

export type ForwardMessageRequestedEvent = {
  kind: "forward_message_requested";
  content: string;
};

export type InsertTextMode = "append" | "prepend" | "replace";

export type InsertTextRequestedEvent = {
  kind: "insert_text_requested";
  content: string;
  mode: InsertTextMode;
};

export type ChatChannelProjection = "messages" | "members" | "applications" | "bans" | "profile";

export type ChannelProjectionChangedEvent = {
  kind: "channel_projection_changed";
  channelId: string;
  projection?: ChatChannelProjection;
};

export function emitForwardMessageRequested(content: string): void {
  window.dispatchEvent(
    new CustomEvent<ForwardMessageRequestedEvent>(FORWARD_MESSAGE_REQUESTED_EVENT, {
      detail: {
        kind: "forward_message_requested",
        content,
      },
    }),
  );
}

export function emitInsertTextRequested(content: string, mode: InsertTextMode = "append"): void {
  window.dispatchEvent(
    new CustomEvent<InsertTextRequestedEvent>(INSERT_TEXT_REQUESTED_EVENT, {
      detail: {
        kind: "insert_text_requested",
        content,
        mode,
      },
    }),
  );
}

export function emitChannelProjectionChanged(channelId: string, projection?: ChatChannelProjection): void {
  const normalizedChannelId = String(channelId ?? "").trim();
  if (!normalizedChannelId) return;
  window.dispatchEvent(
    new CustomEvent<ChannelProjectionChangedEvent>(CHANNEL_PROJECTION_CHANGED_EVENT, {
      detail: {
        kind: "channel_projection_changed",
        channelId: normalizedChannelId,
        projection,
      },
    }),
  );
}

export function observeChannelProjectionChanged(
  observer: (event: ChannelProjectionChangedEvent) => void,
): () => void {
  function handle(event: Event): void {
    observer((event as CustomEvent<ChannelProjectionChangedEvent>).detail);
  }
  window.addEventListener(CHANNEL_PROJECTION_CHANGED_EVENT, handle);
  return () => {
    window.removeEventListener(CHANNEL_PROJECTION_CHANGED_EVENT, handle);
  };
}
