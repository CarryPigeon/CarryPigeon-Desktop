/**
 * @fileoverview userData.ts 文件职责说明。
 */
import Avatar from "/test_avatar.jpg?url";
import { reactive, readonly } from "vue";
import { createLogger } from "@/shared/utils/logger";

export type CurrentUserState = {
  id: number;
  username: string;
  email: string;
  avatarUrl: string;
  description: string;
};

const logger = createLogger("userData");

const defaultUser: CurrentUserState = import.meta.env.DEV
  ? {
      id: 1,
      username: "张三",
      email: "zhangsan@example.com",
      avatarUrl: Avatar,
      description: "热爱 Rust 与前端工程化，喜欢构建好用的桌面应用。",
    }
  : { id: 0, username: "", email: "", avatarUrl: Avatar, description: "" };

const state = reactive<CurrentUserState>({ ...defaultUser });

/**
 * Exported constant.
 * @constant
 */
export const currentUser = readonly(state);

/**
 * setCurrentUser 方法说明。
 * @param patch - 参数说明。
 * @returns 返回值说明。
 */
export function setCurrentUser(patch: Partial<CurrentUserState>) {
  Object.assign(state, patch);
  logger.info("Current user updated", { id: state.id });
}

/**
 * Backwards-compatible facade for existing callers.
 * Prefer using `currentUser` directly in new code.
 * @constant
 */
export const userData = {
  getUsername: () => state.username,
  getEmail: () => state.email,
  getId: () => state.id,
  getAvatar: () => state.avatarUrl,
};
