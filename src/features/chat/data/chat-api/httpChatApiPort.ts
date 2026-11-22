/**
 * @fileoverview httpChatApiPort.ts
 * @description chat｜数据层实现：httpChatApiPort。
 */

import type { ChatApiPort } from "../../domain/ports/chatApiPort";
import type {
  ChatChannelApplicationRecord,
  ChatChannelBanRecord,
  ChatChannelCreateInput,
  ChatChannelMemberRecord,
  ChatChannelPatchInput,
  ChatChannelRecord,
  ChatMentionPage,
  ChatMessageContext,
  ChatMessagePage,
  ChatMessageRecord,
  ChatPinRecord,
  ChatReadStateInput,
  ChatReadStateResponse,
  ChatSendMessageInput,
  ChatUnreadState,
} from "../../domain/types/chatApiModels";
import {
  httpAddChannelAdmin,
  httpApplyJoinChannel,
  httpBatchMarkMentionsRead,
  httpCreateChannel,
  httpDeleteChannel,
  httpDeleteChannelBan,
  httpDecideChannelApplication,
  httpGetMessage,
  httpGetMessagesByIds,
  httpListChannelMessagesAfter,
  httpGetChannel,
  httpGetUnreads,
  httpGetChannelReadState,
  httpGetMention,
  httpGetMentionsByIds,
  httpKickChannelMember,
  httpListChannelApplications,
  httpListChannelBans,
  httpListChannelMembers,
  httpListChannelMessages,
  httpListChannelMessagesAround,
  httpListChannels,
  httpListMentions,
  httpListPins,
  httpMarkMentionRead,
  httpPatchChannel,
  httpPinMessage,
  httpPutChannelBan,
  httpRecallMessage,
  httpRemoveChannelAdmin,
  httpSearchChannelMessages,
  httpSendChannelMessage,
  httpUnpinMessage,
  httpUpdateReadState,
  httpBatchGetChannels,
  httpTransferChannel,
  httpQuitChannel,
  httpListMyChannelApplications,
} from "./httpChatApi";
import {
  mapChatChannelApplicationWire,
  mapChatChannelBanWire,
  mapChatChannelCreateInput,
  mapChatChannelMemberWire,
  mapChatChannelPatchInput,
  mapChatChannelWire,
  mapChatMentionWire,
  toMessageWireDomain,
  mapChatMessagePageWire,
  mapChatMessageWire,
  mapChatPinWire,
  mapChatChannelReadStateWire,
  mapChatReadStateInput,
  mapChatReadStateResponseWire,
  mapChatSendMessageInput,
  mapChatUnreadStateWire,
} from "../protocol/chatWireMappers";

// 新版只传引用 ID；权限不足或原消息消失时保留引用，详情补查失败不影响主请求。
async function populateMessageReferences(serverSocket: string, accessToken: string, messages: ChatMessageRecord[]): Promise<ChatMessageRecord[]> {
  const originals = new Map(messages.map((message) => [message.id, message]));
  const ids = new Set<string>();
  for (const message of messages) {
    if (message.recalledAt) continue;
    if (!message.replyTo && message.replyToMessageId) ids.add(message.replyToMessageId);
    for (const source of message.forwardedMessages ?? []) {
      if (!source.userId) ids.add(source.messageId);
    }
  }
  const missing = [...ids].filter((id) => /^[0-9]+$/.test(id) && !originals.has(id));
  for (let offset = 0; offset < missing.length; offset += 50) {
    const result = await httpGetMessagesByIds(serverSocket, accessToken, missing.slice(offset, offset + 50)).catch(() => null);
    for (const wire of result?.items ?? []) {
      const original = mapChatMessageWire(wire);
      originals.set(original.id, original);
    }
  }
  if (!ids.size) return messages;
  return messages.map((message) => {
    if (message.recalledAt) return message;
    const replied = message.replyToMessageId ? originals.get(message.replyToMessageId) : undefined;
    const replyTo = message.replyTo ?? (replied?.channelId === message.channelId && !replied.recalledAt ? {
      messageId: replied.id,
      senderName: replied.sender?.nickname || `用户 ${replied.userId}`,
      preview: replied.preview ?? "",
      createdAt: replied.sentTime,
    } : undefined);
    const forwardedMessages = message.forwardedMessages?.map((source) => {
      const original = originals.get(source.messageId);
      if (source.userId || original?.channelId !== source.channelId || original.recalledAt) return source;
      return { ...source, userId: original.userId, preview: original.preview ?? "", sentTime: original.sentTime };
    });
    return { ...message, replyTo, forwardedMessages };
  });
}

