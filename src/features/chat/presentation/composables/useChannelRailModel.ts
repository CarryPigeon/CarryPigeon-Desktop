/**
 * @fileoverview channel rail model
 * @description
 * 收敛 ChannelRail 所需的频道筛选、列表与交互动作，避免布局组件直接依赖 session/governance store。
 */

import { computed, proxyRefs, type ComputedRef, type Ref, type ShallowUnwrapRef, type WritableComputedRef } from "vue";
import { getRoomGovernanceCapabilities, type ApplyJoinChannelOutcome } from "@/features/chat/room-governance/api";
import {
  getRoomSessionCapabilities,
  type ChannelSelectionOutcome,
  type CurrentChannelSessionSnapshot,
  type RoomSessionDirectorySnapshot,
} from "@/features/chat/room-session/api";
import { useObservedCapabilitySnapshot } from "@/shared/utils/useObservedCapabilitySnapshot";

const roomGovernanceCapabilities = getRoomGovernanceCapabilities();
const roomSessionCapabilities = getRoomSessionCapabilities();

type RefLike<T> = Ref<T> | ComputedRef<T>;
type ChannelRailRawModel = {
  socket: ComputedRef<string>;
  serverId: ComputedRef<string>;
  missingRequiredCount: ComputedRef<number>;
  channelSearch: WritableComputedRef<string>;
  channelTab: WritableComputedRef<"joined" | "discover">;
  channels: ComputedRef<RoomSessionDirectorySnapshot["visibleChannels"]>;
  currentChannelId: ComputedRef<CurrentChannelSessionSnapshot["currentChannelId"]>;
  setChannelSearch(value: string): void;
  setChannelTab(value: "joined" | "discover"): void;
  openPlugins(): void;
  openRequiredSetup(): void;
  openCreateChannel(): void;
  openChannelInfo(channelId: string): void;
  selectChannel(channelId: string): Promise<ChannelSelectionOutcome>;
  applyJoin(channelId: string): Promise<ApplyJoinChannelOutcome>;
};
export type ChannelRailModel = ShallowUnwrapRef<ChannelRailRawModel>;

export type UseChannelRailModelDeps = {
  socket: RefLike<string>;
  serverId: RefLike<string>;
  missingRequiredCount: RefLike<number>;
  openPlugins(): void;
  openRequiredSetup(): void;
  openCreateChannel(): void;
  openChannelInfo(channelId: string): void;
};

export function useChannelRailModel(deps: UseChannelRailModelDeps): ChannelRailModel {
  const directory = roomSessionCapabilities.directory;
  const currentSession = roomSessionCapabilities.currentChannel;
  const directorySnapshot = useObservedCapabilitySnapshot(directory);
  const currentSessionSnapshot = useObservedCapabilitySnapshot(currentSession);

  const rawModel: ChannelRailRawModel = {
    socket: computed(() => deps.socket.value),
    serverId: computed(() => deps.serverId.value),
    missingRequiredCount: computed(() => deps.missingRequiredCount.value),
    channelSearch: computed({
      get: () => directorySnapshot.value.searchQuery,
      set: directory.setSearchQuery,
    }),
    channelTab: computed({
      get: () => directorySnapshot.value.activeTab,
      set: directory.setActiveTab,
    }),
    channels: computed(() => directorySnapshot.value.visibleChannels),
    currentChannelId: computed(() => currentSessionSnapshot.value.currentChannelId),
    setChannelSearch(value: string): void {
      directory.setSearchQuery(value);
    },
    setChannelTab(value: "joined" | "discover"): void {
      directory.setActiveTab(value);
    },
    openPlugins: deps.openPlugins,
    openRequiredSetup: deps.openRequiredSetup,
    openCreateChannel: deps.openCreateChannel,
    openChannelInfo: deps.openChannelInfo,
    selectChannel: currentSession.selectChannel,
    applyJoin(channelId: string): Promise<ApplyJoinChannelOutcome> {
      return roomGovernanceCapabilities.forChannel(channelId).applyJoin();
    },
  };
  return proxyRefs(rawModel);
}
