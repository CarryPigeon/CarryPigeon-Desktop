/**
 * @fileoverview UserTypes.ts
 * @description Domain types for user feature (framework-agnostic).
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
