/**
 * @fileoverview account/auth-flow 对外 API。
 * @description
 * 统一暴露登录流程相关能力，避免调用方直接依赖子模块内部路径。
 *
 * 说明：
 * - 本文件是 `auth-flow` 子域的稳定入口；
 * - `account/api.ts` 会在 feature 边界上再次聚合这些能力。
 */

import {
  configureInstalledPluginsQueryProvider as configureInstalledPluginsQueryProviderInternal,
  type InstalledPluginsQueryProvider,
} from "./application/installedPluginsProvider";
import {
  clearMissingRequiredPlugins as clearMissingRequiredPluginsInternal,
  getMissingRequiredPluginsSnapshot,
  updateMissingRequiredPlugins as updateMissingRequiredPluginsInternal,
} from "./application/requiredGateState";
import {
  type AuthRequiredSetupOutcome,
  type RevokeTokenOutcome,
  type AuthSignInOutcome,
  type SendVerificationCodeOutcome,
  toAuthFlowErrorInfo,
} from "./application/authFlowOutcome";
import { signInWithEmailCode } from "./application/loginSessionCoordinator";
import {
  getCheckRequiredGateUsecase,
  getRevokeTokenUsecase,
  getSendVerificationCodeUsecase,
} from "./di/auth.di";

export type { InstalledPluginsQueryProvider } from "./application/installedPluginsProvider";
export type {
  AuthFlowErrorCode,
  AuthFlowErrorInfo,
  AuthRequiredSetupOutcome,
  AuthSignInOutcome,
  RevokeTokenOutcome,
  SendVerificationCodeOutcome,
} from "./application/authFlowOutcome";

export type AuthFlowServerCapabilities = {
  sendVerificationCode(email: string): Promise<SendVerificationCodeOutcome>;
  signInWithEmailCode(email: string, code: string): Promise<AuthSignInOutcome>;
  revokeToken(refreshToken: string): Promise<RevokeTokenOutcome>;
  checkRequiredSetup(): Promise<AuthRequiredSetupOutcome>;
};

export type AuthFlowCapabilities = {
  configureInstalledPluginsQueryProvider(provider: InstalledPluginsQueryProvider): void;
  getMissingRequiredPlugins(): readonly string[];
  updateMissingRequiredPlugins(ids: string[]): void;
  clearMissingRequiredPlugins(): void;
  forServer(serverSocket: string): AuthFlowServerCapabilities;
};

/**
 * 创建 auth-flow 子域能力对象。
 */
export function createAuthFlowCapabilities(): AuthFlowCapabilities {
  return {
    configureInstalledPluginsQueryProvider(provider: InstalledPluginsQueryProvider): void {
      configureInstalledPluginsQueryProviderInternal(provider);
    },
    getMissingRequiredPlugins(): readonly string[] {
      return getMissingRequiredPluginsSnapshot();
    },
    updateMissingRequiredPlugins(ids: string[]): void {
      updateMissingRequiredPluginsInternal(ids);
    },
    clearMissingRequiredPlugins(): void {
      clearMissingRequiredPluginsInternal();
    },
    forServer(serverSocket: string): AuthFlowServerCapabilities {
      return {
        async sendVerificationCode(email: string): Promise<SendVerificationCodeOutcome> {
          try {
            await getSendVerificationCodeUsecase(serverSocket).execute(email);
            return {
              ok: true,
              kind: "verification_code_sent",
              cooldownSec: 60,
            };
          } catch (error) {
            return {
              ok: false,
              kind: "verification_code_rejected",
              error: toAuthFlowErrorInfo(error),
            };
          }
        },
        signInWithEmailCode(email: string, code: string): Promise<AuthSignInOutcome> {
          return signInWithEmailCode(serverSocket, email, code);
        },
        async revokeToken(refreshToken: string): Promise<RevokeTokenOutcome> {
          try {
            await getRevokeTokenUsecase(serverSocket).execute(refreshToken);
            return {
              ok: true,
              kind: "auth_token_revoked",
              revoked: true,
            };
          } catch (error) {
            return {
              ok: false,
              kind: "auth_token_revoke_rejected",
              error: toAuthFlowErrorInfo(error),
            };
          }
        },
        async checkRequiredSetup(): Promise<AuthRequiredSetupOutcome> {
          try {
            const missing = await getCheckRequiredGateUsecase(serverSocket).execute();
            if (missing.length <= 0) {
              return {
                ok: true,
                kind: "required_setup_satisfied",
                missingPluginIds: Object.freeze([]),
              };
            }
            return {
              ok: true,
              kind: "required_setup_required",
              missingPluginIds: Object.freeze([...missing]),
            };
          } catch (error) {
            return {
              ok: false,
              kind: "required_setup_unknown",
              error: toAuthFlowErrorInfo(error),
            };
          }
        },
      };
    },
  };
}

let authFlowCapabilitiesSingleton: AuthFlowCapabilities | null = null;

/**
 * 获取 auth-flow 子域共享能力对象。
 */
export function getAuthFlowCapabilities(): AuthFlowCapabilities {
  authFlowCapabilitiesSingleton ??= createAuthFlowCapabilities();
  return authFlowCapabilitiesSingleton;
}
