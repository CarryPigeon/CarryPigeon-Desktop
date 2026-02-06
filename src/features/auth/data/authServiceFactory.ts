/**
 * @fileoverview authServiceFactory.ts
 * @description auth｜数据层实现：authServiceFactory。
 *
 * @deprecated 请改用 domain/ports 与 di/（依赖注入入口）。
 *
 * API 对齐说明：
 * - 认证相关端点与错误模型请参考 `docs/api/*`
 * - required gate：PRD 5.6 + `required_plugin_missing`
 */

/**
 * 向后兼容导出：重导出领域层的认证登录结果类型。
 */
export type { AuthLoginResult } from "../domain/types/AuthTypes";

/**
 * 向后兼容导出：将领域端口类型重命名为 service 类型别名。
 */
export type { AuthServicePort as AuthService } from "../domain/ports/AuthServicePort";
/**
 * 向后兼容导出：将领域端口类型重命名为 service 类型别名。
 */
export type { EmailServicePort as EmailService } from "../domain/ports/EmailServicePort";

// 向后兼容导出：重导出旧工厂函数名
export { createMockEmailServicePort as createMockEmailService } from "../mock/mockEmailServicePort";
export { createMockAuthServicePort as createMockAuthService } from "../mock/mockAuthServicePort";
export { createHttpEmailServicePort as createHttpEmailService } from "../data/httpEmailServicePort";
export { createHttpAuthServicePort as createHttpAuthService } from "../data/httpAuthServicePort";

import type { AuthServicePort } from "../domain/ports/AuthServicePort";
import type { EmailServicePort } from "../domain/ports/EmailServicePort";
import { getAuthServicePort, getEmailServicePort } from "../di/auth.di";

/**
 * 旧版工厂函数名（用于历史调用点兼容）。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns `AuthServicePort` 实例。
 */
export function createAuthService(serverSocket: string): AuthServicePort {
  return getAuthServicePort(serverSocket);
}

/**
 * 旧版工厂函数名（用于历史调用点兼容）。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns `EmailServicePort` 实例。
 */
export function createEmailService(serverSocket: string): EmailServicePort {
  return getEmailServicePort(serverSocket);
}
