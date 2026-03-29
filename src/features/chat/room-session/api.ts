/**
 * @fileoverview chat/room-session 对外 API。
 * @description
 * 暴露会话上下文与连接期编排能力（频道目录、当前频道、就绪、已读上报）。
 */

import { watch } from "vue";
import { clonePlainData } from "@/shared/utils/clonePlainData";
import {
  allChannels,
  channelSearch,
  channelTab,
  channels,
  currentChannelId,
  currentChannelLastReadMid,
  currentChannelLastReadTimeMs,
  ensureChatReady,
  reportCurrentReadState,
  selectChannel,
} from "./application/sessionState";
import type { ChannelSelectionOutcome, ChatChannel } from "./contracts";

/**
 * room-session 目录快照。
 */
export type RoomSessionDirectorySnapshot = {
  allChannels: readonly ChatChannel[];
  visibleChannels: readonly ChatChannel[];
  searchQuery: string;
  activeTab: "joined" | "discover";
};

/**
 * room-session 目录局部 capability。
 */
export type RoomSessionDirectoryCapabilities = {
  getSnapshot(): RoomSessionDirectorySnapshot;
  observeSnapshot(observer: (snapshot: RoomSessionDirectorySnapshot) => void): () => void;
  setSearchQuery(value: string): void;
  setActiveTab(value: "joined" | "discover"): void;
  focusDiscoverChannel(channelName: string): void;
  findChannelById(channelId: string): ChatChannel | null;
};

/**
 * 当前频道会话快照。
 */
export type CurrentChannelSessionSnapshot = {
  currentChannelId: string;
  lastReadMessageId: string;
  lastReadTimeMs: number;
};

/**
 * 当前频道局部 capability。
 */
export type CurrentChannelSessionCapabilities = {
  getSnapshot(): CurrentChannelSessionSnapshot;
  observeSnapshot(observer: (snapshot: CurrentChannelSessionSnapshot) => void): () => void;
  ensureReady(): Promise<void>;
  selectChannel(channelId: string): Promise<ChannelSelectionOutcome>;
  reportReadState(): Promise<void>;
};

/**
 * room-session 子域能力对象。
 */
export type RoomSessionCapabilities = {
  directory: RoomSessionDirectoryCapabilities;
  currentChannel: CurrentChannelSessionCapabilities;
};

/**
 * 创建 room-session 子域能力对象。
 */
export function createRoomSessionCapabilities(): RoomSessionCapabilities {
  function findChannelById(channelId: string): ChatChannel | null {
    for (const channel of allChannels.value) {
      if (channel.id === channelId) return clonePlainData(channel);
    }
    return null;
  }

  function getDirectorySnapshot(): RoomSessionDirectorySnapshot {
    return {
      allChannels: clonePlainData(allChannels.value),
      visibleChannels: clonePlainData(channels.value),
      searchQuery: channelSearch.value,
      activeTab: channelTab.value,
    };
  }

  function observeDirectorySnapshot(
    observer: (snapshot: RoomSessionDirectorySnapshot) => void,
  ): () => void {
    return watch(getDirectorySnapshot, observer, { immediate: true });
  }

  function getCurrentChannelSnapshot(): CurrentChannelSessionSnapshot {
    return {
      currentChannelId: currentChannelId.value,
      lastReadMessageId: currentChannelLastReadMid.value,
      lastReadTimeMs: currentChannelLastReadTimeMs.value,
    };
  }

  function observeCurrentChannelSnapshot(
    observer: (snapshot: CurrentChannelSessionSnapshot) => void,
  ): () => void {
    return watch(getCurrentChannelSnapshot, observer, { immediate: true });
  }

  return {
    directory: {
      getSnapshot: getDirectorySnapshot,
      observeSnapshot: observeDirectorySnapshot,
      setSearchQuery(value: string): void {
        channelSearch.value = value;
      },
      setActiveTab(value: "joined" | "discover"): void {
        channelTab.value = value;
      },
      focusDiscoverChannel(channelName: string): void {
        channelTab.value = "discover";
        channelSearch.value = channelName;
      },
      findChannelById,
    },
    currentChannel: {
      getSnapshot: getCurrentChannelSnapshot,
      observeSnapshot: observeCurrentChannelSnapshot,
      ensureReady: ensureChatReady,
      selectChannel,
      reportReadState: reportCurrentReadState,
    },
  };
}

let roomSessionCapabilitiesSingleton: RoomSessionCapabilities | null = null;

/**
 * 获取 room-session 子域共享能力对象。
 */
export function getRoomSessionCapabilities(): RoomSessionCapabilities {
  roomSessionCapabilitiesSingleton ??= createRoomSessionCapabilities();
  return roomSessionCapabilitiesSingleton;
}

export type { ChannelSelectionErrorInfo, ChannelSelectionOutcome, ChatChannel } from "./contracts";
