/**
 * @fileoverview useChannelPinStore.test.ts
 * @description 测试置顶频道状态：加载、切换、文件热加载与取消订阅。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChannelPinsState } from "@/features/chat/channel-pins/data/localChannelPinsData";

const dataMock = {
  loadChannelPins: vi.fn(),
  toggleChannelPinned: vi.fn(),
  listenChannelPinsFileChanged: vi.fn(),
};

vi.mock("@/features/chat/channel-pins/data/localChannelPinsData", () => ({
  loadChannelPins: () => dataMock.loadChannelPins(),
  toggleChannelPinned: (serverSocket: string, channelId: string) =>
    dataMock.toggleChannelPinned(serverSocket, channelId),
  listenChannelPinsFileChanged: (handler: (state: ChannelPinsState) => void) =>
    dataMock.listenChannelPinsFileChanged(handler),
}));

async function freshStore() {
  const mod = await import("./useChannelPinStore");
  return mod.useChannelPinStore();
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  dataMock.loadChannelPins.mockResolvedValue({ schemaVersion: 1, servers: {} });
  dataMock.listenChannelPinsFileChanged.mockResolvedValue(() => {});
});

describe("useChannelPinStore", () => {
  it("loads pinned state and reports isPinned/pinnedIds", async () => {
    dataMock.loadChannelPins.mockResolvedValue({
      schemaVersion: 1,
      servers: { srv: ["c1", "c2"] },
    });
    const store = await freshStore();
    await store.start();

    expect(store.isPinned("srv", "c1")).toBe(true);
    expect(store.isPinned("srv", "c3")).toBe(false);
    expect(store.isPinned("other", "c1")).toBe(false);
    expect(store.pinnedIds("srv")).toEqual(["c1", "c2"]);
  });

  it("togglePin applies authoritative state returned by the backend", async () => {
    dataMock.toggleChannelPinned.mockResolvedValue({
      schemaVersion: 1,
      servers: { srv: ["c9"] },
    });
    const store = await freshStore();
    await store.togglePin("srv", "c9");

    expect(dataMock.toggleChannelPinned).toHaveBeenCalledWith("srv", "c9");
    expect(store.isPinned("srv", "c9")).toBe(true);
  });

  it("hot reload updates state when the local file changes", async () => {
    const captured: { handler: ((state: ChannelPinsState) => void) | null } = { handler: null };
    dataMock.listenChannelPinsFileChanged.mockImplementation(
      (handler: (state: ChannelPinsState) => void) => {
        captured.handler = handler;
        return Promise.resolve(() => {});
      },
    );
    const store = await freshStore();
    await store.start();

    const emit = captured.handler as ((state: ChannelPinsState) => void) | null;
    emit?.({ schemaVersion: 1, servers: { srv: ["hot"] } });

    expect(store.isPinned("srv", "hot")).toBe(true);
  });

  it("stop unsubscribes the file change listener", async () => {
    const unlisten = vi.fn();
    dataMock.listenChannelPinsFileChanged.mockResolvedValue(unlisten);
    const store = await freshStore();
    await store.start();
    store.stop();

    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("start is idempotent and does not double-subscribe", async () => {
    const store = await freshStore();
    await store.start();
    await store.start();

    expect(dataMock.listenChannelPinsFileChanged).toHaveBeenCalledTimes(1);
  });
});
