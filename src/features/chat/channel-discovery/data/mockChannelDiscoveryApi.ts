/**
 * @fileoverview mockChannelDiscoveryApi.ts
 * @description store mock 下用本地未加入频道充当发现列表，避免打真实 HTTP。
 */

import { getRoomSessionCapabilities } from "@/features/chat/room-session/api";
import type { ChannelDiscoverItem } from "../domain/contracts";
import type { ChannelDiscoveryApiPort } from "../domain/ports";

/**
 * 创建 store-mock 频道发现适配器。
 */
export function createMockChannelDiscoveryApi(): ChannelDiscoveryApiPort {
  return {
    async discoverChannels(_serverSocket, _accessToken, query) {
      const needle = String(query.query ?? "").trim().toLowerCase();
      const type = String(query.type ?? "").trim().toLowerCase();
      const items: ChannelDiscoverItem[] = [];
      for (const channel of getRoomSessionCapabilities().directory.getSnapshot().allChannels) {
        if (channel.joined) continue;
        if (type && String(channel.channelType ?? "").toLowerCase() !== type) continue;
        if (needle && !channel.name.toLowerCase().includes(needle) && !channel.id.toLowerCase().includes(needle)) {
          continue;
        }
        items.push({
          channelId: channel.id,
          name: channel.name,
          brief: channel.brief,
          memberCount: 0,
          requiresApplication: true,
          type: channel.channelType,
        });
      }
      return { items, hasMore: false };
    },
  };
}
