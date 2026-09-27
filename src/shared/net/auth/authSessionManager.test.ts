/**
 * @fileoverview authSessionManager 单测：会话刷新与强制刷新语义。
 * @description
 * 回归背景：启动恢复直接用存储里的 access token 请求资料接口，401 就清空本地会话，
 * 导致重启后登录态丢失。修复后由 `forceRefreshAuthSession` 提供“强制刷新”通道。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const requestJsonMock = vi.fn();

// 只替换网络实现，其余逻辑走真实代码（含 singleflight 与存储写入）。
vi.mock("@/shared/net/http/httpJsonClient", () => ({
  HttpJsonClient: class {
    requestJson(...args: unknown[]): unknown {
      return requestJsonMock(...args);
    }
  },
}));

import { ensureValidAuthSession, forceRefreshAuthSession } from "./authSessionManager";
import { readAuthSession, writeAuthSession, type AuthSession } from "@/shared/utils/localState";

const SOCKET = "127.0.0.1:8080";

/** 构造一个 refresh 接口的合法响应。 */
function refreshResponse(accessToken: string, refreshToken: string): Record<string, unknown> {
  return { access_token: accessToken, refresh_token: refreshToken, expires_in: 3600, uid: "u1" };
}

/** 写入（或清空）本地会话。 */
function seedSession(session: AuthSession | null): void {
  writeAuthSession(SOCKET, session);
}

describe("authSessionManager", () => {
  beforeEach(() => {
    requestJsonMock.mockReset();
    localStorage.clear();
    seedSession(null);
  });

  describe("ensureValidAuthSession", () => {
    it("距过期尚远时不刷新，直接返回存储中的会话", async () => {
      seedSession({ accessToken: "old", refreshToken: "rt", expiresAtMs: Date.now() + 10 * 60_000 });

      const session = await ensureValidAuthSession(SOCKET);

      expect(session?.accessToken).toBe("old");
      expect(requestJsonMock).not.toHaveBeenCalled();
    });

    it("已过期时刷新并写回本地会话", async () => {
      seedSession({ accessToken: "expired", refreshToken: "rt", expiresAtMs: Date.now() - 1000 });
      requestJsonMock.mockResolvedValueOnce(refreshResponse("fresh", "rt2"));

      const session = await ensureValidAuthSession(SOCKET);

      expect(session?.accessToken).toBe("fresh");
      expect(requestJsonMock).toHaveBeenCalledWith("POST", "/auth/refresh", expect.objectContaining({ refresh_token: "rt" }));
      expect(readAuthSession(SOCKET)?.refreshToken).toBe("rt2");
    });

    it("刷新失败时保留原会话（不清会话）", async () => {
      seedSession({ accessToken: "expired", refreshToken: "rt", expiresAtMs: Date.now() - 1000 });
      requestJsonMock.mockRejectedValueOnce(new Error("network down"));

      const session = await ensureValidAuthSession(SOCKET);

      expect(session?.accessToken).toBe("expired");
      expect(readAuthSession(SOCKET)?.accessToken).toBe("expired");
    });

    it("没有会话时返回 null", async () => {
      expect(await ensureValidAuthSession(SOCKET)).toBeNull();
      expect(requestJsonMock).not.toHaveBeenCalled();
    });
  });

  describe("forceRefreshAuthSession", () => {
    it("忽略过期时间强制刷新（旧会话缺 expiresAtMs 时也能自救）", async () => {
      seedSession({ accessToken: "expired", refreshToken: "rt" });
      requestJsonMock.mockResolvedValueOnce(refreshResponse("fresh", "rt2"));

      const session = await forceRefreshAuthSession(SOCKET);

      expect(session?.accessToken).toBe("fresh");
      expect(readAuthSession(SOCKET)?.accessToken).toBe("fresh");
      expect(requestJsonMock).toHaveBeenCalledTimes(1);
    });

    it("没有 refresh token 时不发请求并返回 null", async () => {
      seedSession({ accessToken: "expired", refreshToken: "" });

      expect(await forceRefreshAuthSession(SOCKET)).toBeNull();
      expect(requestJsonMock).not.toHaveBeenCalled();
    });

    it("刷新失败时返回 null 且不动本地会话", async () => {
      seedSession({ accessToken: "expired", refreshToken: "rt" });
      requestJsonMock.mockRejectedValueOnce(new Error("boom"));

      expect(await forceRefreshAuthSession(SOCKET)).toBeNull();
      expect(readAuthSession(SOCKET)?.accessToken).toBe("expired");
    });

    it("空 socket 返回 null", async () => {
      expect(await forceRefreshAuthSession("   ")).toBeNull();
    });
  });
});
