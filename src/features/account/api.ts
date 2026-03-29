/**
 * @fileoverview account Feature 对外公共 API（跨 Feature 访问边界）。
 * @description
 * capability-first 聚合认证、当前用户快照与用户资料能力，替代旧的 `auth/api` 与 `user/api`。
 *
 * 约束：
 * - 跨 feature 调用应优先通过 `create/getAccountCapabilities()` 获取能力对象；
 * - 类型导入应优先依赖 `account/api-types.ts`；
 * - `account` 内部子特性不应反向依赖本聚合入口。
 */

import type { AccountCapabilities } from "./api-types";
import { createAuthFlowCapabilities } from "./auth-flow/api";
import { createCurrentUserCapabilities } from "./current-user/api";
import {
  applyAuthenticatedUserSnapshot,
  syncCurrentUserSnapshot,
} from "./application/currentUserSnapshot";
import { createProfileCapabilities } from "./profile/api";

/**
 * 创建 account 能力对象（object-capability）。
 */
export function createAccountCapabilities(): AccountCapabilities {
  const authFlowCapabilities = createAuthFlowCapabilities();
  const currentUserCapabilities = createCurrentUserCapabilities();
  const profileCapabilities = createProfileCapabilities();

  return {
    authFlow: {
      updateMissingRequiredPlugins: authFlowCapabilities.updateMissingRequiredPlugins,
    },
    currentUser: {
      clearSnapshot: currentUserCapabilities.clearSnapshot,
      getSnapshot: currentUserCapabilities.getSnapshot,
      observeSnapshot: currentUserCapabilities.observeSnapshot,
      applyLocalProfilePatch: currentUserCapabilities.applyLocalProfilePatch,
      applyAuthenticatedSnapshot: applyAuthenticatedUserSnapshot,
    },
    profileErrors: {
      isProfileError: profileCapabilities.isProfileError,
      isMutationUnsupported: profileCapabilities.isMutationUnsupportedError,
      toMessage: profileCapabilities.toErrorMessage,
      supportsMutation: profileCapabilities.supportsMutation,
    },
    forServer(serverSocket) {
      const authServer = authFlowCapabilities.forServer(serverSocket);
      return {
        sendVerificationCode(email) {
          return authServer.sendVerificationCode(email);
        },
        revokeToken(refreshToken) {
          return authServer.revokeToken(refreshToken);
        },
        syncCurrentUserSnapshot(accessToken) {
          return syncCurrentUserSnapshot(serverSocket, accessToken);
        },
        updateUserEmail(email, code) {
          return profileCapabilities.updateUserEmail(serverSocket, email, code);
        },
        updateUserProfile(input) {
          return profileCapabilities.updateUserProfile(serverSocket, input);
        },
      };
    },
  };
}

let cachedAccountCapabilities: AccountCapabilities | null = null;

/**
 * 获取 account 能力对象单例（跨模块共享稳定引用）。
 */
export function getAccountCapabilities(): AccountCapabilities {
  if (!cachedAccountCapabilities) {
    cachedAccountCapabilities = createAccountCapabilities();
  }
  return cachedAccountCapabilities;
}
