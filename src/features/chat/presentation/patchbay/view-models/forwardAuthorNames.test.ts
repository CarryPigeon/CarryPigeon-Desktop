/**
 * @fileoverview forwardAuthorNames.test.ts
 * @description chat｜view-model：转发条目作者昵称解析助手单测。
 */

import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/features/chat/message-flow/api-types";
import type { ForwardedMessageEntry } from "@/features/chat/message-flow/message/domain/messageModels";
import {
  collectUnresolvedForwardAuthorUids,
  withResolvedForwardAuthorNames,
} from "./forwardAuthorNames";

type CoreTextMessage = Extract<ChatMessage, { kind: "core_text" }>;

function makeMessage(overrides: Partial<CoreTextMessage> = {}): ChatMessage {
  return {
    id: "m1",
    kind: "core_text",
    from: { id: "u9", name: "Operator" },
    timeMs: 1000,
    domain: { id: "Core:Forward", label: "Core:Forward", colorVar: "--cp-domain-core" },
    text: "",
    ...overrides,
  };
}

function entry(partial: Partial<ForwardedMessageEntry>): ForwardedMessageEntry {
  return {
    messageId: "src-1",
    channelId: "ch1",
    userId: "u1",
    preview: "hello",
    sentTime: 1,
    ...partial,
  };
}

describe("withResolvedForwardAuthorNames", () => {
  it("resolves entry authors into a shallow copy without mutating the source", () => {
    const source = makeMessage({
      forwardedMessages: [entry({ userId: "u1" }), entry({ messageId: "src-2", userId: "u2" })],
    });
    const result = withResolvedForwardAuthorNames(source, (uid) => `nick-${uid}`);

    expect(result).not.toBe(source);
    expect(result.forwardedMessages?.[0].authorName).toBe("nick-u1");
    expect(result.forwardedMessages?.[1].authorName).toBe("nick-u2");
    // 原对象不被改写
    expect(source.forwardedMessages?.[0].authorName).toBeUndefined();
  });

  it("also resolves forwardedFrom snapshots", () => {
    const source = makeMessage({ forwardedFrom: entry({ userId: "u3" }) });
    const result = withResolvedForwardAuthorNames(source, () => "Alice");

    expect(result.forwardedFrom?.authorName).toBe("Alice");
  });

  it("returns the original message when nothing resolves", () => {
    const source = makeMessage({
      forwardedMessages: [entry({ userId: "u404" })],
    });
    const result = withResolvedForwardAuthorNames(source, () => " ");

    expect(result).toBe(source);
    expect(result.forwardedMessages?.[0].authorName).toBeUndefined();
  });

  it("returns the original message when no forward fields exist", () => {
    const source = makeMessage();
    expect(withResolvedForwardAuthorNames(source, () => "Alice")).toBe(source);
  });

  it("keeps identity when author names are already up to date", () => {
    const source = makeMessage({
      forwardedMessages: [entry({ userId: "u1", authorName: "Alice" })],
    });
    expect(withResolvedForwardAuthorNames(source, () => "Alice")).toBe(source);
  });

  it("trims resolver output before assigning", () => {
    const source = makeMessage({ forwardedMessages: [entry({ userId: "u1" })] });
    const result = withResolvedForwardAuthorNames(source, () => "  Alice  ");
    expect(result.forwardedMessages?.[0].authorName).toBe("Alice");
  });
});

describe("collectUnresolvedForwardAuthorUids", () => {
  it("collects unique unresolved uids across entries", () => {
    const messages: ChatMessage[] = [
      makeMessage({
        forwardedMessages: [entry({ userId: "u1" }), entry({ messageId: "s2", userId: "u2" }), entry({ messageId: "s3", userId: "u1" })],
      }),
      makeMessage({ id: "m2", forwardedFrom: entry({ userId: "u3" }) }),
      makeMessage({ id: "m3" }),
    ];
    const out = collectUnresolvedForwardAuthorUids(messages, () => false);
    expect(out).toEqual(["u1", "u2", "u3"]);
  });

  it("skips uids that already have a resolvable name", () => {
    const messages: ChatMessage[] = [
      makeMessage({ forwardedMessages: [entry({ userId: "u1" }), entry({ messageId: "s2", userId: "u2" })] }),
    ];
    const out = collectUnresolvedForwardAuthorUids(messages, (uid) => uid === "u1");
    expect(out).toEqual(["u2"]);
  });

  it("ignores blank uids and already-named entries", () => {
    const messages: ChatMessage[] = [
      makeMessage({
        forwardedMessages: [
          entry({ userId: "" }),
          entry({ messageId: "s2", userId: "u1", authorName: "Alice" }),
        ],
      }),
    ];
    expect(collectUnresolvedForwardAuthorUids(messages, () => false)).toEqual([]);
  });
});
