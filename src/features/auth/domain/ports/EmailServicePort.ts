/**
 * @fileoverview EmailServicePort.ts
 * @description Domain port: email verification code operations.
 *
 * Implementations:
 * - `mock`: no-op for UI preview
 * - `http`: real HTTP-backed email service
 */

/**
 * Email verification service port.
 */
export interface EmailServicePort {
  /**
   * Request a verification code to be sent to the given email.
   *
   * @param email - Target email address.
   */
  sendCode(email: string): Promise<void>;
}
