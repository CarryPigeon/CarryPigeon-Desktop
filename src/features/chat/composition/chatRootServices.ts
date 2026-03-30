/**
 * @fileoverview chat 根层业务服务
 * @description
 * 在 chat 根层，跨子域复用的 API 动作被直接收束成少数几个根层业务服务。
 *
 * 这样做的目的不是再造一层“薄包装”，而是把根层应用语义固定为三类：
 * - core：目录、消息、已读、普通成员路径
 * - governance：治理命令与治理查询
 * - event-stream：事件流接入
 *
 * 这样 runtime / gateway / capability 只需要面向少数稳定对象编排，
 * 不再关心底层究竟拆成多少个细粒度动作。
 */

import type { ChatEventsClient, ChatEventsConnectOptions } from "@/features/chat/domain/ports/chatEventsPort";
import type { ChatApiPort } from "@/features/chat/domain/ports/chatApiPort";
import type { ChatEventsPort } from "@/features/chat/domain/ports/chatEventsPort";
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
} from "@/features/chat/domain/types/chatApiModels";
import type { ChatEventEnvelope } from "@/features/chat/domain/types/chatEventModels";

/**
 * `ChatCoreApplicationService` 的依赖集合。
 *
 * 这里故意只暴露 core 分组真正需要的最小 API 面，避免：
 * - governance API 混入 core service；
 * - 调用方误以为 root service 可以任意访问完整 `ChatApiPort`。
 */
export type ChatCoreApplicationServiceDeps = {
  api: Pick<
    ChatApiPort,
    | "listChannels"
    | "getUnreads"
    | "listChannelMessages"
    | "sendChannelMessage"
    | "deleteMessage"
    | "updateReadState"
    | "applyJoinChannel"
    | "patchChannel"
  >;
};

/**
 * chat 根层的 core application service。
 *
 * 责任：
 * - 把“目录 / 消息 / 已读 / 普通成员路径”的远端动作整理成一组稳定能力；
 * - 为 runtime/gateway 提供一个比原始端口更清晰的应用层命名面；
 * - 保持自身为纯 application 编排对象，不携带任何响应式状态。
 */
export class ChatCoreApplicationService {
  constructor(private readonly deps: ChatCoreApplicationServiceDeps) {}

  /**
   * 查询当前 server scope 下的频道目录。
   */
  listChannels(serverSocket: string, accessToken: string): Promise<ChatChannelRecord[]> {
    return this.deps.api.listChannels(serverSocket, accessToken);
  }

  /**
   * 查询频道未读摘要。
   */
  getUnreads(serverSocket: string, accessToken: string): Promise<ChatUnreadState[]> {
    return this.deps.api.getUnreads(serverSocket, accessToken);
  }

  /**
   * 查询指定频道的一页消息。
   *
   * @param cursor - 历史翻页游标；为空时表示最新一页。
   * @param limit - 期望页大小；最终是否生效由 data adapter 决定。
   */
  listChannelMessages(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    cursor?: string,
    limit?: number,
  ): Promise<ChatMessagePage> {
    return this.deps.api.listChannelMessages(serverSocket, accessToken, channelId, cursor, limit);
  }

  /**
   * 向指定频道发送一条消息。
   *
   * @param idempotencyKey - 可选幂等键，用于避免重复发送。
   */
  sendMessage(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    request: ChatSendMessageInput,
    idempotencyKey?: string,
  ): Promise<ChatMessageRecord> {
    return this.deps.api.sendChannelMessage(serverSocket, accessToken, channelId, request, idempotencyKey);
  }

  /**
   * 删除一条消息。
   */
  deleteMessage(serverSocket: string, accessToken: string, messageId: string): Promise<void> {
    return this.deps.api.deleteMessage(serverSocket, accessToken, messageId);
  }

  /**
   * 上报频道读状态。
   */
  updateReadState(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    readState: ChatReadStateInput,
  ): Promise<void> {
    return this.deps.api.updateReadState(serverSocket, accessToken, channelId, readState);
  }

  /**
   * 发起加入频道申请。
   */
  applyJoinChannel(serverSocket: string, accessToken: string, channelId: string, reason: string): Promise<void> {
    return this.deps.api.applyJoinChannel(serverSocket, accessToken, channelId, reason);
  }

  /**
   * 更新频道元信息。
   */
  patchChannel(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    patch: ChatChannelPatchInput,
  ): Promise<ChatChannelRecord> {
    return this.deps.api.patchChannel(serverSocket, accessToken, channelId, patch);
  }
}

/**
 * `ChatGovernanceApplicationService` 的依赖集合。
 *
 * 只包含治理相关 API，避免 root 层治理动作和 core 动作重新混在一起。
 */
