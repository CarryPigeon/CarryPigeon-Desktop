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

import { asTrimmedString, asOptionalString, asSafeNumber } from "@/shared/data/wireMapperUtils";

/**
 * 将用户 wire 模型映射为领域用户记录。
 */
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

/**
 * 将频道 wire 模型映射为领域频道记录。
 */
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

/**
 * 将未读状态 wire 模型映射为领域未读状态。
 */
export function mapChatUnreadStateWire(wire: ChatUnreadStateWire): ChatUnreadState {
  return {
    channelId: asTrimmedString(wire.cid),
    unreadCount: Math.max(0, asSafeNumber(wire.unread_count)),
    lastReadTime: asSafeNumber(wire.last_read_time),
  };
}

/**
 * 将消息 wire 模型映射为领域消息记录。
 */
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

/**
 * 将消息分页结果从 wire 结构映射为领域分页结构。
 */
export function mapChatMessagePageWire(wire: ChatMessagePageWire): ChatMessagePage {
  const items = Array.isArray(wire.items) ? wire.items.map(mapChatMessageWire) : [];
  return {
    items,
    nextCursor: asOptionalString(wire.next_cursor),
    hasMore: Boolean(wire.has_more),
  };
}

/**
 * 将频道成员 wire 模型映射为领域成员记录。
 */
export function mapChatChannelMemberWire(wire: ChatChannelMemberWire): ChatChannelMemberRecord {
  return {
    userId: asTrimmedString(wire.uid),
    role: asTrimmedString(wire.role) || "member",
    nickname: asTrimmedString(wire.nickname),
    avatar: asOptionalString(wire.avatar),
    joinTime: asSafeNumber(wire.join_time),
  };
}

/**
 * 将入群申请 wire 模型映射为领域申请记录。
 */
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

/**
 * 将封禁 wire 模型映射为领域封禁记录。
 */
export function mapChatChannelBanWire(wire: ChatChannelBanWire): ChatChannelBanRecord {
  return {
    channelId: asTrimmedString(wire.cid),
    userId: asTrimmedString(wire.uid),
    until: asSafeNumber(wire.until),
    reason: asTrimmedString(wire.reason),
    createTime: wire.create_time == null ? undefined : asSafeNumber(wire.create_time),
  };
}

/**
 * 将领域发送消息输入转换为 wire 请求体。
 */
export function mapChatSendMessageInput(input: ChatSendMessageInput): ChatSendMessageWire {
  return {
    domain: asTrimmedString(input.domain),
    domain_version: asTrimmedString(input.domainVersion),
    data: input.data,
    reply_to_mid: asOptionalString(input.replyToMessageId),
  };
}

/**
 * 将领域已读状态输入转换为 wire 请求体。
 */
export function mapChatReadStateInput(input: ChatReadStateInput): ChatReadStateWire {
  return {
    last_read_mid: asTrimmedString(input.lastReadMessageId),
    last_read_time: asSafeNumber(input.lastReadTime),
  };
}

/**
 * 将频道更新输入裁剪为服务端接受的 wire patch。
 */
export function mapChatChannelPatchInput(input: ChatChannelPatchInput): Partial<Pick<ChatChannelWire, "name" | "brief" | "avatar">> {
  const output: Partial<Pick<ChatChannelWire, "name" | "brief" | "avatar">> = {};
  if (typeof input.name === "string") output.name = input.name.trim();
  if (typeof input.brief === "string") output.brief = input.brief.trim();
  if (typeof input.avatar === "string") output.avatar = input.avatar.trim();
  return output;
}

/**
 * 将创建频道输入转换为 wire 请求体。
 */
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

/**
 * 将服务端 WS 事件从 wire envelope 转换为领域事件 envelope。
 *
 * 已知事件会被投影为判别联合；未知事件保持原始 `eventType` 与 `payload`，
 * 以便上层在不破坏兼容性的前提下决定是否忽略或记录。
 */
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
