/**
 * @fileoverview chatWireMappers.ts
 * @description chat｜数据层 mapper：wire -> domain / domain -> wire。
 */

import type {
  ChatChannelApplicationRecord,
  ChatChannelAnnouncementRecord,
  ChatChannelBanRecord,
  ChatChannelCreateInput,
  ChatChannelMemberRecord,
  ChatChannelPatchInput,
  ChatChannelRecord,
  ChatForwardedFromRecord,
  ChatMentionRecord,
  ChatMessageMentionRecord,
  ChatMessagePage,
  ChatMessageRecord,
  ChatMessageReplyRecord,
  ChatPinRecord,
  ChatQuoteReplyRecord,
  ChatReactionRecord,
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
  ChatMessagePinnedEvent,
  ChatMessageReactionsUpdatedEvent,
  ChatMessageUnpinnedEvent,
  ChatMessageUpdatedEvent,
  ChatReadStateUpdatedEvent,
  MentionCreatedEvent,
  AuditLogCreatedEvent,
  ChannelCategoryChangedEvent,
} from "@/features/chat/domain/types/chatEventModels";
import type {
  ChatChannelApplicationWire,
  ChatChannelAnnouncementWire,
  ChatChannelBanWire,
  ChatChannelMemberWire,
  ChatChannelWire,
  ChatForwardedFromWire,
  ChatMentionWire,
  ChatMessageMentionWire,
  ChatMessagePageWire,
  ChatMessageReactionWire,
  ChatMessageReplyWire,
  ChatMessageWire,
  ChatPinWire,
  ChatQuoteReplyWire,
  ChatReadStateWire,
  ChatSendMessageWire,
  ChatUnreadStateWire,
  ChatUserWire,
} from "./chatWireModels";
import type {
  ChatChannelChangedEventPayloadWire,
  ChatMessageCreatedEventPayloadWire,
  ChatMessageDeletedEventPayloadWire,
  ChatMessagePinnedEventPayloadWire,
  ChatMessageReactionsUpdatedEventPayloadWire,
  ChatMessageUnpinnedEventPayloadWire,
  ChatMessageUpdatedEventPayloadWire,
  ChatReadStateUpdatedEventPayloadWire,
  ChatWsEventWire,
  MentionCreatedEventPayloadWire,
  AuditLogCreatedEventPayloadWire,
  ChannelCategoryChangedEventPayloadWire,
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

function mapChatChannelAnnouncementWire(wire: ChatChannelAnnouncementWire | undefined): ChatChannelAnnouncementRecord | undefined {
  if (!wire) return undefined;
  return {
    content: asTrimmedString(wire.content),
    updatedAt: asSafeNumber(wire.updated_at),
    updatedBy: asOptionalString(wire.updated_by),
  };
}

function mapChatMessageReplyWire(wire: ChatMessageReplyWire | undefined): ChatMessageReplyRecord | undefined {
  if (!wire) return undefined;
  const messageId = asTrimmedString(wire.mid);
  if (!messageId) return undefined;
  return {
    messageId,
    senderName: asTrimmedString(wire.sender_name),
    preview: asTrimmedString(wire.preview),
    createdAt: asSafeNumber(wire.created_at),
    unavailable: Boolean(wire.unavailable),
  };
}

function mapChatMessageMentionWire(wire: ChatMessageMentionWire): ChatMessageMentionRecord {
  return {
    userId: asTrimmedString(wire.uid),
    displayName: asTrimmedString(wire.display_name),
    type: (wire.type === "everyone" || wire.type === "here") ? wire.type : undefined,
  };
}

function mapChatMessageReplyRecord(input: ChatMessageReplyRecord): ChatMessageReplyWire {
  return {
    mid: asTrimmedString(input.messageId),
    sender_name: asTrimmedString(input.senderName),
    preview: asTrimmedString(input.preview),
    created_at: asSafeNumber(input.createdAt),
    unavailable: Boolean(input.unavailable),
  };
}

function mapChatMessageMentionRecord(input: ChatMessageMentionRecord): ChatMessageMentionWire {
  return {
    uid: asTrimmedString(input.userId),
    display_name: asTrimmedString(input.displayName),
    type: (input.type === "everyone" || input.type === "here") ? input.type : undefined,
  };
}

function mapChatQuoteReplyWire(wire: ChatQuoteReplyWire | undefined): ChatQuoteReplyRecord | undefined {
  if (!wire) return undefined;
  const messageId = asTrimmedString(wire.mid);
  if (!messageId) return undefined;
  return {
    messageId,
    userId: asTrimmedString(wire.uid),
    preview: asTrimmedString(wire.preview),
  };
}

function mapChatQuoteReplyRecord(input: ChatQuoteReplyRecord | undefined): ChatQuoteReplyWire | undefined {
  if (!input) return undefined;
  return {
    mid: asTrimmedString(input.messageId),
    uid: asTrimmedString(input.userId),
    preview: asTrimmedString(input.preview),
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
    announcement: mapChatChannelAnnouncementWire(wire.announcement),
    categoryId: asOptionalString(wire.category_id),
    categoryName: asOptionalString(wire.category_name),
    order: wire.order != null ? asSafeNumber(wire.order) : undefined,
    type: asOptionalString(wire.type),
    joined: wire.joined != null ? Boolean(wire.joined) : undefined,
    joinRequested: wire.join_requested != null ? Boolean(wire.join_requested) : undefined,
  };
}

/**
 * 将未读状态 wire 模型映射为领域未读状态。
 */
export function mapChatUnreadStateWire(wire: ChatUnreadStateWire): ChatUnreadState {
  return {
    channelId: asTrimmedString(wire.cid),
    unreadCount: Math.max(0, asSafeNumber(wire.unread_count)),
    mentionUnreadCount:
      wire.mention_unread_count !== undefined ? Math.max(0, asSafeNumber(wire.mention_unread_count)) : undefined,
    lastReadTime: asSafeNumber(wire.last_read_time),
  };
}

function mapChatForwardedFromWire(wire: ChatForwardedFromWire | undefined): ChatForwardedFromRecord | undefined {
  if (!wire) return undefined;
  const messageId = asTrimmedString(wire.mid);
  if (!messageId) return undefined;
  return {
    messageId,
    channelId: asTrimmedString(wire.cid),
    userId: asTrimmedString(wire.uid),
    preview: asTrimmedString(wire.preview),
    sentTime: asSafeNumber(wire.send_time),
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
    replyTo: mapChatMessageReplyWire(wire.reply_to),
    quoteReply: mapChatQuoteReplyWire(wire.quote_reply),
    mentions: Array.isArray(wire.mentions) ? wire.mentions.map(mapChatMessageMentionWire) : [],
    reactions: wire.reactions?.map(mapChatReactionWire),
    editedAt: wire.edited_at != null ? asSafeNumber(wire.edited_at) : undefined,
    editVersion: wire.edit_version != null ? asSafeNumber(wire.edit_version) : undefined,
    forwardedFrom: mapChatForwardedFromWire(wire.forwarded_from),
  };
}

/** Map reaction wire → domain record. */
export function mapChatReactionWire(wire: ChatMessageReactionWire): ChatReactionRecord {
  return {
    emoji: asTrimmedString(wire.emoji),
    count: asSafeNumber(wire.count),
    reactedByMe: Boolean(wire.reacted_by_me),
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
export function mapChatPinWire(wire: ChatPinWire): ChatPinRecord {
  return {
    channelId: asTrimmedString(wire.cid),
    messageId: asTrimmedString(wire.mid),
    pinnedByUserId: asTrimmedString(wire.pinned_by_uid),
    pinnedAt: asSafeNumber(wire.pinned_at),
    note: asOptionalString(wire.note),
  };
}

export function mapChatMentionWire(wire: ChatMentionWire): ChatMentionRecord {
  return {
    mentionId: asTrimmedString(wire.mention_id),
    channelId: asTrimmedString(wire.cid),
    messageId: asTrimmedString(wire.mid),
    fromUserId: asTrimmedString(wire.from_uid),
    target: wire.target ? { type: asTrimmedString(wire.target.type), uid: asTrimmedString(wire.target.uid) } : { type: "", uid: "" },
    createdAt: asSafeNumber(wire.created_at),
    read: Boolean(wire.read),
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

/**
 * 将领域发送消息输入转换为 wire 请求体。
 */
export function mapChatSendMessageInput(input: ChatSendMessageInput): ChatSendMessageWire {
  return {
    domain: asTrimmedString(input.domain),
    domain_version: asTrimmedString(input.domainVersion),
    data: input.data,
    reply_to_mid: asOptionalString(input.replyToMessageId),
    reply_to: input.replyTo ? mapChatMessageReplyRecord(input.replyTo) : undefined,
    quote_reply: input.quoteReply ? mapChatQuoteReplyRecord(input.quoteReply) : undefined,
    mentions: input.mentions?.map(mapChatMessageMentionRecord),
    client_message_id: asOptionalString(input.clientMessageId),
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
export function mapChatChannelPatchInput(input: ChatChannelPatchInput): Partial<Pick<ChatChannelWire, "name" | "brief" | "avatar">> & { announcement?: string } {
  const output: Partial<Pick<ChatChannelWire, "name" | "brief" | "avatar">> & { announcement?: string } = {};
  if (typeof input.name === "string") output.name = input.name.trim();
  if (typeof input.brief === "string") output.brief = input.brief.trim();
  if (typeof input.avatar === "string") output.avatar = input.avatar.trim();
  if (typeof input.announcement === "string") output.announcement = input.announcement.trim();
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
 * 将 "message.reactions_updated" 事件 payload 从 wire 映射为领域事件。
 */
function mapMessageReactionsUpdatedPayload(
  wire: ChatMessageReactionsUpdatedEventPayloadWire,
): ChatMessageReactionsUpdatedEvent {
  return {
    channelId: asTrimmedString(wire.cid),
    messageId: asTrimmedString(wire.mid),
    reactions: (wire.reactions ?? []).map(mapChatReactionWire),
  };
}

function mapMessageUpdatedPayload(wire: ChatMessageUpdatedEventPayloadWire): ChatMessageUpdatedEvent {
  return {
    channelId: asTrimmedString(wire.cid),
    message: mapChatMessageWire(wire.message),
  };
}

function mapMessagePinnedPayload(wire: ChatMessagePinnedEventPayloadWire): ChatMessagePinnedEvent {
  return {
    channelId: asTrimmedString(wire.cid),
    messageId: asTrimmedString(wire.mid),
    pinId: asTrimmedString(wire.pin_id),
    pinnedByUserId: asTrimmedString(wire.pinned_by_uid),
    pinnedAt: asSafeNumber(wire.pinned_at),
    note: asOptionalString(wire.note),
  };
}

function mapMessageUnpinnedPayload(wire: ChatMessageUnpinnedEventPayloadWire): ChatMessageUnpinnedEvent {
  return {
    channelId: asTrimmedString(wire.cid),
    messageId: asTrimmedString(wire.mid),
    pinId: asTrimmedString(wire.pin_id),
    unpinnedByUserId: asTrimmedString(wire.unpinned_by_uid),
    unpinnedAt: asSafeNumber(wire.unpinned_at),
  };
}

function mapMentionCreatedPayload(wire: MentionCreatedEventPayloadWire): MentionCreatedEvent {
  return {
    mentionId: asTrimmedString(wire.mention_id),
    channelId: asTrimmedString(wire.cid),
    messageId: asTrimmedString(wire.mid),
    fromUserId: asTrimmedString(wire.from_uid),
    target: wire.target ? { type: asTrimmedString(wire.target.type), uid: asTrimmedString(wire.target.uid) } : { type: "", uid: "" },
    createdAt: asSafeNumber(wire.created_at),
  };
}

function mapAuditLogCreatedPayload(wire: AuditLogCreatedEventPayloadWire): AuditLogCreatedEvent {
  return {
    auditId: asTrimmedString(wire.audit_id),
    channelId: asTrimmedString(wire.cid),
    actorUserId: asTrimmedString(wire.actor_uid),
    action: asTrimmedString(wire.action),
    createdAt: asSafeNumber(wire.created_at),
  };
}

function mapChannelCategoryChangedPayload(wire: ChannelCategoryChangedEventPayloadWire): ChannelCategoryChangedEvent {
  return {
    channelId: asTrimmedString(wire.cid),
    categoryId: asTrimmedString(wire.category_id),
    categoryName: asTrimmedString(wire.category_name),
    order: asSafeNumber(wire.order),
    type: asTrimmedString(wire.type),
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

  if (base.eventType === "message.reactions_updated") {
    return {
      ...base,
      eventType: "message.reactions_updated",
      payload: mapMessageReactionsUpdatedPayload(wire.payload as ChatMessageReactionsUpdatedEventPayloadWire),
    };
  }

  if (base.eventType === "message.updated") {
    return {
      ...base,
      eventType: "message.updated",
      payload: mapMessageUpdatedPayload(wire.payload as ChatMessageUpdatedEventPayloadWire),
    };
  }

  if (base.eventType === "message.pinned") {
    return {
      ...base,
      eventType: "message.pinned",
      payload: mapMessagePinnedPayload(wire.payload as ChatMessagePinnedEventPayloadWire),
    };
  }

  if (base.eventType === "message.unpinned") {
    return {
      ...base,
      eventType: "message.unpinned",
      payload: mapMessageUnpinnedPayload(wire.payload as ChatMessageUnpinnedEventPayloadWire),
    };
  }

  if (base.eventType === "mention.created") {
    return {
      ...base,
      eventType: "mention.created",
      payload: mapMentionCreatedPayload(wire.payload as MentionCreatedEventPayloadWire),
    };
  }

  if (base.eventType === "audit_log.created") {
    return {
      ...base,
      eventType: "audit_log.created",
      payload: mapAuditLogCreatedPayload(wire.payload as AuditLogCreatedEventPayloadWire),
    };
  }

  if (base.eventType === "channel.category_changed") {
    return {
      ...base,
      eventType: "channel.category_changed",
      payload: mapChannelCategoryChangedPayload(wire.payload as ChannelCategoryChangedEventPayloadWire),
    };
  }

  return {
    ...base,
    payload: wire.payload,
  };
}
