/**
 * @fileoverview httpChatApiPort.ts
 * @description chat｜数据层实现：httpChatApiPort。
 */

import type { ChatApiPort } from "../domain/ports/chatApiPort";
import type {
  ChannelDto,
  ChannelApplicationDto,
  ChannelBanDto,
  ChannelMemberDto,
  ListMessagesResponseDto,
  MessageDto,
  ReadStateRequestDto,
  SendMessageRequestDto,
  UnreadItemDto,
} from "../domain/types/chatWireDtos";
import {
  httpAddChannelAdmin,
  httpApplyJoinChannel,
  httpCreateChannel,
  httpDeleteMessage,
  httpDeleteChannel,
  httpDeleteChannelBan,
  httpGetUnreads,
  httpKickChannelMember,
  httpListChannelApplications,
  httpListChannelBans,
  httpListChannelMessages,
  httpListChannelMembers,
  httpListChannels,
  httpPatchChannel,
  httpPutChannelBan,
  httpRemoveChannelAdmin,
  httpDecideChannelApplication,
  httpSendChannelMessage,
  httpUpdateReadState,
} from "./httpChatApi";

/**
 * HTTP-backed chat API port.
 *
 * @constant
 */
export const httpChatApiPort: ChatApiPort = {
  async listChannels(serverSocket: string, accessToken: string): Promise<ChannelDto[]> {
    return (await httpListChannels(serverSocket, accessToken)) as unknown as ChannelDto[];
  },
  async getUnreads(serverSocket: string, accessToken: string): Promise<UnreadItemDto[]> {
    return (await httpGetUnreads(serverSocket, accessToken)) as unknown as UnreadItemDto[];
  },
  async listChannelMessages(
    serverSocket: string,
    accessToken: string,
    cid: string,
    cursor?: string,
    limit?: number,
  ): Promise<ListMessagesResponseDto> {
    return (await httpListChannelMessages(serverSocket, accessToken, cid, cursor, limit ?? 50)) as unknown as ListMessagesResponseDto;
  },
  async sendChannelMessage(
    serverSocket: string,
    accessToken: string,
    cid: string,
    req: SendMessageRequestDto,
    idempotencyKey?: string,
  ): Promise<MessageDto> {
    return (await httpSendChannelMessage(serverSocket, accessToken, cid, req, idempotencyKey)) as unknown as MessageDto;
  },
  async deleteMessage(serverSocket: string, accessToken: string, mid: string): Promise<void> {
    return httpDeleteMessage(serverSocket, accessToken, mid);
  },
  async updateReadState(
    serverSocket: string,
    accessToken: string,
    cid: string,
    req: ReadStateRequestDto,
  ): Promise<void> {
    return httpUpdateReadState(serverSocket, accessToken, cid, req);
  },
  async applyJoinChannel(serverSocket: string, accessToken: string, cid: string, reason: string): Promise<void> {
    return httpApplyJoinChannel(serverSocket, accessToken, cid, reason);
  },
  async patchChannel(
    serverSocket: string,
    accessToken: string,
    cid: string,
    patch: Partial<Pick<ChannelDto, "name" | "brief" | "avatar">>,
  ): Promise<ChannelDto> {
    return (await httpPatchChannel(serverSocket, accessToken, cid, patch)) as unknown as ChannelDto;
  },

  async listChannelMembers(serverSocket: string, accessToken: string, cid: string): Promise<ChannelMemberDto[]> {
    return (await httpListChannelMembers(serverSocket, accessToken, cid)) as unknown as ChannelMemberDto[];
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

  async listChannelApplications(serverSocket: string, accessToken: string, cid: string): Promise<ChannelApplicationDto[]> {
    return (await httpListChannelApplications(serverSocket, accessToken, cid)) as unknown as ChannelApplicationDto[];
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

  async listChannelBans(serverSocket: string, accessToken: string, cid: string): Promise<ChannelBanDto[]> {
    return (await httpListChannelBans(serverSocket, accessToken, cid)) as unknown as ChannelBanDto[];
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
    req: Pick<ChannelDto, "name"> & Partial<Pick<ChannelDto, "brief" | "avatar">>,
  ): Promise<ChannelDto> {
    return (await httpCreateChannel(serverSocket, accessToken, req)) as unknown as ChannelDto;
  },

  async deleteChannel(serverSocket: string, accessToken: string, cid: string): Promise<void> {
    return httpDeleteChannel(serverSocket, accessToken, cid);
  },
};
