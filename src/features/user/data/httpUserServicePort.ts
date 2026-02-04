/**
 * @fileoverview httpUserServicePort.ts
 * @description HTTP implementation of UserServicePort.
 */

import type { UserServicePort } from "../domain/ports/UserServicePort";
import type { UserMe, UserPublic } from "../domain/types/UserTypes";
import { httpGetCurrentUser, httpGetUser, httpListUsers } from "./httpUserApi";

/**
 * Create an HTTP-backed UserServicePort.
 *
 * @param serverSocket - Server socket.
 * @returns UserServicePort implementation.
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
      throw new Error("updateUserEmail is not part of the current HTTP API");
    },
    async updateUserProfile(
      username: string,
      avatar: number,
      sex: number,
      brief: string,
      birthday: number,
    ): Promise<void> {
      void username;
      void avatar;
      void sex;
      void brief;
      void birthday;
      throw new Error("updateUserProfile is not part of the current HTTP API");
    },
  };
}
