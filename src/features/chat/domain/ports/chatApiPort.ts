/**
 * @fileoverview chatApiPort.ts
 * @description chat｜领域端口：chatApiPort。
 *
 * 说明：
 * - 该端口刻意保持“协议无关”：可由 HTTP 实现、内存 Mock 实现，或通过原生桥接实现。
 * - 字段命名尽量贴近服务端契约（`snake_case` 的 DTO），以减少边界映射歧义与维护成本。
 */

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
	} from "../types/chatWireDtos";

/**
 * 聊天 HTTP API 端口（domain 层）。
 *
 * 说明：
 * - 该端口描述“请求-响应”类能力（与事件流 `ChatEventsPort` 相对）；
 * - 具体实现位于 data 层（HTTP/Mock/原生桥接等）。
 */
export type ChatApiPort = {
  /**
   * 获取当前用户可见的频道列表。
   *
   * @param serverSocket - 用于推导 origin 的 server socket。
   * @param accessToken - 访问令牌（Bearer）。
   * @returns 频道 DTO 列表。
   */
  listChannels(serverSocket: string, accessToken: string): Promise<ChannelDto[]>;
  /**
   * 获取当前用户在各频道的未读计数。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @returns 未读条目列表。
   */
  getUnreads(serverSocket: string, accessToken: string): Promise<UnreadItemDto[]>;
  /**
   * 获取频道消息列表（游标分页）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param cid - 频道 id。
   * @param cursor - 可选游标。
   * @param limit - 每页大小。
   * @returns 分页响应。
   */
  listChannelMessages(
    serverSocket: string,
    accessToken: string,
    cid: string,
    cursor?: string,
    limit?: number,
  ): Promise<ListMessagesResponseDto>;
  /**
   * 向频道发送消息。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param cid - 频道 id。
   * @param req - 发送消息请求体。
   * @param idempotencyKey - 可选幂等 key（用于避免重试重复写入）。
   * @returns 创建后的消息 DTO。
   */
  sendChannelMessage(
    serverSocket: string,
    accessToken: string,
    cid: string,
    req: SendMessageRequestDto,
    idempotencyKey?: string,
  ): Promise<MessageDto>;
  /**
   * 按消息 id 硬删除消息（hard-delete）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param mid - 消息 id（mid）。
   * @returns 无返回值。
   */
  deleteMessage(serverSocket: string, accessToken: string, mid: string): Promise<void>;
  /**
   * 更新频道读状态（只允许前进）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param cid - 频道 id。
   * @param req - 读状态请求体。
   * @returns 无返回值。
   */
  updateReadState(serverSocket: string, accessToken: string, cid: string, req: ReadStateRequestDto): Promise<void>;
  /**
   * 申请加入频道（或加入公开频道，具体由服务端策略决定）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param cid - 频道 id。
   * @param reason - 可选原因。
   * @returns 无返回值。
   */
  applyJoinChannel(serverSocket: string, accessToken: string, cid: string, reason: string): Promise<void>;
  /**
   * 更新频道元信息（name/brief/avatar）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param cid - 频道 id。
   * @param patch - patch 对象。
   * @returns 更新后的频道 DTO。
   */
  patchChannel(
    serverSocket: string,
    accessToken: string,
    cid: string,
    patch: Partial<Pick<ChannelDto, "name" | "brief" | "avatar">>,
  ): Promise<ChannelDto>;

  // ==========================================================================
  // Admin / Owner actions
  // ==========================================================================

  /**
   * 获取频道成员列表（admin/owner）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param cid - 频道 id。
   * @returns 成员 DTO 列表。
   */
  listChannelMembers(serverSocket: string, accessToken: string, cid: string): Promise<ChannelMemberDto[]>;

  /**
   * 将成员踢出频道（admin/owner）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param cid - 频道 id。
   * @param uid - 用户 id。
   * @returns 无返回值。
   */
  kickChannelMember(serverSocket: string, accessToken: string, cid: string, uid: string): Promise<void>;

  /**
   * 授予频道管理员（owner）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param cid - 频道 id。
   * @param uid - 用户 id。
   * @returns 无返回值。
   */
  addChannelAdmin(serverSocket: string, accessToken: string, cid: string, uid: string): Promise<void>;

  /**
   * 撤销频道管理员（owner）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param cid - 频道 id。
   * @param uid - 用户 id。
   * @returns 无返回值。
   */
  removeChannelAdmin(serverSocket: string, accessToken: string, cid: string, uid: string): Promise<void>;

  /**
   * 获取频道入群申请列表（admin/owner）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param cid - 频道 id。
   * @returns 申请 DTO 列表。
   */
  listChannelApplications(serverSocket: string, accessToken: string, cid: string): Promise<ChannelApplicationDto[]>;

  /**
   * 审批入群申请（admin/owner）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param cid - 频道 id。
   * @param applicationId - 申请 id。
   * @param decision - `"approve"` 或 `"reject"`。
   * @returns 无返回值。
   */
  decideChannelApplication(
    serverSocket: string,
    accessToken: string,
    cid: string,
    applicationId: string,
    decision: "approve" | "reject",
  ): Promise<void>;

  /**
   * 获取频道封禁列表（admin/owner）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param cid - 频道 id。
   * @returns 封禁 DTO 列表。
   */
  listChannelBans(serverSocket: string, accessToken: string, cid: string): Promise<ChannelBanDto[]>;

  /**
   * 设置禁言/封禁（创建或更新）（admin/owner）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param cid - 频道 id。
   * @param uid - 用户 id。
   * @param until - 截止时间戳（ms；0 表示永久）。
   * @param reason - 原因说明。
   * @returns 无返回值。
   */
  putChannelBan(
    serverSocket: string,
    accessToken: string,
    cid: string,
    uid: string,
    until: number,
    reason: string,
  ): Promise<void>;

  /**
   * 解除禁言/封禁（admin/owner）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param cid - 频道 id。
   * @param uid - 用户 id。
   * @returns 无返回值。
   */
  deleteChannelBan(serverSocket: string, accessToken: string, cid: string, uid: string): Promise<void>;

  /**
   * 创建频道（owner）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param req - 创建请求（name/brief/avatar）。
   * @returns 创建后的频道 DTO。
   */
  createChannel(
    serverSocket: string,
    accessToken: string,
    req: Pick<ChannelDto, "name"> & Partial<Pick<ChannelDto, "brief" | "avatar">>,
  ): Promise<ChannelDto>;

  /**
   * 删除频道（owner）。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param cid - 频道 id。
   * @returns 无返回值。
   */
  deleteChannel(serverSocket: string, accessToken: string, cid: string): Promise<void>;
};
