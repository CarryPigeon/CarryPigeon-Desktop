/**
 * @fileoverview room-session capability source
 * @description
 * 组装 room-session 子域的内部 capability 来源。
 *
 * 说明：
 * - `api.ts` 只负责对外导出与单例管理；
 * - 本文件负责把 runtime store-access 适配为稳定 capability；
 * - Vue `watch()` 被限制在这里，不再直接出现在子域公共 API 文件中。
 */

import { clonePlainData } from "@/shared/utils/clonePlainData";
import { createWatchedSnapshotObserver } from "@/shared/utils/createWatchedSnapshotObserver";
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
} from "./presentation/store-access/sessionStoreAccess";
import type {
  ChatChannel,
  CurrentChannelSessionSnapshot,
  RoomSessionCapabilities,
  RoomSessionDirectorySnapshot,
} from "./api-types";

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

const observeDirectorySnapshot = createWatchedSnapshotObserver(getDirectorySnapshot);

function getCurrentChannelSnapshot(): CurrentChannelSessionSnapshot {
  return {
    currentChannelId: currentChannelId.value,
    lastReadMessageId: currentChannelLastReadMid.value,
    lastReadTimeMs: currentChannelLastReadTimeMs.value,
  };
}

const observeCurrentChannelSnapshot = createWatchedSnapshotObserver(getCurrentChannelSnapshot);

/**
 * 创建 room-session 子域内部 capability 源。
 */
export function createRoomSessionCapabilitySource(): RoomSessionCapabilities {
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
