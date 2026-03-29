/**
 * @fileoverview chat session state
 * @description
 * 承载 room-session 维度的基础状态与派生视图：
 * 频道目录、当前频道、读状态与 server-scope 版本。
 */

import { computed, reactive, ref } from "vue";
import type { ChatChannel } from "@/features/chat/room-session/contracts";

/**
 * 创建 room-session 相关状态。
 *
 * @returns session 状态与派生视图。
 */
export function createChatSessionState() {
  const channelsRef = ref<ChatChannel[]>([]);
  const channelSearch = ref<string>("");
  const channelTab = ref<"joined" | "discover">("joined");
  const currentChannelId = ref<string>("");

  const lastReadTimeMsByChannel = reactive<Record<string, number>>({});
  const lastReadMidByChannel = reactive<Record<string, string>>({});
  const lastReadReportAtMsByChannel = reactive<Record<string, number>>({});
  const scopeVersion = ref<number>(0);

  const allChannels = computed(() => channelsRef.value);

  const channels = computed(() => {
    const needle = channelSearch.value.trim().toLowerCase();
    const base: ChatChannel[] = [];
    const showJoined = channelTab.value === "joined";
    for (const c of channelsRef.value) {
      const ok = showJoined ? c.joined : !c.joined;
      if (ok) base.push(c);
    }
    if (!needle) return base;
    const filtered: ChatChannel[] = [];
    for (const c of base) {
      if (c.name.toLowerCase().includes(needle) || c.id.toLowerCase().includes(needle)) filtered.push(c);
    }
    return filtered;
  });

  const currentChannelLastReadTimeMs = computed(() => lastReadTimeMsByChannel[currentChannelId.value] ?? 0);
  const currentChannelLastReadMid = computed(() => lastReadMidByChannel[currentChannelId.value] ?? "");

  return {
    channelsRef,
    channelSearch,
    channelTab,
    currentChannelId,
    lastReadTimeMsByChannel,
    lastReadMidByChannel,
    lastReadReportAtMsByChannel,
    scopeVersion,
    allChannels,
    channels,
    currentChannelLastReadTimeMs,
    currentChannelLastReadMid,
  };
}
