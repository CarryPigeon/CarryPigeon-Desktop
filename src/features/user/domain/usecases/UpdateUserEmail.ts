/**
 * @fileoverview UpdateUserEmail.ts
 * @description Usecase: update user email.
 */

import type { UserServicePort } from "../ports/UserServicePort";

/**
 * Update user email usecase.
 */
export class UpdateUserEmail {
  constructor(private readonly userService: UserServicePort) {}

  /**
   * Execute update user email.
   *
   * @param email - New email.
   * @param code - Verification code.
   * @returns Promise<void>.
   */
  execute(email: string, code: string): Promise<void> {
    return this.userService.updateUserEmail(email, code);
  }
}
