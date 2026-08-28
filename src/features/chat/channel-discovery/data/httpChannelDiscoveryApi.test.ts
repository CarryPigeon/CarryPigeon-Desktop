/**
 * @fileoverview httpChannelDiscoveryApi 契约测试。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestJson = vi.fn();

vi.mock("@/shared/net/http/authedHttpJsonClient", () => ({
  createAuthedHttpJsonClient: () => ({ requestJson }),
}));

import { createHttpChannelDiscoveryApi } from "./httpChannelDiscoveryApi";

describe("createHttpChannelDiscoveryApi", () => {
  beforeEach(() => {
    requestJson.mockReset();
  });

  it("maps domain query to q and returns domain page", async () => {
    requestJson.mockResolvedValueOnce({
      items: [{ cid: "11", name: "general", member_count: 2, requires_application: false }],
      next_cursor: "n1",
      has_more: false,
    });
    const api = createHttpChannelDiscoveryApi();
    const page = await api.discoverChannels("127.0.0.1:8080", "tok", { query: "gen", limit: 20, type: "public" });
    expect(requestJson).toHaveBeenCalledWith("GET", "/channels/discover?q=gen&limit=20&type=public");
    expect(page.items[0]).toEqual(
      expect.objectContaining({ channelId: "11", name: "general", memberCount: 2, requiresApplication: false }),
    );
  });
});
