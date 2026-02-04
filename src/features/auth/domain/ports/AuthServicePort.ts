/**
 * @fileoverview AuthServicePort.ts
 * @description Domain port: authentication operations (login, token refresh, revoke).
 *
 * Implementations:
 * - `mock`: deterministic auth for UI preview
 * - `http`: real HTTP-backed auth service
 */

import type { AuthLoginResult, TokenLoginResult } from "../types/AuthTypes";

/**
 * Authentication service port.
 */
export interface AuthServicePort {
  /**
   * Authenticate user via email + verification code.
   *
   * @param email - User email address.
   * @param code - Verification code sent to email.
   * @returns Authentication result with tokens.
   * @throws AuthRequiredPluginMissingError when required plugins are not satisfied.
   */
  loginWithEmailCode(email: string, code: string): Promise<AuthLoginResult>;

  /**
   * Validate an existing access token and retrieve user info.
   *
   * @param token - Access token to validate.
   * @returns Token login result with uid.
   */
  tokenLogin(token: string): Promise<TokenLoginResult>;

  /**
   * Refresh access token using refresh token.
   *
   * @param refreshToken - Refresh token.
   * @returns New authentication result with rotated tokens.
   */
  refreshAccessToken(refreshToken: string): Promise<AuthLoginResult>;

  /**
   * Revoke a refresh token (logout).
   *
   * @param refreshToken - Refresh token to revoke.
   */
  revokeRefreshToken(refreshToken: string): Promise<void>;
}
