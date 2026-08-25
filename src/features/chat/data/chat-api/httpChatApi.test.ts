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

import { httpPatchChannel, httpSendChannelMessage } from "./httpChatApi";

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

describe("httpSendChannelMessage", () => {
  beforeEach(() => {
    requestJsonWithHeaders.mockReset();
  });

  it("should copy Idempotency-Key into client_message_id", async () => {
    requestJsonWithHeaders.mockResolvedValueOnce({ mid: "1", domain: "Core:Text" });

    await httpSendChannelMessage(
      "127.0.0.1:8080",
      "tok",
      "c1",
      { domain: "Core:Text", domain_version: "1.0.0", data: { text: "hi" } },
      "local-1",
    );

    expect(requestJsonWithHeaders).toHaveBeenCalledWith(
      "POST",
      "/channels/c1/messages",
      {
        domain: "Core:Text",
        domain_version: "1.0.0",
        data: { text: "hi" },
        client_message_id: "local-1",
      },
      { "Idempotency-Key": "local-1" },
    );
  });
});
