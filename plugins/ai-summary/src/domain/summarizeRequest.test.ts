/**
 * @fileoverview AI 总结 domain 纯函数单测。
 * @description
 * 覆盖频道消息投影（逐行文本）、请求体构造、末条消息指纹与
 * 「按参与消息集合指纹」的缓存新鲜度判定，以及服务端响应/缓存解析的容错规则。
 */

import { describe, expect, it } from "vitest";
import type { PluginChannelMessage } from "@/features/plugins/api-types";
import { computeScopeFingerprint } from "./summarizeScope";
import {
  buildChannelMessageLines,
  buildSummarizeRequestBody,
  isCacheFresh,
  latestMessageIdOf,
  parseCachedSummary,
  parseSummarizeResponse,
  type CachedSummary,
} from "./summarizeRequest";

/**
 * 构造频道消息。
 *
 * @param messageId - 消息 id。
 * @param text - 文本投影。
 * @param senderName - 发送者展示名。
 * @returns 插件可见消息。
 */
function message(messageId: string, text: string, senderName = "Alice"): PluginChannelMessage {
  return { messageId, senderId: "u1", senderName, timeMs: 1, text };
}

/**
 * 构造缓存。
 *
 * @param messages - 指纹对应的参与消息（缺省为 m1/m2 两条）。
 * @returns 缓存对象。
 */
function cachedOf(messages: PluginChannelMessage[] = [message("m1", "a"), message("m2", "b")]): CachedSummary {
  return {
    summary: "旧总结",
    channelId: "ch1",
    messageCount: messages.length,
    latestMessageId: latestMessageIdOf(messages),
    scopeFingerprint: computeScopeFingerprint(messages),
    capturedAtMs: 1,
    sourceKind: "server",
    provider: "",
    model: "",
  };
}

describe("buildChannelMessageLines", () => {
  it("prefixes sender name and keeps order", () => {
    expect(buildChannelMessageLines([message("m1", "第一条"), message("m2", "第二条", "Bob")])).toEqual([
      "Alice: 第一条",
      "Bob: 第二条",
    ]);
  });

  it("falls back to plain text when sender name is empty", () => {
    expect(buildChannelMessageLines([message("m1", "  hi  ", "")])).toEqual(["hi"]);
  });

  it("drops blank projections and tolerates non-array input", () => {
    expect(buildChannelMessageLines([message("m1", "   "), message("m2", "keep")])).toEqual(["Alice: keep"]);
    expect(buildChannelMessageLines(undefined as never)).toEqual([]);
  });
});

describe("buildSummarizeRequestBody", () => {
  it("trims channel id and projects messages", () => {
    expect(buildSummarizeRequestBody("  ch1  ", [message("m1", "hi")])).toEqual({
      channel_id: "ch1",
      messages: ["Alice: hi"],
    });
  });
});

describe("latestMessageIdOf", () => {
  it("returns the last non-empty message id", () => {
    expect(latestMessageIdOf([message("m1", "a"), message("m2", "b"), message("", "c")])).toBe("m2");
    expect(latestMessageIdOf([])).toBe("");
  });
});

describe("isCacheFresh", () => {
  it("is fresh when the scoped message set is unchanged", () => {
    const scoped = [message("m1", "a"), message("m2", "b")];
    expect(isCacheFresh(cachedOf(scoped), scoped)).toBe(true);
  });

  it("is stale when a new message arrives", () => {
    const cached = cachedOf([message("m1", "a"), message("m2", "b")]);
    expect(isCacheFresh(cached, [message("m1", "a"), message("m2", "b"), message("m3", "c")])).toBe(false);
  });

  it("is stale when earlier history joins the scope", () => {
    const cached = cachedOf([message("m2", "b")]);
    expect(isCacheFresh(cached, [message("m0", "old"), message("m2", "b")])).toBe(false);
  });

  it("is stale when the same count covers a different selection", () => {
    // 范围（聊天多选）变化但条数与末条消息恰好一致：指纹必须能区分。
    const cached = cachedOf([message("m1", "a"), message("m3", "c")]);
    expect(isCacheFresh(cached, [message("m1", "a"), message("m2", "b")])).toBe(false);
  });

  it("is fresh when the scope is unchanged after loading more history", () => {
    // 聊天多选范围固定时，翻页载入更早历史不应让摘要失效（避免无谓的重复生成）。
    const scoped = [message("m5", "e"), message("m6", "f")];
    expect(isCacheFresh(cachedOf(scoped), scoped)).toBe(true);
  });

  it("is stale without cache, without a fingerprint, or for an empty scope", () => {
    expect(isCacheFresh(null, [message("m1", "a")])).toBe(false);
    expect(isCacheFresh({ ...cachedOf(), scopeFingerprint: "" }, [message("m1", "a")])).toBe(false);
    expect(isCacheFresh(cachedOf(), [])).toBe(false);
  });
});

