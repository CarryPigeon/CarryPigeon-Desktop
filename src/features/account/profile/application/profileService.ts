/**
 * @fileoverview account/profile application facade。
 * @description
 * 收敛 profile 子域对外可用的 application 服务，避免公共 API 直接依赖 ports 文件或低层实现细节。
 */

import {
  getCurrentUserUsecase,
  getUpdateUserEmailUsecase,
  getUpdateUserProfileUsecase,
  supportsProfileMutation,
} from "../di/user.di";
import { isProfileError, toProfileErrorMessage } from "../domain/errors/ProfileErrors";
import { isProfileMutationUnsupportedError } from "../domain/errors/ProfileMutationUnsupportedError";
import type { UpdateUserProfileInput } from "../domain/types/UserTypes";
import {
  toProfileMutationErrorInfo,
  type UpdateUserEmailOutcome,
  type UpdateUserProfileOutcome,
} from "./profileMutationOutcome";

export function getCurrentUserProfile(serverSocket: string, accessToken: string) {
  return getCurrentUserUsecase(serverSocket).execute(accessToken);
}

export async function updateCurrentUserEmail(
  serverSocket: string,
  email: string,
  code: string,
): Promise<UpdateUserEmailOutcome> {
  try {
    await getUpdateUserEmailUsecase(serverSocket).execute(email, code);
    return {
      ok: true,
      kind: "user_email_updated",
      email: String(email ?? "").trim(),
    };
  } catch (error) {
    return {
      ok: false,
      kind: "user_email_update_rejected",
      error: toProfileMutationErrorInfo(error),
    };
  }
}

export async function updateCurrentUserProfile(
  serverSocket: string,
  input: UpdateUserProfileInput,
): Promise<UpdateUserProfileOutcome> {
  try {
    await getUpdateUserProfileUsecase(serverSocket).execute(input);
    const updatedFields = Object.freeze(
      Object.entries(input)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key),
    );
    return {
      ok: true,
      kind: "user_profile_updated",
      updatedFields,
    };
  } catch (error) {
    return {
      ok: false,
      kind: "user_profile_update_rejected",
      error: toProfileMutationErrorInfo(error),
    };
  }
}

export function supportsProfileMutationCapability(): boolean {
  return supportsProfileMutation();
}

export {
  isProfileError,
  isProfileMutationUnsupportedError,
  toProfileErrorMessage,
};
