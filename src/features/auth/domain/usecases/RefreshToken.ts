/**
 * @fileoverview RefreshToken.ts
 * @description Usecase: refresh access token using refresh token.
 */

import type { AuthServicePort } from "../ports/AuthServicePort";
import type { AuthLoginResult } from "../types/AuthTypes";

/**
 * Refresh token usecase.
 */
export class RefreshToken {
  constructor(private readonly authService: AuthServicePort) {}

  /**
   * Refresh access token.
   *
   * @param refreshToken - Current refresh token.
   * @returns New authentication result with rotated tokens.
   */
  execute(refreshToken: string): Promise<AuthLoginResult> {
    return this.authService.refreshAccessToken(refreshToken);
  }
}
