/**
 * @fileoverview authorNameResolution.test.ts
 * @description chat｜view-model：消息作者（发送者/提及）昵称解析助手单测。
 */

import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/features/chat/message-flow/api-types";
import type { MessageMention } from "@/features/chat/message-flow/message/domain/messageModels";
import {
  collectUnresolvedAuthorUids,
  isPlaceholderSenderName,
  withResolvedMentionNames,
  withResolvedQuoteReplyName,
  withResolvedSenderName,
} from "./authorNameResolution";

type CoreTextMessage = Extract<ChatMessage, { kind: "core_text" }>;

function makeMessage(overrides: Partial<CoreTextMessage> = {}): ChatMessage {
  return {
    id: "m1",
    kind: "core_text",
    from: { id: "1001", name: "用户 1001" },
    timeMs: 1000,
    domain: { id: "Core:Text", label: "Core:Text", colorVar: "--cp-domain-core" },
    text: "hello",
    ...overrides,
  };
}

function mention(partial: Partial<MessageMention>): MessageMention {
  return { userId: "u2", displayName: "", ...partial };
}

describe("isPlaceholderSenderName", () => {
  it("recognizes mapper fallback names", () => {
    expect(isPlaceholderSenderName("")).toBe(true);
    expect(isPlaceholderSenderName("用户 1001")).toBe(true);
    expect(isPlaceholderSenderName("u:1001")).toBe(true);
    expect(isPlaceholderSenderName("未知用户")).toBe(true);
  });

  it("keeps real nicknames that merely look similar", () => {
    expect(isPlaceholderSenderName("Operator")).toBe(false);
    expect(isPlaceholderSenderName("User 1001")).toBe(false);
    expect(isPlaceholderSenderName("Relay")).toBe(false);
    // 真实昵称可能以「用户」开头：缺少分隔符时不得判为占位名，否则会被目录结果覆盖。
    expect(isPlaceholderSenderName("用户小张")).toBe(false);
    expect(isPlaceholderSenderName("用户1001")).toBe(false);
  });
});

describe("withResolvedSenderName", () => {
  it("replaces the fallback name with the resolved nickname without mutating the source", () => {
    const source = makeMessage();
    const result = withResolvedSenderName(source, (uid) => (uid === "1001" ? "系统" : ""));

    expect(result).not.toBe(source);
    expect(result.from.name).toBe("系统");
    expect(result.from.id).toBe("1001");
    expect(source.from.name).toBe("用户 1001");
  });

  it("returns the original message when the name is already resolved", () => {
    const source = makeMessage({ from: { id: "1001", name: "Operator" } });
    expect(withResolvedSenderName(source, () => "系统")).toBe(source);
  });

  it("returns the original message when the resolver cannot resolve the uid", () => {
    const source = makeMessage();
    expect(withResolvedSenderName(source, () => "")).toBe(source);
    // 解析结果本身仍是占位形态时不覆盖
    expect(withResolvedSenderName(source, () => "用户 1001")).toBe(source);
  });
});

describe("withResolvedMentionNames", () => {
  it("fills empty mention display names", () => {
    const source = makeMessage({
      mentions: [mention({ userId: "u2", displayName: "" }), mention({ userId: "u3", displayName: "Bob" })],
    });
    const result = withResolvedMentionNames(source, (uid) => (uid === "u2" ? "Alice" : ""));

    expect(result).not.toBe(source);
    expect(result.mentions?.[0].displayName).toBe("Alice");
    expect(result.mentions?.[1].displayName).toBe("Bob");
    expect(source.mentions?.[0].displayName).toBe("");
  });

  it("skips system mentions and leaves unresolved mentions untouched", () => {
    const source = makeMessage({
      mentions: [mention({ userId: "everyone", displayName: "", type: "everyone" })],
    });
    expect(withResolvedMentionNames(source, () => "ignored")).toBe(source);
  });
});

describe("withResolvedQuoteReplyName", () => {
  it("fills the quote author name without mutating the source", () => {
    const source = makeMessage({
      quoteReply: { messageId: "q1", userId: "u9", preview: "下午 3 点" },
    });
    const result = withResolvedQuoteReplyName(source, (uid) => (uid === "u9" ? "Charlie" : ""));

    expect(result).not.toBe(source);
    expect(result.quoteReply?.senderName).toBe("Charlie");
    expect(source.quoteReply?.senderName).toBeUndefined();
  });

  it("keeps an already resolved quote author and ignores unresolvable uids", () => {
    const named = makeMessage({
      quoteReply: { messageId: "q1", userId: "u9", preview: "hi", senderName: "Charlie" },
    });
    expect(withResolvedQuoteReplyName(named, () => "Other")).toBe(named);

    const unresolved = makeMessage({
      quoteReply: { messageId: "q1", userId: "u9", preview: "hi" },
    });
    expect(withResolvedQuoteReplyName(unresolved, () => "")).toBe(unresolved);
  });
});

describe("collectUnresolvedAuthorUids", () => {
  it("collects unresolved senders, mentions and quote authors, skipping named ones", () => {
    const messages: ChatMessage[] = [
      makeMessage({ id: "m1", from: { id: "1001", name: "用户 1001" } }),
      makeMessage({ id: "m2", from: { id: "1002", name: "Relay" } }),
      makeMessage({
        id: "m3",
        from: { id: "1003", name: "未知用户" },
        mentions: [mention({ userId: "u2", displayName: "" }), mention({ userId: "u3", displayName: "Bob" })],
        quoteReply: { messageId: "q1", userId: "u9", preview: "hi" },
      }),
    ];

    expect(collectUnresolvedAuthorUids(messages, () => false)).toEqual(["1001", "1003", "u2", "u9"]);
    // 已知昵称的 uid 不再进入补拉队列（发送者/提及/引用作者命名状态都会被检查）
    expect(collectUnresolvedAuthorUids(messages, (uid) => uid === "u2")).toEqual(["1001", "1003", "u9"]);
  });

  it("returns an empty list when every author already has a name", () => {
    const messages: ChatMessage[] = [
      makeMessage({ from: { id: "1001", name: "Operator" } }),
      makeMessage({ id: "m2", mentions: [mention({ userId: "u2", displayName: "Alice" })] }),
      makeMessage({
        id: "m3",
        quoteReply: { messageId: "q1", userId: "u9", preview: "hi", senderName: "Charlie" },
      }),
    ];
    expect(collectUnresolvedAuthorUids(messages, () => false)).toEqual([]);
  });
});
