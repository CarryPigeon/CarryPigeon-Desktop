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
  ChatMessagePage,
  ChatMessageRecord,
  ChatPinRecord,
  ChatReadStateInput,
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
  httpDeleteMessage,
  httpDecideChannelApplication,
  httpEditMessage,
  httpForwardMessage,
  httpGetChannel,
  httpGetUnreads,
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
  httpRemoveChannelAdmin,
  httpSearchChannelMessages,
  httpSendChannelMessage,
  httpUnpinMessage,
  httpUpdateReadState,
} from "./httpChatApi";
import {
  mapChatChannelApplicationWire,
  mapChatChannelBanWire,
  mapChatChannelCreateInput,
  mapChatChannelMemberWire,
  mapChatChannelPatchInput,
  mapChatChannelWire,
  mapChatMentionWire,
  mapChatMessagePageWire,
  mapChatMessageWire,
  mapChatPinWire,
  mapChatReadStateInput,
  mapChatSendMessageInput,
  mapChatUnreadStateWire,
} from "../protocol/chatWireMappers";

/**
 * chat HTTP API 端口实现。
 *
 * 职责边界：
 * - 调用底层 HTTP transport；
 * - 完成 wire model 与 domain model 的转换；
 * - 不承载任何业务编排或 presentation 语义。
 */
export const httpChatApiPort: ChatApiPort = {
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
    const page = await httpListChannelMessages(serverSocket, accessToken, cid, cursor, limit ?? 50);
    return mapChatMessagePageWire(page);
  },
  async sendChannelMessage(
    serverSocket: string,
    accessToken: string,
    cid: string,
    req: ChatSendMessageInput,
    idempotencyKey?: string,
  ): Promise<ChatMessageRecord> {
    const created = await httpSendChannelMessage(serverSocket, accessToken, cid, mapChatSendMessageInput(req), idempotencyKey);
    return mapChatMessageWire(created);
  },
  async deleteMessage(serverSocket: string, accessToken: string, mid: string): Promise<void> {
    return httpDeleteMessage(serverSocket, accessToken, mid);
  },
  async updateReadState(
    serverSocket: string,
    accessToken: string,
    cid: string,
    req: ChatReadStateInput,
  ): Promise<void> {
    return httpUpdateReadState(serverSocket, accessToken, cid, mapChatReadStateInput(req));
  },
  async applyJoinChannel(serverSocket: string, accessToken: string, cid: string, reason: string): Promise<void> {
    return httpApplyJoinChannel(serverSocket, accessToken, cid, reason);
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
  ): Promise<void> {
    return httpDecideChannelApplication(serverSocket, accessToken, cid, applicationId, decision);
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
  ): Promise<void> {
    return httpPutChannelBan(serverSocket, accessToken, cid, uid, until, reason);
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
      domain: query.domain,
      before_mid: query.beforeMid,
      after_mid: query.afterMid,
    });
    return mapChatMessagePageWire(page);
  },
  async listChannelMessagesAround(
    serverSocket: string,
    accessToken: string,
    cid: string,
    aroundMid: string,
    before?: number,
    after?: number,
  ): Promise<ChatMessagePage> {
    const page = await httpListChannelMessagesAround(serverSocket, accessToken, cid, aroundMid, before, after);
    return mapChatMessagePageWire(page);
  },
  async editMessage(
    serverSocket: string,
    accessToken: string,
    mid: string,
    req: { domain: string; domainVersion: string; data: unknown; mentions?: Array<{ type: string; uid: string }>; expectedEditVersion?: number },
  ): Promise<ChatMessageRecord> {
    const updated = await httpEditMessage(serverSocket, accessToken, mid, {
      domain: req.domain,
      domain_version: req.domainVersion,
      data: req.data,
      mentions: req.mentions,
      expected_edit_version: req.expectedEditVersion,
    });
    return mapChatMessageWire(updated);
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
    req: { targetCid: string; comment?: string; idempotencyKey?: string },
  ): Promise<ChatMessageRecord> {
    const forwarded = await httpForwardMessage(serverSocket, accessToken, mid, {
      target_cid: req.targetCid,
      comment: req.comment,
      idempotency_key: req.idempotencyKey,
    });
    return mapChatMessageWire(forwarded);
  },
  async listMentions(serverSocket: string, accessToken: string, cursor?: string, limit?: number, unreadOnly?: boolean, cid?: string): Promise<ChatMentionPage> {
    const wire = await httpListMentions(serverSocket, accessToken, cursor, limit, unreadOnly, cid);
    return {
      items: Array.isArray(wire.items) ? wire.items.map(mapChatMentionWire) : [],
      nextCursor: wire.next_cursor,
      hasMore: Boolean(wire.has_more),
    };
  },
  async markMentionRead(serverSocket: string, accessToken: string, mentionId: string): Promise<void> {
    return httpMarkMentionRead(serverSocket, accessToken, mentionId);
  },
  async batchMarkMentionsRead(serverSocket: string, accessToken: string, beforeMentionId?: string, cid?: string): Promise<void> {
    return httpBatchMarkMentionsRead(serverSocket, accessToken, beforeMentionId, cid);
  },
};
