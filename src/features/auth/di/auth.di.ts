/**
 * @fileoverview 认证模块依赖注入入口（auth.di.ts）。
 * @description 认证 feature 的 composition root（邮件验证码 + 会话认证）。
 *
 * 选择规则：
 * - mock 模式为 `"store"` 时：使用确定性的内存实现，便于 UI 预览。
 * - 其他模式：使用基于 HTTP 的实现（真实服务端或 protocol-mock transport）。
 */

import { MOCK_MODE } from "@/shared/config/runtime";
import type { AuthServicePort } from "../domain/ports/AuthServicePort";
import type { EmailServicePort } from "../domain/ports/EmailServicePort";
import { createHttpAuthServicePort } from "../data/httpAuthServicePort";
import { createHttpEmailServicePort } from "../data/httpEmailServicePort";
import { createMockAuthServicePort } from "../mock/mockAuthServicePort";
import { createMockEmailServicePort } from "../mock/mockEmailServicePort";
import { LoginWithEmailCode } from "../domain/usecases/LoginWithEmailCode";
import { SendVerificationCode } from "../domain/usecases/SendVerificationCode";
import { RefreshToken } from "../domain/usecases/RefreshToken";
import { TokenLogin } from "../domain/usecases/TokenLogin";
import { RevokeToken } from "../domain/usecases/RevokeToken";
import { CheckRequiredGate } from "../domain/usecases/CheckRequiredGate";
import type { RequiredGatePort } from "../domain/ports/RequiredGatePort";
import { requiredGatePort } from "../data/requiredGatePort";

/**
 * 获取指定服务器 Socket 地址对应的 `EmailServicePort` 实现。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns EmailServicePort 实例。
 */
export function getEmailServicePort(serverSocket: string): EmailServicePort {
  return MOCK_MODE === "store"
    ? createMockEmailServicePort(serverSocket)
    : createHttpEmailServicePort(serverSocket);
}

/**
 * 获取指定服务器 Socket 地址对应的 `AuthServicePort` 实现。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns AuthServicePort 实例。
 */
export function getAuthServicePort(serverSocket: string): AuthServicePort {
  return MOCK_MODE === "store"
    ? createMockAuthServicePort(serverSocket)
    : createHttpAuthServicePort(serverSocket);
}

/**
 * 获取 `LoginWithEmailCode` 用例实例。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns LoginWithEmailCode 用例实例。
 */
export function getLoginWithEmailCodeUsecase(serverSocket: string): LoginWithEmailCode {
  return new LoginWithEmailCode(getAuthServicePort(serverSocket));
}

/**
 * 获取 `SendVerificationCode` 用例实例。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns SendVerificationCode 用例实例。
 */
export function getSendVerificationCodeUsecase(serverSocket: string): SendVerificationCode {
  return new SendVerificationCode(getEmailServicePort(serverSocket));
}

/**
 * 获取 `RefreshToken` 用例实例。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns RefreshToken 用例实例。
 */
export function getRefreshTokenUsecase(serverSocket: string): RefreshToken {
  return new RefreshToken(getAuthServicePort(serverSocket));
}

/**
 * 获取 `TokenLogin` 用例实例。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns TokenLogin 用例实例。
 */
export function getTokenLoginUsecase(serverSocket: string): TokenLogin {
  return new TokenLogin(getAuthServicePort(serverSocket));
}

/**
 * 获取 `RevokeToken` 用例实例。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns RevokeToken 用例实例。
 */
export function getRevokeTokenUsecase(serverSocket: string): RevokeToken {
  return new RevokeToken(getAuthServicePort(serverSocket));
}

/**
 * 获取 `RequiredGatePort`（单例）。
 *
 * @returns RequiredGatePort 实例。
 */
export function getRequiredGatePort(): RequiredGatePort {
  return requiredGatePort;
}

/**
 * 获取 `CheckRequiredGate` 用例实例。
 *
 * @returns CheckRequiredGate 用例实例。
 */
export function getCheckRequiredGateUsecase(): CheckRequiredGate {
  return new CheckRequiredGate(getRequiredGatePort());
}

// ============================================================================
// 向后兼容导出（已废弃：请使用上方 port/usecase 版本）
// ============================================================================

/**
 * @deprecated 请改用 getEmailServicePort。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns EmailServicePort 实例。
 */
export function getEmailService(serverSocket: string): EmailServicePort {
  return getEmailServicePort(serverSocket);
}

/**
 * @deprecated 请改用 getAuthServicePort。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns AuthServicePort 实例。
 */
export function getAuthService(serverSocket: string): AuthServicePort {
  return getAuthServicePort(serverSocket);
}
