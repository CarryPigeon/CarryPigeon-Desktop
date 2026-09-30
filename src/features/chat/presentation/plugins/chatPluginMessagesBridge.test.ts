/**
 * @fileoverview chatPluginMessagesBridge 单测。
 * @description
 * 覆盖 `host.messages` 的宿主侧实现：无频道空快照、上限钳制、频道名解析、
 * 聊天多选 → 可参与总结 id 的收敛（含 store 未就绪降级），
 * 以及翻页前后条数差、无更多历史与翻页失败降级（不抛进插件运行时）。
 */

import { describe, expect, it, vi } from "vitest";
import { ref, type Ref } from "vue";
import type { ChatMessage } from "@/features/chat/message-flow/api-types";
import type { PluginMessagesApi } from "@/features/plugins/api-types";

/**
 * 构造文本消息。
 *
 * @param id - 消息 id。
 * @param text - 正文。
 * @returns 渲染用消息。
 */
function textMessage(id: string, text: string): ChatMessage {
  return {
    id,
    kind: "core_text",
    from: { id: "u1", name: "Alice" },
    timeMs: 1,
    domain: { id: "Core:Text" },
    text,
  } as unknown as ChatMessage;
}

type LoadBridgeOptions = {
  channelId?: string;
  messages?: ChatMessage[];
  hasMore?: boolean;
  loadMore?: () => Promise<void>;
  channels?: Array<{ id: string; name: string }>;
  /** 聊天视图当前多选的 id；传 `"throw"` 模拟 store 未就绪。 */
  selectedIds?: string[] | "throw";
};

/**
 * 以受控 store access 桩加载桥（模块级单例需逐个用例重建）。
 *
 * @param options - 受控状态。
 * @returns 桥与被测状态引用。
 */
async function loadBridge(options: LoadBridgeOptions = {}) {
  vi.resetModules();
  const currentChannelId = ref(options.channelId ?? "");
  const currentMessages = ref<ChatMessage[]>(options.messages ?? []);
  const currentChannelHasMore = ref(options.hasMore ?? false);
  const loadMoreMessages = vi.fn(options.loadMore ?? (async () => {}));
  const allChannels = ref<Array<{ id: string; name: string }>>(options.channels ?? []);
  const selected = options.selectedIds ?? [];
  const selectedIdsRef = ref<string[]>(selected === "throw" ? [] : selected);

  vi.doMock("@/features/chat/message-flow/presentation/store-access/messageFlowStoreAccess", () => ({
    currentChannelId,
    currentMessages,
    currentChannelHasMore,
    loadMoreMessages,
    getSelectedIds: () => {
      if (selected === "throw") throw new Error("store not ready");
      return [...selectedIdsRef.value];
    },
  }));
  vi.doMock("@/features/chat/room-session/presentation/store-access/sessionStoreAccess", () => ({
    allChannels,
  }));

  const mod = await import("./chatPluginMessagesBridge");
  return {
    bridge: mod.chatPluginMessagesBridge as PluginMessagesApi,
    currentMessages: currentMessages as Ref<ChatMessage[]>,
    currentChannelHasMore,
    loadMoreMessages,
    selectedIdsRef,
  };
}

