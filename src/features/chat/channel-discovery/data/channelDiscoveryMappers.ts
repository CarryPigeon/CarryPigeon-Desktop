/**
 * @fileoverview channel-discovery wire → 领域映射。
 */

import { asOptionalString, asSafeBoolean, asSafeNumber, asTrimmedString } from "@/shared/data/wireMapperUtils";
import type { ChannelDiscoverItem, ChannelDiscoverPage } from "../domain/contracts";
import type { ChannelDiscoverItemWire, ChannelDiscoverPageWire } from "./channelDiscoveryWire";

/**
 * 将发现列表项 wire 映射为领域模型。
 */
export function mapChannelDiscoverItemWire(wire: ChannelDiscoverItemWire | null | undefined): ChannelDiscoverItem | null {
  if (!wire) return null;
  const channelId = asTrimmedString(wire.cid);
  if (!channelId) return null;
  return {
    channelId,
    name: asTrimmedString(wire.name) || channelId,
    brief: asOptionalString(wire.brief),
    avatar: asOptionalString(wire.avatar),
    memberCount: Math.max(0, asSafeNumber(wire.member_count)),
    requiresApplication: asSafeBoolean(wire.requires_application),
    type: asOptionalString(wire.type),
  };
}

/**
 * 将发现分页 wire 映射为领域分页。
 */
export function mapChannelDiscoverPageWire(wire: ChannelDiscoverPageWire | null | undefined): ChannelDiscoverPage {
  const items: ChannelDiscoverItem[] = [];
  for (const row of wire?.items ?? []) {
    const item = mapChannelDiscoverItemWire(row);
    if (item) items.push(item);
  }
  return {
    items,
    nextCursor: asOptionalString(wire?.next_cursor),
    hasMore: asSafeBoolean(wire?.has_more),
  };
}
