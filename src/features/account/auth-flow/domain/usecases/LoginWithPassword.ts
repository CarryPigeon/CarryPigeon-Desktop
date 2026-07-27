/**
 * @fileoverview LoginWithPassword.ts
 * @description account/auth-flow｜用例：LoginWithPassword。
 */

import type { AuthServicePort } from "../ports/AuthServicePort";
import type { AuthLoginResult } from "../types/AuthTypes";

/**
 * 用户名密码登录用例。
 */
export class LoginWithPassword {
  constructor(private readonly authService: AuthServicePort) {}

  /**
   * 执行用户名密码登录。
   *
   * @param username - 用户名。
   * @param password - 密码。
   * @returns 登录结果（access/refresh token 等）。
   */
  execute(username: string, password: string): Promise<AuthLoginResult> {
    return this.authService.loginWithPassword(username, password);
  }
}
