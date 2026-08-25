/**
 * @fileoverview channel rail model
 * @description
 * 收敛 ChannelRail 所需的频道筛选、列表与交互动作，避免布局组件直接依赖 session/governance store。
 */

import { computed, onScopeDispose, proxyRefs, watch, type ComputedRef, type Ref, type ShallowUnwrapRef, type WritableComputedRef } from "vue";
import type { ApplyJoinChannelOutcome } from "@/features/chat/room-governance/api-types";
import type {
  ChannelSelectionOutcome,
  CurrentChannelSessionCapabilities,
  CurrentChannelSessionSnapshot,
  RoomSessionDirectoryCapabilities,
  RoomSessionDirectorySnapshot,
} from "@/features/chat/room-session/api-types";
import { useObservedCapabilitySnapshot } from "@/shared/utils/useObservedCapabilitySnapshot";
import { createAsyncTaskRunner } from "@/features/chat/presentation/patchbay/interactions/asyncTaskRunner";
import type { AsyncErrorHandler } from "@/features/chat/presentation/patchbay/interactions/asyncTaskRunner";
import { currentServerSocket } from "@/features/server-connection/api";
import { createLocalStorageDraftStorage } from "@/features/chat/message-flow/draft/data/localStorageDraftStorage";
import { getChannelDiscoveryCapabilities } from "@/features/chat/channel-discovery/api";
import type { ChannelDiscoveryCapabilities } from "@/features/chat/channel-discovery/api-types";
import { mapDiscoverItemsToChannelSummaries } from "@/features/chat/channel-discovery/domain/mappers";
import { debounce } from "@/shared/utils/rateLimit";

type RefLike<T> = Ref<T> | ComputedRef<T>;

type ServerInfoView = { name: string; brief: string; avatar?: string };

type ChannelRailRawModel = {
  socket: ComputedRef<string>;
  serverId: ComputedRef<string>;
  serverInfo: ComputedRef<ServerInfoView | null>;
  missingRequiredCount: ComputedRef<number>;
  channelSearch: WritableComputedRef<string>;
  channelTab: WritableComputedRef<"joined" | "discover">;
  channels: ComputedRef<RoomSessionDirectorySnapshot["visibleChannels"]>;
  currentChannelId: ComputedRef<CurrentChannelSessionSnapshot["currentChannelId"]>;
  discoverLoading: ComputedRef<boolean>;
  discoverError: ComputedRef<string>;
  discoverHasMore: ComputedRef<boolean>;
  discoverType: ComputedRef<string>;
  setChannelSearch(value: string): void;
  setChannelTab(value: "joined" | "discover"): void;
  setDiscoverType(value: string): Promise<void>;
  loadMoreDiscover(): Promise<void>;
  openPlugins(): void;
  openRequiredSetup(): void;
  openCreateMenu(): void;
  openChannelInfo(channelId: string): void;
  openServerInfo(): void;
  openServerManager(): void;
  openFileManager(): void;
  openSettings(): void;
  selectChannel(channelId: string): Promise<ChannelSelectionOutcome>;
  applyJoin(channelId: string): Promise<ApplyJoinChannelOutcome>;
  hasDraft(channelId: string): boolean;
  isChannelMuted(channelId: string): boolean;
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
  serverInfo: RefLike<ServerInfoView | null>;
  missingRequiredCount: RefLike<number>;
  openPlugins(): void;
  openRequiredSetup(): void;
  openCreateMenu(): void;
  openChannelInfo(channelId: string): void;
  openServerInfo?(): void;
  openServerManager(): void;
  openFileManager(): void;
  openSettings(): void;
  applyJoin(channelId: string): Promise<ApplyJoinChannelOutcome>;
  onAsyncError: AsyncErrorHandler;
  /** 频道静音状态查询 */
  isChannelMuted(channelId: string): boolean;
  /** 切换频道静音 */
  toggleChannelMute(channelId: string): Promise<void>;
  /** 打开频道右键菜单 */
  openChannelContextMenu(e: MouseEvent, channelId: string): void;
  /** 频道发现 capability；缺省时使用子域单例。 */
  discovery?: ChannelDiscoveryCapabilities;
};

/**
 * 创建 ChannelRail 页面模型。
 */
