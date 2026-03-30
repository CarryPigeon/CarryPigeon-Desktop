/**
 * @fileoverview chat/room-session 公共类型入口。
 * @description
 * 统一承载 room-session 子域的稳定公共契约，避免页面层和聚合层深依赖领域路径。
 */

import type { ReadableCapability } from "@/shared/types/capabilities";
import type { ChannelSelectionOutcome, ChatChannel } from "./domain/contracts";

export type {
  ChannelSelectionErrorInfo,
  ChannelSelectionOutcome,
  ChatChannel,
} from "./domain/contracts";

/**
 * 频道目录快照。
 */
export type RoomSessionDirectorySnapshot = {
  allChannels: readonly ChatChannel[];
  visibleChannels: readonly ChatChannel[];
  searchQuery: string;
  activeTab: "joined" | "discover";
};

/**
 * 频道目录 capability。
 *
 * 职责：
 * - 暴露目录查询；
 * - 暴露筛选、标签切换与 discover 聚焦一类本地交互命令。
 */
export type RoomSessionDirectoryCapabilities = ReadableCapability<RoomSessionDirectorySnapshot> & {
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
 * 当前频道会话 capability。
 *
 * 它收敛“当前频道”上下文下最核心的生命周期动作：
 * 就绪、切换、已读上报。
 */
export type CurrentChannelSessionCapabilities = ReadableCapability<CurrentChannelSessionSnapshot> & {
  ensureReady(): Promise<void>;
  selectChannel(channelId: string): Promise<ChannelSelectionOutcome>;
  reportReadState(): Promise<void>;
};

/**
 * room-session 子域对外 capability 聚合。
 */
export type RoomSessionCapabilities = {
  directory: RoomSessionDirectoryCapabilities;
  currentChannel: CurrentChannelSessionCapabilities;
};
