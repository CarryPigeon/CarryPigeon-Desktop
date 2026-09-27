/**
 * @fileoverview currentUserRestore 单测：启动恢复当前用户时的鉴权自救策略。
 * @description
 * 回归背景：启动恢复用过期 access token 请求 `GET /users/me`，401 直接清空本地会话，
 * 造成重启后登录态丢失（频道列表空）。修复后仅“刷新也失败”才判定会话失效。
 */

import { describe, expect, it, vi } from "vitest";
import {
  mergeUidIntoSession,
  syncCurrentUserWithRefresh,
  type CurrentUserRestoreDeps,
} from "./currentUserRestore";

/** 构造带 HTTP 状态码的错误。 */
function httpError(status: number): Error & { status: number } {
  const error = new Error(`http ${status}`) as Error & { status: number };
  error.status = status;
  return error;
}

const isAuthFailure = (error: unknown): boolean =>
  typeof (error as { status?: unknown } | null)?.status === "number" &&
  [401, 403].includes((error as { status: number }).status);

describe("syncCurrentUserWithRefresh", () => {
  it("首次同步成功：不触发刷新", async () => {
    const sync = vi.fn(async (token: string) => `user:${token}`);
    const refresh = vi.fn(async () => "fresh");
    const deps: CurrentUserRestoreDeps<string> = {
      initialAccessToken: "old",
      sync,
      refresh,
      isAuthFailure,
    };

    const outcome = await syncCurrentUserWithRefresh(deps);

    expect(outcome).toEqual({ ok: true, value: "user:old" });
    expect(refresh).not.toHaveBeenCalled();
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("401 后刷新成功：用新 token 重试一次", async () => {
    const sync = vi.fn(async (token: string) => {
      if (token === "expired") throw httpError(401);
      return `user:${token}`;
    });
    const refresh = vi.fn(async () => "fresh");
    const deps: CurrentUserRestoreDeps<string> = {
      initialAccessToken: "expired",
      sync,
      refresh,
      isAuthFailure,
    };

    const outcome = await syncCurrentUserWithRefresh(deps);

    expect(outcome).toEqual({ ok: true, value: "user:fresh" });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(sync.mock.calls.map((call) => call[0])).toEqual(["expired", "fresh"]);
  });

  it("401 且拿不到新 token：判定会话失效（调用方清会话）", async () => {
    const sync = vi.fn(async () => {
      throw httpError(401);
    });
    const refresh = vi.fn(async () => null);
    const deps: CurrentUserRestoreDeps<string> = {
      initialAccessToken: "expired",
      sync,
      refresh,
      isAuthFailure,
    };

    expect(await syncCurrentUserWithRefresh(deps)).toEqual({ ok: false, authFailure: true });
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("刷新后重试仍 401：判定会话失效", async () => {
    const sync = vi.fn(async () => {
      throw httpError(403);
    });
    const deps: CurrentUserRestoreDeps<string> = {
      initialAccessToken: "expired",
      sync,
      refresh: async () => "fresh",
      isAuthFailure,
    };

    expect(await syncCurrentUserWithRefresh(deps)).toEqual({ ok: false, authFailure: true });
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("非鉴权错误（网络不可达）：不刷新、不清会话", async () => {
    const sync = vi.fn(async () => {
      throw new Error("network down");
    });
    const refresh = vi.fn(async () => "fresh");
    const deps: CurrentUserRestoreDeps<string> = {
      initialAccessToken: "old",
      sync,
      refresh,
      isAuthFailure,
    };

    expect(await syncCurrentUserWithRefresh(deps)).toEqual({ ok: false, authFailure: false });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("刷新后重试遇到网络错误：不清会话（authFailure=false）", async () => {
    const sync = vi.fn(async (token: string) => {
      if (token === "expired") throw httpError(401);
      throw new Error("network down");
    });
    const deps: CurrentUserRestoreDeps<string> = {
      initialAccessToken: "expired",
      sync,
      refresh: async () => "fresh",
      isAuthFailure,
    };

    expect(await syncCurrentUserWithRefresh(deps)).toEqual({ ok: false, authFailure: false });
  });
});

describe("mergeUidIntoSession", () => {
  it("以存储中的最新会话为基准（刷新后的新 token 不被旧快照覆盖）", () => {
    const persisted = { accessToken: "fresh", refreshToken: "rt2", uid: undefined };
    const stale = { accessToken: "expired", refreshToken: "rt1", uid: undefined };

    expect(mergeUidIntoSession(persisted, stale, "u1")).toEqual({
      accessToken: "fresh",
      refreshToken: "rt2",
      uid: "u1",
    });
  });

  it("存储为空时退化为进入时的快照", () => {
    const fallback = { accessToken: "a", refreshToken: "r", uid: undefined };

    expect(mergeUidIntoSession(null, fallback, "u1")).toEqual({ accessToken: "a", refreshToken: "r", uid: "u1" });
  });

  it("uid 已一致时无需回写（返回 null，避免多余写盘）", () => {
    const session = { accessToken: "a", refreshToken: "r", uid: "u1" };

    expect(mergeUidIntoSession(session, session, "u1")).toBeNull();
  });

  it("uid 不一致时以存储中的 uid 为基准更新", () => {
    const persisted = { accessToken: "fresh", refreshToken: "rt2", uid: "old" };
    const stale: { accessToken: string; refreshToken: string; uid?: string } = {
      accessToken: "stale",
      refreshToken: "rt1",
    };

    expect(mergeUidIntoSession(persisted, stale, "u2")).toEqual({
      accessToken: "fresh",
      refreshToken: "rt2",
      uid: "u2",
    });
  });
});
