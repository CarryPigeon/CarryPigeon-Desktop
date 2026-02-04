/**
 * @fileoverview authServiceFactory.ts
 * @description Data-layer factory: re-exports for backward compatibility.
 *
 * @deprecated Use domain/ports and di/ instead.
 *
 * API alignment:
 * - See `docs/api/*` for auth endpoints and error model
 * - required gate: PRD 5.6 + `required_plugin_missing`
 */

// Re-export types from domain layer for backward compatibility
export type { AuthLoginResult } from "../domain/types/AuthTypes";

// Re-export port types as service types for backward compatibility
export type { AuthServicePort as AuthService } from "../domain/ports/AuthServicePort";
export type { EmailServicePort as EmailService } from "../domain/ports/EmailServicePort";

// Re-export factory functions for backward compatibility
export { createMockEmailServicePort as createMockEmailService } from "../mock/mockEmailServicePort";
export { createMockAuthServicePort as createMockAuthService } from "../mock/mockAuthServicePort";
export { createHttpEmailServicePort as createHttpEmailService } from "../data/httpEmailServicePort";
export { createHttpAuthServicePort as createHttpAuthService } from "../data/httpAuthServicePort";

import type { AuthServicePort } from "../domain/ports/AuthServicePort";
import type { EmailServicePort } from "../domain/ports/EmailServicePort";
import { getAuthServicePort, getEmailServicePort } from "../di/auth.di";

/**
 * Legacy factory name used by presentation/bootstrap layers.
 *
 * @param serverSocket - Server socket.
 * @returns AuthServicePort.
 */
export function createAuthService(serverSocket: string): AuthServicePort {
  return getAuthServicePort(serverSocket);
}

/**
 * Legacy factory name used by presentation/bootstrap layers.
 *
 * @param serverSocket - Server socket.
 * @returns EmailServicePort.
 */
export function createEmailService(serverSocket: string): EmailServicePort {
  return getEmailServicePort(serverSocket);
}
