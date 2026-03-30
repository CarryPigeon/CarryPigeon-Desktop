/**
 * @fileoverview room-session presentation store access。
 * @description
 * 这是 room-session presentation 层内部使用的 store 访问面。
 * 它只转发 runtime 管理的当前子域 store，不暴露聚合 store 或内部运行时实现。
 */

import { computed } from "vue";
import { getRoomSessionStore } from "@/features/chat/composition/runtimeAccess";
import type { ChannelSelectionOutcome } from "@/features/chat/room-session/api-types";

/**
 * 延迟解析当前 room-session store，确保运行时实例始终由 application/runtime 装配根决定。
 */
function resolveRoomSessionStore(): ReturnType<typeof getRoomSessionStore> {
  return getRoomSessionStore();
}

/**
 * 当前工作区的完整频道目录。
 */
export const allChannels = computed(() => resolveRoomSessionStore().allChannels.value);
/**
 * 频道搜索词双向投影。
 */
export const channelSearch = computed({
  get: () => resolveRoomSessionStore().channelSearch.value,
  set: (value: string) => {
    resolveRoomSessionStore().channelSearch.value = value;
  },
});
/**
 * 频道列表当前标签双向投影。
 */
export const channelTab = computed({
  get: () => resolveRoomSessionStore().channelTab.value,
  set: (value: "joined" | "discover") => {
    resolveRoomSessionStore().channelTab.value = value;
  },
});
/**
 * 当前筛选后可见的频道列表。
 */
export const channels = computed(() => resolveRoomSessionStore().channels.value);
/**
 * 当前选中频道 id 双向投影。
 */
export const currentChannelId = computed({
  get: () => resolveRoomSessionStore().currentChannelId.value,
  set: (value: string) => {
    resolveRoomSessionStore().currentChannelId.value = value;
  },
});
/**
 * 当前频道最后一次本地记录的已读时间。
 */
export const currentChannelLastReadTimeMs = computed(() => resolveRoomSessionStore().currentChannelLastReadTimeMs.value);
/**
 * 当前频道最后一次本地记录的已读消息 id。
 */
export const currentChannelLastReadMid = computed(() => resolveRoomSessionStore().currentChannelLastReadMid.value);

/**
 * 确保当前 chat 会话进入可用状态。
 */
export function ensureChatReady(): Promise<void> {
  return resolveRoomSessionStore().ensureChatReady();
}

/**
 * 对当前频道执行一次最佳努力的读状态上报。
 */
export function reportCurrentReadState(): Promise<void> {
  return resolveRoomSessionStore().reportCurrentReadState();
}

/**
 * 切换到指定频道。
 */
export function selectChannel(id: string): Promise<ChannelSelectionOutcome> {
  return resolveRoomSessionStore().selectChannel(id);
}
