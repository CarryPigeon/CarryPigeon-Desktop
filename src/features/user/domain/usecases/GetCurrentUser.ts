/**
 * @fileoverview GetCurrentUser.ts
 * @description Usecase: fetch current user profile.
 */

import type { UserServicePort } from "../ports/UserServicePort";
import type { UserMe } from "../types/UserTypes";

/**
 * Get current user usecase.
 */
export class GetCurrentUser {
  constructor(private readonly userService: UserServicePort) {}

  /**
   * Execute get current user.
   *
   * @param accessToken - Bearer access token.
   * @returns Current user profile.
   */
  execute(accessToken: string): Promise<UserMe> {
    return this.userService.getMe(accessToken);
  }
}
