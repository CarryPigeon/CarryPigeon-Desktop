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
};

/**
 * Public user profile (visible to other users).
 */
export type UserPublic = {
  uid: string;
  nickname: string;
  avatar?: string;
};

/**
 * 用户资料更新输入对象。
 */
export type UpdateUserProfileInput = {
  username: string;
  avatar: number;
  sex: number;
  brief: string;
  birthday: number;
};
