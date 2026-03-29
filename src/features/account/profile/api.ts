/**
 * @fileoverview account/profile 对外 API。
 * @description
 * 暴露用户资料查询与更新用例，避免调用方直接依赖 profile 内部路径。
 *
 * 说明：
 * - 本文件是 `profile` 子域的稳定入口；
 * - `account/api.ts` 会在 feature 边界上再次聚合这些能力。
 */

import {
  getCurrentUserProfile,
  isProfileError,
  isProfileMutationUnsupportedError,
  supportsProfileMutationCapability,
  toProfileErrorMessage,
  updateCurrentUserEmail,
  updateCurrentUserProfile,
} from "./application/profileService";
import type { UpdateUserProfileInput } from "./domain/types/UserTypes";
import type { UpdateUserEmailOutcome, UpdateUserProfileOutcome } from "./application/profileMutationOutcome";

export type ProfileCapabilities = {
  getCurrentUser(serverSocket: string, accessToken: string): ReturnType<typeof getCurrentUserProfile>;
  updateUserEmail(serverSocket: string, email: string, code: string): Promise<UpdateUserEmailOutcome>;
  updateUserProfile(serverSocket: string, input: UpdateUserProfileInput): Promise<UpdateUserProfileOutcome>;
  supportsMutation(): boolean;
  isProfileError(error: unknown): boolean;
  isMutationUnsupportedError(error: unknown): boolean;
  toErrorMessage(error: unknown): string;
};

/**
 * 创建 profile 子域能力对象。
 */
export function createProfileCapabilities(): ProfileCapabilities {
  return {
    getCurrentUser(serverSocket: string, accessToken: string) {
      return getCurrentUserProfile(serverSocket, accessToken);
    },
    updateUserEmail(serverSocket: string, email: string, code: string): Promise<UpdateUserEmailOutcome> {
      return updateCurrentUserEmail(serverSocket, email, code);
    },
    updateUserProfile(serverSocket: string, input: UpdateUserProfileInput): Promise<UpdateUserProfileOutcome> {
      return updateCurrentUserProfile(serverSocket, input);
    },
    supportsMutation: supportsProfileMutationCapability,
    isProfileError,
    isMutationUnsupportedError: isProfileMutationUnsupportedError,
    toErrorMessage: toProfileErrorMessage,
  };
}

let profileCapabilitiesSingleton: ProfileCapabilities | null = null;

/**
 * 获取 profile 子域共享能力对象。
 */
export function getProfileCapabilities(): ProfileCapabilities {
  profileCapabilitiesSingleton ??= createProfileCapabilities();
  return profileCapabilitiesSingleton;
}

export { isProfileError, toProfileErrorMessage };
export { isProfileMutationUnsupportedError };
export type { UpdateUserEmailOutcome, UpdateUserProfileOutcome } from "./application/profileMutationOutcome";
