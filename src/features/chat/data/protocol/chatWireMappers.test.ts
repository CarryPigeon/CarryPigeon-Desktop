/**
 * @fileoverview chatWireMappers 单元测试
 * @description 验证 wire format (snake_case) 到领域模型的映射正确性
 */

import { describe, expect, it } from "vitest";
import {
  mapChatUserWire,
  mapChatChannelWire,
  mapChatUnreadStateWire,
  mapChatMessageWire,
  mapChatReactionWire,
  mapChatMessagePageWire,
  mapChatChannelMemberWire,
  mapChatChannelApplicationWire,
  mapChatPinWire,
  mapChatMentionWire,
  mapChatChannelBanWire,
  mapChatSendMessageInput,
  mapChatReadStateInput,
  mapChatChannelPatchInput,
  mapChatChannelCreateInput,
} from "./chatWireMappers";
import type { ChatUserWire } from "./chatWireModels";

// ── mapChatUserWire ──

describe("mapChatUserWire", () => {
  it("should map valid user wire to record", () => {
    const wire: ChatUserWire = { uid: "u1", nickname: "Alice", avatar: "https://a.example/1.png" };
    const result = mapChatUserWire(wire);
    expect(result).toEqual({
      id: "u1",
      nickname: "Alice",
      avatar: "https://a.example/1.png",
    });
  });

  it("should return undefined for undefined input", () => {
    expect(mapChatUserWire(undefined)).toBeUndefined();
  });

  it("should return undefined when both id and nickname are empty", () => {
    const wire: ChatUserWire = { uid: "", nickname: "" };
    expect(mapChatUserWire(wire)).toBeUndefined();
  });

  it("should trim whitespace from fields", () => {
    const wire: ChatUserWire = { uid: "  u2  ", nickname: "  Bob  " };
    const result = mapChatUserWire(wire);
    expect(result?.id).toBe("u2");
    expect(result?.nickname).toBe("Bob");
  });

  it("should handle missing avatar", () => {
    const wire: ChatUserWire = { uid: "u3", nickname: "Charlie" };
    const result = mapChatUserWire(wire);
    expect(result?.avatar).toBeUndefined();
  });
});

// ── mapChatChannelWire ──

describe("mapChatChannelWire", () => {
  it("should map channel wire with all fields", () => {
    const wire = {
      cid: "ch1", name: "General", brief: "General discussion",
      avatar: "https://a.example/ch1.png", owner_uid: "owner1",
      joined: true, join_requested: false, category_id: "cat1",
      category_name: "Official", order: 1, type: "public",
    };
    const result = mapChatChannelWire(wire as any);
    expect(result.id).toBe("ch1");
    expect(result.name).toBe("General");
    expect(result.brief).toBe("General discussion");
    expect(result.ownerUserId).toBe("owner1");
    expect(result.joined).toBe(true);
    expect(result.joinRequested).toBe(false);
    expect(result.categoryId).toBe("cat1");
    expect(result.categoryName).toBe("Official");
  });

  it("should use id as fallback name", () => {
    const wire = { cid: "ch2", name: "" };
    const result = mapChatChannelWire(wire as any);
    expect(result.name).toBe("ch2");
  });
});

// ── mapChatUnreadStateWire ──

describe("mapChatUnreadStateWire", () => {
  it("should map unread state fields", () => {
    const wire = { cid: "ch1", unread_count: 10, mention_unread_count: 3, last_read_time: 1699999999000 };
    const result = mapChatUnreadStateWire(wire as any);
    expect(result.channelId).toBe("ch1");
    expect(result.unreadCount).toBe(10);
    expect(result.mentionUnreadCount).toBe(3);
    expect(result.lastReadTime).toBe(1699999999000);
  });

  it("should never have negative unread count", () => {
    const wire = { cid: "ch2", unread_count: -5, last_read_time: 0 };
    const result = mapChatUnreadStateWire(wire as any);
    expect(result.unreadCount).toBe(0);
  });
});

// ── mapChatMessageWire ──

