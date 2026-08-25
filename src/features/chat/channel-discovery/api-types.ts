/**
 * @fileoverview channel-discovery 公共类型入口。
 * @description 只导出领域语义与 capability 契约，不导出 wire。
 */

import type { ReadableCapability } from "@/shared/types/capabilities";
import type { ChannelDiscoverItem, ChannelDiscoverPage, ChannelDiscoverQuery } from "./domain/contracts";

export type { ChannelDiscoverItem, ChannelDiscoverPage, ChannelDiscoverQuery };

/**
 * 频道发现快照。
 */
export type ChannelDiscoverySnapshot = {
  query: string;
  type: string;
  items: readonly ChannelDiscoverItem[];
  nextCursor?: string;
  hasMore: boolean;
  loading: boolean;
  error: string;
  joinRequestedIds: readonly string[];
};

/**
 * 频道发现 capability。
 */
export type ChannelDiscoveryCapabilities = ReadableCapability<ChannelDiscoverySnapshot> & {
  search(query?: string): Promise<void>;
  setType(type?: string): Promise<void>;
  loadMore(): Promise<void>;
  markJoinRequested(channelId: string): void;
};
