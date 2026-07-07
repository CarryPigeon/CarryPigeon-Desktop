/**
 * @fileoverview UserTypes.ts
 * @description account/profile｜领域类型：UserTypes。
 */

/**
 * Current user profile (authenticated user).
 */
export type UserMe = {
  uid: string;
  email?: string;
  nickname?: string;
  avatar?: string;
  backgroundUrl?: string;
};

/**
 * Public user profile (visible to other users).
 */
export type UserPublic = {
  uid: string;
  nickname: string;
  avatar?: string;
  email?: string;
  bio?: string;
  backgroundUrl?: string;
};

/**
 * 用户资料更新输入对象。
 * 与服务端 `PATCH /api/users/me` 协议对齐。
 */
export type UpdateUserProfileInput = {
  username: string;
  avatar?: string;
  brief: string;
};
