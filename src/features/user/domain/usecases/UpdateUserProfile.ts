/**
 * @fileoverview UpdateUserProfile.ts
 * @description user｜用例：UpdateUserProfile。
 */

import type { UserServicePort } from "../ports/UserServicePort";

/**
 * 用例：更新用户资料。
 */
export class UpdateUserProfile {
  constructor(private readonly userService: UserServicePort) {}

  /**
   * 执行：修改当前用户基础资料。
   *
   * @param username - 昵称。
   * @param avatar - 头像 id（由服务端定义的资源编号）。
   * @param sex - 性别 code（由服务端枚举定义）。
   * @param brief - 简介。
   * @param birthday - 生日时间戳（毫秒）。
   * @returns 无返回值。
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
