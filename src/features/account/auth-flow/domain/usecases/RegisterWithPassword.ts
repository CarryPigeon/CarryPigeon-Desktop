/**
 * @fileoverview RegisterWithPassword.ts
 * @description account/auth-flow｜用例：RegisterWithPassword。
 */

import type { AuthServicePort } from "../ports/AuthServicePort";
import type { AuthRegisterResult } from "../types/AuthTypes";

/**
 * 用户名密码注册用例（不签发 token）。
 */
export class RegisterWithPassword {
  constructor(private readonly authService: AuthServicePort) {}

  /**
   * 执行用户名密码注册。
   *
   * @param username - 用户名。
   * @param password - 密码。
   * @returns 注册结果（uid / username）。
   */
  execute(username: string, password: string): Promise<AuthRegisterResult> {
    return this.authService.registerWithPassword(username, password);
  }
}
