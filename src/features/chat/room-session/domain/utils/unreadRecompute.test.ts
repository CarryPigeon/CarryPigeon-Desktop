import { describe, it, expect } from "vitest";
import { pickReportableLastMid, recomputeChannelUnread } from "./unreadRecompute";
import type { ChatMessage } from "@/features/chat/message-flow/api-types";

function msg(id: string, timeMs: number, recalledAt?: number): ChatMessage {
  return { id, timeMs, recalledAt } as unknown as ChatMessage;
}

describe("recomputeChannelUnread", () => {
  it("returns null when local timeline is empty (no recompute, fall back to server)", () => {
    const result = recomputeChannelUnread({
      serverUnread: 5,
      messages: [],
      lastReadTimeMs: 0,
      lastReadMessageId: "",
    });
    expect(result).toBeNull();
  });

  it("counts only messages after the read marker and excludes recalled", () => {
    const messages = [
      msg("1", 100, undefined),
      msg("2", 200, undefined), // after marker
      msg("3", 300, 250), // recalled -> excluded
      msg("4", 400, undefined), // after marker
    ];
    const result = recomputeChannelUnread({
      serverUnread: 99,
      messages,
      lastReadTimeMs: 150,
      lastReadMessageId: "1",
    });
    // only id 2 and 4 are after timeMs=150
    expect(result).toBe(2);
  });

  it("treats marker-equivalent message id as read (strict greater-than)", () => {
    const messages = [msg("1", 100), msg("2", 200), msg("3", 300)];
    const result = recomputeChannelUnread({
      serverUnread: 99,
      messages,
      lastReadTimeMs: 200,
      lastReadMessageId: "2",
    });
    // only id 3 is strictly after (time 200 == marker time, id "3" > "2")
    expect(result).toBe(1);
  });
});

describe("pickReportableLastMid", () => {
  it("returns last visible message id", () => {
    const messages = [msg("1", 100), msg("2", 200), msg("3", 300)];
    expect(pickReportableLastMid(messages, "fallback")).toBe("3");
  });

  it("skips recalled trailing messages", () => {
    const messages = [msg("1", 100), msg("2", 200, 250), msg("3", 300, 260)];
    expect(pickReportableLastMid(messages, "fallback")).toBe("1");
  });

  it("falls back when all messages are recalled or empty", () => {
    const messages = [msg("1", 100, 250), msg("2", 200, 260)];
    expect(pickReportableLastMid(messages, "fallback")).toBe("fallback");
    expect(pickReportableLastMid([], "fb2")).toBe("fb2");
  });
});
