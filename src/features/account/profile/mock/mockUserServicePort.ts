/**
 * @fileoverview mockUserServicePort.ts
 * @description account/profile｜Mock 实现：mockUserServicePort（用于本地预览/测试）。
 */

import { MOCK_LATENCY_MS } from "@/shared/config/runtime";
import { sleep } from "@/shared/mock/sleep";
import type { UserServicePort } from "../domain/ports/UserServicePort";
import type { UpdateUserProfileInput } from "../domain/types/UserTypes";
import type { UserMe, UserPublic } from "../domain/types/UserTypes";

// Mock 背景图片
const MOCK_BACKGROUNDS = [
  "https://picsum.photos/id/1018/800/400", // Mountain
  "https://picsum.photos/id/1015/800/400", // River
  "https://picsum.photos/id/1039/800/400", // Forest
  "https://picsum.photos/id/1043/800/400", // Sea
];

/**
 * 创建 `UserServicePort` 的 mock 实现。
 *
 * @param serverSocket - 服务器 Socket 地址（mock 中不使用，仅保留签名一致性）。
 * @returns `UserServicePort` 实现。
 */
export function createMockUserServicePort(serverSocket: string): UserServicePort {
  void serverSocket;
  return {
    async getMe(accessToken: string): Promise<UserMe> {
      void accessToken;
      await sleep(MOCK_LATENCY_MS);
      return {
        uid: "1",
        email: "user@example.com",
        nickname: "Operator",
        avatar: "",
        backgroundUrl: MOCK_BACKGROUNDS[0],
      };
    },
    async getUser(accessToken: string, uid: string): Promise<UserPublic> {
      void accessToken;
      await sleep(MOCK_LATENCY_MS);
      const idx = parseInt(String(uid), 10) % MOCK_BACKGROUNDS.length;
      return {
        uid: String(uid ?? "1"),
        nickname: "User " + uid,
        avatar: "",
        email: `user${uid}@example.com`,
        bio: "这是一段用户简介。在这里可以写一些关于自己的介绍。",
        backgroundUrl: MOCK_BACKGROUNDS[idx] ?? MOCK_BACKGROUNDS[0],
      };
    },
    async listUsers(accessToken: string, ids: string[]): Promise<UserPublic[]> {
      void accessToken;
      await sleep(MOCK_LATENCY_MS);
      const out: UserPublic[] = [];
      for (const id of ids ?? []) {
        const idx = parseInt(String(id), 10) % MOCK_BACKGROUNDS.length;
        out.push({
          uid: String(id ?? ""),
          nickname: "User " + id,
          avatar: "",
          email: `user${id}@example.com`,
          backgroundUrl: MOCK_BACKGROUNDS[idx] ?? MOCK_BACKGROUNDS[0],
        });
      }
      return out;
    },
    async updateUserEmail(email: string, code: string): Promise<void> {
      void email;
      void code;
      await sleep(MOCK_LATENCY_MS);
    },
    async updateUserProfile(input: UpdateUserProfileInput): Promise<void> {
      void input;
      await sleep(MOCK_LATENCY_MS);
    },
    async updateUserBackgroundImage(accessToken: string, file: File): Promise<string> {
      void accessToken;
      void file;
      await sleep(MOCK_LATENCY_MS);
      // 返回随机背景
      const idx = Math.floor(Math.random() * MOCK_BACKGROUNDS.length);
      return MOCK_BACKGROUNDS[idx] ?? MOCK_BACKGROUNDS[0];
    },
  };
}
