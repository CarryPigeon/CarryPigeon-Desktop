/**
 * @fileoverview SendVerificationCode.ts
 * @description Usecase: request email verification code.
 */

import type { EmailServicePort } from "../ports/EmailServicePort";

/**
 * Send verification code usecase.
 */
export class SendVerificationCode {
  constructor(private readonly emailService: EmailServicePort) {}

  /**
   * Request a verification code to be sent to the given email.
   *
   * @param email - Target email address.
   * @returns Promise<void>.
   */
  execute(email: string): Promise<void> {
    return this.emailService.sendCode(email);
  }
}
