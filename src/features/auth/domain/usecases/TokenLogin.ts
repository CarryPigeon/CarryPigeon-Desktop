/**
 * @fileoverview TokenLogin.ts
 * @description auth｜用例：TokenLogin。
 */

import type { AuthServicePort } from "../ports/AuthServicePort";
import type { TokenLoginResult } from "../types/AuthTypes";

/**
 * token 登录用例。
 */
export class TokenLogin {
  constructor(private readonly authService: AuthServicePort) {}

  /**
   * 校验并使用已有 access token 获取用户信息。
   *
   * @param token - 要校验的 access token。
   * @returns token 登录结果（包含 uid）。
   */
  execute(token: string): Promise<TokenLoginResult> {
    return this.authService.tokenLogin(token);
  }
}
