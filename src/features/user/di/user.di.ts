/**
 * @fileoverview user.di.ts
 * @description user｜依赖组装（DI）：user.di。
 *
 * 选择规则：
 * - `USE_MOCK_API`：使用确定性的内存实现（用于 UI 预览/开发联调）。
 * - 其它情况：使用基于 HTTP 的真实实现。
 */

import { USE_MOCK_API, USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import type { UserServicePort } from "../domain/ports/UserServicePort";
import { createHttpUserServicePort } from "../data/httpUserServicePort";
import { createMockUserServicePort } from "../mock/mockUserServicePort";
import { GetCurrentUser } from "../domain/usecases/GetCurrentUser";
import { GetUser } from "../domain/usecases/GetUser";
import { ListUsers } from "../domain/usecases/ListUsers";
import { UpdateUserEmail } from "../domain/usecases/UpdateUserEmail";
import { UpdateUserProfile } from "../domain/usecases/UpdateUserProfile";

/**
 * 获取指定服务器 Socket 地址对应的 `UserServicePort`。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns UserServicePort 实例。
 */
export function getUserServicePort(serverSocket: string): UserServicePort {
  if (USE_MOCK_TRANSPORT) return createHttpUserServicePort(serverSocket);
  if (USE_MOCK_API) return createMockUserServicePort(serverSocket);
  return createHttpUserServicePort(serverSocket);
}

/**
 * 获取 GetCurrentUser 用例实例。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns GetCurrentUser 实例。
 */
export function getGetCurrentUserUsecase(serverSocket: string): GetCurrentUser {
  return new GetCurrentUser(getUserServicePort(serverSocket));
}

/**
 * 获取 GetUser 用例实例。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns GetUser 实例。
 */
export function getGetUserUsecase(serverSocket: string): GetUser {
  return new GetUser(getUserServicePort(serverSocket));
}

/**
 * 获取 ListUsers 用例实例。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns ListUsers 实例。
 */
export function getListUsersUsecase(serverSocket: string): ListUsers {
  return new ListUsers(getUserServicePort(serverSocket));
}

/**
 * 获取 UpdateUserEmail 用例实例。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns UpdateUserEmail 实例。
 */
export function getUpdateUserEmailUsecase(serverSocket: string): UpdateUserEmail {
  return new UpdateUserEmail(getUserServicePort(serverSocket));
}

/**
 * 获取 UpdateUserProfile 用例实例。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns UpdateUserProfile 实例。
 */
export function getUpdateUserProfileUsecase(serverSocket: string): UpdateUserProfile {
  return new UpdateUserProfile(getUserServicePort(serverSocket));
}

// ============================================================================
// 向后兼容导出
// ============================================================================

/**
 * 向后兼容导出：将领域端口类型重命名为 service 类型别名。
 */
export type { UserServicePort as UserService } from "../domain/ports/UserServicePort";

/**
 * @deprecated 请使用 `getUserServicePort` 替代。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns UserServicePort 实例。
 */
export function createUserService(serverSocket: string): UserServicePort {
  return getUserServicePort(serverSocket);
}