describe("mapChatMessageWire", () => {
  it("should map core_text message wire", () => {
    const wire = {
      mid: "msg1", cid: "ch1", uid: "u1",
      sender: { uid: "u1", nickname: "Alice" },
      domain: "Core:Text", data: { text: "Hello world" },
      send_time: 1700000000000,
    };
    const result = mapChatMessageWire(wire as any);
    expect(result.id).toBe("msg1");
    expect(result.channelId).toBe("ch1");
    expect(result.sender?.nickname).toBe("Alice");
    expect(result.domain).toBe("Core:Text");
    expect(result.sentTime).toBe(1700000000000);
  });

  it("should map reply_to when present", () => {
    const wire = {
      mid: "msg2", cid: "ch1", uid: "u2",
      sender: { uid: "u2", nickname: "Bob" },
      domain: "Core:Text", data: { text: "Reply" },
      send_time: 1700000000000,
      reply_to: { mid: "msg1", sender_name: "Alice", preview: "Hello", created_at: 1699999999000 },
    };
    const result = mapChatMessageWire(wire as any);
    expect(result.replyTo?.messageId).toBe("msg1");
    expect(result.replyTo?.senderName).toBe("Alice");
  });

  it("should parse mentions array", () => {
    const wire = {
      mid: "msg3", cid: "ch1", uid: "u1",
      sender: { uid: "u1", nickname: "Alice" },
      domain: "Core:Text", data: { text: "Hey @Bob" },
      send_time: 1700000000000,
      mentions: [{ uid: "u2", display_name: "Bob", type: "user" }],
    };
    const result = mapChatMessageWire(wire as any);
    expect(result.mentions).toHaveLength(1);
    expect(result.mentions![0].userId).toBe("u2");
  });
});

// ── mapChatReactionWire ──

describe("mapChatReactionWire", () => {
  it("should map reaction wire", () => {
    const wire = { emoji: "👍", count: 5, reacted_by_me: true };
    const result = mapChatReactionWire(wire as any);
    expect(result).toEqual({ emoji: "👍", count: 5, reactedByMe: true });
  });
});

// ── mapChatMessagePageWire ──

describe("mapChatMessagePageWire", () => {
  it("should map message page with cursor pagination", () => {
    const wire = {
      items: [
        { mid: "m1", cid: "ch1", uid: "u1", sender: { uid: "u1", nickname: "A" }, domain: "Core:Text", data: { text: "Hi" }, send_time: 1 },
      ],
      next_cursor: "cursor-abc",
      has_more: true,
    };
    const result = mapChatMessagePageWire(wire as any);
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBe("cursor-abc");
    expect(result.hasMore).toBe(true);
  });

  it("should default has_more to false", () => {
    const wire = { items: [], next_cursor: "" };
    const result = mapChatMessagePageWire(wire as any);
    expect(result.hasMore).toBe(false);
  });
});

// ── mapChatChannelMemberWire ──

describe("mapChatChannelMemberWire", () => {
  it("should map member fields", () => {
    const wire = { uid: "u1", nickname: "Alice", role: "admin", join_time: 1700000000000, avatar: "" };
    const result = mapChatChannelMemberWire(wire as any);
    expect(result.userId).toBe("u1");
    expect(result.nickname).toBe("Alice");
    expect(result.role).toBe("admin");
    expect(result.joinTime).toBe(1700000000000);
  });

  it("should default role to member", () => {
    const wire = { uid: "u2", nickname: "Bob", join_time: 1 };
    const result = mapChatChannelMemberWire(wire as any);
    expect(result.role).toBe("member");
  });
});

// ── mapChatChannelApplicationWire ──

describe("mapChatChannelApplicationWire", () => {
  it("should map application fields", () => {
    const wire = {
      application_id: "app1", cid: "ch1", uid: "u2",
      reason: "Please let me in", status: "pending", apply_time: 1700000000000,
    };
    const result = mapChatChannelApplicationWire(wire as any);
    expect(result.applicationId).toBe("app1");
    expect(result.userId).toBe("u2");
    expect(result.reason).toBe("Please let me in");
    expect(result.status).toBe("pending");
  });
});

// ── mapChatPinWire ──

