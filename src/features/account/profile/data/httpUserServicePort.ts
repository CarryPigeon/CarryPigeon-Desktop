/**
 * @fileoverview httpUserServicePort.ts
 * @description account/profile｜数据层实现：httpUserServicePort。
 */

import type { UserServicePort } from "../domain/ports/UserServicePort";
import type { UpdateUserProfileInput } from "../domain/types/UserTypes";
import type { UserMe, UserPublic } from "../domain/types/UserTypes";
import { httpGetCurrentUser, httpGetUser, httpListUsers } from "./httpUserApi";
import { ProfileMutationUnsupportedError } from "../domain/errors/ProfileMutationUnsupportedError";

/**
 * 创建 HTTP 版本的 UserServicePort。
 *
 * @param serverSocket - 服务端 socket。
 * @returns UserServicePort 实现。
 */
export function createHttpUserServicePort(serverSocket: string): UserServicePort {
  const socket = serverSocket.trim();
  return {
    async getMe(accessToken: string): Promise<UserMe> {
      return httpGetCurrentUser(socket, accessToken);
    },
    async getUser(accessToken: string, uid: string): Promise<UserPublic> {
      return httpGetUser(socket, accessToken, uid);
    },
    async listUsers(accessToken: string, ids: string[]): Promise<UserPublic[]> {
      return httpListUsers(socket, accessToken, ids);
    },
    async updateUserEmail(email: string, code: string): Promise<void> {
      void email;
      void code;
      throw new ProfileMutationUnsupportedError();
    },
    async updateUserProfile(input: UpdateUserProfileInput): Promise<void> {
      void input;
      throw new ProfileMutationUnsupportedError();
    },
  };
}
