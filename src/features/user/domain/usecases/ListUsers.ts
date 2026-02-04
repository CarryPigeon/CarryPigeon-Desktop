/**
 * @fileoverview ListUsers.ts
 * @description Usecase: batch fetch user profiles.
 */

import type { UserServicePort } from "../ports/UserServicePort";
import type { UserPublic } from "../types/UserTypes";

/**
 * List users usecase.
 */
export class ListUsers {
  constructor(private readonly userService: UserServicePort) {}

  /**
   * Execute list users.
   *
   * @param accessToken - Bearer access token.
   * @param ids - User id list.
   * @returns User public profiles list.
   */
  execute(accessToken: string, ids: string[]): Promise<UserPublic[]> {
    return this.userService.listUsers(accessToken, ids);
  }
}
