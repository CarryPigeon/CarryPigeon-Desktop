/**
 * @fileoverview AuthServicePort.ts
 * @description auth｜领域端口：AuthServicePort。
 *
 * 实现说明：
 * - `mock`：用于 UI 预览/开发联调的确定性实现
 * - `http`：基于后端 API 的真实实现
 */

import type { AuthLoginResult, TokenLoginResult } from "../types/AuthTypes";

/**
 * 认证服务端口（领域层）。
 */
export interface AuthServicePort {
  /**
   * 使用邮箱 + 验证码登录并获取 token。
   *
   * @param email - 用户邮箱地址。
   * @param code - 邮箱验证码。
   * @returns 登录结果（access/refresh token 等）。
   * @throws AuthRequiredPluginMissingError 当 required gate 不满足（缺少必需插件）时抛出。
   */
  loginWithEmailCode(email: string, code: string): Promise<AuthLoginResult>;

  /**
   * 校验并使用已有 access token 获取用户信息。
   *
   * @param token - 要校验的 access token。
   * @returns token 登录结果（包含 uid）。
   */
  tokenLogin(token: string): Promise<TokenLoginResult>;

  /**
   * 使用 refresh token 刷新 access token。
   *
   * @param refreshToken - refresh token。
   * @returns 刷新后的登录结果（可能发生 refresh token 轮换）。
   */
  refreshAccessToken(refreshToken: string): Promise<AuthLoginResult>;

  /**
   * 撤销 refresh token（通常用于退出登录）。
   *
   * @param refreshToken - 要撤销的 refresh token。
   */
  revokeRefreshToken(refreshToken: string): Promise<void>;
}