describe("parseCachedSummary", () => {
  it("rejects unusable values", () => {
    expect(parseCachedSummary(null)).toBeNull();
    expect(parseCachedSummary("nope")).toBeNull();
    expect(parseCachedSummary({ summary: "   " })).toBeNull();
  });

  it("normalizes legacy entries without fingerprint fields", () => {
    expect(parseCachedSummary({ summary: "旧总结", channelId: "ch1", messageCount: 3 })).toEqual({
      summary: "旧总结",
      channelId: "ch1",
      messageCount: 3,
      latestMessageId: "",
      scopeFingerprint: "",
      capturedAtMs: 0,
      sourceKind: "server",
      provider: "",
      model: "",
    });
  });

  it("keeps the scope fingerprint when present", () => {
    expect(
      parseCachedSummary({ summary: "s", channelId: "ch1", messageCount: 2, scopeFingerprint: "1a2b3c4d" }),
    ).toMatchObject({ scopeFingerprint: "1a2b3c4d" });
  });

  it("keeps client source details", () => {
    expect(
      parseCachedSummary({
        summary: "s",
        channelId: "ch1",
        messageCount: 1,
        latestMessageId: "m1",
        capturedAtMs: 123,
        sourceKind: "client",
        provider: "DeepSeek",
        model: "deepseek-flash",
      }),
    ).toMatchObject({
      sourceKind: "client",
      provider: "DeepSeek",
      model: "deepseek-flash",
      latestMessageId: "m1",
      capturedAtMs: 123,
    });
  });
});

describe("parseSummarizeResponse", () => {
  it("parses a valid response", () => {
    const res = parseSummarizeResponse(
      JSON.stringify({ summary: "S of 2", channel_id: "ch1", message_count: 2 }),
    );
    expect(res).toEqual({
      ok: true,
      result: { summary: "S of 2", channelId: "ch1", messageCount: 2 },
    });
  });

  it("rejects invalid JSON", () => {
    expect(parseSummarizeResponse("{oops")).toEqual({
      ok: false,
      error: "invalid JSON response",
    });
  });

  it("rejects empty body", () => {
    expect(parseSummarizeResponse("  ")).toEqual({ ok: false, error: "empty response body" });
  });

  it("rejects missing summary", () => {
    expect(parseSummarizeResponse(JSON.stringify({ channel_id: "ch1", message_count: 1 }))).toEqual({
      ok: false,
      error: "summary must be a non-empty string",
    });
  });

  it("rejects non-string summary", () => {
    expect(parseSummarizeResponse(JSON.stringify({ summary: 123 }))).toEqual({
      ok: false,
      error: "summary must be a non-empty string",
    });
  });

  it("rejects blank summary", () => {
    expect(parseSummarizeResponse(JSON.stringify({ summary: "   " }))).toEqual({
      ok: false,
      error: "summary must be a non-empty string",
    });
  });

  it("coerces missing message_count to 0", () => {
    const res = parseSummarizeResponse(JSON.stringify({ summary: "s", channel_id: "c" }));
    expect(res).toEqual({ ok: true, result: { summary: "s", channelId: "c", messageCount: 0 } });
  });
});
