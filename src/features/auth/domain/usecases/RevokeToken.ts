/**
 * @fileoverview RevokeToken.ts
 * @description Usecase: revoke refresh token (logout).
 */

import type { AuthServicePort } from "../ports/AuthServicePort";

/**
 * Revoke token usecase.
 */
export class RevokeToken {
  constructor(private readonly authService: AuthServicePort) {}

  /**
   * Revoke a refresh token.
   *
   * @param refreshToken - Refresh token to revoke.
   * @returns Promise<void>.
   */
  execute(refreshToken: string): Promise<void> {
    return this.authService.revokeRefreshToken(refreshToken);
  }
}
