/**
 * @fileoverview channel-discovery api contract
 * @description 频道发现｜API 类型定义。
 */

import type { ChannelDiscoverPageWire, ChannelDiscoverQueryWire } from "./api-types";

export type ChatChannelDiscoveryApi = {
  discoverChannels(serverSocket: string, accessToken: string, query: ChannelDiscoverQueryWire): Promise<ChannelDiscoverPageWire>;
};
