/**
 * @fileoverview useChannelMuteStore.test.ts
 * @description 测试 useChannelMuteStore：通知级别、切换、定时静音、到期回收。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = {
  getPreferences: vi.fn(),
  setServerPreference: vi.fn(),
  setChannelPreference: vi.fn(),
};

vi.mock("@/features/chat/notification-preferences/data/httpNotificationPreferenceApi", () => ({
  createHttpNotificationPreferenceApi: () => apiMock,
}));

import {
  MUTE_DURATION_1H,
  MUTE_DURATION_8H,
  MUTE_DURATION_24H,
  MUTE_DURATION_FOREVER,
  useChannelMuteStore,
} from "./useChannelMuteStore";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useChannelMuteStore", () => {
  it("setNotificationLevel writes mode and clears mutedUntil when null is passed", async () => {
    apiMock.setChannelPreference.mockResolvedValueOnce(undefined);
    const store = useChannelMuteStore();
    await store.setNotificationLevel("c1", "muted", "srv", "tok", null);
    expect(apiMock.setChannelPreference).toHaveBeenCalledWith("srv", "tok", "c1", {
      mode: "muted",
    });
    expect(store.getMutedUntil("c1")).toBeUndefined();
  });

  it("setNotificationLevel forwards mutedUntilMs when provided", async () => {
    apiMock.setChannelPreference.mockResolvedValueOnce(undefined);
    const store = useChannelMuteStore();
    const future = Date.now() + 3_600_000;
    await store.setNotificationLevel("c2", "muted", "srv", "tok", future);
    expect(apiMock.setChannelPreference).toHaveBeenCalledWith("srv", "tok", "c2", {
      mode: "muted",
      muted_until: future,
    });
    expect(store.getMutedUntil("c2")).toBe(future);
  });

  it("setNotificationLevelForDuration sets now+duration for positive duration", async () => {
    apiMock.setChannelPreference.mockResolvedValueOnce(undefined);
    const store = useChannelMuteStore();
    const before = Date.now();
    await store.setNotificationLevelForDuration("c3", "muted", MUTE_DURATION_1H, "srv", "tok");
    const after = Date.now();
    const muted = store.getMutedUntil("c3") ?? 0;
    expect(muted).toBeGreaterThanOrEqual(before + MUTE_DURATION_1H);
    expect(muted).toBeLessThanOrEqual(after + MUTE_DURATION_1H);
  });

  it("setNotificationLevelForDuration clears mutedUntil when duration <= 0 (forever mute)", async () => {
    apiMock.setChannelPreference.mockResolvedValueOnce(undefined);
    const store = useChannelMuteStore();
    await store.setNotificationLevelForDuration("c4", "muted", MUTE_DURATION_FOREVER, "srv", "tok");
    expect(apiMock.setChannelPreference).toHaveBeenCalledWith("srv", "tok", "c4", {
      mode: "muted",
    });
    expect(store.getMutedUntil("c4")).toBeUndefined();
  });

  it("setNotificationLevelForDuration covers 8h and 24h presets", async () => {
    apiMock.setChannelPreference.mockResolvedValue(undefined);
    const store = useChannelMuteStore();
    const before = Date.now();
    await store.setNotificationLevelForDuration("c8h", "muted", MUTE_DURATION_8H, "srv", "tok");
    await store.setNotificationLevelForDuration("c24h", "muted", MUTE_DURATION_24H, "srv", "tok");
    const after = Date.now();
    const m8h = store.getMutedUntil("c8h") ?? 0;
    const m24h = store.getMutedUntil("c24h") ?? 0;
    expect(m8h).toBeGreaterThanOrEqual(before + MUTE_DURATION_8H);
    expect(m8h).toBeLessThanOrEqual(after + MUTE_DURATION_8H);
    expect(m24h).toBeGreaterThanOrEqual(before + MUTE_DURATION_24H);
    expect(m24h).toBeLessThanOrEqual(after + MUTE_DURATION_24H);
  });

  it("reapExpiredMutes resets expired channels to all and returns their ids", () => {
    const store = useChannelMuteStore();
    const past = Date.now() - 1000;
    const future = Date.now() + 60_000;
    store.channelLevels.value = new Map([
      ["expired", "muted" as const],
      ["active", "muted" as const],
      ["not-muted", "all" as const],
    ]);
    store.channelMutedUntil.value = new Map([
      ["expired", past],
      ["active", future],
    ]);
    const expired = store.reapExpiredMutes(Date.now());
    expect(expired).toEqual(["expired"]);
    expect(store.getNotificationLevel("expired")).toBe("all");
    expect(store.getMutedUntil("expired")).toBeUndefined();
    expect(store.getNotificationLevel("active")).toBe("muted");
    expect(store.getMutedUntil("active")).toBe(future);
  });

  it("refresh parses per-channel muted_until", async () => {
    apiMock.getPreferences.mockResolvedValueOnce({
      server: { mode: "all" },
      channels: [
        { cid: "cA", mode: "muted", muted_until: 1_700_000_000_000 },
        { cid: "cB", mode: "mentions_only" },
        { cid: "cC", mode: "all" },
      ],
    });
    const store = useChannelMuteStore();
    await store.refresh("srv", "tok");
    expect(store.getNotificationLevel("cA")).toBe("muted");
    expect(store.getMutedUntil("cA")).toBe(1_700_000_000_000);
    expect(store.getMutedUntil("cB")).toBeUndefined();
  });
});
