/**
 * @fileoverview httpChatApiPort.ts
 * @description Data adapter: implements `ChatApiPort` using the HTTP JSON client.
 */

import type { ChatApiPort } from "../domain/ports/chatApiPort";
import type {
  ChannelDto,
  ListMessagesResponseDto,
  MessageDto,
  ReadStateRequestDto,
  SendMessageRequestDto,
  UnreadItemDto,
} from "../domain/types/chatWireDtos";
import {
  httpApplyJoinChannel,
  httpDeleteMessage,
  httpGetUnreads,
  httpListChannelMessages,
  httpListChannels,
  httpPatchChannel,
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
};
