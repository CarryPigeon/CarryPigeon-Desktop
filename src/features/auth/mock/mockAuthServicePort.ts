/**
 * @fileoverview mockAuthServicePort.ts
 * @description Mock AuthServicePort implementation for UI preview.
 *
 * Required plugins gate:
 * - If any required plugin is missing or not enabled/healthy, throws
 *   `AuthRequiredPluginMissingError` with `missing_plugins`.
 */

import { MOCK_LATENCY_MS } from "@/shared/config/runtime";
import { sleep } from "@/shared/mock/sleep";
import { MOCK_PLUGIN_CATALOG } from "@/shared/mock/mockPluginCatalog";
import { getMockPluginsState } from "@/shared/mock/mockPluginState";
import type { AuthServicePort } from "../domain/ports/AuthServicePort";
import type { AuthLoginResult, TokenLoginResult } from "../domain/types/AuthTypes";
import { AuthRequiredPluginMissingError } from "../domain/errors/AuthErrors";

/**
 * Create a mock AuthServicePort.
 *
 * @param serverSocket - Server socket (used as namespace for mock plugin state).
 * @returns AuthServicePort implementation.
 */
export function createMockAuthServicePort(serverSocket: string): AuthServicePort {
  return {
    async loginWithEmailCode(email: string, code: string): Promise<AuthLoginResult> {
      void code;
      await sleep(MOCK_LATENCY_MS);

      const required = MOCK_PLUGIN_CATALOG.filter((p) => p.required).map((p) => p.pluginId);
      const state = getMockPluginsState(serverSocket);
      const missing = required.filter((id) => !(state[id]?.enabled && state[id]?.status === "ok"));
      if (missing.length > 0) {
        throw new AuthRequiredPluginMissingError({
          reason: "required_plugin_missing",
          missing_plugins: missing,
        });
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
