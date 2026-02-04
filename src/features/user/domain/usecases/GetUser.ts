/**
 * @fileoverview GetUser.ts
 * @description Usecase: fetch a user's public profile.
 */

import type { UserServicePort } from "../ports/UserServicePort";
import type { UserPublic } from "../types/UserTypes";

/**
 * Get user usecase.
 */
export class GetUser {
  constructor(private readonly userService: UserServicePort) {}

  /**
   * Execute get user.
   *
   * @param accessToken - Bearer access token.
   * @param uid - User id.
   * @returns User public profile.
   */
  execute(accessToken: string, uid: string): Promise<UserPublic> {
    return this.userService.getUser(accessToken, uid);
  }
}
