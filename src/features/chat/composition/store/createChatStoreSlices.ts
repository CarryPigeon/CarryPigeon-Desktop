/**
 * @fileoverview chat store subdomain slices
 * @description
 * 从聚合 runtime store 中构造稳定的子域 runtime slice，避免 DI 将同一个对象直接伪装成多个模块。
 */

import type {
  ChatRuntimeAggregateStore,
  MessageFlowRuntimeStore,
  RoomGovernanceRuntimeStore,
  RoomSessionRuntimeStore,
} from "@/features/chat/composition/contracts/chatStoreTypes";

/**
 * 从聚合 store 中提取 room-session runtime slice。
 */
export function createRoomSessionSlice(store: ChatRuntimeAggregateStore): RoomSessionRuntimeStore {
  return {
    channels: store.channels,
    allChannels: store.allChannels,
    channelSearch: store.channelSearch,
    channelTab: store.channelTab,
    currentChannelId: store.currentChannelId,
    currentChannelLastReadTimeMs: store.currentChannelLastReadTimeMs,
    currentChannelLastReadMid: store.currentChannelLastReadMid,
    ensureChatReady: store.ensureChatReady,
    selectChannel: store.selectChannel,
    reportCurrentReadState: store.reportCurrentReadState,
  };
}

/**
 * 从聚合 store 中提取 message-flow runtime slice。
 */
export function createMessageFlowSlice(store: ChatRuntimeAggregateStore): MessageFlowRuntimeStore {
  return {
    composerDraft: store.composerDraft,
    selectedDomainId: store.selectedDomainId,
    replyToMessageId: store.replyToMessageId,
    messageActionError: store.messageActionError,
    currentMessages: store.currentMessages,
    currentChannelHasMore: store.currentChannelHasMore,
    loadingMoreMessages: store.loadingMoreMessages,
    availableDomains: store.availableDomains,
    getMessageById: store.getMessageById,
    loadMoreMessages: store.loadMoreMessages,
    startReply: store.startReply,
    cancelReply: store.cancelReply,
    deleteMessage: store.deleteMessage,
    sendComposerMessage: store.sendComposerMessage,
  };
}

/**
 * 从聚合 store 中提取 room-governance runtime slice。
 */
export function createRoomGovernanceSlice(store: ChatRuntimeAggregateStore): RoomGovernanceRuntimeStore {
  return {
    members: store.members,
    applyJoin: store.applyJoin,
    updateChannelMeta: store.updateChannelMeta,
    listMembers: store.listMembers,
    kickMember: store.kickMember,
    setAdmin: store.setAdmin,
    removeAdmin: store.removeAdmin,
    listApplications: store.listApplications,
    decideApplication: store.decideApplication,
    listBans: store.listBans,
    setBan: store.setBan,
    removeBan: store.removeBan,
    createChannel: store.createChannel,
    deleteChannel: store.deleteChannel,
  };
}
