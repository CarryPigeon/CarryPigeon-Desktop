/**
 * @fileoverview chat/channel-discovery 对外 API。
 * @description
 * 暴露频道发现查询能力。不导出 wire DTO。
 */

import type { ChannelDiscoveryCapabilities } from "./api-types";
import { createChannelDiscoveryCapabilitySource } from "./capability-source";

export type {
  ChannelDiscoverItem,
  ChannelDiscoverPage,
  ChannelDiscoverQuery,
  ChannelDiscoveryCapabilities,
  ChannelDiscoverySnapshot,
} from "./api-types";

/**
 * 创建频道发现 capability。
 */
export function createChannelDiscoveryCapabilities(): ChannelDiscoveryCapabilities {
  return createChannelDiscoveryCapabilitySource();
}

let channelDiscoveryCapabilitiesSingleton: ChannelDiscoveryCapabilities | null = null;

/**
 * 获取频道发现共享 capability。
 */
export function getChannelDiscoveryCapabilities(): ChannelDiscoveryCapabilities {
  channelDiscoveryCapabilitiesSingleton ??= createChannelDiscoveryCapabilities();
  return channelDiscoveryCapabilitiesSingleton;
}
