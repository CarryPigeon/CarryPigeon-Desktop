import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestJson } = vi.hoisted(() => ({ requestJson: vi.fn() }));
vi.mock("@/shared/net/http/authedHttpJsonClient", () => ({
  createAuthedHttpJsonClient: () => ({ requestJson }),
}));

import { httpChatApiPort } from "./httpChatApiPort";

const socket = "chat.local";
const token = "token";
const mention = { mention_id: "4001", cid: "2001", mid: "3001", from_uid: "2", target: { type: "user", uid: "1" }, created_at: 50, read: false };

beforeEach(() => requestJson.mockReset());

describe("mention endpoints", () => {
  it("uses the channel route and passes the opaque cursor unchanged through query encoding", async () => {
    requestJson.mockResolvedValue({ items: [mention], next_cursor: null, has_more: false });
    const result = await httpChatApiPort.listMentions(socket, token, "+/=", 20, true, "2001");
    expect(requestJson).toHaveBeenCalledWith("GET", "/channels/2001/mentions?cursor=%2B%2F%3D&limit=20&unread_only=true");
    expect(result).toEqual({ items: [expect.objectContaining({ mentionId: "4001", read: false })], nextCursor: undefined, hasMore: false });
  });

  it("fetches single and batch detail without marking them read", async () => {
    requestJson.mockResolvedValueOnce(mention).mockResolvedValueOnce({ items: [mention] });
    await expect(httpChatApiPort.getMention(socket, token, "4001")).resolves.toMatchObject({ mentionId: "4001", read: false });
    await expect(httpChatApiPort.getMentionsByIds(socket, token, ["4001", "4001"])).resolves.toHaveLength(1);
    expect(requestJson).toHaveBeenNthCalledWith(1, "GET", "/mentions/4001");
    expect(requestJson).toHaveBeenNthCalledWith(2, "POST", "/mentions/ids", { mention_ids: ["4001", "4001"] });
  });

  it("marks individual, global, and channel scopes read", async () => {
    requestJson.mockResolvedValue(null);
    await httpChatApiPort.markMentionRead(socket, token, "4001");
    await httpChatApiPort.batchMarkMentionsRead(socket, token);
    await httpChatApiPort.batchMarkMentionsRead(socket, token, "4001", "2001");
    expect(requestJson).toHaveBeenNthCalledWith(1, "PUT", "/mentions/4001/read");
    expect(requestJson).toHaveBeenNthCalledWith(2, "PUT", "/mentions/read", undefined);
    expect(requestJson).toHaveBeenNthCalledWith(3, "PUT", "/channels/2001/mentions/read", { through_mention_id: "4001" });
  });
});

describe("read-state endpoints", () => {
  it("decodes a nullable channel MID and aggregate read counts", async () => {
    requestJson.mockResolvedValueOnce({ cid: "2001", uid: "1", last_read_mid: null, unread_count: 1 })
      .mockResolvedValueOnce({ total: 1, items: [{ cid: "2001", unread_count: 1 }] });
    await expect(httpChatApiPort.getChannelReadState(socket, token, "2001")).resolves.toEqual({ channelId: "2001", userId: "1", lastReadMid: null, unreadCount: 1 });
    await expect(httpChatApiPort.getUnreads(socket, token)).resolves.toEqual([{ channelId: "2001", unreadCount: 1 }]);
    expect(requestJson).toHaveBeenNthCalledWith(1, "GET", "/channels/2001/read_state");
    expect(requestJson).toHaveBeenNthCalledWith(2, "GET", "/unreads");
  });

  it("sends only the MID and preserves the acknowledged server anchor", async () => {
    requestJson.mockResolvedValue({ cid: "2001", uid: "1", last_read_mid: "9007199254740995" });
    await expect(httpChatApiPort.updateReadState(socket, token, "2001", { lastReadMessageId: "9007199254740994" }))
      .resolves.toEqual({ channelId: "2001", userId: "1", lastReadMid: "9007199254740995" });
    expect(requestJson).toHaveBeenCalledWith("PUT", "/channels/2001/read_state", { last_read_mid: "9007199254740994" });
  });
});
