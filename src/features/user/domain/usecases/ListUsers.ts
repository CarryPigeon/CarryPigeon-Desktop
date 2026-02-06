/**
 * @fileoverview ListUsers.ts
 * @description user｜用例：ListUsers。
 */

import type { UserServicePort } from "../ports/UserServicePort";
import type { UserPublic } from "../types/UserTypes";

/**
 * 批量获取用户公开资料用例。
 */
export class ListUsers {
  constructor(private readonly userService: UserServicePort) {}

  /**
   * 执行批量获取用户公开资料。
   *
   * @param accessToken - Bearer access token。
   * @param ids - 用户 id 列表。
   * @returns 用户公开资料列表。
   */
  execute(accessToken: string, ids: string[]): Promise<UserPublic[]> {
    return this.userService.listUsers(accessToken, ids);
  }
}
