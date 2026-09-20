/**
 * @fileoverview useServerLogout.test.ts
 * @description server-connection/rack｜composable：按服务器退出登录的单元测试。
 *
 * 覆盖：活动服务器完整退出（吊销 + 清 workspace + 清用户快照）、非活动服务器仅清本机登录态、
 * refresh token 缺失/吊销失败时的 best-effort 行为。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revokeToken: vi.fn(async (_token: string) => {}),
  clearSnapshot: vi.fn(),
  clearCurrentWorkspace: vi.fn(async (_socket: string) => {}),
  readRefreshToken: vi.fn((_socket: string) => "refresh-token"),
  clearAuthAndResumeState: vi.fn((_socket: string) => {}),
  currentSocket: { value: "http://a.example:8080" },
}));

vi.mock("@/features/account/api", () => ({
  getAccountCapabilities: () => ({
    forServer: (_socket: string) => ({ revokeToken: mocks.revokeToken }),
    currentUser: { clearSnapshot: mocks.clearSnapshot },
  }),
}));

vi.mock("@/features/server-connection/api", () => ({
  currentServerSocket: mocks.currentSocket,
  getServerConnectionCapabilities: () => ({
    scopeLifecycle: { clearCurrentWorkspace: mocks.clearCurrentWorkspace },
  }),
}));

vi.mock("@/shared/utils/localState", () => ({
  readRefreshToken: mocks.readRefreshToken,
  clearAuthAndResumeState: mocks.clearAuthAndResumeState,
}));

import { useServerLogout } from "./useServerLogout";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentSocket.value = "http://a.example:8080";
  mocks.readRefreshToken.mockReturnValue("refresh-token");
  mocks.revokeToken.mockResolvedValue(undefined);
  mocks.clearCurrentWorkspace.mockResolvedValue(undefined);
});

describe("useServerLogout", () => {
  it("退出当前活动服务器：吊销凭证并清理 workspace 与用户快照", async () => {
    const { logoutServer, loggingOut } = useServerLogout();

    const outcome = await logoutServer("http://a.example:8080");

    expect(outcome).toEqual({ ok: true, activeSessionCleared: true });
    expect(mocks.revokeToken).toHaveBeenCalledWith("refresh-token");
    expect(mocks.clearAuthAndResumeState).toHaveBeenCalledWith("http://a.example:8080");
    expect(mocks.clearCurrentWorkspace).toHaveBeenCalledWith("http://a.example:8080");
    expect(mocks.clearSnapshot).toHaveBeenCalledTimes(1);
    expect(loggingOut.value).toBe(false);
  });

  it("退出非活动服务器：只清理该服务器的本地登录态，不动当前会话", async () => {
    const { logoutServer } = useServerLogout();

    const outcome = await logoutServer("http://b.example:8080");

    expect(outcome).toEqual({ ok: true, activeSessionCleared: false });
    expect(mocks.revokeToken).toHaveBeenCalledWith("refresh-token");
    expect(mocks.readRefreshToken).toHaveBeenCalledWith("http://b.example:8080");
    expect(mocks.clearAuthAndResumeState).toHaveBeenCalledWith("http://b.example:8080");
    expect(mocks.clearCurrentWorkspace).not.toHaveBeenCalled();
    expect(mocks.clearSnapshot).not.toHaveBeenCalled();
  });

  it("没有 refresh token 时跳过吊销，但仍清理本地登录态", async () => {
    mocks.readRefreshToken.mockReturnValue("");
    const { logoutServer } = useServerLogout();

    const outcome = await logoutServer("http://a.example:8080");

    expect(outcome.ok).toBe(true);
    expect(mocks.revokeToken).not.toHaveBeenCalled();
    expect(mocks.clearAuthAndResumeState).toHaveBeenCalledTimes(1);
  });

  it("服务端吊销失败不影响本地退出（best-effort）", async () => {
    mocks.revokeToken.mockRejectedValue(new Error("network down"));
    const { logoutServer } = useServerLogout();

    const outcome = await logoutServer("http://a.example:8080");

    expect(outcome.ok).toBe(true);
    expect(mocks.clearAuthAndResumeState).toHaveBeenCalledTimes(1);
  });

  it("socket 为空时直接返回失败，不触发任何清理", async () => {
    const { logoutServer } = useServerLogout();

    const outcome = await logoutServer("   ");

    expect(outcome.ok).toBe(false);
    expect(mocks.revokeToken).not.toHaveBeenCalled();
    expect(mocks.clearAuthAndResumeState).not.toHaveBeenCalled();
  });
});
