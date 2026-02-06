/**
 * @fileoverview EmailServicePort.ts
 * @description auth｜领域端口：EmailServicePort。
 *
 * 实现说明：
 * - `mock`：用于 UI 预览/开发联调的空实现
 * - `http`：基于后端 API 的真实实现
 */

/**
 * 邮箱验证码服务端口（领域层）。
 */
export interface EmailServicePort {
  /**
   * 请求服务端向指定邮箱发送验证码。
   *
   * @param email - 目标邮箱地址。
   */
  sendCode(email: string): Promise<void>;
}
