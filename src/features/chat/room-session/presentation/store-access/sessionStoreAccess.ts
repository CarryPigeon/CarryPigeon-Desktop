/**
 * @fileoverview room-session presentation store access。
 * @description
 * 这是 room-session presentation 层内部使用的 store 访问面。
 * 它只转发 runtime 管理的当前子域 store，不暴露聚合 store 或内部运行时实现。
 */

import { computed } from "vue";
import { getRoomSessionStore } from "@/features/chat/application/runtime/runtimeAccess";
import type { ChannelSelectionOutcome } from "@/features/chat/room-session/api-types";

/**
 * 延迟解析当前 room-session store，确保运行时实例始终由 application/runtime 装配根决定。
 */
function resolveRoomSessionStore(): ReturnType<typeof getRoomSessionStore> {
  return getRoomSessionStore();
}

export const allChannels = computed(() => resolveRoomSessionStore().allChannels.value);
export const channelSearch = computed({
  get: () => resolveRoomSessionStore().channelSearch.value,
  set: (value: string) => {
    resolveRoomSessionStore().channelSearch.value = value;
  },
});
export const channelTab = computed({
  get: () => resolveRoomSessionStore().channelTab.value,
  set: (value: "joined" | "discover") => {
    resolveRoomSessionStore().channelTab.value = value;
  },
});
export const channels = computed(() => resolveRoomSessionStore().channels.value);
export const currentChannelId = computed({
  get: () => resolveRoomSessionStore().currentChannelId.value,
  set: (value: string) => {
    resolveRoomSessionStore().currentChannelId.value = value;
  },
});
export const currentChannelLastReadTimeMs = computed(() => resolveRoomSessionStore().currentChannelLastReadTimeMs.value);
export const currentChannelLastReadMid = computed(() => resolveRoomSessionStore().currentChannelLastReadMid.value);

export function ensureChatReady(): Promise<void> {
  return resolveRoomSessionStore().ensureChatReady();
}

export function reportCurrentReadState(): Promise<void> {
  return resolveRoomSessionStore().reportCurrentReadState();
}

export function selectChannel(id: string): Promise<ChannelSelectionOutcome> {
  return resolveRoomSessionStore().selectChannel(id);
}
