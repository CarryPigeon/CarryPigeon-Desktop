/**
 * @fileoverview createChatEventRouter.test.ts
 * @description chat｜composition：根事件路由器 mention.created 即时补拉分支测试。
 */
import { describe, expect, it, vi } from "vitest";
import { createChatEventRouter, type ChatWsEventRouterDeps } from "./createChatEventRouter";
import type { ChatEventEnvelope } from "@/features/chat/domain/types/chatEventModels";

function buildDeps(overrides?: Partial<ChatWsEventRouterDeps>): ChatWsEventRouterDeps {
  return {
    logger: { debug: vi.fn() },
    getServerSocket: () => "sk-1:8080",
    getCurrentUserId: () => "u-1",
    timelineState: {
      readCurrentChannelId: () => "c1",
      appendMessageIfMissing: vi.fn(() => true),
      removeMessage: vi.fn(),
      updateMessageReactions: vi.fn(),
      updateMessage: vi.fn(),
      markMessageRecalled: vi.fn(),
    },
    unreadProjection: {
      incrementChannelUnread: vi.fn(),
      recomputeChannelUnreadLocally: vi.fn(),
    },
    readStateProjection: {
      readLastReadTimeMs: vi.fn(() => 0),
      readLastReadMessageId: vi.fn(() => ""),
      writeLastReadTimeMs: vi.fn(),
      writeLastReadMessageId: vi.fn(),
      markChannelReadLocally: vi.fn(),
    },
    refreshChannels: vi.fn(async () => undefined),
    refreshChannelLatestPage: vi.fn(async () => undefined),
    refreshMembersRail: vi.fn(async () => undefined),
    refreshMentionInbox: vi.fn(async () => undefined),
    emitChannelProjectionChanged: vi.fn(),
    mapWireMessage: vi.fn(),
    compareMessages: vi.fn(() => 0),
    ...overrides,
  } as ChatWsEventRouterDeps;
}

function mentionCreatedEnvelope(channelId: string): ChatEventEnvelope {
  return {
    eventId: "900",
    eventType: "mention.created",
    serverTime: 1700000000000,
    payload: {
      mentionId: "m-1",
      channelId,
      messageId: "mid-1",
      fromUserId: "u-2",
      target: { type: "user", uid: "u-1" },
      createdAt: 1700000000000,
    },
  } as unknown as ChatEventEnvelope;
}

describe("createChatEventRouter mention.created 即时补拉", () => {
  it("mention.created 触发对应频道的最新页补拉", async () => {
    const refreshChannelLatestPage = vi.fn(async () => undefined);
    const handleWsEvent = createChatEventRouter(buildDeps({ refreshChannelLatestPage }));

    handleWsEvent(mentionCreatedEnvelope("c-9"));
    await Promise.resolve();

    expect(refreshChannelLatestPage).toHaveBeenCalledWith("c-9");
  });

  it("同一频道的连续 mention 补拉被去重", async () => {
    const refreshChannelLatestPage = vi.fn(
      () => new Promise<void>((resolve) => setTimeout(resolve, 10)),
    );
    const handleWsEvent = createChatEventRouter(buildDeps({ refreshChannelLatestPage }));

    handleWsEvent(mentionCreatedEnvelope("c-9"));
    handleWsEvent(mentionCreatedEnvelope("c-9"));
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(refreshChannelLatestPage).toHaveBeenCalledTimes(1);
  });

  it("mention.created 触发提及收件箱刷新", async () => {
    const refreshMentionInbox = vi.fn(async () => undefined);
    const handleWsEvent = createChatEventRouter(buildDeps({ refreshMentionInbox }));

    handleWsEvent(mentionCreatedEnvelope("c-9"));
    await Promise.resolve();

    expect(refreshMentionInbox).toHaveBeenCalledTimes(1);
  });

  it("缺少 channelId 的 mention 事件被安全忽略", () => {
    const refreshChannelLatestPage = vi.fn(async () => undefined);
    const handleWsEvent = createChatEventRouter(buildDeps({ refreshChannelLatestPage }));

    const env = mentionCreatedEnvelope("");
    handleWsEvent(env);

    expect(refreshChannelLatestPage).not.toHaveBeenCalled();
  });
});
