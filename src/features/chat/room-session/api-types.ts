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

export type RoomSessionDirectorySnapshot = {
  allChannels: readonly ChatChannel[];
  visibleChannels: readonly ChatChannel[];
  searchQuery: string;
  activeTab: "joined" | "discover";
};

export type RoomSessionDirectoryCapabilities = ReadableCapability<RoomSessionDirectorySnapshot> & {
  setSearchQuery(value: string): void;
  setActiveTab(value: "joined" | "discover"): void;
  focusDiscoverChannel(channelName: string): void;
  findChannelById(channelId: string): ChatChannel | null;
};

export type CurrentChannelSessionSnapshot = {
  currentChannelId: string;
  lastReadMessageId: string;
  lastReadTimeMs: number;
};

export type CurrentChannelSessionCapabilities = ReadableCapability<CurrentChannelSessionSnapshot> & {
  ensureReady(): Promise<void>;
  selectChannel(channelId: string): Promise<ChannelSelectionOutcome>;
  reportReadState(): Promise<void>;
};

export type RoomSessionCapabilities = {
  directory: RoomSessionDirectoryCapabilities;
  currentChannel: CurrentChannelSessionCapabilities;
};
