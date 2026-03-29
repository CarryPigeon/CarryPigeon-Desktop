/**
 * @fileoverview UpdateUserProfile.ts
 * @description account/profile｜用例：UpdateUserProfile。
 */

import type { UserMutationPort } from "../ports/UserServicePort";
import type { UpdateUserProfileInput } from "../types/UserTypes";

/**
 * 用例：更新用户资料。
 */
export class UpdateUserProfile {
  constructor(private readonly userService: UserMutationPort) {}

  /**
   * 执行：修改当前用户基础资料。
   *
   * @param input - 用户资料输入对象。
   * @returns 无返回值。
   */
  execute(input: UpdateUserProfileInput): Promise<void> {
    return this.userService.updateUserProfile(input);
  }
}
