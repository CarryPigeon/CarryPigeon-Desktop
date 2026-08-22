/**
 * @fileoverview preferenceCatchUpScheduler.test.ts
 * @description chat/room-session｜application：偏好感知补拉调度器行为测试。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPreferenceCatchUpScheduler } from "./preferenceCatchUpScheduler";

const SOCKET = "sk-1:8080";

function build(overrides?: {
  getActiveServerSocket?: () => string;
  getActiveScopeVersion?: () => number;
  listNonAllChannels?: () => string[];
  refreshChannelLatestPage?: (cid: string) => Promise<void>;
}) {
  const refreshChannelLatestPage =
    overrides?.refreshChannelLatestPage ?? vi.fn(async () => undefined);
  let scopeVersion = 1;
  const deps = {
    intervalMs: 20_000,
    getActiveServerSocket: overrides?.getActiveServerSocket ?? (() => SOCKET),
    getActiveScopeVersion: overrides?.getActiveScopeVersion ?? (() => scopeVersion),
    listNonAllChannels:
      overrides?.listNonAllChannels ??
      vi.fn(() => ["c-muted", "c-mentions"]),
    refreshChannelLatestPage,
  };
  const scheduler = createPreferenceCatchUpScheduler(deps);
  return { scheduler, deps, setScopeVersion: (v: number) => (scopeVersion = v) };
}

describe("createPreferenceCatchUpScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("每个周期对非 all 频道各补拉一次", async () => {
    const { scheduler, deps } = build();
    scheduler.start(SOCKET);
    expect(scheduler.isRunningFor(SOCKET)).toBe(true);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(deps.listNonAllChannels).toHaveBeenCalledTimes(1);
    expect(deps.refreshChannelLatestPage).toHaveBeenCalledTimes(2);
    expect(deps.refreshChannelLatestPage).toHaveBeenCalledWith("c-muted");
    expect(deps.refreshChannelLatestPage).toHaveBeenCalledWith("c-mentions");

    await vi.advanceTimersByTimeAsync(20_000);
    expect(deps.refreshChannelLatestPage).toHaveBeenCalledTimes(4);
  });

  it("同一 key 重复 start 幂等；不同 key 先停旧再启新", async () => {
    const { scheduler, deps } = build();
    scheduler.start(SOCKET);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(deps.refreshChannelLatestPage).toHaveBeenCalledTimes(2);

    scheduler.start(SOCKET);
    await vi.advanceTimersByTimeAsync(20_000);
    // 仍只有一个定时器在跑
    expect(deps.refreshChannelLatestPage).toHaveBeenCalledTimes(4);

    scheduler.start("sk-2:8080");
    expect(scheduler.isRunningFor(SOCKET)).toBe(false);
    expect(scheduler.isRunningFor("sk-2:8080")).toBe(true);
  });

  it("scope 过期后跳过后续轮次", async () => {
    const { scheduler, deps, setScopeVersion } = build();
    scheduler.start(SOCKET);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(deps.refreshChannelLatestPage).toHaveBeenCalledTimes(2);

    setScopeVersion(2);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(deps.refreshChannelLatestPage).toHaveBeenCalledTimes(2);
  });

  it("stop 后不再补拉，且幂等", async () => {
    const { scheduler, deps } = build();
    scheduler.start(SOCKET);
    scheduler.stop();
    scheduler.stop();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(deps.refreshChannelLatestPage).not.toHaveBeenCalled();
    expect(scheduler.isRunningFor(SOCKET)).toBe(false);
  });

  it("单频道失败不影响同轮其余频道", async () => {
    const refreshChannelLatestPage = vi.fn(async (cid: string) => {
      if (cid === "c-muted") throw new Error("network down");
    });
    const { scheduler, deps } = build({ refreshChannelLatestPage });
    scheduler.start(SOCKET);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(deps.refreshChannelLatestPage).toHaveBeenCalledTimes(2);
  });

  it("空 socket key 不启动", () => {
    const { scheduler } = build();
    scheduler.start("");
    expect(scheduler.isRunningFor("")).toBe(false);
  });
});
