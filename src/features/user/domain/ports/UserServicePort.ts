/**
 * @fileoverview UserServicePort.ts
 * @description user｜领域端口：UserServicePort。
 *
 * 实现说明：
 * - `mock`：用于 UI 预览/开发联调的确定性实现
 * - `http`：基于后端 API 的真实实现
 */

import type { UserMe, UserPublic } from "../types/UserTypes";

/**
 * 用户服务端口（领域层）。
 */
export interface UserServicePort {
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
   * @param username - 用户名。
   * @param avatar - avatar id。
   * @param sex - 性别编码。
   * @param brief - 简介。
   * @param birthday - 生日时间戳。
   */
  updateUserProfile(
    username: string,
    avatar: number,
    sex: number,
    brief: string,
    birthday: number,
  ): Promise<void>;
}
