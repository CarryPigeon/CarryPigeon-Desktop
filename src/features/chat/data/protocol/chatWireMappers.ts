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
  ChatForwardMessageData,
  ChatLinkPreview,
  ChatMentionRecord,
  ChatMessageMentionRecord,
  ChatMessagePage,
  ChatMessageRecord,
  ChatMessageReplyRecord,
  ChatPinRecord,
  ChatQuoteReplyRecord,
  ChatReadStateInput,
  ChatReadStateResponse,
  ChatChannelReadState,
  ChatReplyMessageData,
  ChatSendMessageInput,
  ChatUnreadState,
  ChatUserRecord,
} from "@/features/chat/domain/types/chatApiModels";
// ChatMessageMentionRecord 仅在领域模型内部使用，wire 上的 mentions 已改为 string[]。
import type {
  ChatChannelChangedEvent,
  ChatEventEnvelope,
  ChatMessageCreatedEvent,
  ChatMessageDeletedEvent,
  ChatMessagePinnedEvent,
  ChatMessageUnpinnedEvent,
  ChatMessageUpdatedEvent,
  ChatReadStateUpdatedEvent,
  MentionCreatedEvent,
  AuditLogCreatedEvent,
  ChannelCategoryChangedEvent,
  ChatMessageRecalledEvent,
} from "@/features/chat/domain/types/chatEventModels";
import type {
  ChatChannelApplicationWire,
  ChatChannelAnnouncementWire,
  ChatChannelBanWire,
  ChatChannelMemberWire,
  ChatChannelWire,
  ChatForwardedFromWire,
  ChatMentionWire,
  ChatMessagePageWire,
  ChatMessageReplyWire,
  ChatMessageWire,
  ChatPinWire,
  ChatQuoteReplyWire,
  ChatReadStateResponseWire,
  ChatChannelReadStateWire,
  ChatReadStateWire,
  ChatReplyMessageWireData,
  ChatSendMessageWire,
  ChatUnreadStateWire,
  ChatUserWire,
} from "./chatWireModels";
import type { ChatForwardMessageWireData } from "./chatWireModels";
import type {
  ChatChannelChangedEventPayloadWire,
  ChatMessageCreatedEventPayloadWire,
  ChatMessageDeletedEventPayloadWire,
  ChatMessagePinnedEventPayloadWire,
  ChatMessageUnpinnedEventPayloadWire,
  ChatMessageUpdatedEventPayloadWire,
  ChatReadStateUpdatedEventPayloadWire,
  ChatWsEventWire,
  MentionCreatedEventPayloadWire,
  AuditLogCreatedEventPayloadWire,
  ChannelCategoryChangedEventPayloadWire,
  ChatMessageRecalledEventPayloadWire,
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

/**
 * 把消息顶层 mentions（服务端 UID 字符串数组）映射为领域 mention 记录；
 * 服务端不回传 displayName/type，因此 displayName 留空、type 留 undefined，
 * 由 message-flow 渲染层在做用户展示时自行回退填充。
 */
function wireMentionsToRecords(uids: unknown): ChatMessageMentionRecord[] {
  if (!Array.isArray(uids)) return [];
  return uids
    .map((uid) => asTrimmedString(uid))
    .filter((uid): uid is string => Boolean(uid))
    .map((userId) => ({ userId, displayName: "" }));
}

/**
 * 把领域 mention 记录序列化为服务端 wire 顶层的 UID 字符串数组。
 */
function recordsToWireMentionUids(records: ChatMessageMentionRecord[] | undefined): string[] | undefined {
  if (!Array.isArray(records) || records.length === 0) return undefined;
  const uids = records.map((m) => asTrimmedString(m.userId)).filter((uid) => Boolean(uid));
  return uids.length > 0 ? uids : undefined;
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

/**
 * 将频道 wire 模型映射为领域频道记录。
 */
export function mapChatChannelWire(wire: ChatChannelWire): ChatChannelRecord {
  const id = asTrimmedString(wire.cid);
  return {
    id,
    name: asTrimmedString(wire.name) || id,
    systemChannel: wire.system_channel,
    createdAt: wire.created_at == null ? undefined : asSafeNumber(wire.created_at),
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
function normalizeUnreadCount(value: unknown): number {
  return Math.min(10_000, Math.max(0, Math.trunc(asSafeNumber(value))));
}

export function mapChatChannelReadStateWire(wire: ChatChannelReadStateWire): ChatChannelReadState {
  return {
    channelId: asTrimmedString(wire.cid),
    userId: asTrimmedString(wire.uid),
    lastReadMid: wire.last_read_mid === null ? null : asTrimmedString(wire.last_read_mid),
    unreadCount: normalizeUnreadCount(wire.unread_count),
  };
}

export function mapChatUnreadStateWire(wire: ChatUnreadStateWire): ChatUnreadState {
  return {
    channelId: asTrimmedString(wire.cid),
    unreadCount: normalizeUnreadCount(wire.unread_count),
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

function mapChatReplyMessageWireDataToRecord(data: ChatReplyMessageWireData): ChatReplyMessageData {
  return {
    content: data.content,
    replyToMessageId: asOptionalString(data.reply_to_mid),
    replyTo: mapChatMessageReplyWire(data.reply_to),
    quoteReply: mapChatQuoteReplyWire(data.quote_reply),
    linkPreview: data.link_preview as ChatLinkPreview | undefined,
  };
}

function mapChatForwardMessageWireDataToRecord(data: ChatForwardMessageWireData): ChatForwardMessageData {
  return {
    domain: asTrimmedString(data.domain),
    domainVersion: asTrimmedString(data.domain_version),
    content: data.content,
    forwardedFrom: mapChatForwardedFromWire(data.forwarded_from),
    forwardedMessages: Array.isArray(data.forwarded_messages)
      ? data.forwarded_messages.map(mapChatForwardedFromWire).filter((m): m is ChatForwardedFromRecord => m != null)
      : undefined,
  };
}

/**
 * 将消息 wire 模型映射为领域消息记录。
 *
 * 服务端 canonical envelope 固定 10 字段；关系元数据只在 `data` 内按 domain 分支
 * 约定（Core:ReplyText 含 reply/quote/link_preview、Core:Forward 含 forward 快照），
 * 在 mapper 内解出后回填到顶层 ChatMessageRecord 对应字段。
 * 顶层可选 `sender`（旧版/部分服务端仍回传）会被映射为 `ChatMessageRecord.sender`，
 * 使发送者昵称/头像在展示层无需再按 uid 兜底；缺失时由展示层批量补拉用户资料。
 * `mentions` 整体在顶层为 `string[]`，映射时构造默认 displayName 为空的
 * `ChatMessageMentionRecord`，由渲染层做用户名回退。
 * `status` 为 `recalled` 时回填 `recalledAt`，触发撤回态展示。
 */
export function mapChatMessageWire(wire: ChatMessageWire): ChatMessageRecord {
  const versioned = /^(.*):V(\d+)$/.exec(asTrimmedString(wire.domain));
  const wireDomain = versioned?.[1] ?? asTrimmedString(wire.domain);
  const domain = wireDomain === "Core:Attachment" ? "Core:File" : wireDomain;
  const sendTime = asSafeNumber(wire.send_time);
  const uid = asTrimmedString(wire.uid);
  const sender = mapChatUserWire(wire.sender);
  const mentions: ChatMessageMentionRecord[] = wireMentionsToRecords(wire.mentions);

  let replyToMessageId: string | undefined;
  let replyTo: ChatMessageReplyRecord | undefined;
  let quoteReply: ChatQuoteReplyRecord | undefined;
  let forwardedFrom: ChatForwardedFromRecord | undefined;
  let forwardedMessages: ChatForwardedFromRecord[] | undefined;
  let linkPreview: ChatLinkPreview | undefined;

  let data: unknown = wire.data;
  const payload = wire.data && typeof wire.data === "object" ? wire.data as Record<string, unknown> : {};
  if (domain === "Core:Text") {
    data = { ...payload, text: typeof payload.content === "string" ? payload.content : payload.text };
    replyToMessageId = asOptionalString(payload.reply_to_mid);
  } else if (domain === "Core:ReplyText") {
    const replyData = mapChatReplyMessageWireDataToRecord(payload as ChatReplyMessageWireData);
    data = replyData;
    replyToMessageId = replyData.replyToMessageId;
    replyTo = replyData.replyTo;
    quoteReply = replyData.quoteReply;
    if (replyData.linkPreview != null) linkPreview = replyData.linkPreview;
  } else if (domain === "Core:Forward") {
    const forwardData = mapChatForwardMessageWireDataToRecord(payload as ChatForwardMessageWireData);
    const sourceChannelId = asTrimmedString(payload.source_channel_id);
    const ids = Array.isArray(payload.message_ids) ? payload.message_ids.map(asTrimmedString).filter(Boolean) : [];
    data = { ...payload, ...forwardData };
    if (sourceChannelId && ids.length) {
      forwardData.forwardedMessages ??= ids.map((messageId) => ({
        messageId, channelId: sourceChannelId, userId: "", preview: "", sentTime: 0,
      }));
    }
    // 现行契约要求 forward 快照封装在 data 内；旧版服务端放在消息顶层，这里做回退兼容
    //（data 内优先，顶层仅在 data 缺失时兜底），避免跨频道转发来源丢失导致转发消息不可见。
    forwardedFrom = forwardData.forwardedFrom ?? mapChatForwardedFromWire(wire.forwarded_from);
    forwardedMessages =
      forwardData.forwardedMessages ??
      (Array.isArray(wire.forwarded_messages)
        ? wire.forwarded_messages.map(mapChatForwardedFromWire).filter((m): m is ChatForwardedFromRecord => m != null)
        : undefined);
  }

  const status = asTrimmedString(wire.status);
  const recalledAt = status === "recalled" ? sendTime : undefined;

  return {
    id: asTrimmedString(wire.mid),
    channelId: asTrimmedString(wire.cid),
    userId: uid,
    // 服务端回传 sender 时直接复用其昵称/头像；顶层 uid 作为 sender.uid 缺失时的兜底。
    sender: sender ? { ...sender, id: sender.id || uid } : undefined,
    sentTime: sendTime,
    domain,
    domainVersion: versioned ? `${versioned[2]}.0.0` : asTrimmedString(wire.domain_version),
    data,
    preview: asOptionalString(wire.preview),
    replyToMessageId,
    replyTo,
    quoteReply,
    mentions,
    recalledAt,
    forwardedFrom,
    forwardedMessages,
    linkPreview,
  };
}

/**
 * 将消息分页结果从 wire 结构映射为领域分页结构。
 */
export function mapChatMessagePageWire(wire: ChatMessagePageWire): ChatMessagePage {
  const items = Array.isArray(wire.items) ? wire.items.map(mapChatMessageWire) : [];
  return {
    items,
    nextCursor: typeof wire.next_cursor === "string" ? wire.next_cursor : undefined,
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
    nickname: asTrimmedString(wire.username),
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
    createTime: asSafeNumber(wire.create_time),
  };
}

/**
 * 将领域发送消息输入转换为 wire 请求体。
 *
 * - 顶层 `mentions` 为 string[]（snowflake UID），与服务端 sendChannelMessageRequest 对齐；
 * - Core:ReplyText 的 reply/quote/link_preview 关系元数据封装在 `data` 内；
 * - Core:Forward 的 forward 快照封装在 `data` 内。
 */
export function toMessageWireDomain(raw: string, version?: string): string {
  const name = asTrimmedString(raw);
  if (/^Core:(Text|ReplyText)(:V1)?$/.test(name)) return "Core:Text:V1";
  if (/^Core:(File|Attachment)(:V1)?$/.test(name)) return "Core:Attachment:V1";
  if (/^Core:(Image|Voice|Forward)$/.test(name)) return `${name}:V1`;
  if (!name.startsWith("Core:") && !/:V\d+$/.test(name) && /^\d+(?:\.|$)/.test(version ?? "")) {
    return `${name}:V${version?.split(".")[0]}`;
  }
  return name;
}

export function mapChatSendMessageInput(input: ChatSendMessageInput): ChatSendMessageWire {
  const domain = toMessageWireDomain(input.domain, input.domainVersion);
  const payload = input.data != null && typeof input.data === "object" ? input.data as Record<string, unknown> : {};
  let data = input.data;
  if (domain === "Core:Text:V1") {
    const rawContent = payload.content ?? payload.text ?? input.data;
    const content = typeof rawContent === "string" ? rawContent : asTrimmedString((rawContent as { text?: unknown } | null)?.text);
    const replyMid = asOptionalString(input.replyToMessageId ?? payload.replyToMessageId ?? payload.reply_to_mid);
    data = { content, ...(replyMid ? { reply_to_mid: replyMid } : {}) };
  } else if (/^Core:(Image|Voice|Attachment):V1$/.test(domain)) {
    data = { share_key: asTrimmedString(payload.share_key ?? payload.shareKey) };
  }
  return { domain, data, mentions: recordsToWireMentionUids(input.mentions) ?? [] };
}

/**
 * 将领域已读状态输入转换为 wire 请求体。
 */
export function mapChatReadStateInput(input: ChatReadStateInput): ChatReadStateWire {
  return {
    last_read_mid: asTrimmedString(input.lastReadMessageId),
  };
}

/**
 * 将已读状态响应 wire 映射为领域模型。
 */
export function mapChatReadStateResponseWire(wire: ChatReadStateResponseWire): ChatReadStateResponse {
  return {
    channelId: asTrimmedString(wire.cid),
    userId: asTrimmedString(wire.uid),
    lastReadMid: asTrimmedString(wire.last_read_mid),
  };
}

/**
 * 将频道更新输入裁剪为服务端接受的 wire patch。
 *
 * 服务端 `UpdateChannelProfileRequest` 当前只接受 `name` 与 `brief`；
 * 修改公告 / 头像暂不支持，相关字段在 domain 层已被删除，此处不再输出。
 */
export function mapChatChannelPatchInput(input: ChatChannelPatchInput): Partial<Pick<ChatChannelWire, "name" | "brief">> {
  const output: Partial<Pick<ChatChannelWire, "name" | "brief">> = {};
  if (typeof input.name === "string") output.name = input.name.trim();
  if (typeof input.brief === "string") output.brief = input.brief.trim();
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
  if (!wire || typeof wire !== "object") return { channelId: "" };
  if ("channel_id" in wire) return {
    channelId: asTrimmedString(wire.channel_id),
    messageId: asTrimmedString(wire.message_id),
    eventSequence: asSafeNumber(wire.event_sequence),
  };
  return { channelId: asTrimmedString(wire.cid), message: wire.message ? mapChatMessageWire(wire.message) : undefined };
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
  };
}

function mapChannelChangedPayload(wire: ChatChannelChangedEventPayloadWire): ChatChannelChangedEvent {
  return {
    channelId: asTrimmedString(wire.cid),
    scope: asOptionalString(wire.scope),
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
  };
}

function mapMessageUnpinnedPayload(wire: ChatMessageUnpinnedEventPayloadWire): ChatMessageUnpinnedEvent {
  return {
    channelId: asTrimmedString(wire.cid),
    messageId: asTrimmedString(wire.mid),
  };
}

function mapMessageRecalledPayload(wire: ChatMessageRecalledEventPayloadWire, serverTime: number): ChatMessageRecalledEvent {
  if (!wire || typeof wire !== "object") return { channelId: "", messageId: "", recalledAt: serverTime, recalledByUserId: "" };
  if ("channel_id" in wire) return {
    channelId: asTrimmedString(wire.channel_id), messageId: asTrimmedString(wire.message_id),
    recalledAt: serverTime, recalledByUserId: "", eventSequence: asSafeNumber(wire.event_sequence),
  };
  return {
    channelId: asTrimmedString(wire.cid), messageId: asTrimmedString(wire.mid),
    recalledAt: asSafeNumber(wire.recall_time), recalledByUserId: "",
  };
}

function mapMentionCreatedPayload(wire: MentionCreatedEventPayloadWire): MentionCreatedEvent {
  return {
    mentionId: asTrimmedString(wire.mention_id),
    channelId: asTrimmedString(wire.cid),
    messageId: asTrimmedString(wire.mid),
    fromUserId: asTrimmedString(wire.from_uid),
    target: { type: "user", uid: asTrimmedString(wire.uid) },
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

  if (base.eventType === "message.recalled") {
    return {
      ...base,
      eventType: "message.recalled",
      payload: mapMessageRecalledPayload(wire.payload as ChatMessageRecalledEventPayloadWire, base.serverTime),
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
