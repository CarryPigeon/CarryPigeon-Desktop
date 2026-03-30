/**
 * @fileoverview channel rail model
 * @description
 * 收敛 ChannelRail 所需的频道筛选、列表与交互动作，避免布局组件直接依赖 session/governance store。
 */

import { computed, proxyRefs, type ComputedRef, type Ref, type ShallowUnwrapRef, type WritableComputedRef } from "vue";
import type { ApplyJoinChannelOutcome } from "@/features/chat/room-governance/api-types";
import type {
  ChannelSelectionOutcome,
  CurrentChannelSessionCapabilities,
  CurrentChannelSessionSnapshot,
  RoomSessionDirectoryCapabilities,
  RoomSessionDirectorySnapshot,
} from "@/features/chat/room-session/api-types";
import { useObservedCapabilitySnapshot } from "@/shared/utils/useObservedCapabilitySnapshot";

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
/**
 * ChannelRail 组件消费的页面模型。
 */
export type ChannelRailModel = ShallowUnwrapRef<ChannelRailRawModel>;

/**
 * ChannelRail 页面模型依赖。
 */
export type UseChannelRailModelDeps = {
  directory: RoomSessionDirectoryCapabilities;
  currentSession: CurrentChannelSessionCapabilities;
  socket: RefLike<string>;
  serverId: RefLike<string>;
  missingRequiredCount: RefLike<number>;
  openPlugins(): void;
  openRequiredSetup(): void;
  openCreateChannel(): void;
  openChannelInfo(channelId: string): void;
  applyJoin(channelId: string): Promise<ApplyJoinChannelOutcome>;
};

/**
 * 创建 ChannelRail 页面模型。
 */
export function useChannelRailModel(deps: UseChannelRailModelDeps): ChannelRailModel {
  const directorySnapshot = useObservedCapabilitySnapshot(deps.directory);
  const currentSessionSnapshot = useObservedCapabilitySnapshot(deps.currentSession);

  const rawModel: ChannelRailRawModel = {
    socket: computed(() => deps.socket.value),
    serverId: computed(() => deps.serverId.value),
    missingRequiredCount: computed(() => deps.missingRequiredCount.value),
    channelSearch: computed({
      get: () => directorySnapshot.value.searchQuery,
      set: deps.directory.setSearchQuery,
    }),
    channelTab: computed({
      get: () => directorySnapshot.value.activeTab,
      set: deps.directory.setActiveTab,
    }),
    channels: computed(() => directorySnapshot.value.visibleChannels),
    currentChannelId: computed(() => currentSessionSnapshot.value.currentChannelId),
    setChannelSearch(value: string): void {
      deps.directory.setSearchQuery(value);
    },
    setChannelTab(value: "joined" | "discover"): void {
      deps.directory.setActiveTab(value);
    },
    openPlugins: deps.openPlugins,
    openRequiredSetup: deps.openRequiredSetup,
    openCreateChannel: deps.openCreateChannel,
    openChannelInfo: deps.openChannelInfo,
    selectChannel: deps.currentSession.selectChannel,
    applyJoin: deps.applyJoin,
  };
  return proxyRefs(rawModel);
}
