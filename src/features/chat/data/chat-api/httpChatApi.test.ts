/**
 * @fileoverview httpChatApi 适配层测试。
 * @description 对齐服务端既有契约：PATCH 频道 204 后补拉详情；发送消息把幂等键写入 body `client_message_id`。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const requestJson = vi.fn();
const requestJsonWithHeaders = vi.fn();

vi.mock("@/shared/net/http/authedHttpJsonClient", () => ({
  createAuthedHttpJsonClient: () => ({
    requestJson,
    requestJsonWithHeaders,
  }),
}));

import {
  httpGetMessage, httpGetMessagesByIds, httpListChannelMessages, httpListChannelMessagesAfter,
  httpListChannelMessagesAround, httpPatchChannel, httpRecallMessage, httpSendChannelMessage,
} from "./httpChatApi";
import { httpChatApiPort } from "./httpChatApiPort";

describe("httpPatchChannel", () => {
  beforeEach(() => {
    requestJson.mockReset();
  });

  it("should GET channel after 204 empty PATCH body", async () => {
    requestJson
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ cid: "c1", name: "room", brief: "hi", avatar: "" });

    const result = await httpPatchChannel("127.0.0.1:8080", "tok", "c1", { name: "room", brief: "hi" });

    expect(result).toEqual({ cid: "c1", name: "room", brief: "hi", avatar: "" });
    expect(requestJson).toHaveBeenNthCalledWith(1, "PATCH", "/channels/c1", { name: "room", brief: "hi" });
    expect(requestJson).toHaveBeenNthCalledWith(2, "GET", "/channels/c1");
  });

  it("should return PATCH JSON when server includes cid", async () => {
    requestJson.mockResolvedValueOnce({ cid: "c1", name: "kept" });

    const result = await httpPatchChannel("127.0.0.1:8080", "tok", "c1", { name: "kept" });

    expect(result.name).toBe("kept");
    expect(requestJson).toHaveBeenCalledTimes(1);
  });
});

describe("消息引用预览", () => {
  beforeEach(() => requestJson.mockReset());

  const scope = ["127.0.0.1:18080", "token", "2001"] as const;
  const original = { mid: "9007199254740993", cid: "2001", uid: "1001", domain: "Core:Text:V1", data: { content: "Original" }, preview: "Original", send_time: 10 };
  const reply = { ...original, mid: "9007199254740994", data: { content: "Reply", reply_to_mid: original.mid } };
  const forward = { ...original, mid: "9007199254740995", domain: "Core:Forward:V1", data: { source_channel_id: original.cid, message_ids: [original.mid] } };

  it("批量补查引用，回复和转发共用同一个详情请求", async () => {
    requestJson.mockResolvedValueOnce({ items: [forward, reply], next_cursor: null, has_more: false })
      .mockResolvedValueOnce({ total: 1, items: [original] });
    const { items } = await httpChatApiPort.listChannelMessages(...scope);
    expect(requestJson).toHaveBeenNthCalledWith(2, "POST", "/channels/messages/ids", { message_ids: [original.mid] });
    expect(items[0].forwardedMessages).toEqual([{ messageId: original.mid, channelId: original.cid, userId: original.uid, preview: "Original", sentTime: 10 }]);
    expect(items[1].replyTo).toMatchObject({ messageId: original.mid, preview: "Original" });
  });

  it("锚点上下文保留响应顺序，并解析窗口内的回复引用", async () => {
    requestJson.mockResolvedValueOnce({ items: [reply, original] });

    const context = await httpChatApiPort.listChannelMessagesAround(...scope, original.mid);
    expect(requestJson).toHaveBeenCalledExactlyOnceWith("GET",
      `/channels/2001/messages/around?anchor_mid=${original.mid}&before=25&after=25`);
    expect(context).toEqual({
      items: [
        expect.objectContaining({ id: reply.mid, replyTo: expect.objectContaining({ messageId: original.mid }) }),
        expect.objectContaining({ id: original.mid }),
      ],
    });
  });

  it("详情补查失败时仍展示消息并保留引用 ID", async () => {
    requestJson.mockResolvedValueOnce(reply).mockRejectedValueOnce(new Error("Not found"));
    await expect(httpChatApiPort.getMessage(scope[0], scope[1], reply.mid)).resolves.toMatchObject({ id: reply.mid, replyToMessageId: original.mid });
  });
});

describe("消息 HTTP 协议", () => {
  beforeEach(() => requestJson.mockReset());

  it("发送版本化域，不附加旧版幂等字段", async () => {
    const payload = { domain: "Core:Text:V1", data: { content: "hi" }, mentions: [] };
    requestJson.mockResolvedValueOnce({ mid: "1", domain: "Core:Text:V1" });
    await httpSendChannelMessage("127.0.0.1:8080", "tok", "c1", payload);
    expect(requestJson).toHaveBeenCalledWith("POST", "/channels/c1/messages", payload);
  });

  it("区分最新、更旧、更新、锚点和详情，并保持游标原样", async () => {
    requestJson.mockResolvedValue({ items: [], total: 0 });
    const args = ["127.0.0.1:8080", "tok", "2001"] as const;
    await httpListChannelMessages(...args);
    await httpListChannelMessages(...args, "p=+/ ");
    await httpListChannelMessagesAfter(...args, "p=+/ ");
    await httpListChannelMessagesAround(...args, "3001", 0, 51);
    await httpGetMessage(args[0], args[1], "3001");
    await httpGetMessagesByIds(args[0], args[1], ["3001", "3002"]);
    requestJson.mockResolvedValueOnce(null);
    await expect(httpRecallMessage(...args, "3001")).resolves.toBeUndefined();
    expect(requestJson.mock.calls).toEqual([
      ["GET", "/channels/2001/messages?limit=20"],
      ["GET", "/channels/2001/messages/before?cursor=p%3D%2B%2F%20&limit=20"],
      ["GET", "/channels/2001/messages/after?cursor=p%3D%2B%2F%20&limit=20"],
      ["GET", "/channels/2001/messages/around?anchor_mid=3001&before=0&after=50"],
      ["GET", "/channels/messages/3001"],
      ["POST", "/channels/messages/ids", { message_ids: ["3001", "3002"] }],
      ["POST", "/channels/2001/messages/3001/recall"],
    ]);
  });
});
