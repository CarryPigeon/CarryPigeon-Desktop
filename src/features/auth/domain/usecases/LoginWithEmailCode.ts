/**
 * @fileoverview LoginWithEmailCode.ts
 * @description Usecase: authenticate user via email + verification code.
 */

import type { AuthServicePort } from "../ports/AuthServicePort";
import type { AuthLoginResult } from "../types/AuthTypes";

/**
 * Login with email code usecase.
 */
export class LoginWithEmailCode {
  constructor(private readonly authService: AuthServicePort) {}

  /**
   * Execute email code login.
   *
   * @param email - User email address.
   * @param code - Verification code.
   * @returns Authentication result.
   */
  execute(email: string, code: string): Promise<AuthLoginResult> {
    return this.authService.loginWithEmailCode(email, code);
  }
}
