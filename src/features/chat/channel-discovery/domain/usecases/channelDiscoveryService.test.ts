/**
 * @fileoverview 频道发现 application service 契约测试。
 */
import { describe, expect, it, vi } from "vitest";
import type { ChannelDiscoverPage } from "../contracts";
import { ChannelDiscoveryApplicationService } from "./channelDiscoveryService";

function createHarness() {
  let query = "";
  let items: ChannelDiscoverPage["items"] = [];
  let nextCursor: string | undefined;
  let hasMore = false;
  let loading = false;
  let error = "";
  const joinRequestedIds: string[] = [];
  const api = {
    discoverChannels: vi.fn(async (): Promise<ChannelDiscoverPage> => ({
      items: [{ channelId: "11", name: "general", memberCount: 3, requiresApplication: true }],
      nextCursor: "c2",
      hasMore: true,
    })),
  };
  const service = new ChannelDiscoveryApplicationService({
    api,
    scope: {
      getSocketAndValidToken: async () => ["sock", "token"] as [string, string],
    },
    state: {
      readQuery: () => query,
      writeQuery: (value) => {
        query = value;
      },
      replacePage: (page) => {
        items = [...page.items];
        nextCursor = page.nextCursor;
        hasMore = Boolean(page.hasMore);
      },
      appendPage: (page) => {
        items = [...items, ...page.items];
        nextCursor = page.nextCursor;
        hasMore = Boolean(page.hasMore);
      },
      setLoading: (value) => {
        loading = value;
      },
      setError: (value) => {
        error = value;
      },
      markJoinRequested: (channelId) => {
        if (!joinRequestedIds.includes(channelId)) joinRequestedIds.push(channelId);
      },
      readNextCursor: () => nextCursor,
      readHasMore: () => hasMore,
      readLoading: () => loading,
    },
  });
  return { service, api, snapshot: () => ({ query, items, nextCursor, hasMore, loading, error, joinRequestedIds }) };
}

describe("ChannelDiscoveryApplicationService", () => {
  it("search_forwardsDomainQuery_andReplacesPage", async () => {
    const { service, api, snapshot } = createHarness();
    await service.search("  gen  ");
    expect(api.discoverChannels).toHaveBeenCalledWith("sock", "token", { query: "gen", limit: 20 });
    expect(snapshot().items[0]?.channelId).toBe("11");
    expect(snapshot().query).toBe("gen");
    expect(snapshot().loading).toBe(false);
  });

  it("loadMore_appendsWhenCursorExists", async () => {
    const { service, api } = createHarness();
    await service.search("");
    api.discoverChannels.mockResolvedValueOnce({
      items: [{ channelId: "12", name: "ops", memberCount: 1, requiresApplication: false }],
      hasMore: false,
    });
    await service.loadMore();
    expect(api.discoverChannels).toHaveBeenLastCalledWith("sock", "token", { query: "", cursor: "c2", limit: 20 });
  });

  it("markJoinRequested_recordsLocalId", async () => {
    const { service, snapshot } = createHarness();
    service.markJoinRequested("11");
    expect(snapshot().joinRequestedIds).toEqual(["11"]);
  });
});
