/**
 * @fileoverview LoginWithEmailCode.ts
 * @description auth｜用例：LoginWithEmailCode。
 */

import type { AuthServicePort } from "../ports/AuthServicePort";
import type { AuthLoginResult } from "../types/AuthTypes";

/**
 * 邮箱验证码登录用例。
 */
export class LoginWithEmailCode {
  constructor(private readonly authService: AuthServicePort) {}

  /**
   * 执行邮箱验证码登录。
   *
   * @param email - 用户邮箱地址。
   * @param code - 邮箱验证码。
   * @returns 登录结果（access/refresh token 等）。
   */
  execute(email: string, code: string): Promise<AuthLoginResult> {
    return this.authService.loginWithEmailCode(email, code);
  }
}
