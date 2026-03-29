/**
 * @fileoverview chat store subdomain slices
 * @description
 * 从聚合 runtime store 中构造稳定的子域 runtime slice，避免 DI 将同一个对象直接伪装成多个模块。
 */

import type {
  ChatRuntimeStore,
  MessageFlowRuntimeStore,
  RoomGovernanceRuntimeStore,
  RoomSessionRuntimeStore,
} from "./chatStoreTypes";

export function createRoomSessionSlice(store: ChatRuntimeStore): RoomSessionRuntimeStore {
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

export function createMessageFlowSlice(store: ChatRuntimeStore): MessageFlowRuntimeStore {
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

export function createRoomGovernanceSlice(store: ChatRuntimeStore): RoomGovernanceRuntimeStore {
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