describe("chatPluginMessagesBridge.readCurrentChannel", () => {
  it("returns an empty snapshot when no channel is selected", async () => {
    const { bridge } = await loadBridge({ messages: [textMessage("m1", "hi")] });

    await expect(bridge.readCurrentChannel()).resolves.toEqual({
      channelId: "",
      channelName: "",
      totalCount: 0,
      truncated: false,
      hasMoreHistory: false,
      capturedAtMs: 0,
      messages: [],
      selectedMessageIds: [],
      selectedTotalCount: 0,
    });
  });

  it("projects current channel messages with channel name and history flag", async () => {
    const { bridge } = await loadBridge({
      channelId: "c1",
      messages: [textMessage("m1", "第一条"), textMessage("m2", "第二条")],
      hasMore: true,
      channels: [{ id: "c1", name: "研发" }],
    });

    const snapshot = await bridge.readCurrentChannel();

    expect(snapshot.channelId).toBe("c1");
    expect(snapshot.channelName).toBe("研发");
    expect(snapshot.messages.map((m) => m.text)).toEqual(["第一条", "第二条"]);
    expect(snapshot.totalCount).toBe(2);
    expect(snapshot.truncated).toBe(false);
    expect(snapshot.hasMoreHistory).toBe(true);
    expect(snapshot.capturedAtMs).toBeGreaterThan(0);
  });

  it("falls back to channel id when the directory has no name", async () => {
    const { bridge } = await loadBridge({ channelId: "c1", messages: [textMessage("m1", "hi")] });

    await expect(bridge.readCurrentChannel()).resolves.toMatchObject({ channelName: "c1" });
  });

  it("clamps maxMessages into [1, 500]", async () => {
    const messages = [1, 2, 3].map((i) => textMessage(`m${i}`, `msg-${i}`));
    const { bridge } = await loadBridge({ channelId: "c1", messages });

    await expect(bridge.readCurrentChannel({ maxMessages: 1 })).resolves.toMatchObject({
      truncated: true,
      messages: [{ messageId: "m3" }],
    });
    await expect(bridge.readCurrentChannel({ maxMessages: 9999 })).resolves.toMatchObject({
      truncated: false,
    });
    await expect(bridge.readCurrentChannel({ maxMessages: -5 })).resolves.toMatchObject({
      truncated: true,
    });
  });

  it("reports multi-selected messages in timeline order with the raw total", async () => {
    const messages = [1, 2, 3].map((i) => textMessage(`m${i}`, `msg-${i}`));
    const { bridge } = await loadBridge({ channelId: "c1", messages, selectedIds: ["m3", "m1"] });

    await expect(bridge.readCurrentChannel()).resolves.toMatchObject({
      selectedMessageIds: ["m1", "m3"],
      selectedTotalCount: 2,
    });
  });

  it("keeps the raw total when selected messages cannot be summarized", async () => {
    // 撤回/投影为空/未载入的选中项不进 selectedMessageIds，但仍计入原始条数，供面板提示。
    const { bridge } = await loadBridge({
      channelId: "c1",
      messages: [textMessage("m1", "第一条")],
      selectedIds: ["m1", "recalled", "too-old"],
    });

    await expect(bridge.readCurrentChannel()).resolves.toMatchObject({
      selectedMessageIds: ["m1"],
      selectedTotalCount: 3,
    });
  });

  it("reports no selection when the chat store is not ready", async () => {
    const { bridge } = await loadBridge({
      channelId: "c1",
      messages: [textMessage("m1", "第一条")],
      selectedIds: "throw",
    });

    // 多选读取失败不能拖垮整份快照，否则插件会误判为「宿主不支持读取频道消息」。
    await expect(bridge.readCurrentChannel()).resolves.toMatchObject({
      channelId: "c1",
      selectedMessageIds: [],
      selectedTotalCount: 0,
      messages: [{ messageId: "m1" }],
    });
  });

  it("reflects selection changes on the next read", async () => {
    const messages = [1, 2].map((i) => textMessage(`m${i}`, `msg-${i}`));
    const { bridge, selectedIdsRef } = await loadBridge({ channelId: "c1", messages });

    await expect(bridge.readCurrentChannel()).resolves.toMatchObject({ selectedTotalCount: 0 });

    selectedIdsRef.value = ["m2"];

    await expect(bridge.readCurrentChannel()).resolves.toMatchObject({
      selectedMessageIds: ["m2"],
      selectedTotalCount: 1,
    });
  });
});

describe("chatPluginMessagesBridge.loadMoreHistory", () => {
  it("returns zeros when no channel is selected", async () => {
    const { bridge, loadMoreMessages } = await loadBridge({ hasMore: true });

    await expect(bridge.loadMoreHistory()).resolves.toEqual({
      loadedCount: 0,
      loadedDelta: 0,
      hasMore: false,
    });
    expect(loadMoreMessages).not.toHaveBeenCalled();
  });

  it("skips the page request when there is no more history", async () => {
    const { bridge, loadMoreMessages } = await loadBridge({
      channelId: "c1",
      messages: [textMessage("m1", "hi")],
      hasMore: false,
    });

    await expect(bridge.loadMoreHistory()).resolves.toEqual({
      loadedCount: 1,
      loadedDelta: 0,
      hasMore: false,
    });
    expect(loadMoreMessages).not.toHaveBeenCalled();
  });

  it("reports the delta and the remaining history flag after a successful page", async () => {
    const { bridge, currentMessages, currentChannelHasMore, loadMoreMessages } = await loadBridge({
      channelId: "c1",
      messages: [textMessage("m3", "第三条")],
      hasMore: true,
      loadMore: async () => {
        currentMessages.value = [textMessage("m1", "第一条"), textMessage("m2", "第二条"), ...currentMessages.value];
        currentChannelHasMore.value = false;
      },
    });

    await expect(bridge.loadMoreHistory()).resolves.toEqual({
      loadedCount: 3,
      loadedDelta: 2,
      hasMore: false,
    });
    expect(loadMoreMessages).toHaveBeenCalledTimes(1);
  });

  it("degrades to zero delta when paging fails", async () => {
    const { bridge } = await loadBridge({
      channelId: "c1",
      messages: [textMessage("m1", "hi")],
      hasMore: true,
      loadMore: async () => {
        throw new Error("boom");
      },
    });

    await expect(bridge.loadMoreHistory()).resolves.toEqual({
      loadedCount: 1,
      loadedDelta: 0,
      hasMore: true,
    });
  });

  it("reports zero delta when a concurrent page made the call a no-op", async () => {
    const { bridge } = await loadBridge({
      channelId: "c1",
      messages: [textMessage("m1", "hi")],
      hasMore: true,
    });

    await expect(bridge.loadMoreHistory()).resolves.toEqual({
      loadedCount: 1,
      loadedDelta: 0,
      hasMore: true,
    });
  });
});
