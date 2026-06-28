/**
 * @fileoverview MessageFlowApplicationService 单元测试
 * @description 测试消息发送、回复、删除等核心流程，使用 mock 依赖隔离验证
 */

import { describe, expect, it, vi } from "vitest";
import { MessageFlowApplicationService } from "./messageFlowService";
import type { MessageFlowApplicationServiceDeps } from "./messageFlowService";
import type { ChatMessage } from "../../domain/contracts";

// ── Helpers ──

/** 创建最小可用的 ChatMessage fixture */
function makeMessage(overrides: Record<string, unknown> = {}): ChatMessage {
  return {
    id: "msg-1",
    channelId: "ch1",
    userId: "u1",
    from: { id: "u1", name: "Alice" },
    domain: { id: "Core:Text", label: "Text", version: "1.0.0", colorVar: "--cp-domain-core" as const },
    kind: "core_text",
    text: "Hello world",
    preview: "Hello world",
    timeMs: Date.now(),
    ...overrides,
  } as unknown as ChatMessage;
}

/** 创建基础 mock deps（使用 any 类型以简化复杂接口的 mock） */
function makeMockDeps(overrides: Record<string, unknown> = {}): MessageFlowApplicationServiceDeps {
  return {
    api: {
      sendChannelMessage: vi.fn().mockResolvedValue({
        id: "msg-new", cid: "ch1", uid: "u1",
        sender: { uid: "u1", nickname: "Alice" },
        domain: "Core:Text", data: { text: "Hello" },
        send_time: Date.now(),
      }),
      deleteChannelMessage: vi.fn().mockResolvedValue(undefined),
      deleteMessage: vi.fn().mockResolvedValue(undefined),
      editChannelMessage: vi.fn().mockResolvedValue({}),
      recallChannelMessage: vi.fn().mockResolvedValue({}),
      listChannelMessages: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
    },
    scope: {
      getSocketAndValidToken: vi.fn().mockResolvedValue(["tcp://server", "token-abc"]),
      getActiveServerSocket: vi.fn().mockReturnValue("tcp://server"),
      getActiveScopeVersion: vi.fn().mockReturnValue(1),
    },
    timelineState: {
      readCurrentChannelId: vi.fn().mockReturnValue("ch1"),
      appendMessageIfMissing: vi.fn(),
      beginOptimisticMessageRemoval: vi.fn().mockReturnValue({ restore: vi.fn() }),
      listMessages: vi.fn().mockReturnValue([]),
      replaceMessage: vi.fn(),
    },
    composerState: {
      readSelectedDomainId: vi.fn().mockReturnValue("Core:Text"),
      readDraft: vi.fn().mockReturnValue("Hello"),
      readReplyDraft: vi.fn().mockReturnValue(null),
      readQuoteReplyDraft: vi.fn().mockReturnValue(null),
      setReplyDraft: vi.fn(),
      clearReplyDraft: vi.fn(),
      clearQuoteReplyDraft: vi.fn(),
      clearDraft: vi.fn(),
      clearChannelDraft: vi.fn(),
      writeActionError: vi.fn(),
      listDraftMentions: vi.fn().mockReturnValue([]),
      clearDraftMentions: vi.fn(),
    },
    mapWireMessage: vi.fn((_socket, msg) => ({
      id: (msg as any).id ?? "msg-mapped",
      channelId: (msg as any).cid ?? "ch1",
      userId: (msg as any).uid ?? "u1",
      from: { id: (msg as any).sender?.uid ?? "u1", name: (msg as any).sender?.nickname ?? "Alice" },
      domain: { id: "Core:Text", label: "Text", version: "1.0.0", colorVar: "--cp-domain-core" as const },
      kind: "core_text" as const,
      text: (msg as any).data?.text ?? "",
      preview: (msg as any).data?.text ?? "",
      timeMs: Date.now(),
    })),
    mergeMessages: vi.fn((_existing, incoming) => Promise.resolve(incoming)),
    readStateReporter: {
      advanceLocalReadTime: vi.fn().mockReturnValue(Date.now()),
      reportIfAllowed: vi.fn().mockResolvedValue(undefined),
      canReportNow: vi.fn().mockReturnValue(true),
    },
    currentUserId: "u1",
    ...overrides,
  } as unknown as MessageFlowApplicationServiceDeps;
}

// ── Tests ──

