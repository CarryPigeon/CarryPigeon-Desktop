/**
 * @fileoverview user.di.ts
 * @description account/profile｜依赖组装（DI）：user.di。
 *
 * 选择规则：
 * - `IS_STORE_MOCK`：使用确定性的内存实现（用于 UI 预览/开发联调）。
 * - 其它情况：使用基于 HTTP 的真实实现。
 */

import { selectByMockMode } from "@/shared/config/mockModeSelector";
import type { UserMutationPort, UserQueryPort, UserServicePort } from "../domain/ports/UserServicePort";
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
  return selectByMockMode<UserServicePort>({
    off: () => createHttpUserServicePort(serverSocket),
    store: () => createMockUserServicePort(serverSocket),
    protocol: () => createHttpUserServicePort(serverSocket),
  });
}

/**
 * 获取用户查询端口（只读）。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns UserQueryPort 实例。
 */
export function getUserQueryPort(serverSocket: string): UserQueryPort {
  return getUserServicePort(serverSocket);
}

/**
 * 获取用户资料变更端口（写）。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns UserMutationPort 实例。
 */
export function getUserMutationPort(serverSocket: string): UserMutationPort {
  return getUserServicePort(serverSocket);
}

/**
 * 判断当前运行模式下是否支持 profile mutation。
 *
 * 说明：
 * - 当前 HTTP（off/protocol）后端不支持用户资料写接口；
 * - store mock 模式支持该能力（用于 UI 预览/调试）。
 *
 * @returns 支持则为 true。
 */
export function supportsProfileMutation(): boolean {
  return selectByMockMode<boolean>({
    off: () => false,
    protocol: () => false,
    store: () => true,
  });
}

/**
 * 获取 GetCurrentUser 用例实例（推荐命名）。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns GetCurrentUser 实例。
 */
export function getCurrentUserUsecase(serverSocket: string): GetCurrentUser {
  return new GetCurrentUser(getUserQueryPort(serverSocket));
}

/**
 * 获取 GetUser 用例实例。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns GetUser 实例。
 */
export function getUserUsecase(serverSocket: string): GetUser {
  return new GetUser(getUserQueryPort(serverSocket));
}

/**
 * 获取 ListUsers 用例实例。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns ListUsers 实例。
 */
export function getListUsersUsecase(serverSocket: string): ListUsers {
  return new ListUsers(getUserQueryPort(serverSocket));
}

/**
 * 获取 UpdateUserEmail 用例实例。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns UpdateUserEmail 实例。
 */
export function getUpdateUserEmailUsecase(serverSocket: string): UpdateUserEmail {
  return new UpdateUserEmail(getUserMutationPort(serverSocket));
}

/**
 * 获取 UpdateUserProfile 用例实例。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @returns UpdateUserProfile 实例。
 */
export function getUpdateUserProfileUsecase(serverSocket: string): UpdateUserProfile {
  return new UpdateUserProfile(getUserMutationPort(serverSocket));
}
