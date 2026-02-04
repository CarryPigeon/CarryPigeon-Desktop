/**
 * @fileoverview UserServicePort.ts
 * @description Domain port: user profile operations.
 *
 * Implementations:
 * - `mock`: deterministic user data for UI preview
 * - `http`: real HTTP-backed user service
 */

import type { UserMe, UserPublic } from "../types/UserTypes";

/**
 * User service port.
 */
export interface UserServicePort {
  /**
   * Get current user profile.
   *
   * @param accessToken - Bearer access token.
   * @returns Current user profile.
   */
  getMe(accessToken: string): Promise<UserMe>;

  /**
   * Get a user's public profile.
   *
   * @param accessToken - Bearer access token.
   * @param uid - User id.
   * @returns User public profile.
   */
  getUser(accessToken: string, uid: string): Promise<UserPublic>;

  /**
   * Batch fetch user public profiles.
   *
   * @param accessToken - Bearer access token.
   * @param ids - User id list.
   * @returns User public profiles list.
   */
  listUsers(accessToken: string, ids: string[]): Promise<UserPublic[]>;

  /**
   * Update user email (requires verification code).
   *
   * @param email - New email.
   * @param code - Verification code.
   */
  updateUserEmail(email: string, code: string): Promise<void>;

  /**
   * Update user profile.
   *
   * @param username - New username.
   * @param avatar - Avatar id.
   * @param sex - Sex code.
   * @param brief - Bio.
   * @param birthday - Birthday timestamp.
   */
  updateUserProfile(
    username: string,
    avatar: number,
    sex: number,
    brief: string,
    birthday: number,
  ): Promise<void>;
}
