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

  it("should leave mentionUnreadCount undefined when server omits mention_unread_count", () => {
    const wire = { cid: "ch3", unread_count: 2, last_read_time: 1699999999000 };
    const result = mapChatUnreadStateWire(wire as any);
    expect(result.mentionUnreadCount).toBeUndefined();
  });
});

// ── mapChatMessageWire ──

describe("mapChatMessageWire", () => {
  it("should map core_text message wire", () => {
    const wire = {
      mid: "msg1", cid: "ch1", uid: "u1",
      domain: "Core:Text", data: { text: "Hello world" },
      send_time: 1700000000000,
    };
    const result = mapChatMessageWire(wire as any);
    expect(result.id).toBe("msg1");
    expect(result.channelId).toBe("ch1");
    // 服务端 canonical 信封不携带 sender，作者信息由客户端通过 members 等接口解析；
    // mapper 应将 sender 留空，而非从 wire 顶层读取。
    expect(result.sender).toBeUndefined();
    expect(result.userId).toBe("u1");
    expect(result.domain).toBe("Core:Text");
    expect(result.sentTime).toBe(1700000000000);
  });

  it("should extract reply_to from Core:ReplyText data", () => {
    const wire = {
      mid: "msg2", cid: "ch1", uid: "u2",
      domain: "Core:ReplyText",
      domain_version: "1.0.0",
      data: {
        content: { text: "Reply" },
        reply_to_mid: "msg1",
        reply_to: { mid: "msg1", sender_name: "Alice", preview: "Hello", created_at: 1699999999000 },
      },
      send_time: 1700000000000,
    };
    const result = mapChatMessageWire(wire as any);
    expect(result.replyTo?.messageId).toBe("msg1");
    expect(result.replyTo?.senderName).toBe("Alice");
    expect(result.replyToMessageId).toBe("msg1");
  });

  it("should parse mentions string array at top level", () => {
    const wire = {
      mid: "msg3", cid: "ch1", uid: "u1",
      domain: "Core:Text", data: { text: "Hey @Bob" },
      send_time: 1700000000000,
      mentions: ["u2"],
    };
    const result = mapChatMessageWire(wire as any);
    expect(result.mentions).toHaveLength(1);
    expect(result.mentions![0].userId).toBe("u2");
    // wire 顶层为 string[]，服务端不回传 displayName/type，留空由渲染层回退。
    expect(result.mentions![0].displayName).toBe("");
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

  it("should convert Instant epoch seconds join_time to milliseconds", () => {
    const wire = { uid: "u3", nickname: "Carol", join_time: 1700000000 };
    const result = mapChatChannelMemberWire(wire as any);
    expect(result.joinTime).toBe(1700000000000);
  });

  it("should convert numeric-string Instant seconds join_time to milliseconds", () => {
    const wire = { uid: "u4", nickname: "Dave", join_time: "1700000000.5" };
    const result = mapChatChannelMemberWire(wire as any);
    expect(result.joinTime).toBe(1700000000500);
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
    expect(result.applyTime).toBe(1700000000000);
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
      linkPreview: { url: "https://example.com", title: "Example" },
    } as any;
    const result = mapChatSendMessageInput(input);
    expect(result.domain).toBe("Core:Text");
    expect(result.domain_version).toBe("1.0.0");
    expect(result.data).toEqual({ text: "Hello" });
    // Core:Text 顶层不承载 reply/quote/link_preview 关系元数据
    expect((result as any).reply_to_mid).toBeUndefined();
    expect((result as any).reply_to).toBeUndefined();
    expect((result as any).quote_reply).toBeUndefined();
    expect((result as any).link_preview).toBeUndefined();
    // mentions 在信封顶层为 string[]（snowflake UID）
    expect(result.mentions).toEqual(["u3"]);
  });

  it("should put reply metadata and linkPreview inside data for Core:ReplyText", () => {
    const input = {
      domain: "Core:ReplyText",
      domainVersion: "1.0.0",
      data: {
        content: { text: "Reply text" },
      },
      replyToMessageId: "reply1",
      replyTo: { messageId: "r1", senderName: "Bob", preview: "Hi", createdAt: 1 },
      quoteReply: { messageId: "q1", userId: "u2", preview: "Hey" },
      mentions: [{ userId: "u3", displayName: "Charlie", type: "user" }],
      linkPreview: { url: "https://example.com", title: "Example" },
    } as any;
    const result = mapChatSendMessageInput(input);
    expect(result.domain).toBe("Core:ReplyText");
    // 关系元数据放在 data 内，顶层不出现
    expect((result as any).reply_to_mid).toBeUndefined();
    expect((result as any).reply_to).toBeUndefined();
    expect((result as any).quote_reply).toBeUndefined();
    expect((result as any).link_preview).toBeUndefined();
    // mentions 仍在信封顶层为 string[]（snowflake UID），不放入 data
    expect(result.mentions).toEqual(["u3"]);
    expect(result.data).toEqual({
      content: { text: "Reply text" },
      reply_to_mid: "reply1",
      reply_to: { mid: "r1", sender_name: "Bob", preview: "Hi", created_at: 1, unavailable: false },
      quote_reply: { mid: "q1", uid: "u2", preview: "Hey" },
      link_preview: input.linkPreview,
    });
  });
});

// ── Core:ReplyText / Core:Forward wrapper domains ──

describe("mapChatMessageWire wrapper domains", () => {
  it("should extract reply metadata, mentions and linkPreview from Core:ReplyText data", () => {
    const wire = {
      mid: "msg-reply",
      cid: "ch1",
      uid: "u1",
      domain: "Core:ReplyText",
      domain_version: "1.0.0",
      data: {
        content: { text: "Reply text" },
        reply_to_mid: "msg1",
        reply_to: { mid: "msg1", sender_name: "Bob", preview: "Hi", created_at: 1699999999000 },
        quote_reply: { mid: "msg2", uid: "u2", preview: "Hey" },
        link_preview: { url: "https://example.com", title: "Example" },
      },
      // mentions 在信封顶层为 string[]（snowflake UID），不放入 data。
      mentions: ["u3"],
      send_time: 1700000000000,
    };
    const result = mapChatMessageWire(wire as any);
    expect(result.domain).toBe("Core:ReplyText");
    expect(result.data).toEqual({
      content: { text: "Reply text" },
      replyToMessageId: "msg1",
      replyTo: { messageId: "msg1", senderName: "Bob", preview: "Hi", createdAt: 1699999999000, unavailable: false },
      quoteReply: { messageId: "msg2", userId: "u2", preview: "Hey" },
      linkPreview: { url: "https://example.com", title: "Example" },
    });
    expect(result.replyToMessageId).toBe("msg1");
    expect(result.replyTo?.messageId).toBe("msg1");
    expect(result.replyTo?.senderName).toBe("Bob");
    expect(result.quoteReply?.messageId).toBe("msg2");
    // mentions 从顶层 string[] 解析为 ChatMessageMentionRecord[]，displayName 留空。
    expect(result.mentions).toEqual([{ userId: "u3", displayName: "" }]);
    expect(result.linkPreview).toEqual(wire.data.link_preview);
  });

  it("should extract forward metadata from Core:Forward data", () => {
    const wire = {
      mid: "msg-fwd",
      cid: "ch1",
      uid: "u1",
      domain: "Core:Forward",
      domain_version: "1.0.0",
      data: {
        domain: "Core:Text",
        domain_version: "1.0.0",
        content: { text: "See this" },
        forwarded_from: { mid: "msg1", cid: "ch2", uid: "u2", preview: "Hello", send_time: 1699999999000 },
      },
      send_time: 1700000000000,
    };
    const result = mapChatMessageWire(wire as any);
    expect(result.domain).toBe("Core:Forward");
    expect(result.forwardedFrom?.messageId).toBe("msg1");
    expect(result.forwardedFrom?.channelId).toBe("ch2");
  });

  it("should extract merged forward metadata from Core:Forward data", () => {
    const wire = {
      mid: "msg-fwd-merged",
      cid: "ch1",
      uid: "u1",
      domain: "Core:Forward",
      domain_version: "1.0.0",
      data: {
        domain: "Core:Text",
        domain_version: "1.0.0",
        content: { text: "" },
        forwarded_messages: [
          { mid: "msg1", cid: "ch2", uid: "u2", preview: "A", send_time: 1699999999000 },
          { mid: "msg2", cid: "ch2", uid: "u2", preview: "B", send_time: 1699999999100 },
        ],
      },
      send_time: 1700000000000,
    };
    const result = mapChatMessageWire(wire as any);
    expect(result.domain).toBe("Core:Forward");
    expect(result.forwardedMessages).toHaveLength(2);
    expect(result.forwardedMessages?.[0].messageId).toBe("msg1");
    expect(result.forwardedMessages?.[1].messageId).toBe("msg2");
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
