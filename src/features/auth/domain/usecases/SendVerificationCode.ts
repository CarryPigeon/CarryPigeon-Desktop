/**
 * @fileoverview SendVerificationCode.ts
 * @description auth｜用例：SendVerificationCode。
 */

import type { EmailServicePort } from "../ports/EmailServicePort";

/**
 * 发送邮箱验证码用例。
 */
export class SendVerificationCode {
  constructor(private readonly emailService: EmailServicePort) {}

  /**
   * 请求服务端向指定邮箱发送验证码。
   *
   * @param email - 目标邮箱地址。
   * @returns Promise<void>。
   */
  execute(email: string): Promise<void> {
    return this.emailService.sendCode(email);
  }
}
