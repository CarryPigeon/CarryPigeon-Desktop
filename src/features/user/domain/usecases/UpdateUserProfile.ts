/**
 * @fileoverview UpdateUserProfile.ts
 * @description Usecase: update user profile.
 */

import type { UserServicePort } from "../ports/UserServicePort";

/**
 * Update user profile usecase.
 */
export class UpdateUserProfile {
  constructor(private readonly userService: UserServicePort) {}

  /**
   * Execute update user profile.
   *
   * @param username - New username.
   * @param avatar - Avatar id.
   * @param sex - Sex code.
   * @param brief - Bio.
   * @param birthday - Birthday timestamp.
   * @returns Promise<void>.
   */
  execute(
    username: string,
    avatar: number,
    sex: number,
    brief: string,
    birthday: number,
  ): Promise<void> {
    return this.userService.updateUserProfile(username, avatar, sex, brief, birthday);
  }
}
