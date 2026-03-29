/**
 * @fileoverview chatWireMappers.ts
 * @description chat｜数据层 mapper：wire -> domain / domain -> wire。
 */

import type {
  ChatChannelApplicationRecord,
  ChatChannelBanRecord,
  ChatChannelCreateInput,
  ChatChannelMemberRecord,
  ChatChannelPatchInput,
  ChatChannelRecord,
  ChatMessagePage,
  ChatMessageRecord,
  ChatReadStateInput,
  ChatSendMessageInput,
  ChatUnreadState,
  ChatUserRecord,
} from "@/features/chat/domain/types/chatApiModels";
import type {
  ChatChannelChangedEvent,
  ChatEventEnvelope,
  ChatMessageCreatedEvent,
  ChatMessageDeletedEvent,
  ChatReadStateUpdatedEvent,
} from "@/features/chat/domain/types/chatEventModels";
import type {
  ChatChannelApplicationWire,
  ChatChannelBanWire,
  ChatChannelMemberWire,
  ChatChannelWire,
  ChatMessagePageWire,
  ChatMessageWire,
  ChatReadStateWire,
  ChatSendMessageWire,
  ChatUnreadStateWire,
  ChatUserWire,
} from "./chatWireModels";
import type {
  ChatChannelChangedEventPayloadWire,
  ChatMessageCreatedEventPayloadWire,
  ChatMessageDeletedEventPayloadWire,
  ChatReadStateUpdatedEventPayloadWire,
  ChatWsEventWire,
} from "./chatWireEvents";

function asTrimmedString(value: unknown): string {
  return String(value ?? "").trim();
}

function asOptionalString(value: unknown): string | undefined {
  const next = asTrimmedString(value);
  return next || undefined;
}

function asSafeNumber(value: unknown): number {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? Math.trunc(next) : 0;
}

export function mapChatUserWire(wire: ChatUserWire | undefined): ChatUserRecord | undefined {
  if (!wire) return undefined;
  const id = asTrimmedString(wire.uid);
  const nickname = asTrimmedString(wire.nickname);
  if (!id && !nickname) return undefined;
  return {
    id,
    nickname,
    avatar: asOptionalString(wire.avatar),
  };
}

export function mapChatChannelWire(wire: ChatChannelWire): ChatChannelRecord {
  const id = asTrimmedString(wire.cid);
  return {
    id,
    name: asTrimmedString(wire.name) || id,
    brief: asOptionalString(wire.brief),
    avatar: asOptionalString(wire.avatar),
    ownerUserId: asOptionalString(wire.owner_uid),
  };
}

export function mapChatUnreadStateWire(wire: ChatUnreadStateWire): ChatUnreadState {
  return {
    channelId: asTrimmedString(wire.cid),
    unreadCount: Math.max(0, asSafeNumber(wire.unread_count)),
    lastReadTime: asSafeNumber(wire.last_read_time),
  };
}

export function mapChatMessageWire(wire: ChatMessageWire): ChatMessageRecord {
  return {
    id: asTrimmedString(wire.mid),
    channelId: asTrimmedString(wire.cid),
    userId: asTrimmedString(wire.uid),
    sender: mapChatUserWire(wire.sender),
    sentTime: asSafeNumber(wire.send_time),
    domain: asTrimmedString(wire.domain),
    domainVersion: asTrimmedString(wire.domain_version),
    data: wire.data,
    preview: asOptionalString(wire.preview),
    replyToMessageId: asOptionalString(wire.reply_to_mid),
  };
}

export function mapChatMessagePageWire(wire: ChatMessagePageWire): ChatMessagePage {
  const items = Array.isArray(wire.items) ? wire.items.map(mapChatMessageWire) : [];
  return {
    items,
    nextCursor: asOptionalString(wire.next_cursor),
    hasMore: Boolean(wire.has_more),
  };
}

export function mapChatChannelMemberWire(wire: ChatChannelMemberWire): ChatChannelMemberRecord {
  return {
    userId: asTrimmedString(wire.uid),
    role: asTrimmedString(wire.role) || "member",
    nickname: asTrimmedString(wire.nickname),
    avatar: asOptionalString(wire.avatar),
    joinTime: asSafeNumber(wire.join_time),
  };
}

export function mapChatChannelApplicationWire(wire: ChatChannelApplicationWire): ChatChannelApplicationRecord {
  return {
    applicationId: asTrimmedString(wire.application_id),
    channelId: asTrimmedString(wire.cid),
    userId: asTrimmedString(wire.uid),
    reason: asTrimmedString(wire.reason),
    applyTime: asSafeNumber(wire.apply_time),
    status: asTrimmedString(wire.status) || "pending",
  };
}

