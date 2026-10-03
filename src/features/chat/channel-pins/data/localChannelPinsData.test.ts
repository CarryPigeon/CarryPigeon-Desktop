/**
 * @fileoverview localChannelPinsData.test.ts
 * @description 测试置顶频道数据访问：载荷归一化与 command 参数。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = {
  invokeTauri: vi.fn(),
  safeInvokeTauri: vi.fn(),
};

vi.mock("@/shared/tauri/invokeClient", () => ({
  invokeTauri: (...args: unknown[]) => invokeMock.invokeTauri(...args),
  safeInvokeTauri: (...args: unknown[]) => invokeMock.safeInvokeTauri(...args),
}));

vi.mock("@/shared/tauri/events", () => ({
  listenChannelPinsChanged: () => Promise.resolve(() => {}),
}));

import {
  getChannelPinsFilePath,
  loadChannelPins,
  setChannelPinned,
  toggleChannelPinned,
} from "./localChannelPinsData";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("localChannelPinsData", () => {
  it("normalizes malformed server maps from the backend", async () => {
    invokeMock.safeInvokeTauri.mockResolvedValue({
      schemaVersion: 9,
      servers: {
        srv: ["c1", 2, "", "c2"],
        bad: "not-an-array",
      },
    });

    const state = await loadChannelPins();
    expect(state.schemaVersion).toBe(9);
    expect(state.servers).toEqual({ srv: ["c1", "c2"] });
  });

  it("returns empty state when Tauri is unavailable", async () => {
    invokeMock.safeInvokeTauri.mockResolvedValue(undefined);
    const state = await loadChannelPins();
    expect(state).toEqual({ schemaVersion: 1, servers: {} });
  });

  it("forwards pin arguments to the backend", async () => {
    invokeMock.invokeTauri.mockResolvedValue({ schemaVersion: 1, servers: {} });
    await setChannelPinned("srv", "c1", true);
    expect(invokeMock.invokeTauri).toHaveBeenCalledWith("channel_pins_set", {
      serverSocket: "srv",
      channelId: "c1",
      pinned: true,
    });

    await toggleChannelPinned("srv", "c1");
    expect(invokeMock.invokeTauri).toHaveBeenCalledWith("channel_pins_toggle", {
      serverSocket: "srv",
      channelId: "c1",
    });
  });

  it("returns null file path fallback when command yields nothing", async () => {
    invokeMock.safeInvokeTauri.mockResolvedValue(undefined);
    expect(await getChannelPinsFilePath()).toBeNull();
  });
});
