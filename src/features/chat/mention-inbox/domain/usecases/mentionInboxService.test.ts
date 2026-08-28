/**
 * @fileoverview 提及收件箱 application service 契约测试。
 */
import { describe, expect, it, vi } from "vitest";
import type { MentionInboxItem } from "../contracts";
import { MentionInboxApplicationService } from "./mentionInboxService";

function item(partial: Partial<MentionInboxItem> & Pick<MentionInboxItem, "mentionId">): MentionInboxItem {
  return {
    mentionId: partial.mentionId,
    channelId: partial.channelId ?? "c1",
    messageId: partial.messageId ?? "m1",
    fromUserId: partial.fromUserId ?? "u2",
    target: partial.target ?? { type: "user", uid: "u1" },
    createdAt: partial.createdAt ?? 1,
    read: partial.read ?? false,
  };
}

function createHarness() {
  const items: MentionInboxItem[] = [item({ mentionId: "n1" })];
  let unreadCount = 1;
  let nextCursor: string | undefined = "c2";
  let hasMore = true;
  let unreadOnly = false;
  let channelId = "";
  let loading = false;
  const api = {
    listMentions: vi.fn(async (_s: string, _t: string, query: { unreadOnly?: boolean; cursor?: string; channelId?: string }) => {
      if (query.unreadOnly) return { items: [item({ mentionId: "n1" })], hasMore: false };
      return { items: [...items], nextCursor, hasMore };
    }),
    markMentionRead: vi.fn(async () => undefined),
    batchMarkMentionsRead: vi.fn(async () => undefined),
  };
  const navigation = { selectChannel: vi.fn(async () => undefined) };
  const service = new MentionInboxApplicationService({
    api,
    scope: { getSocketAndValidToken: async () => ["sock", "tok"] as [string, string] },
    state: {
      replaceItems: (next, cursor, more) => {
        items.length = 0;
        items.push(...next);
        nextCursor = cursor;
        hasMore = Boolean(more);
      },
      appendItems: (next, cursor, more) => {
        items.push(...next);
        nextCursor = cursor;
        hasMore = Boolean(more);
      },
      setUnreadCount: (count) => {
        unreadCount = count;
      },
      setLoading: (value) => {
        loading = value;
      },
      setError: vi.fn(),
      setUnreadOnly: (value) => {
        unreadOnly = value;
      },
      setChannelId: (value) => {
        channelId = value;
      },
      markLocalRead: (mentionId) => {
        const found = items.find((row) => row.mentionId === mentionId);
        if (found) found.read = true;
      },
      markAllLocalRead: () => {
        for (const row of items) row.read = true;
      },
      findItem: (mentionId) => items.find((row) => row.mentionId === mentionId) ?? null,
      readNextCursor: () => nextCursor,
      readHasMore: () => hasMore,
      readLoading: () => loading,
      readUnreadOnly: () => unreadOnly,
      readChannelId: () => channelId,
    },
    navigation,
  });
  return { service, api, navigation, snapshot: () => ({ items, unreadCount, unreadOnly, channelId, hasMore }) };
}

describe("MentionInboxApplicationService", () => {
  it("refresh_loadsInboxAndUnreadCount", async () => {
    const { service, api, snapshot } = createHarness();
    await service.refresh();
    expect(api.listMentions).toHaveBeenCalledTimes(2);
    expect(snapshot().unreadCount).toBe(1);
  });

  it("setUnreadOnly_requestsUnreadQuery", async () => {
    const { service, api, snapshot } = createHarness();
    await service.setUnreadOnly(true);
    expect(snapshot().unreadOnly).toBe(true);
    expect(api.listMentions).toHaveBeenCalledWith("sock", "tok", expect.objectContaining({ unreadOnly: true, limit: 50 }));
  });

  it("loadMore_appendsWhenCursorExists", async () => {
    const { service, api } = createHarness();
    await service.refresh();
    api.listMentions.mockClear();
    await service.loadMore();
    expect(api.listMentions).toHaveBeenCalledWith(
      "sock",
      "tok",
      expect.objectContaining({ cursor: "c2", limit: 50 }),
    );
  });

  it("openMention_marksReadAndSelectsChannelWithoutAroundMid", async () => {
    const { service, api, navigation } = createHarness();
    await service.openMention("n1");
    expect(api.markMentionRead).toHaveBeenCalledWith("sock", "tok", "n1");
    expect(navigation.selectChannel).toHaveBeenCalledWith("c1");
    expect(api.listMentions.mock.calls.every((call) => !JSON.stringify(call).includes("around"))).toBe(true);
  });

  it("markAllRead_callsBatchEndpoint", async () => {
    const { service, api } = createHarness();
    await service.markAllRead();
    expect(api.batchMarkMentionsRead).toHaveBeenCalledWith("sock", "tok");
  });
});
