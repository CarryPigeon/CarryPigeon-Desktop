/**
 * @fileoverview chat gateway factory
 * @description
 * 抽离展示层 runtime gateway 组装逻辑，降低 DI 容器与 runtime registry 的职责密度。
 *
 * 这里的 gateway 不是新的业务层，而是一个窄适配层：
 * - 输入是 application service；
 * - 输出是 presentation/runtime 更适合消费的方法集合。
 */

import type {
  ChatCoreApplicationService,
  ChatEventStreamApplicationService,
  ChatGovernanceApplicationService,
} from "@/features/chat/composition/chatRootServices";
import type {
  ChatApiGateway,
  ChatCoreApiGateway,
  ChatEventsGateway,
  ChatGovernanceApiGateway,
} from "@/features/chat/composition/contracts/chatGateway";

/**
 * 创建 chat API gateway 所需的根层 application services。
 */
export type CreateChatApiGatewayDeps = {
  /**
   * 该依赖集合是 runtime 侧消费的根层 application services。
   *
   * 作用：
   * - 把按语义分组的 application service 包装成 presentation/runtime 更易消费的网关函数集合；
   * - 避免 runtime 在装配阶段逐个理解底层动作或 data 端口。
   */
  core: ChatCoreApplicationService;
  governance: ChatGovernanceApplicationService;
};

/**
 * 创建 chat 核心读写 gateway。
 *
 * 覆盖范围：
 * - 频道目录
 * - 消息列表
 * - 消息发送/删除
 * - 已读状态
 * - 普通成员路径的频道动作
 */
export function createChatCoreApiGateway(deps: CreateChatApiGatewayDeps): ChatCoreApiGateway {
  return {
    listChannels(serverSocket, accessToken) {
      return deps.core.listChannels(serverSocket, accessToken);
    },
    getUnreads(serverSocket, accessToken) {
      return deps.core.getUnreads(serverSocket, accessToken);
    },
    listChannelMessages(serverSocket, accessToken, channelId, cursor, limit) {
      return deps.core.listChannelMessages(serverSocket, accessToken, channelId, cursor, limit);
    },
    sendChannelMessage(serverSocket, accessToken, channelId, req, idempotencyKey) {
      return deps.core.sendMessage(serverSocket, accessToken, channelId, req, idempotencyKey);
    },
    deleteMessage(serverSocket, accessToken, messageId) {
      return deps.core.deleteMessage(serverSocket, accessToken, messageId);
    },
    updateReadState(serverSocket, accessToken, channelId, readState) {
      return deps.core.updateReadState(serverSocket, accessToken, channelId, readState);
    },
    applyJoinChannel(serverSocket, accessToken, channelId, reason) {
      return deps.core.applyJoinChannel(serverSocket, accessToken, channelId, reason);
    },
    patchChannel(serverSocket, accessToken, channelId, patch) {
      return deps.core.patchChannel(serverSocket, accessToken, channelId, patch);
    },
  };
}

/**
 * 创建治理侧 gateway。
 *
 * 覆盖范围：
 * - 成员 / 管理员
 * - 入群申请
 * - 封禁
 * - 频道创建与删除
 */
export function createChatGovernanceApiGateway(deps: CreateChatApiGatewayDeps): ChatGovernanceApiGateway {
  return {
    listChannelMembers(serverSocket, accessToken, channelId) {
      return deps.governance.listChannelMembers(serverSocket, accessToken, channelId);
    },
    kickChannelMember(serverSocket, accessToken, channelId, uid) {
      return deps.governance.kickChannelMember(serverSocket, accessToken, channelId, uid);
    },
    addChannelAdmin(serverSocket, accessToken, channelId, uid) {
      return deps.governance.addChannelAdmin(serverSocket, accessToken, channelId, uid);
    },
    removeChannelAdmin(serverSocket, accessToken, channelId, uid) {
      return deps.governance.removeChannelAdmin(serverSocket, accessToken, channelId, uid);
    },
    listChannelApplications(serverSocket, accessToken, channelId) {
      return deps.governance.listChannelApplications(serverSocket, accessToken, channelId);
    },
    decideChannelApplication(serverSocket, accessToken, channelId, applicationId, decision) {
      return deps.governance.decideChannelApplication(serverSocket, accessToken, channelId, applicationId, decision);
    },
    listChannelBans(serverSocket, accessToken, channelId) {
      return deps.governance.listChannelBans(serverSocket, accessToken, channelId);
    },
    putChannelBan(serverSocket, accessToken, channelId, uid, until, reason) {
      return deps.governance.putChannelBan(serverSocket, accessToken, channelId, uid, until, reason);
    },
    deleteChannelBan(serverSocket, accessToken, channelId, uid) {
      return deps.governance.deleteChannelBan(serverSocket, accessToken, channelId, uid);
    },
    createChannel(serverSocket, accessToken, req) {
      return deps.governance.createChannel(serverSocket, accessToken, req);
    },
    deleteChannel(serverSocket, accessToken, channelId) {
      return deps.governance.deleteChannel(serverSocket, accessToken, channelId);
    },
  };
}

/**
 * 合并核心 gateway 与治理 gateway，得到 presentation/runtime 使用的完整 chat API。
 */
export function createChatApiGateway(deps: CreateChatApiGatewayDeps): ChatApiGateway {
  return {
    ...createChatCoreApiGateway(deps),
    ...createChatGovernanceApiGateway(deps),
  };
}

/**
 * 把事件流 application service 适配为 runtime 侧网关。
 */
export function createChatEventsGateway(events: ChatEventStreamApplicationService): ChatEventsGateway {
  return {
    connect(serverSocket, accessToken, onEvent, options) {
      return events.connect(serverSocket, accessToken, onEvent, options);
    },
  };
}
