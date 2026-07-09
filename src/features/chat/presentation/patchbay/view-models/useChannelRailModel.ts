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
import { createAsyncTaskRunner } from "@/features/chat/presentation/patchbay/interactions/asyncTaskRunner";
import type { AsyncErrorHandler } from "@/features/chat/presentation/patchbay/interactions/asyncTaskRunner";
import { currentServerSocket } from "@/features/server-connection/api";
import { createLocalStorageDraftStorage } from "@/features/chat/message-flow/draft/data/localStorageDraftStorage";

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
  setChannelSearch(value: string): void;
  setChannelTab(value: "joined" | "discover"): void;
  openPlugins(): void;
  openRequiredSetup(): void;
  openCreateMenu(e: MouseEvent): void;
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
  openCreateMenu(e: MouseEvent): void;
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
};

/**
 * 创建 ChannelRail 页面模型。
 */
export function useChannelRailModel(deps: UseChannelRailModelDeps): ChannelRailModel {
  const directorySnapshot = useObservedCapabilitySnapshot(deps.directory);
  const currentSessionSnapshot = useObservedCapabilitySnapshot(deps.currentSession);
  const runAsyncTask = createAsyncTaskRunner(deps.onAsyncError);
  const draftStorage = createLocalStorageDraftStorage(() => currentServerSocket.value ?? "");

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
    openCreateMenu: deps.openCreateMenu,
    openChannelInfo: deps.openChannelInfo,
    openServerInfo: deps.openServerInfo ?? deps.openServerManager,
    openServerManager: deps.openServerManager,
    openFileManager: deps.openFileManager,
    openSettings: deps.openSettings,
    selectChannel,
    applyJoin: deps.applyJoin,
    hasDraft(channelId: string): boolean {
      if (!channelId) return false;
      return draftStorage.readDraft(channelId) !== null;
    },
    isChannelMuted: deps.isChannelMuted,
  };
  return proxyRefs(rawModel);
}