export function useChannelRailModel(deps: UseChannelRailModelDeps): ChannelRailModel {
  const directorySnapshot = useObservedCapabilitySnapshot(deps.directory);
  const currentSessionSnapshot = useObservedCapabilitySnapshot(deps.currentSession);
  const discovery = deps.discovery ?? getChannelDiscoveryCapabilities();
  const discoverySnapshot = useObservedCapabilitySnapshot(discovery);
  const runAsyncTask = createAsyncTaskRunner(deps.onAsyncError);
  const draftStorage = createLocalStorageDraftStorage(() => currentServerSocket.value ?? "");

  const searchDiscover = debounce((query: string) => {
    void discovery.search(query);
  }, 300);

  onScopeDispose(() => {
    searchDiscover.cancel();
  });

  watch(
    () => [directorySnapshot.value.activeTab, directorySnapshot.value.searchQuery] as const,
    ([tab, query], previous) => {
      if (tab !== "discover") {
        searchDiscover.cancel();
        return;
      }
      const previousTab = previous?.[0];
      const previousQuery = previous?.[1];
      if (tab !== previousTab) {
        searchDiscover.cancel();
        void discovery.search(query);
        return;
      }
      if (query !== previousQuery) searchDiscover(query);
    },
    { immediate: true },
  );

  /**
   * 从左侧频道栏点击切换频道。
   *
   * 错误处理说明：
   * 1. 通过 runAsyncTask 兜底捕获异步异常
   * 2. 业务层面主动检查返回结果的 ok 标记
   * 3. 如果业务失败（ok = false），显式调用 onAsyncError 上报错误
   * 4. 不会静默吞掉业务失败，保证错误能够被日志记录并展示给用户
   */
  function selectChannel(channelId: string): Promise<ChannelSelectionOutcome> {
    const promise = deps.currentSession.selectChannel(channelId);
    runAsyncTask(
      promise.then((outcome) => {
        // 业务层面检查结果，如果失败主动上报，不静默吞错
        if (!outcome.ok) {
          deps.onAsyncError("chat_select_channel_from_rail_failed", outcome.error.message);
        }
        return outcome;
      }),
      "chat_select_channel_from_rail_failed",
    );
    return promise;
  }

  function applyJoin(channelId: string): Promise<ApplyJoinChannelOutcome> {
    const promise = deps.applyJoin(channelId);
    runAsyncTask(
      promise.then((outcome) => {
        if (outcome.ok) discovery.markJoinRequested(channelId);
        return outcome;
      }),
      "chat_apply_join_from_rail_failed",
    );
    return promise;
  }

  const rawModel: ChannelRailRawModel = {
    socket: computed(() => deps.socket.value),
    serverId: computed(() => deps.serverId.value),
    serverInfo: computed(() => deps.serverInfo.value),
    missingRequiredCount: computed(() => deps.missingRequiredCount.value),
    channelSearch: computed({
      get: () => directorySnapshot.value.searchQuery,
      set: deps.directory.setSearchQuery,
    }),
    channelTab: computed({
      get: () => directorySnapshot.value.activeTab,
      set: deps.directory.setActiveTab,
    }),
    channels: computed(() => {
      if (directorySnapshot.value.activeTab !== "discover") {
        return directorySnapshot.value.visibleChannels;
      }
      const joinedIds = new Set(directorySnapshot.value.allChannels.map((channel) => channel.id));
      return mapDiscoverItemsToChannelSummaries(
        discoverySnapshot.value.items,
        joinedIds,
        new Set(discoverySnapshot.value.joinRequestedIds),
      );
    }),
    currentChannelId: computed(() => currentSessionSnapshot.value.currentChannelId),
    discoverLoading: computed(() => discoverySnapshot.value.loading),
    discoverError: computed(() => discoverySnapshot.value.error),
    discoverHasMore: computed(() => discoverySnapshot.value.hasMore),
    discoverType: computed(() => discoverySnapshot.value.type),
    setChannelSearch(value: string): void {
      deps.directory.setSearchQuery(value);
    },
    setChannelTab(value: "joined" | "discover"): void {
      deps.directory.setActiveTab(value);
    },
    async setDiscoverType(value: string): Promise<void> {
      await discovery.setType(value);
    },
    async loadMoreDiscover(): Promise<void> {
      await discovery.loadMore();
    },
    openPlugins: deps.openPlugins,
    openRequiredSetup: deps.openRequiredSetup,
    openCreateMenu: deps.openCreateMenu,
    openChannelInfo: deps.openChannelInfo,
    openServerInfo: deps.openServerInfo ?? deps.openServerManager,
    openServerManager: deps.openServerManager,
    openFileManager: deps.openFileManager,
    openSettings: deps.openSettings,
    selectChannel,
    applyJoin,
    hasDraft(channelId: string): boolean {
      if (!channelId) return false;
      return draftStorage.readDraft(channelId) !== null;
    },
    isChannelMuted: deps.isChannelMuted,
  };
  return proxyRefs(rawModel);
}