describe("MessageFlowApplicationService", () => {
  describe("startReply", () => {
    it("should set reply draft for text message", () => {
      const deps = makeMockDeps();
      const svc = new MessageFlowApplicationService(deps);
      const msg = makeMessage({ id: "msg-1", kind: "core_text", text: "Hello" });

      svc.startReply(msg);
      expect(deps.composerState.setReplyDraft).toHaveBeenCalledWith({
        messageId: "msg-1",
        senderName: "Alice",
        preview: "Hello",
        createdAt: expect.any(Number),
      });
      expect(deps.composerState.writeActionError).toHaveBeenCalledWith(null);
    });

    it("should use preview for non-text messages", () => {
      const deps = makeMockDeps();
      const svc = new MessageFlowApplicationService(deps);
      // Simulate an image message (non-text) with preview fallback
      const msg = {
        id: "msg-2",
        kind: "image",
        from: { id: "u1", name: "Alice" },
        domain: { id: "Core:Image", label: "Image", version: "1.0.0", colorVar: "--cp-domain-core" as const },
        text: "",
        preview: "image.png",
        timeMs: Date.now(),
        channelId: "ch1",
        userId: "u1",
      } as unknown as ChatMessage;

      svc.startReply(msg);
      expect(deps.composerState.setReplyDraft).toHaveBeenCalledWith(
        expect.objectContaining({ preview: "image.png" }),
      );
    });
  });

  describe("cancelReply", () => {
    it("should clear reply draft", () => {
      const deps = makeMockDeps();
      const svc = new MessageFlowApplicationService(deps);

      svc.cancelReply();
      expect(deps.composerState.clearReplyDraft).toHaveBeenCalled();
    });
  });

  describe("sendComposerMessage", () => {
    it("should reject empty text draft", async () => {
      const deps = makeMockDeps();
      deps.composerState.readDraft = vi.fn().mockReturnValue("");
      const svc = new MessageFlowApplicationService(deps);

      const result = await svc.sendComposerMessage();
      expect(result.ok).toBe(false);
      expect(result.kind).toBe("chat_message_send_rejected");
    });

    it("should reject when no socket/token", async () => {
      const deps = makeMockDeps();
      deps.scope.getSocketAndValidToken = vi.fn().mockResolvedValue([null, null]);
      const svc = new MessageFlowApplicationService(deps);

      const result = await svc.sendComposerMessage();
      expect(result.ok).toBe(false);
      expect((result as any).error?.code).toBe("not_signed_in");
    });

    it("should reject when no channel selected", async () => {
      const deps = makeMockDeps();
      deps.timelineState.readCurrentChannelId = vi.fn().mockReturnValue("");
      const svc = new MessageFlowApplicationService(deps);

      const result = await svc.sendComposerMessage();
      expect(result.ok).toBe(false);
      expect((result as any).error?.code).toBe("channel_not_selected");
    });

    it("should send text message successfully", async () => {
      const deps = makeMockDeps();
      const svc = new MessageFlowApplicationService(deps);

      const result = await svc.sendComposerMessage();
      expect(result.ok).toBe(true);
      expect(result.kind).toBe("chat_message_sent");
      expect(deps.api.sendChannelMessage).toHaveBeenCalled();
      expect(deps.composerState.clearDraft).toHaveBeenCalled();
      expect(deps.composerState.clearReplyDraft).toHaveBeenCalled();
    });

    it("should send with reply draft when set", async () => {
      const deps = makeMockDeps();
      deps.composerState.readReplyDraft = vi.fn().mockReturnValue({
        messageId: "reply-to-1",
        senderName: "Bob",
        preview: "Hi",
        createdAt: 1000,
      });
      const svc = new MessageFlowApplicationService(deps);

      const result = await svc.sendComposerMessage();
      expect(result.ok).toBe(true);
      expect(deps.api.sendChannelMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        "ch1",
        expect.objectContaining({
          replyToMessageId: "reply-to-1",
          replyTo: expect.objectContaining({ messageId: "reply-to-1" }),
        }),
        expect.any(String),
      );
    });

    it("should handle send failure gracefully", async () => {
      const deps = makeMockDeps();
      deps.api.sendChannelMessage = vi.fn().mockRejectedValue(new Error("Network error"));
      const svc = new MessageFlowApplicationService(deps);

      const result = await svc.sendComposerMessage();
      expect(result.ok).toBe(false);
      expect(result.kind).toBe("chat_message_send_rejected");
      expect((result as any).error?.code).toBe("send_failed");
      expect(deps.composerState.writeActionError).toHaveBeenCalled();
    });

    it("should reject plugin composer without payload", async () => {
      const deps = makeMockDeps();
      deps.composerState.readSelectedDomainId = vi.fn().mockReturnValue("Plugin:Math");
      const svc = new MessageFlowApplicationService(deps);

      const result = await svc.sendComposerMessage();
      expect(result.ok).toBe(false);
      expect((result as any).error?.code).toBe("plugin_composer_required");
    });
  });

  describe("deleteMessage", () => {
    it("should reject empty message id", async () => {
      const deps = makeMockDeps();
      const svc = new MessageFlowApplicationService(deps);

      const result = await svc.deleteMessage("");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("missing_message_id");
      }
    });

    it("should reject when not signed in", async () => {
      const deps = makeMockDeps();
      deps.scope.getSocketAndValidToken = vi.fn().mockResolvedValue([null, null]);
      const svc = new MessageFlowApplicationService(deps);

      const result = await svc.deleteMessage("msg-1");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("not_signed_in");
      }
    });

    it("should optimistically remove then call API", async () => {
      const deps = makeMockDeps();
      const svc = new MessageFlowApplicationService(deps);

      const result = await svc.deleteMessage("msg-1");
      expect(result.ok).toBe(true);
      expect(result.kind).toBe("chat_message_deleted");
      expect(deps.api.deleteMessage).toHaveBeenCalled();
    });

    it("should rollback on delete failure", async () => {
      const restoreMock = vi.fn();
      const deps = makeMockDeps();
      deps.timelineState.beginOptimisticMessageRemoval = vi.fn().mockReturnValue({ restore: restoreMock });
      deps.api.deleteMessage = vi.fn().mockRejectedValue(new Error("Server error"));
      const svc = new MessageFlowApplicationService(deps);

      const result = await svc.deleteMessage("msg-1");
      expect(result.ok).toBe(false);
      expect(result.kind).toBe("chat_message_delete_rejected");
      expect(restoreMock).toHaveBeenCalled();
    });
  });
});
