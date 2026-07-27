/**
 * @fileoverview AuthTypes.ts
 * @description account/auth-flow｜领域类型：AuthTypes。
 */

/**
 * Authentication login result containing tokens and user info.
 */
export type AuthLoginResult = {
  /**
   * Bearer token used for HTTP Authorization and WS auth.
   */
  accessToken: string;
  /**
   * Refresh token used for session refresh/revoke.
   */
  refreshToken: string;
  /**
   * Access token TTL (seconds) returned by the server.
   */
  expiresInSec: number;
  /**
   * User id (Snowflake string).
   */
  uid: string;
  /**
   * Whether this session was created for a new user (server decision).
   */
  isNewUser: boolean;
};

/**
 * Password registration result（`POST /auth/register`；不签发 token）。
 */
export type AuthRegisterResult = {
  uid: string;
  username: string;
};

/**
 * Token login result (minimal).
 */
export type TokenLoginResult = {
  accessToken: string;
  uid: string;
};