export function mapChatChannelBanWire(wire: ChatChannelBanWire): ChatChannelBanRecord {
  return {
    channelId: asTrimmedString(wire.cid),
    userId: asTrimmedString(wire.uid),
    until: asSafeNumber(wire.until),
    reason: asTrimmedString(wire.reason),
    createTime: wire.create_time == null ? undefined : asSafeNumber(wire.create_time),
  };
}

export function mapChatSendMessageInput(input: ChatSendMessageInput): ChatSendMessageWire {
  return {
    domain: asTrimmedString(input.domain),
    domain_version: asTrimmedString(input.domainVersion),
    data: input.data,
    reply_to_mid: asOptionalString(input.replyToMessageId),
  };
}

export function mapChatReadStateInput(input: ChatReadStateInput): ChatReadStateWire {
  return {
    last_read_mid: asTrimmedString(input.lastReadMessageId),
    last_read_time: asSafeNumber(input.lastReadTime),
  };
}

export function mapChatChannelPatchInput(input: ChatChannelPatchInput): Partial<Pick<ChatChannelWire, "name" | "brief" | "avatar">> {
  const output: Partial<Pick<ChatChannelWire, "name" | "brief" | "avatar">> = {};
  if (typeof input.name === "string") output.name = input.name.trim();
  if (typeof input.brief === "string") output.brief = input.brief.trim();
  if (typeof input.avatar === "string") output.avatar = input.avatar.trim();
  return output;
}

export function mapChatChannelCreateInput(
  input: ChatChannelCreateInput,
): Pick<ChatChannelWire, "name"> & Partial<Pick<ChatChannelWire, "brief" | "avatar">> {
  return {
    name: asTrimmedString(input.name),
    brief: asOptionalString(input.brief) ?? "",
    avatar: asOptionalString(input.avatar) ?? "",
  };
}

function mapMessageCreatedPayload(wire: ChatMessageCreatedEventPayloadWire): ChatMessageCreatedEvent {
  return {
    channelId: asTrimmedString(wire.cid),
    message: mapChatMessageWire(wire.message),
  };
}

function mapMessageDeletedPayload(wire: ChatMessageDeletedEventPayloadWire): ChatMessageDeletedEvent {
  return {
    channelId: asTrimmedString(wire.cid),
    messageId: asTrimmedString(wire.mid),
  };
}

function mapReadStateUpdatedPayload(wire: ChatReadStateUpdatedEventPayloadWire): ChatReadStateUpdatedEvent {
  return {
    channelId: asTrimmedString(wire.cid),
    userId: asTrimmedString(wire.uid),
    lastReadMessageId: asTrimmedString(wire.last_read_mid),
    lastReadTime: asSafeNumber(wire.last_read_time),
  };
}

function mapChannelChangedPayload(wire: ChatChannelChangedEventPayloadWire): ChatChannelChangedEvent {
  return {
    channelId: asTrimmedString(wire.cid),
    scope: asOptionalString(wire.scope),
  };
}

export function mapChatWsEventWire(wire: ChatWsEventWire): ChatEventEnvelope {
  const base = {
    eventId: asTrimmedString(wire.event_id),
    eventType: asTrimmedString(wire.event_type),
    serverTime: asSafeNumber(wire.server_time),
  };

  if (base.eventType === "message.created") {
    return {
      ...base,
      eventType: "message.created",
      payload: mapMessageCreatedPayload(wire.payload as ChatMessageCreatedEventPayloadWire),
    };
  }

  if (base.eventType === "message.deleted") {
    return {
      ...base,
      eventType: "message.deleted",
      payload: mapMessageDeletedPayload(wire.payload as ChatMessageDeletedEventPayloadWire),
    };
  }

  if (base.eventType === "read_state.updated") {
    return {
      ...base,
      eventType: "read_state.updated",
      payload: mapReadStateUpdatedPayload(wire.payload as ChatReadStateUpdatedEventPayloadWire),
    };
  }

  if (base.eventType === "channel.changed") {
    return {
      ...base,
      eventType: "channel.changed",
      payload: mapChannelChangedPayload(wire.payload as ChatChannelChangedEventPayloadWire),
    };
  }

  if (base.eventType === "channels.changed") {
    return {
      ...base,
      eventType: "channels.changed",
      payload: {},
    };
  }

  return {
    ...base,
    payload: wire.payload,
  };
}
