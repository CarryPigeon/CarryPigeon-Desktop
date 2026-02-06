/**
 * @fileoverview GetCurrentUser.ts
 * @description user｜用例：GetCurrentUser。
 */

import type { UserServicePort } from "../ports/UserServicePort";
import type { UserMe } from "../types/UserTypes";

/**
 * 用例：获取当前用户资料（me）。
 */
export class GetCurrentUser {
  constructor(private readonly userService: UserServicePort) {}

  /**
   * 执行：获取当前登录用户的个人资料。
   *
   * @param accessToken - 访问令牌（Bearer）。
   * @returns 当前用户资料。
   */
  execute(accessToken: string): Promise<UserMe> {
    return this.userService.getMe(accessToken);
  }
}
