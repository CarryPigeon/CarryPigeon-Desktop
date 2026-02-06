/**
 * @fileoverview auth Feature 对外公共 API（跨 Feature 访问边界）。
 * @description
 * 对外暴露认证能力（service factory / required gate 状态）与错误判定工具。
 */

export {
  createAuthService,
  createEmailService,
  type AuthLoginResult,
  type AuthService,
  type EmailService,
} from "./data/authServiceFactory";

export { setMissingRequiredPlugins, missingRequiredPlugins } from "./presentation/store/requiredGate";

export { isAuthRequiredPluginMissingError } from "./domain/errors/AuthErrors";