describe("mapChatPinWire", () => {
  it("should map pin fields", () => {
    const wire = { cid: "ch1", mid: "msg1", pinned_by_uid: "u1", pinned_at: 1700000000000, note: "Important" };
    const result = mapChatPinWire(wire as any);
    expect(result.channelId).toBe("ch1");
    expect(result.messageId).toBe("msg1");
    expect(result.pinnedByUserId).toBe("u1");
    expect(result.pinnedAt).toBe(1700000000000);
  });
});

// ── mapChatMentionWire ──

describe("mapChatMentionWire", () => {
  it("should map mention wire to domain record", () => {
    const wire = {
      mention_id: "m1", cid: "ch1", mid: "msg1",
      from_uid: "u1", target: { type: "user", uid: "u2" },
      created_at: 1700000000000, read: false,
    };
    const result = mapChatMentionWire(wire as any);
    expect(result.mentionId).toBe("m1");
    expect(result.channelId).toBe("ch1");
    expect(result.messageId).toBe("msg1");
    expect(result.fromUserId).toBe("u1");
    expect(result.target.type).toBe("user");
    expect(result.target.uid).toBe("u2");
    expect(result.read).toBe(false);
  });
});

// ── mapChatChannelBanWire ──

describe("mapChatChannelBanWire", () => {
  it("should map ban to domain record", () => {
    const wire = {
      cid: "ch1", uid: "u1", reason: "Spam",
      until: 1710000000000, create_time: 1700000000000,
    };
    const result = mapChatChannelBanWire(wire as any);
    expect(result.channelId).toBe("ch1");
    expect(result.userId).toBe("u1");
    expect(result.reason).toBe("Spam");
    expect(result.until).toBe(1710000000000);
    expect(result.createTime).toBe(1700000000000);
  });
});

// ── mapChatSendMessageInput (domain → wire) ──

describe("mapChatSendMessageInput", () => {
  it("should map domain input to snake_case wire", () => {
    const input = {
      domain: "Core:Text", domainVersion: "1.0.0",
      data: { text: "Hello" },
      replyToMessageId: "reply1",
      replyTo: { messageId: "r1", senderName: "Bob", preview: "Hi", createdAt: 1 },
      quoteReply: { messageId: "q1", userId: "u2", preview: "Hey" },
      mentions: [{ userId: "u3", displayName: "Charlie", type: "user" as const }],
      linkPreview: undefined,
    } as any;
    const result = mapChatSendMessageInput(input);
    expect(result.domain).toBe("Core:Text");
    expect(result.domain_version).toBe("1.0.0");
    expect(result.data).toEqual({ text: "Hello" });
    expect(result.reply_to_mid).toBe("reply1");
    expect(result.reply_to?.mid).toBe("r1");
    expect(result.quote_reply?.mid).toBe("q1");
  });
});

// ── mapChatReadStateInput (domain → wire) ──

describe("mapChatReadStateInput", () => {
  it("should map read state input to snake_case wire", () => {
    const input = { lastReadMessageId: "m10", lastReadTime: 1700000000000 };
    const result = mapChatReadStateInput(input as any);
    expect(result.last_read_mid).toBe("m10");
    expect(result.last_read_time).toBe(1700000000000);
  });
});

// ── mapChatChannelPatchInput (domain → wire) ──

describe("mapChatChannelPatchInput", () => {
  it("should map patch input with provided fields", () => {
    const input = { name: "New Name", brief: "New brief", announcement: "Announcement!" } as any;
    const result = mapChatChannelPatchInput(input);
    expect(result.name).toBe("New Name");
    expect(result.brief).toBe("New brief");
  });

  it("should omit undefined fields", () => {
    const input = { name: "Only Name" } as any;
    const result = mapChatChannelPatchInput(input);
    expect(result.name).toBe("Only Name");
    expect((result as any).brief).toBeUndefined();
  });
});

// ── mapChatChannelCreateInput ──

describe("mapChatChannelCreateInput", () => {
  it("should map create input with name and brief", () => {
    const input = { name: "New Channel", brief: "A new channel" } as any;
    const result = mapChatChannelCreateInput(input);
    expect(result.name).toBe("New Channel");
    expect(result.brief).toBe("A new channel");
  });
});
