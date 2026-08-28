/**
 * @fileoverview channel-discovery mapper 契约测试。
 */
import { describe, expect, it } from "vitest";
import { mapChannelDiscoverPageWire } from "../data/channelDiscoveryMappers";
import { mapDiscoverItemsToChannelSummaries } from "./mappers";
import type { ChannelDiscoverItem } from "./contracts";

describe("mapChannelDiscoverPageWire", () => {
  it("maps snake_case discover page to domain", () => {
    const page = mapChannelDiscoverPageWire({
      items: [
        {
          cid: "11",
          name: "general",
          brief: "公开讨论区",
          avatar: "avatars/ch/11.png",
          member_count: 42,
          requires_application: true,
        },
      ],
      next_cursor: "opaque-1",
      has_more: true,
    });
    expect(page).toEqual({
      items: [
        {
          channelId: "11",
          name: "general",
          brief: "公开讨论区",
          avatar: "avatars/ch/11.png",
          memberCount: 42,
          requiresApplication: true,
          type: undefined,
        },
      ],
      nextCursor: "opaque-1",
      hasMore: true,
    });
  });

  it("drops rows without cid", () => {
    const page = mapChannelDiscoverPageWire({
      items: [{ cid: "  ", name: "x", member_count: 1, requires_application: false }],
      has_more: false,
    });
    expect(page.items).toEqual([]);
  });
});

describe("mapDiscoverItemsToChannelSummaries", () => {
  const item: ChannelDiscoverItem = {
    channelId: "11",
    name: "general",
    brief: "公开讨论区",
    memberCount: 42,
    requiresApplication: true,
  };

  it("hides already joined channels and marks local join requests", () => {
    const rows = mapDiscoverItemsToChannelSummaries([item], new Set(["11"]), new Set());
    expect(rows).toEqual([]);

    const visible = mapDiscoverItemsToChannelSummaries([item], new Set(), new Set(["11"]));
    expect(visible).toEqual([
      expect.objectContaining({
        id: "11",
        joined: false,
        joinRequested: true,
        memberCount: 42,
      }),
    ]);
  });
});
