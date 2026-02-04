/**
 * @fileoverview user.di.ts
 * @description Composition root for user feature.
 *
 * Selection rules:
 * - `USE_MOCK_API` uses deterministic in-memory services for UI preview.
 * - Otherwise uses HTTP-backed services.
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
 * Get a UserServicePort for the given server socket.
 *
 * @param serverSocket - Server socket.
 * @returns UserServicePort.
 */
export function getUserServicePort(serverSocket: string): UserServicePort {
  return USE_MOCK_TRANSPORT ? createHttpUserServicePort(serverSocket) : USE_MOCK_API
    ? createMockUserServicePort(serverSocket)
    : createHttpUserServicePort(serverSocket);
}

/**
 * Get GetCurrentUser usecase.
 *
 * @param serverSocket - Server socket.
 * @returns GetCurrentUser usecase instance.
 */
export function getGetCurrentUserUsecase(serverSocket: string): GetCurrentUser {
  return new GetCurrentUser(getUserServicePort(serverSocket));
}

/**
 * Get GetUser usecase.
 *
 * @param serverSocket - Server socket.
 * @returns GetUser usecase instance.
 */
export function getGetUserUsecase(serverSocket: string): GetUser {
  return new GetUser(getUserServicePort(serverSocket));
}

/**
 * Get ListUsers usecase.
 *
 * @param serverSocket - Server socket.
 * @returns ListUsers usecase instance.
 */
export function getListUsersUsecase(serverSocket: string): ListUsers {
  return new ListUsers(getUserServicePort(serverSocket));
}

/**
 * Get UpdateUserEmail usecase.
 *
 * @param serverSocket - Server socket.
 * @returns UpdateUserEmail usecase instance.
 */
export function getUpdateUserEmailUsecase(serverSocket: string): UpdateUserEmail {
  return new UpdateUserEmail(getUserServicePort(serverSocket));
}

/**
 * Get UpdateUserProfile usecase.
 *
 * @param serverSocket - Server socket.
 * @returns UpdateUserProfile usecase instance.
 */
export function getUpdateUserProfileUsecase(serverSocket: string): UpdateUserProfile {
  return new UpdateUserProfile(getUserServicePort(serverSocket));
}

// ============================================================================
// Backward compatibility exports
// ============================================================================

export type { UserServicePort as UserService } from "../domain/ports/UserServicePort";

/**
 * @deprecated Use getUserServicePort instead.
 *
 * @param serverSocket - Server socket.
 * @returns UserServicePort.
 */
export function createUserService(serverSocket: string): UserServicePort {
  return getUserServicePort(serverSocket);
}
