/**
 * @fileoverview chatApiPort.ts
 * @description Domain port: chat resource access over a request/response API.
 *
 * Notes:
 * - This port is protocol-agnostic: it can be backed by HTTP, mocked in-memory,
 *   or bridged via native transports.
 * - Field names mirror the server contract (`snake_case`) to reduce mapping
 *   ambiguity at the boundary.
 */

import type {
  ChannelDto,
  ListMessagesResponseDto,
  MessageDto,
  ReadStateRequestDto,
  SendMessageRequestDto,
  UnreadItemDto,
} from "../types/chatWireDtos";

export type ChatApiPort = {
  /**
   * List channels visible to the current user.
   *
   * @param serverSocket - Server socket used to derive origin.
   * @param accessToken - Bearer access token.
   * @returns Channels list.
   */
  listChannels(serverSocket: string, accessToken: string): Promise<ChannelDto[]>;
  /**
   * Get per-channel unread counters for current user.
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Bearer token.
   * @returns Unread list.
   */
  getUnreads(serverSocket: string, accessToken: string): Promise<UnreadItemDto[]>;
  /**
   * List messages for a channel (cursor pagination).
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Bearer token.
   * @param cid - Channel id.
   * @param cursor - Optional cursor.
   * @param limit - Page size.
   * @returns Page response.
   */
  listChannelMessages(
    serverSocket: string,
    accessToken: string,
    cid: string,
    cursor?: string,
    limit?: number,
  ): Promise<ListMessagesResponseDto>;
  /**
   * Send a message to a channel.
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Bearer token.
   * @param cid - Channel id.
   * @param req - Message request payload.
   * @param idempotencyKey - Optional idempotency key.
   * @returns Created message.
   */
  sendChannelMessage(
    serverSocket: string,
    accessToken: string,
    cid: string,
    req: SendMessageRequestDto,
    idempotencyKey?: string,
  ): Promise<MessageDto>;
  /**
   * Hard delete a message.
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Bearer token.
   * @param mid - Message id.
   * @returns Promise<void>
   */
  deleteMessage(serverSocket: string, accessToken: string, mid: string): Promise<void>;
  /**
   * Update read state for a channel (only forward).
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Bearer token.
   * @param cid - Channel id.
   * @param req - Read state payload.
   * @returns Promise<void>
   */
  updateReadState(serverSocket: string, accessToken: string, cid: string, req: ReadStateRequestDto): Promise<void>;
  /**
   * Apply/join a channel.
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Bearer token.
   * @param cid - Channel id.
   * @param reason - Optional reason.
   * @returns Promise<void>
   */
  applyJoinChannel(serverSocket: string, accessToken: string, cid: string, reason: string): Promise<void>;
  /**
   * Patch channel metadata (name/brief/avatar).
   *
   * @param serverSocket - Server socket.
   * @param accessToken - Bearer token.
   * @param cid - Channel id.
   * @param patch - Patch object.
   * @returns Updated channel.
   */
  patchChannel(
    serverSocket: string,
    accessToken: string,
    cid: string,
    patch: Partial<Pick<ChannelDto, "name" | "brief" | "avatar">>,
  ): Promise<ChannelDto>;
};
