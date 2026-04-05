/**
 * @fileoverview httpUserServicePort.ts
 * @description account/profile｜数据层实现：httpUserServicePort。
 */

import type { UserServicePort } from "../domain/ports/UserServicePort";
import type { UpdateUserProfileInput } from "../domain/types/UserTypes";
import type { UserMe, UserPublic } from "../domain/types/UserTypes";
import { httpGetCurrentUser, httpGetUser, httpListUsers, httpUploadBackgroundImage } from "./httpUserApi";
import { ProfileMutationUnsupportedError } from "../domain/errors/ProfileMutationUnsupportedError";
import { mapUserMeWire, mapUserPublicWire } from "./userWireMappers";

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
      const wire = await httpGetCurrentUser(socket, accessToken);
      return mapUserMeWire(wire);
    },
    async getUser(accessToken: string, uid: string): Promise<UserPublic> {
      const wire = await httpGetUser(socket, accessToken, uid);
      return mapUserPublicWire(wire);
    },
    async listUsers(accessToken: string, ids: string[]): Promise<UserPublic[]> {
      const wires = await httpListUsers(socket, accessToken, ids);
      return wires.map(mapUserPublicWire);
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
    async updateUserBackgroundImage(accessToken: string, file: File): Promise<string> {
      return httpUploadBackgroundImage(socket, accessToken, file);
    },
  };
}
