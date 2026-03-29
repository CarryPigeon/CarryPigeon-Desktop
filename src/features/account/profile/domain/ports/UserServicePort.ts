/**
 * @fileoverview UserServicePort.ts
 * @description account/profile｜领域端口：UserServicePort。
 *
 * 实现说明：
 * - `mock`：用于 UI 预览/开发联调的确定性实现
 * - `http`：基于后端 API 的真实实现
 */

import type { UpdateUserProfileInput, UserMe, UserPublic } from "../types/UserTypes";

/**
 * 用户查询端口（只读能力）。
 */
export interface UserQueryPort {
  /**
   * 获取当前用户资料。
   *
   * @param accessToken - Bearer access token。
   * @returns 当前用户资料。
   */
  getMe(accessToken: string): Promise<UserMe>;

  /**
   * 按 uid 获取用户公开资料。
   *
   * @param accessToken - Bearer access token。
   * @param uid - 用户 id。
   * @returns 用户公开资料。
   */
  getUser(accessToken: string, uid: string): Promise<UserPublic>;

  /**
   * 批量获取用户公开资料。
   *
   * @param accessToken - Bearer access token。
   * @param ids - 用户 id 列表。
   * @returns 用户公开资料列表。
   */
  listUsers(accessToken: string, ids: string[]): Promise<UserPublic[]>;
}

/**
 * 用户资料变更端口（写能力）。
 */
export interface UserMutationPort {
  /**
   * 更新用户邮箱（需要验证码）。
   *
   * @param email - 新邮箱地址。
   * @param code - 验证码。
   */
  updateUserEmail(email: string, code: string): Promise<void>;

  /**
   * 更新用户资料。
   *
   * @param input - 用户资料输入对象。
   */
  updateUserProfile(input: UpdateUserProfileInput): Promise<void>;
}

/**
 * 用户服务端口（聚合查询 + 变更能力）。
 */
export interface UserServicePort extends UserQueryPort, UserMutationPort {}
