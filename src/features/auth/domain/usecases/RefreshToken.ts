/**
 * @fileoverview RefreshToken.ts
 * @description auth｜用例：RefreshToken。
 */

import type { AuthServicePort } from "../ports/AuthServicePort";
import type { AuthLoginResult } from "../types/AuthTypes";

/**
 * 刷新 access token 用例。
 */
export class RefreshToken {
  constructor(private readonly authService: AuthServicePort) {}

  /**
   * 使用 refresh token 刷新 access token。
   *
   * @param refreshToken - 当前 refresh token。
   * @returns 刷新后的登录结果（可能发生 refresh token 轮换）。
   */
  execute(refreshToken: string): Promise<AuthLoginResult> {
    return this.authService.refreshAccessToken(refreshToken);
  }
}
