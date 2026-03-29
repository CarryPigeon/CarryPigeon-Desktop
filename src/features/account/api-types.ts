/**
 * @fileoverview account feature public types
 * @description
 * 统一暴露 account feature 对外稳定类型，避免跨 feature 直接依赖子特性的 domain/data 路径。
 */

import type { ReadableCapability } from "@/shared/types/capabilities";
import type { CurrentUser, CurrentUserProfilePatch, CurrentUserTrustLevel } from "./current-user/api";
import type { UpdateUserProfileInput } from "./profile/domain/types/UserTypes";
import type {
  RevokeTokenOutcome,
  SendVerificationCodeOutcome,
} from "./auth-flow/api";
import type {
  UpdateUserEmailOutcome,
  UpdateUserProfileOutcome,
} from "./profile/api";

export type { CurrentUser, CurrentUserProfilePatch, CurrentUserTrustLevel };

/**
 * account/current-user 对外能力分组。
 */
export type AccountCurrentUserCapabilities = ReadableCapability<CurrentUser> & {
  /**
   * 清空当前用户展示快照。
   *
   * @returns 无返回值。
   */
  clearSnapshot(): void;

  /**
   * 根据认证结果写入最小可信用户快照。
   *
   * @param input - 认证链路已确认的最小身份信息。
   * @returns 已写入的当前用户快照。
   */
  applyAuthenticatedSnapshot(input: { uid?: string; email?: string }): CurrentUser;

  /**
   * 在不提升 `trustLevel` 的前提下，投影本地 profile patch。
   *
   * 说明：
   * - 仅用于 UI 回显或权威同步失败后的保守更新；
   * - 不应把它当作“已拿到权威 profile”。
   *
   * @param patch - 本地资料 patch。
   * @returns 应用 patch 后的当前用户快照。
   */
  applyLocalProfilePatch(patch: CurrentUserProfilePatch): CurrentUser;
};

/**
 * account/auth-flow 对外能力分组。
 */
export type AccountAuthFlowCapabilities = {
  /**
   * 写入当前 required-setup 闸门判定得到的“缺失插件 id 列表”。
   *
   * @param ids - 当前缺失的插件 id 列表。
   * @returns 无返回值。
   */
  updateMissingRequiredPlugins(ids: string[]): void;
};

/**
 * account/profile 错误语义分组。
 */
export type AccountProfileErrorCapabilities = {
  /**
   * 判断给定错误是否属于 profile 领域错误。
   *
   * @param error - 待判定的未知错误。
   * @returns 若属于 profile 错误则为 `true`。
   */
  isProfileError(error: unknown): boolean;

  /**
   * 判断给定错误是否表示“当前运行模式不支持资料写操作”。
   *
   * @param error - 待判定的未知错误。
   * @returns 若为 mutation unsupported 错误则为 `true`。
   */
  isMutationUnsupported(error: unknown): boolean;

  /**
   * 将 profile 相关错误格式化为面向 UI 的可读文案。
   *
   * @param error - 待格式化的未知错误。
   * @returns 可直接展示的错误文案。
   */
  toMessage(error: unknown): string;

  /**
   * 判断当前运行模式下是否支持 profile mutation。
   *
   * @returns 支持资料写操作时为 `true`。
   */
  supportsMutation(): boolean;
};

/**
 * 绑定到特定 server 的 account 局部 capability。
 */
export type AccountServerCapabilities = {
  /**
   * 向当前绑定的服务器发送邮箱验证码。
   *
   * @param email - 需要接收验证码的邮箱地址。
   * @returns 显式发码结果；失败时返回结构化错误信息而非抛出业务分支异常。
   */
  sendVerificationCode(email: string): Promise<SendVerificationCodeOutcome>;

  /**
   * 向当前绑定的服务器撤销 refresh token。
   *
   * @param refreshToken - 要撤销的 refresh token。
   * @returns 显式撤销结果；失败时返回结构化认证错误信息。
   */
  revokeToken(refreshToken: string): Promise<RevokeTokenOutcome>;

  /**
   * 从当前绑定服务器同步当前用户展示快照。
   *
   * @param accessToken - 可用于读取当前用户资料的 access token。
   * @returns 同步后的当前用户快照。
   */
  syncCurrentUserSnapshot(accessToken: string): Promise<CurrentUser>;

  /**
   * 更新当前用户邮箱。
   *
   * @param email - 新邮箱地址。
   * @param code - 邮箱验证码。
   * @returns 显式邮箱更新结果；失败时返回结构化资料错误信息。
   */
  updateUserEmail(email: string, code: string): Promise<UpdateUserEmailOutcome>;

  /**
   * 更新当前用户资料。
   *
   * @param input - 用户资料更新载荷。
   * @returns 显式资料更新结果；失败时返回结构化资料错误信息。
   */
  updateUserProfile(input: UpdateUserProfileInput): Promise<UpdateUserProfileOutcome>;
};

/**
 * account feature 对外能力契约（object-capability）。
 *
 * 说明：
 * - 调用方应通过 capability 对象访问 account 的稳定公共能力；
 * - 该契约按 `authFlow`、`currentUser`、`profileErrors` 与 `forServer()` 分组；
 * - 所有方法均面向“跨 feature 调用者”，不暴露 account 内部 store / usecase 组装细节。
 */
export type AccountCapabilities = {
  /**
   * 认证流程相关能力。
   */
  authFlow: AccountAuthFlowCapabilities;

  /**
   * 当前用户展示快照相关能力。
   */
  currentUser: AccountCurrentUserCapabilities;

  /**
   * profile 错误语义能力。
   */
  profileErrors: AccountProfileErrorCapabilities;

  /**
   * 绑定到指定 server 的局部 capability。
   *
   * @param serverSocket - 当前服务器 socket。
   * @returns 绑定到该 server 的局部能力对象。
   */
  forServer(serverSocket: string): AccountServerCapabilities;
};
