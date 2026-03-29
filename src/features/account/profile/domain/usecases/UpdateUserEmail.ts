/**
 * @fileoverview UpdateUserEmail.ts
 * @description account/profile｜用例：UpdateUserEmail。
 */

import type { UserMutationPort } from "../ports/UserServicePort";

/**
 * 用例：更新用户邮箱。
 */
export class UpdateUserEmail {
  constructor(private readonly userService: UserMutationPort) {}

  /**
   * 执行：修改当前用户邮箱。
   *
   * @param email - 新邮箱地址。
   * @param code - 邮箱验证码。
   * @returns 无返回值。
   */
  execute(email: string, code: string): Promise<void> {
    return this.userService.updateUserEmail(email, code);
  }
}
