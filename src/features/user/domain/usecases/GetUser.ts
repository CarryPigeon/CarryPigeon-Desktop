/**
 * @fileoverview GetUser.ts
 * @description user｜用例：GetUser。
 */

import type { UserServicePort } from "../ports/UserServicePort";
import type { UserPublic } from "../types/UserTypes";

/**
 * 用例：获取用户公开资料。
 */
export class GetUser {
  constructor(private readonly userService: UserServicePort) {}

  /**
   * 执行：获取指定用户的公开资料。
   *
   * @param accessToken - 访问令牌（Bearer）。
   * @param uid - 用户 id。
   * @returns 用户公开资料。
   */
  execute(accessToken: string, uid: string): Promise<UserPublic> {
    return this.userService.getUser(accessToken, uid);
  }
}
