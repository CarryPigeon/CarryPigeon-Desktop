/**
 * @fileoverview mockAuthServicePort.ts
 * @description auth｜Mock 实现：mockAuthServicePort（用于本地预览/测试）。
 *
 * required 插件闸门：
 * - 若任何 required 插件缺失或未启用/不健康，则抛出 `AuthRequiredPluginMissingError`，
 *   并携带 `missing_plugins`。
 */

import { MOCK_DISABLE_REQUIRED_GATE, MOCK_LATENCY_MS } from "@/shared/config/runtime";
import { sleep } from "@/shared/mock/sleep";
import { MOCK_PLUGIN_CATALOG } from "@/shared/mock/mockPluginCatalog";
import { getMockPluginsState } from "@/shared/mock/mockPluginState";
import type { AuthServicePort } from "../domain/ports/AuthServicePort";
import type { AuthLoginResult, TokenLoginResult } from "../domain/types/AuthTypes";
import { AuthRequiredPluginMissingError } from "../domain/errors/AuthErrors";

/**
 * 创建 `AuthServicePort` 的 mock 实现。
 *
 * @param serverSocket - 服务器 Socket 地址（用于 mock 插件状态的命名空间隔离）。
 * @returns `AuthServicePort` 实现。
 */
export function createMockAuthServicePort(serverSocket: string): AuthServicePort {
  return {
    async loginWithEmailCode(email: string, code: string): Promise<AuthLoginResult> {
      void code;
      await sleep(MOCK_LATENCY_MS);

      if (!MOCK_DISABLE_REQUIRED_GATE) {
        const required = MOCK_PLUGIN_CATALOG.filter((p) => p.required).map((p) => p.pluginId);
        const state = getMockPluginsState(serverSocket);
        const missing = required.filter((id) => !(state[id]?.enabled && state[id]?.status === "ok"));
        if (missing.length > 0) {
          throw new AuthRequiredPluginMissingError({
            reason: "required_plugin_missing",
            missing_plugins: missing,
          });
        }
      }

      return {
        accessToken: `mock-access:${email.trim().toLowerCase()}:${Date.now()}`,
        refreshToken: `mock-refresh:${email.trim().toLowerCase()}:${Date.now()}`,
        expiresInSec: 1800,
        uid: "1",
        isNewUser: false,
      };
    },
    async tokenLogin(token: string): Promise<TokenLoginResult> {
      await sleep(MOCK_LATENCY_MS);
      if (!token.trim()) throw new Error("Missing token");
      return { accessToken: token, uid: "1" };
    },
    async refreshAccessToken(refreshToken: string): Promise<AuthLoginResult> {
      await sleep(MOCK_LATENCY_MS);
      if (!refreshToken.trim()) throw new Error("Missing refresh token");
      return {
        accessToken: `mock-access:refreshed:${Date.now()}`,
        refreshToken: `mock-refresh:rotated:${Date.now()}`,
        expiresInSec: 1800,
        uid: "1",
        isNewUser: false,
      };
    },
    async revokeRefreshToken(refreshToken: string): Promise<void> {
      void refreshToken;
      await sleep(MOCK_LATENCY_MS);
    },
  };
}
