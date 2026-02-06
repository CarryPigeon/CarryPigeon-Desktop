/**
 * @fileoverview httpAuthServicePort.ts
 * @description auth｜数据层实现：httpAuthServicePort。
 *
 * API 对齐说明：
 * - 认证相关接口与错误模型：见 `docs/api/*`
 * - required gate：PRD 5.6 + `required_plugin_missing`
 */

import { HttpJsonClient } from "@/shared/net/http/httpJsonClient";
import { isApiRequestError } from "@/shared/net/http/apiErrors";
import { getDeviceId } from "@/shared/utils/deviceId";
import type { AuthServicePort } from "../domain/ports/AuthServicePort";
import type { AuthLoginResult, TokenLoginResult } from "../domain/types/AuthTypes";
import { AuthRequiredPluginMissingError } from "../domain/errors/AuthErrors";
import { getPluginManagerPort } from "@/features/plugins/api";

type ApiTokenResponse = {
  token_type: string;
  access_token: string;
  expires_in: number;
  refresh_token: string;
  uid: string;
  is_new_user: boolean;
};

type ApiUserMeResponse = {
  uid: string;
  email?: string;
  nickname?: string;
  avatar?: string;
};

/**
 * 创建 HTTP 版本的 AuthServicePort。
 *
 * @param serverSocket - 服务端 socket。
 * @returns AuthServicePort 实现。
 */
export function createHttpAuthServicePort(serverSocket: string): AuthServicePort {
  const baseClient = new HttpJsonClient({ serverSocket, apiVersion: 1 });

  /**
   * 构造 required-gate 设计所需的 `installed_plugins[]` 载荷。
   *
   * @returns 用于认证请求的插件声明列表。
   */
  async function listInstalledPluginsForAuth(): Promise<Array<{ plugin_id: string; version: string }>> {
    try {
      const installed = await getPluginManagerPort().listInstalled(serverSocket);
      const out: Array<{ plugin_id: string; version: string }> = [];
      for (const p of installed) {
        const ok = Boolean(p.enabled) && p.status === "ok" && Boolean(p.currentVersion);
        if (!ok) continue;
        out.push({ plugin_id: p.pluginId, version: p.currentVersion as string });
      }
      return out;
    } catch {
      return [];
    }
  }

  /**
   * 尝试把 API error 转换为 auth 领域错误（可识别时）。
   *
   * @param e - HTTP client 抛出的未知错误。
   * @returns 该函数不会返回；只会抛出错误。
   */
  function rethrowIfRequiredGate(e: unknown): never {
    if (isApiRequestError(e) && e.reason === "required_plugin_missing") {
      const missing = Array.isArray(e.details.missing_plugins) ? (e.details.missing_plugins as unknown[]) : [];
      const ids = missing.map((x) => String(x).trim()).filter(Boolean);
      throw new AuthRequiredPluginMissingError({ reason: "required_plugin_missing", missing_plugins: ids });
    }
    throw e;
  }

  return {
    async loginWithEmailCode(email: string, code: string): Promise<AuthLoginResult> {
      const e = email.trim();
      const c = code.trim();
      if (!e || !c) throw new Error("Missing email or code");

      try {
        const installed_plugins = await listInstalledPluginsForAuth();
        const res = await baseClient.requestJson<ApiTokenResponse>("POST", "/auth/tokens", {
          grant_type: "email_code",
          email: e,
          code: c,
          client: {
            device_id: getDeviceId(),
            installed_plugins,
          },
        });
        const accessToken = String(res.access_token ?? "").trim();
        const refreshToken = String(res.refresh_token ?? "").trim();
        const expiresInSec = Number(res.expires_in ?? 0);
        if (!accessToken) throw new Error("Missing access_token");
        if (!refreshToken) throw new Error("Missing refresh_token");
        return {
          accessToken,
          refreshToken,
          expiresInSec: Number.isFinite(expiresInSec) ? Math.max(0, Math.trunc(expiresInSec)) : 0,
          uid: String(res.uid ?? "").trim(),
          isNewUser: Boolean(res.is_new_user),
        };
      } catch (err) {
        rethrowIfRequiredGate(err);
      }
    },
    async tokenLogin(token: string): Promise<TokenLoginResult> {
      const t = token.trim();
      if (!t) throw new Error("Missing token");

      const client = new HttpJsonClient({ serverSocket, apiVersion: 1, accessToken: t });
      try {
        const me = await client.requestJson<ApiUserMeResponse>("GET", "/users/me");
        return { accessToken: t, uid: String(me.uid ?? "").trim() };
      } catch (err) {
        if (isApiRequestError(err)) {
          throw new Error(`Token login failed: ${err.reason} (HTTP ${err.status})`);
        }
        throw err;
      }
    },
    async refreshAccessToken(refreshToken: string): Promise<AuthLoginResult> {
      const rt = refreshToken.trim();
      if (!rt) throw new Error("Missing refresh token");

      const res = await baseClient.requestJson<ApiTokenResponse>("POST", "/auth/refresh", {
        refresh_token: rt,
        client: { device_id: getDeviceId() },
      });
      const accessToken = String(res.access_token ?? "").trim();
      const nextRefreshToken = String(res.refresh_token ?? "").trim();
      const expiresInSec = Number(res.expires_in ?? 0);
      if (!accessToken) throw new Error("Missing access_token");
      if (!nextRefreshToken) throw new Error("Missing refresh_token");
      return {
        accessToken,
        refreshToken: nextRefreshToken,
        expiresInSec: Number.isFinite(expiresInSec) ? Math.max(0, Math.trunc(expiresInSec)) : 0,
        uid: String(res.uid ?? "").trim(),
        isNewUser: Boolean(res.is_new_user),
      };
    },
    async revokeRefreshToken(refreshToken: string): Promise<void> {
      const rt = refreshToken.trim();
      if (!rt) return;
      await baseClient.requestJson<void>("POST", "/auth/revoke", {
        refresh_token: rt,
        client: { device_id: getDeviceId() },
      });
    },
  };
}
