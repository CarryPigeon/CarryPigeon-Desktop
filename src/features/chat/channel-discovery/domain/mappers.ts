/**
 * @fileoverview channel-discovery 领域映射。
 * @description 发现项 → 频道栏摘要；不含 wire。
 */

import type { ChannelSummary } from "@/features/chat/shared-kernel/channelSummary";
import type { ChannelDiscoverItem } from "./contracts";

/**
 * 将发现项转为频道栏可渲染摘要，并去掉已加入频道。
 */
export function mapDiscoverItemsToChannelSummaries(
  items: readonly ChannelDiscoverItem[],
  joinedChannelIds: ReadonlySet<string>,
  joinRequestedIds: ReadonlySet<string>,
): ChannelSummary[] {
  const next: ChannelSummary[] = [];
  for (const item of items) {
    if (joinedChannelIds.has(item.channelId)) continue;
    next.push({
      id: item.channelId,
      name: item.name,
      brief: item.brief ?? "",
      unread: 0,
      joined: false,
      joinRequested: joinRequestedIds.has(item.channelId),
      channelType: item.type,
      memberCount: item.memberCount,
    });
  }
  return next;
}
