/**
 * @fileoverview mockUserServicePort.ts
 * @description Mock UserServicePort implementation for UI preview.
 */

import { MOCK_LATENCY_MS } from "@/shared/config/runtime";
import { sleep } from "@/shared/mock/sleep";
import type { UserServicePort } from "../domain/ports/UserServicePort";
import type { UserMe, UserPublic } from "../domain/types/UserTypes";

/**
 * Create a mock UserServicePort.
 *
 * @param serverSocket - Server socket (unused by mock).
 * @returns UserServicePort implementation.
 */
export function createMockUserServicePort(serverSocket: string): UserServicePort {
  void serverSocket;
  return {
    async getMe(accessToken: string): Promise<UserMe> {
      void accessToken;
      await sleep(MOCK_LATENCY_MS);
      return { uid: "1", email: "user@example.com", nickname: "Operator", avatar: "" };
    },
    async getUser(accessToken: string, uid: string): Promise<UserPublic> {
      void accessToken;
      await sleep(MOCK_LATENCY_MS);
      return { uid: String(uid ?? "1"), nickname: "User", avatar: "" };
    },
    async listUsers(accessToken: string, ids: string[]): Promise<UserPublic[]> {
      void accessToken;
      await sleep(MOCK_LATENCY_MS);
      const out: UserPublic[] = [];
      for (const id of ids ?? []) {
        out.push({ uid: String(id ?? ""), nickname: "User", avatar: "" });
      }
      return out;
    },
    async updateUserEmail(email: string, code: string): Promise<void> {
      void email;
      void code;
      await sleep(MOCK_LATENCY_MS);
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
      await sleep(MOCK_LATENCY_MS);
    },
  };
}