async function populateMessagePage(serverSocket: string, accessToken: string, page: ChatMessagePage): Promise<ChatMessagePage> {
  return { ...page, items: await populateMessageReferences(serverSocket, accessToken, page.items) };
}

/**
 * chat HTTP API 端口实现。
 *
 * 职责边界：
 * - 调用底层 HTTP transport；
 * - 完成 wire model 与 domain model 的转换；
 * - 不承载任何业务编排或 presentation 语义。
 */
export const httpChatApiPort: ChatApiPort = {
  async batchGetChannels(serverSocket, accessToken, channelIds) {
    const result = await httpBatchGetChannels(serverSocket, accessToken, channelIds);
    return { total: result.total, items: result.items.map(mapChatChannelWire) };
  },
  transferChannel: httpTransferChannel,
  quitChannel: httpQuitChannel,
  async listMyChannelApplications(serverSocket, accessToken) {
    return (await httpListMyChannelApplications(serverSocket, accessToken)).map(mapChatChannelApplicationWire);
  },
  async listChannels(serverSocket: string, accessToken: string): Promise<ChatChannelRecord[]> {
    const list = await httpListChannels(serverSocket, accessToken);
    return list.map(mapChatChannelWire);
  },
  async getUnreads(serverSocket: string, accessToken: string): Promise<ChatUnreadState[]> {
    const list = await httpGetUnreads(serverSocket, accessToken);
    return list.map(mapChatUnreadStateWire);
  },
  async listChannelMessages(
    serverSocket: string,
    accessToken: string,
    cid: string,
    cursor?: string,
    limit?: number,
  ): Promise<ChatMessagePage> {
    const page = await httpListChannelMessages(serverSocket, accessToken, cid, cursor, limit);
    return populateMessagePage(serverSocket, accessToken, mapChatMessagePageWire(page));
  },
  async listChannelMessagesAfter(serverSocket, accessToken, cid, cursor, limit) {
    return populateMessagePage(serverSocket, accessToken, mapChatMessagePageWire(await httpListChannelMessagesAfter(serverSocket, accessToken, cid, cursor, limit)));
  },
  async getMessage(serverSocket, accessToken, mid) {
    const message = mapChatMessageWire(await httpGetMessage(serverSocket, accessToken, mid));
    const [populated] = await populateMessageReferences(serverSocket, accessToken, [message]);
    return populated;
  },
  async getMessagesByIds(serverSocket, accessToken, messageIds) {
    const { total, items } = await httpGetMessagesByIds(serverSocket, accessToken, messageIds);
    return { total, items: items.map(mapChatMessageWire) };
  },
  async sendChannelMessage(
    serverSocket: string,
    accessToken: string,
    cid: string,
    req: ChatSendMessageInput,
  ): Promise<ChatMessageRecord> {
    const created = await httpSendChannelMessage(serverSocket, accessToken, cid, mapChatSendMessageInput(req));
    return mapChatMessageWire(created);
  },
  recallMessage: httpRecallMessage,
  async getChannelReadState(serverSocket, accessToken, cid) {
    return mapChatChannelReadStateWire(await httpGetChannelReadState(serverSocket, accessToken, cid));
  },
  async updateReadState(
    serverSocket: string,
    accessToken: string,
    cid: string,
    req: ChatReadStateInput,
  ): Promise<ChatReadStateResponse> {
    const wire = await httpUpdateReadState(serverSocket, accessToken, cid, mapChatReadStateInput(req));
    return mapChatReadStateResponseWire(wire);
  },
  async applyJoinChannel(serverSocket, accessToken, cid, reason) {
    return mapChatChannelApplicationWire(await httpApplyJoinChannel(serverSocket, accessToken, cid, reason));
  },
  async patchChannel(
    serverSocket: string,
    accessToken: string,
    cid: string,
    patch: ChatChannelPatchInput,
  ): Promise<ChatChannelRecord> {
    const next = await httpPatchChannel(serverSocket, accessToken, cid, mapChatChannelPatchInput(patch));
    return mapChatChannelWire(next);
  },
  async listChannelMembers(serverSocket: string, accessToken: string, cid: string): Promise<ChatChannelMemberRecord[]> {
    const list = await httpListChannelMembers(serverSocket, accessToken, cid);
    return list.map(mapChatChannelMemberWire);
  },
  async kickChannelMember(serverSocket: string, accessToken: string, cid: string, uid: string): Promise<void> {
    return httpKickChannelMember(serverSocket, accessToken, cid, uid);
  },
  async addChannelAdmin(serverSocket: string, accessToken: string, cid: string, uid: string): Promise<void> {
    return httpAddChannelAdmin(serverSocket, accessToken, cid, uid);
  },
  async removeChannelAdmin(serverSocket: string, accessToken: string, cid: string, uid: string): Promise<void> {
    return httpRemoveChannelAdmin(serverSocket, accessToken, cid, uid);
  },
  async listChannelApplications(serverSocket: string, accessToken: string, cid: string): Promise<ChatChannelApplicationRecord[]> {
    const list = await httpListChannelApplications(serverSocket, accessToken, cid);
    return list.map(mapChatChannelApplicationWire);
  },
  async decideChannelApplication(
    serverSocket: string,
    accessToken: string,
    cid: string,
    applicationId: string,
    decision: "approve" | "reject",
  ): Promise<ChatChannelApplicationRecord> {
    return mapChatChannelApplicationWire(await httpDecideChannelApplication(serverSocket, accessToken, cid, applicationId, decision));
  },
  async listChannelBans(serverSocket: string, accessToken: string, cid: string): Promise<ChatChannelBanRecord[]> {
    const list = await httpListChannelBans(serverSocket, accessToken, cid);
    return list.map(mapChatChannelBanWire);
  },
  async putChannelBan(
    serverSocket: string,
    accessToken: string,
    cid: string,
    uid: string,
    until: number,
    reason: string,
  ): Promise<ChatChannelBanRecord> {
    const wire = await httpPutChannelBan(serverSocket, accessToken, cid, uid, until, reason);
    return mapChatChannelBanWire(wire);
  },
  async deleteChannelBan(serverSocket: string, accessToken: string, cid: string, uid: string): Promise<void> {
    return httpDeleteChannelBan(serverSocket, accessToken, cid, uid);
  },
  async createChannel(
    serverSocket: string,
    accessToken: string,
    req: ChatChannelCreateInput,
  ): Promise<ChatChannelRecord> {
    const created = await httpCreateChannel(serverSocket, accessToken, mapChatChannelCreateInput(req));
    return mapChatChannelWire(created);
  },
  async deleteChannel(serverSocket: string, accessToken: string, cid: string): Promise<void> {
    return httpDeleteChannel(serverSocket, accessToken, cid);
  },
  async getChannel(serverSocket: string, accessToken: string, cid: string): Promise<ChatChannelRecord> {
    const wire = await httpGetChannel(serverSocket, accessToken, cid);
    return mapChatChannelWire(wire);
  },
  async searchChannelMessages(
    serverSocket: string,
    accessToken: string,
    cid: string,
    query: { q: string; cursor?: string; limit?: number; senderUid?: string; domain?: string; beforeMid?: string; afterMid?: string },
  ): Promise<ChatMessagePage> {
    const page = await httpSearchChannelMessages(serverSocket, accessToken, cid, {
      q: query.q,
      cursor: query.cursor,
      limit: query.limit,
      sender_uid: query.senderUid,
      domain: query.domain ? toMessageWireDomain(query.domain) : undefined,
    });
    return populateMessagePage(serverSocket, accessToken, mapChatMessagePageWire(page));
  },
  async listChannelMessagesAround(
    serverSocket: string,
    accessToken: string,
    cid: string,
    aroundMid: string,
    before?: number,
    after?: number,
  ): Promise<ChatMessageContext> {
    const context = await httpListChannelMessagesAround(serverSocket, accessToken, cid, aroundMid, before, after);
    const items = await populateMessageReferences(serverSocket, accessToken, context.items.map(mapChatMessageWire));
    return { items };
  },
  async pinMessage(serverSocket: string, accessToken: string, cid: string, mid: string, note?: string): Promise<void> {
    return httpPinMessage(serverSocket, accessToken, cid, mid, note);
  },
  async unpinMessage(serverSocket: string, accessToken: string, cid: string, mid: string): Promise<void> {
    return httpUnpinMessage(serverSocket, accessToken, cid, mid);
  },
  async listPins(serverSocket: string, accessToken: string, cid: string, cursor?: string, limit?: number): Promise<{ items: ChatPinRecord[]; nextCursor?: string; hasMore?: boolean }> {
    const wire = await httpListPins(serverSocket, accessToken, cid, cursor, limit);
    return {
      items: Array.isArray(wire.items) ? wire.items.map(mapChatPinWire) : [],
      nextCursor: wire.next_cursor,
      hasMore: Boolean(wire.has_more),
    };
  },
  async forwardMessage(
    serverSocket: string,
    accessToken: string,
    mid: string,
    req: { targetCid: string; sourceChannelId?: string; mergedMids?: string[] },
  ): Promise<ChatMessageRecord> {
    const sourceChannelId = req.sourceChannelId || (await httpGetMessage(serverSocket, accessToken, mid)).cid;
    const messageIds = req.mergedMids?.length ? req.mergedMids : [mid];
    const forwarded = await httpSendChannelMessage(serverSocket, accessToken, req.targetCid, {
      domain: "Core:Forward:V1", data: { source_channel_id: sourceChannelId, message_ids: messageIds }, mentions: [],
    });
    return mapChatMessageWire(forwarded);
  },
  async listMentions(serverSocket: string, accessToken: string, cursor?: string, limit?: number, unreadOnly?: boolean, cid?: string): Promise<ChatMentionPage> {
    const wire = await httpListMentions(serverSocket, accessToken, cursor, limit, unreadOnly, cid);
    return {
      items: Array.isArray(wire.items) ? wire.items.map(mapChatMentionWire) : [],
      nextCursor: wire.has_more ? wire.next_cursor ?? undefined : undefined,
      hasMore: wire.has_more,
    };
  },
  async getMention(serverSocket, accessToken, mentionId) {
    return mapChatMentionWire(await httpGetMention(serverSocket, accessToken, mentionId));
  },
  async getMentionsByIds(serverSocket, accessToken, mentionIds) {
    return (await httpGetMentionsByIds(serverSocket, accessToken, mentionIds)).map(mapChatMentionWire);
  },
  async markMentionRead(serverSocket: string, accessToken: string, mentionId: string): Promise<void> {
    return httpMarkMentionRead(serverSocket, accessToken, mentionId);
  },
  async batchMarkMentionsRead(serverSocket: string, accessToken: string, throughMentionId?: string, cid?: string): Promise<void> {
    return httpBatchMarkMentionsRead(serverSocket, accessToken, throughMentionId, cid);
  },
};
