import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestJson } = vi.hoisted(() => ({ requestJson: vi.fn() }));
vi.mock("@/shared/net/http/authedHttpJsonClient", () => ({
  createAuthedHttpJsonClient: () => ({ requestJson }),
}));

import { httpChatApiPort as api } from "./httpChatApiPort";

const scope = ["localhost:18080", "token"] as const;
const channel = { cid: "2001", name: "General", brief: "", system_channel: true, created_at: 1700000000000 };
const application = { application_id: "5001", cid: "2001", uid: "1002", reason: "project", apply_time: 1700000000000, status: "pending" };
const ban = { cid: "2001", uid: "1002", until: 1893456000000, reason: "Spam", create_time: 1700000000000 };

function page<T>(items: T[], index = 1, more = false) {
  return { items, page: index, page_size: 50, total: more ? 2 : items.length, has_more: more };
}

beforeEach(() => requestJson.mockReset());

describe("channel governance HTTP contracts", () => {
  it("continues the joined-channel list through the last page", async () => {
    requestJson.mockResolvedValueOnce(page([channel], 1, true))
      .mockResolvedValueOnce(page([{ ...channel, cid: "2002" }], 2));
    const channels = await api.listChannels(...scope);
    expect(channels.map((item) => item.id)).toEqual(["2001", "2002"]);
    expect(channels[0]).toMatchObject({ systemChannel: true, createdAt: channel.created_at });
    expect(requestJson.mock.calls).toEqual([
      ["GET", "/channels?page=1&page_size=50"],
      ["GET", "/channels?page=2&page_size=50"],
    ]);
  });

  it("creates and patches with documented fields and refreshes detail after null", async () => {
    requestJson.mockResolvedValueOnce(channel).mockResolvedValueOnce(null).mockResolvedValueOnce(channel);
    await api.createChannel(...scope, { name: "General", avatar: "old-avatar" });
    await api.patchChannel(...scope, "2001", { name: "General", brief: "Project" });
    expect(requestJson.mock.calls).toEqual([
      ["POST", "/channels", { name: "General", brief: "" }],
      ["PATCH", "/channels/2001", { name: "General", brief: "Project" }],
      ["GET", "/channels/2001"],
    ]);
  });

  it("supports batch lookup, ownership transfer, quit and personal applications", async () => {
    requestJson.mockResolvedValueOnce({ items: [channel], total: 2 })
      .mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(page([application]));
    expect(await api.batchGetChannels(...scope, ["2001", "9007199254740993"])).toMatchObject({
      total: 2, items: [{ id: "2001" }],
    });
    await api.transferChannel(...scope, "2001", "1002");
    await api.quitChannel(...scope, "2001");
    expect(await api.listMyChannelApplications(...scope)).toMatchObject([{ applicationId: "5001", status: "pending" }]);
    expect(requestJson.mock.calls).toEqual([
      ["POST", "/channels/list", ["2001", "9007199254740993"]],
      ["PUT", "/channels/2001/transfer", { new_owner: "1002" }],
      ["POST", "/channels/2001/quit"],
      ["GET", "/channels/applications?page=1&page_size=50"],
    ]);
  });

  it("maps new application, member and ban objects", async () => {
    requestJson.mockResolvedValueOnce(application)
      .mockResolvedValueOnce({ ...application, status: "accepted" })
      .mockResolvedValueOnce(page([{ uid: "1002", username: "Alice", role: "member", join_time: 1700000000000 }]))
      .mockResolvedValueOnce(ban).mockResolvedValueOnce(page([ban]));
    expect(await api.applyJoinChannel(...scope, "2001", "project")).toMatchObject({ applicationId: "5001", status: "pending" });
    expect(await api.decideChannelApplication(...scope, "2001", "5001", "approve")).toMatchObject({ status: "accepted" });
    expect(await api.listChannelMembers(...scope, "2001")).toMatchObject([{ nickname: "Alice", userId: "1002" }]);
    expect(await api.putChannelBan(...scope, "2001", "1002", ban.until, ban.reason)).toMatchObject({ until: ban.until });
    expect(await api.listChannelBans(...scope, "2001")).toMatchObject([{ userId: "1002", until: ban.until, createTime: ban.create_time }]);
  });
});
