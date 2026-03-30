/**
 * @fileoverview 聊天实时 Store（HTTP + WS 事件流）。
 * @description chat｜展示层状态（store）：chat runtime store。
 * 实现聊天领域的核心交互闭环：
 * - HTTP：频道列表/未读/历史消息/成员/管理操作等
 * - WS：实时事件（新消息/删除/读状态/频道变更提示）
 *
 * 设计目标：
 * - 尽量把“协议语义”收敛在 store 内，UI 只消费状态与 action。
 * - 在 WS 不可用（如自签证书场景）时，自动降级为 HTTP polling。
 */

import { watch } from "vue";
import { createLogger } from "@/shared/utils/logger";
import type { ChatApiGateway, ChatEventsGateway } from "@/features/chat/composition/contracts/chatGateway";
import type { ChatRuntimeAggregateStore } from "@/features/chat/composition/contracts/chatStoreTypes";
import { assembleChatStoreRuntime } from "@/features/chat/composition/store/assembleChatStoreRuntime";

const logger = createLogger("chatRuntimeStore");

/**
 * chat 实时 Store 的依赖集合（API + 事件端口）。
 */
export type ChatRuntimeStoreDeps = {
  api: ChatApiGateway;
  events: ChatEventsGateway;
};

/**
 * 创建 chat 实时 Store 实例。
 *
 * @param deps - API + events 端口依赖。
 * @returns ChatRuntimeAggregateStore。
 */
export function createChatRuntimeStore(deps: ChatRuntimeStoreDeps): ChatRuntimeAggregateStore {
  /**
   * `assembleChatStoreRuntime()` 是 chat 运行时的真实装配点：
   * - 先拿到共享 state；
   * - 再拿到 session/message-flow/governance 三组运行时；
   * - 最后由本文件投影成历史兼容的聚合 store 形状。
   */
  const {
    state,
    sessionSharedContext,
    governance,
    messageFlow,
    session,
  } = assembleChatStoreRuntime({
    api: deps.api,
    events: deps.events,
    logger,
  });
  const {
    channelSearch,
    channelTab,
    composerDraft,
    selectedDomainId,
    replyToMessageId,
    messageActionError,
    members,
    allChannels,
    channels,
    currentChannelId,
    currentMessages,
    currentChannelHasMore,
    currentChannelLoadingMore,
    currentChannelLastReadTimeMs,
    currentChannelLastReadMid,
  } = state;

  watch(
    () => sessionSharedContext.scope.getActiveServerSocket(),
    () => {
      // server workspace 变化时，由 session 子域负责清理当前频道与连接期状态。
      session.resetForServerChange();
    },
  );

  return {
    channels,
    allChannels,
    channelSearch,
    channelTab,
    composerDraft,
    selectedDomainId,
    replyToMessageId,
    messageActionError,
    currentChannelId,
    currentMessages,
    currentChannelHasMore,
    loadingMoreMessages: currentChannelLoadingMore,
    currentChannelLastReadTimeMs,
    currentChannelLastReadMid,
    members,
    ensureChatReady: session.ensureChatReady,
    availableDomains: messageFlow.availableDomains,
    getMessageById: session.getMessageById,
    selectChannel: session.selectChannel,
    reportCurrentReadState: session.reportCurrentReadState,
    loadMoreMessages: messageFlow.loadMoreMessages,
    applyJoin: governance.applyJoin,
    updateChannelMeta: governance.updateChannelMeta,
    startReply: messageFlow.startReply,
    cancelReply: messageFlow.cancelReply,
    deleteMessage: messageFlow.deleteMessage,
    sendComposerMessage: messageFlow.sendComposerMessage,
    // 频道管理
    listMembers: governance.listMembers,
    kickMember: governance.kickMember,
    setAdmin: governance.setAdmin,
    removeAdmin: governance.removeAdmin,
    listApplications: governance.listApplications,
    decideApplication: governance.decideApplication,
    listBans: governance.listBans,
    setBan: governance.setBan,
    removeBan: governance.removeBan,
    createChannel: governance.createChannel,
    deleteChannel: governance.deleteChannel,
  };
}
