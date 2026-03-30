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

/**
 * 在完整频道目录里按 id 查询频道。
 */
function findChannelById(channelId: string): ChatChannel | null {
  for (const channel of allChannels.value) {
    if (channel.id === channelId) return clonePlainData(channel);
  }
  return null;
}

/**
 * 构造目录 capability 的只读快照。
 */
function getDirectorySnapshot(): RoomSessionDirectorySnapshot {
  return {
    allChannels: clonePlainData(allChannels.value),
    visibleChannels: clonePlainData(channels.value),
    searchQuery: channelSearch.value,
    activeTab: channelTab.value,
  };
}

const observeDirectorySnapshot = createWatchedSnapshotObserver(getDirectorySnapshot);

/**
 * 构造当前频道会话快照。
 */
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
 *
 * capability-source 的职责是：
 * - 向外提供稳定 object-capability；
 * - 向内继续复用 runtime store-access；
 * - 把 Vue watch 限制在内部边界，不泄漏到公共 API。
 */
export function createRoomSessionCapabilitySource(): RoomSessionCapabilities {
  return {
    directory: {
      getSnapshot: getDirectorySnapshot,
      observeSnapshot: observeDirectorySnapshot,
      /**
       * 设置目录搜索关键字。
       */
      setSearchQuery(value: string): void {
        channelSearch.value = value;
      },
      /**
       * 切换目录标签页。
       */
      setActiveTab(value: "joined" | "discover"): void {
        channelTab.value = value;
      },
      /**
       * 强制进入 discover 标签，并填入指定频道名。
       *
       * 典型场景：
       * - 用户点击“前往发现页”
       * - 其他 feature 需要把某个频道名称作为搜索种子写入
       */
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
