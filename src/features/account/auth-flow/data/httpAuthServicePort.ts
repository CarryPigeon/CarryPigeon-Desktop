/**
 * @fileoverview httpAuthServicePort.ts
 * @description account/auth-flow｜数据层实现：httpAuthServicePort。
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
import { AuthError, AuthRequiredPluginMissingError } from "../domain/errors/AuthErrors";
import { buildInstalledPluginsPayload } from "./installedPluginsPayload";

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
   * 尝试把 API error 转换为 auth 领域错误（可识别时）。
   *
   * @param e - HTTP client 抛出的未知错误。
   * @returns 无返回值；仅在命中 required gate 时抛错。
   */
  function throwIfRequiredGate(e: unknown): void {
    if (isApiRequestError(e) && e.reason === "required_plugin_missing") {
      const missing = Array.isArray(e.details.missing_plugins) ? (e.details.missing_plugins as unknown[]) : [];
      const ids = missing.map((x) => String(x).trim()).filter(Boolean);
      throw new AuthRequiredPluginMissingError({ reason: "required_plugin_missing", missing_plugins: ids });
    }
  }

  /**
   * 将未知异常归一化为 AuthError。
   *
   * @param code - 错误码。
   * @param fallback - 回退文案。
   * @param error - 原始异常。
   * @returns 该函数不会返回；只会抛出 AuthError。
   */
  function rethrowAsAuthError(code: AuthError["code"], fallback: string, error: unknown): never {
    if (error instanceof AuthError) throw error;
    if (isApiRequestError(error)) {
      throw new AuthError({
        code,
        message: `${fallback}: ${error.reason} (HTTP ${error.status})`,
        status: error.status,
        reason: error.reason,
        details: error.details,
        cause: error,
      });
    }
    throw new AuthError({ code, message: String(error) || fallback, cause: error });
  }

  return {
    async loginWithEmailCode(email: string, code: string): Promise<AuthLoginResult> {
      const e = email.trim();
      const c = code.trim();
      if (!e || !c) throw new AuthError({ code: "missing_email_or_code", message: "Missing email or code." });

      try {
        const installed_plugins = await buildInstalledPluginsPayload(serverSocket, { bestEffort: true });
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
        if (!accessToken) throw new AuthError({ code: "login_failed", message: "Missing access_token in login response." });
        if (!refreshToken) throw new AuthError({ code: "login_failed", message: "Missing refresh_token in login response." });
        return {
          accessToken,
          refreshToken,
          expiresInSec: Number.isFinite(expiresInSec) ? Math.max(0, Math.trunc(expiresInSec)) : 0,
          uid: String(res.uid ?? "").trim(),
          isNewUser: Boolean(res.is_new_user),
        };
      } catch (err) {
        throwIfRequiredGate(err);
        rethrowAsAuthError("login_failed", "Login failed", err);
      }
    },
    async tokenLogin(token: string): Promise<TokenLoginResult> {
      const t = token.trim();
      if (!t) throw new AuthError({ code: "missing_token", message: "Missing token." });

      const client = new HttpJsonClient({ serverSocket, apiVersion: 1, accessToken: t });
      try {
        const me = await client.requestJson<ApiUserMeResponse>("GET", "/users/me");
        return { accessToken: t, uid: String(me.uid ?? "").trim() };
      } catch (err) {
        rethrowAsAuthError("token_login_failed", "Token login failed", err);
      }
    },
    async refreshAccessToken(refreshToken: string): Promise<AuthLoginResult> {
      const rt = refreshToken.trim();
      if (!rt) throw new AuthError({ code: "missing_refresh_token", message: "Missing refresh token." });

      try {
        const res = await baseClient.requestJson<ApiTokenResponse>("POST", "/auth/refresh", {
          refresh_token: rt,
          client: { device_id: getDeviceId() },
        });
        const accessToken = String(res.access_token ?? "").trim();
        const nextRefreshToken = String(res.refresh_token ?? "").trim();
        const expiresInSec = Number(res.expires_in ?? 0);
        if (!accessToken) throw new AuthError({ code: "refresh_failed", message: "Missing access_token in refresh response." });
        if (!nextRefreshToken) throw new AuthError({ code: "refresh_failed", message: "Missing refresh_token in refresh response." });
        return {
          accessToken,
          refreshToken: nextRefreshToken,
          expiresInSec: Number.isFinite(expiresInSec) ? Math.max(0, Math.trunc(expiresInSec)) : 0,
          uid: String(res.uid ?? "").trim(),
          isNewUser: Boolean(res.is_new_user),
        };
      } catch (err) {
        rethrowAsAuthError("refresh_failed", "Refresh token failed", err);
      }
    },
    async revokeRefreshToken(refreshToken: string): Promise<void> {
      const rt = refreshToken.trim();
      if (!rt) return;
      try {
        await baseClient.requestJson<void>("POST", "/auth/revoke", {
          refresh_token: rt,
          client: { device_id: getDeviceId() },
        });
      } catch (err) {
        rethrowAsAuthError("revoke_failed", "Revoke token failed", err);
      }
    },
  };
}
