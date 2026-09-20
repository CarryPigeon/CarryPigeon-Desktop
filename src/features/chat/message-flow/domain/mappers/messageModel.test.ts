/**
 * @fileoverview messageModel.test.ts
 * @description chat｜domain：消息领域记录 → 展示投影映射单测（发送者昵称与回复作者）。
 */

import { describe, expect, it } from "vitest";
import type { ChatMessageRecord } from "@/features/chat/domain/types/chatApiModels";
import { createMessageMapper } from "./messageModel";

const mapper = createMessageMapper({ resolveDomainPluginHint: () => "" });

function record(overrides: Partial<ChatMessageRecord> = {}): ChatMessageRecord {
  return {
    id: "m1",
    channelId: "ch1",
    userId: "1001",
    sentTime: 1700000000000,
    domain: "Core:Text",
    domainVersion: "1.0.0",
    data: { text: "hello" },
    preview: "hello",
    ...overrides,
  };
}

describe("createMessageMapper.mapWireMessage", () => {
  it("uses the sender nickname when the record carries a sender profile", () => {
    const m = mapper.mapWireMessage("s", record({ sender: { id: "1001", nickname: "系统", avatar: "a.png" } }));

    expect(m.from.id).toBe("1001");
    expect(m.from.name).toBe("系统");
    expect(m.from.avatarUrl).toBe("a.png");
  });

  it("falls back to a detectable placeholder name when the nickname is missing", () => {
    const m = mapper.mapWireMessage("s", record());

    // 该形态可被展示层识别并按 uid 补拉公开资料替换。
    expect(m.from.name).toBe("用户 1001");
  });

  it("keeps the reply author name and never reuses the current sender nickname", () => {
    const replyRecord = (senderName: string): Partial<ChatMessageRecord> => ({
      domain: "Core:ReplyText",
      data: { content: { text: "ok" } },
      replyToMessageId: "m0",
      replyTo: { messageId: "m0", senderName, preview: "hi", createdAt: 1 },
      sender: { id: "1002", nickname: "Relay" },
    });

    const named = mapper.mapWireMessage("s", record(replyRecord("Alice")));
    expect(named.replyTo?.senderName).toBe("Alice");

    const missing = mapper.mapWireMessage("s", record(replyRecord("")));
    expect(missing.replyTo?.senderName).toBe("未知用户");
  });
});