export type ChatGovernanceApplicationServiceDeps = {
  api: Pick<
    ChatApiPort,
    | "listChannelMembers"
    | "kickChannelMember"
    | "addChannelAdmin"
    | "removeChannelAdmin"
    | "listChannelApplications"
    | "decideChannelApplication"
    | "listChannelBans"
    | "putChannelBan"
    | "deleteChannelBan"
    | "createChannel"
    | "deleteChannel"
  >;
};

/**
 * chat 根层的 governance application service。
 *
 * 责任：
 * - 收束成员治理、申请治理、封禁治理、频道生命周期治理；
 * - 让上层编排点只依赖一个治理对象，而不是散落的方法集合。
 */
export class ChatGovernanceApplicationService {
  constructor(private readonly deps: ChatGovernanceApplicationServiceDeps) {}

  /**
   * 查询频道成员列表。
   */
  listChannelMembers(serverSocket: string, accessToken: string, channelId: string): Promise<ChatChannelMemberRecord[]> {
    return this.deps.api.listChannelMembers(serverSocket, accessToken, channelId);
  }

  /**
   * 移除频道成员。
   */
  kickChannelMember(serverSocket: string, accessToken: string, channelId: string, uid: string): Promise<void> {
    return this.deps.api.kickChannelMember(serverSocket, accessToken, channelId, uid);
  }

  /**
   * 授予频道管理员。
   */
  addChannelAdmin(serverSocket: string, accessToken: string, channelId: string, uid: string): Promise<void> {
    return this.deps.api.addChannelAdmin(serverSocket, accessToken, channelId, uid);
  }

  /**
   * 撤销频道管理员。
   */
  removeChannelAdmin(serverSocket: string, accessToken: string, channelId: string, uid: string): Promise<void> {
    return this.deps.api.removeChannelAdmin(serverSocket, accessToken, channelId, uid);
  }

  /**
   * 查询频道入群申请列表。
   */
  listChannelApplications(
    serverSocket: string,
    accessToken: string,
    channelId: string,
  ): Promise<ChatChannelApplicationRecord[]> {
    return this.deps.api.listChannelApplications(serverSocket, accessToken, channelId);
  }

  /**
   * 审批一条入群申请。
   */
  decideChannelApplication(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    applicationId: string,
    decision: "approve" | "reject",
  ): Promise<void> {
    return this.deps.api.decideChannelApplication(serverSocket, accessToken, channelId, applicationId, decision);
  }

  /**
   * 查询频道封禁列表。
   */
  listChannelBans(serverSocket: string, accessToken: string, channelId: string): Promise<ChatChannelBanRecord[]> {
    return this.deps.api.listChannelBans(serverSocket, accessToken, channelId);
  }

  /**
   * 创建或覆盖频道封禁记录。
   */
  putChannelBan(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    uid: string,
    until: number,
    reason: string,
  ): Promise<void> {
    return this.deps.api.putChannelBan(serverSocket, accessToken, channelId, uid, until, reason);
  }

  /**
   * 删除频道封禁记录。
   */
  deleteChannelBan(serverSocket: string, accessToken: string, channelId: string, uid: string): Promise<void> {
    return this.deps.api.deleteChannelBan(serverSocket, accessToken, channelId, uid);
  }

  /**
   * 创建频道。
   */
  createChannel(
    serverSocket: string,
    accessToken: string,
    request: ChatChannelCreateInput,
  ): Promise<ChatChannelRecord> {
    return this.deps.api.createChannel(serverSocket, accessToken, request);
  }

  /**
   * 删除频道。
   */
  deleteChannel(serverSocket: string, accessToken: string, channelId: string): Promise<void> {
    return this.deps.api.deleteChannel(serverSocket, accessToken, channelId);
  }
}

/**
 * `ChatEventStreamApplicationService` 的依赖集合。
 */
export type ChatEventStreamApplicationServiceDeps = {
  events: Pick<ChatEventsPort, "connect">;
};

/**
 * chat 根层的事件流 application service。
 *
 * 该对象只负责建立事件连接，不负责事件解释、状态落地或 UI 投影。
 */
export class ChatEventStreamApplicationService {
  constructor(private readonly deps: ChatEventStreamApplicationServiceDeps) {}

  /**
   * 建立 chat 事件流连接。
   *
   * @param onEvent - 每条事件到达时的回调。
   * @param options - 连接细节与恢复策略。
   */
  connect(
    serverSocket: string,
    accessToken: string,
    onEvent: (evt: ChatEventEnvelope) => void,
    options?: ChatEventsConnectOptions,
  ): ChatEventsClient {
    return this.deps.events.connect(serverSocket, accessToken, onEvent, options);
  }
}

/**
 * chat 根层 application services 分组。
 *
 * 这是 DI 容器向 runtime 暴露的稳定应用层对象集合。
 */
export type ChatRootServices = {
  core: ChatCoreApplicationService;
  governance: ChatGovernanceApplicationService;
  events: ChatEventStreamApplicationService;
};
