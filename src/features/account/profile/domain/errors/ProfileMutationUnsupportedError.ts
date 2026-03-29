/**
 * @fileoverview ProfileMutationUnsupportedError.ts
 * @description account/profile｜领域错误：当前 API 不支持资料修改。
 */

import { ProfileError } from "./ProfileErrors";

/**
 * 用户资料写操作在当前服务端 API 中不可用时抛出的错误。
 */
export class ProfileMutationUnsupportedError extends ProfileError {
  constructor(message = "Profile update endpoints are not supported by the current server API") {
    super({ code: "mutation_unsupported", message });
    this.name = "ProfileMutationUnsupportedError";
  }
}

/**
 * 判断错误是否为“资料修改不支持”。
 *
 * @param e - 任意错误对象。
 * @returns 命中则为 `true`。
 */
export function isProfileMutationUnsupportedError(e: unknown): e is ProfileMutationUnsupportedError {
  return e instanceof ProfileMutationUnsupportedError;
}
