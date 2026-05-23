/**
 * @fileoverview httpUserServicePort.ts
 * @description account/profile｜数据层实现：httpUserServicePort。
 */

import type { UserServicePort } from "../domain/ports/UserServicePort";
import type { UpdateUserProfileInput } from "../domain/types/UserTypes";
import type { UserMe, UserPublic } from "../domain/types/UserTypes";
import {
  httpGetCurrentUser,
  httpGetUser,
  httpListUsers,
  httpUpdateUserEmail,
  httpUpdateUserProfile,
  httpUploadAvatarImage,
  httpUploadBackgroundImage,
} from "./httpUserApi";
import { ensureValidAccessToken } from "@/shared/net/auth/api";
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
      const accessToken = await ensureValidAccessToken(socket);
      await httpUpdateUserEmail(socket, accessToken, email, code);
    },
    async updateUserProfile(input: UpdateUserProfileInput): Promise<void> {
      const accessToken = await ensureValidAccessToken(socket);
      await httpUpdateUserProfile(socket, accessToken, input);
    },
    async updateUserBackgroundImage(accessToken: string, file: File): Promise<string> {
      return httpUploadBackgroundImage(socket, accessToken, file);
    },
    async updateUserAvatarImage(accessToken: string, file: File): Promise<string> {
      return httpUploadAvatarImage(socket, accessToken, file);
    },
  };
}
