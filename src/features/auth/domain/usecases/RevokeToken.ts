/**
 * @fileoverview RevokeToken.ts
 * @description auth｜用例：RevokeToken。
 */

import type { AuthServicePort } from "../ports/AuthServicePort";

/**
 * 撤销 refresh token 用例（通常用于退出登录）。
 */
export class RevokeToken {
  constructor(private readonly authService: AuthServicePort) {}

  /**
   * 撤销 refresh token。
   *
   * @param refreshToken - 要撤销的 refresh token。
   * @returns Promise<void>。
   */
  execute(refreshToken: string): Promise<void> {
    return this.authService.revokeRefreshToken(refreshToken);
  }
}
