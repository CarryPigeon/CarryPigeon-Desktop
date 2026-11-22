/**
 * @fileoverview EmailServicePort.ts
 * @description account/auth-flow｜领域端口：EmailServicePort。
 *
 * 实现说明：
 * - `mock`：用于 UI 预览/开发联调的空实现
 * - `http`：基于后端 API 的真实实现
 */

/**
 * 邮箱验证码服务端口（领域层）。
 */
export type EmailCodePurpose = "REGISTER" | "LOGIN" | "CHANGE_EMAIL" | "password_change";

export interface EmailServicePort {
  sendCode(email: string, purpose: EmailCodePurpose): Promise<void>;
}
