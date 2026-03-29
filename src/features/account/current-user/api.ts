/**
 * @fileoverview account/current-user 对外 API。
 * @description
 * 暴露“当前用户展示态”的只读快照与受控写接口。
 *
 * 说明：
 * - 本文件是 `current-user` 子域的稳定入口；
 * - 该快照服务于展示层与跨 feature 集成，不替代 profile 领域查询结果。
 */

import type { ReadableCapability } from "@/shared/types/capabilities";
import {
  applyCurrentUserProfilePatch,
} from "../application/currentUserSnapshot";
import {
  clearCurrentUserSnapshot,
  getCurrentUserSnapshot,
  observeCurrentUserSnapshot,
} from "./application/currentUserState";
import type {
  CurrentUser,
  CurrentUserProfilePatch,
} from "./application/currentUserContracts";

export type CurrentUserCapabilities = ReadableCapability<CurrentUser> & {
  applyLocalProfilePatch(patch: CurrentUserProfilePatch): CurrentUser;
  clearSnapshot(): void;
};

/**
 * 创建 current-user 子域能力对象。
 */
export function createCurrentUserCapabilities(): CurrentUserCapabilities {
  return {
    getSnapshot: getCurrentUserSnapshot,
    observeSnapshot: observeCurrentUserSnapshot,
    applyLocalProfilePatch: applyCurrentUserProfilePatch,
    clearSnapshot: clearCurrentUserSnapshot,
  };
}

let currentUserCapabilitiesSingleton: CurrentUserCapabilities | null = null;

/**
 * 获取 current-user 子域共享能力对象。
 */
export function getCurrentUserCapabilities(): CurrentUserCapabilities {
  currentUserCapabilitiesSingleton ??= createCurrentUserCapabilities();
  return currentUserCapabilitiesSingleton;
}

export type { CurrentUser, CurrentUserProfilePatch, CurrentUserTrustLevel } from "./application/currentUserContracts";
