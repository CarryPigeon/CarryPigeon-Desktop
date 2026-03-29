/**
 * @fileoverview account 当前用户快照同步。
 * @description
 * 收敛“如何从权威身份资料构造当前用户展示快照”的规则，
 * 避免登录恢复、登录成功、资料更新分别维护不同的写入逻辑。
 */

import {
  getCurrentUserSnapshot,
  replaceCurrentUserSnapshot,
} from "@/features/account/current-user/application/currentUserState";
import type {
  CurrentUser,
  CurrentUserProfilePatch,
} from "@/features/account/current-user/application/currentUserContracts";
import { getCurrentUserProfile } from "@/features/account/profile/application/profileService";

type UserProfileLike = {
  uid?: unknown;
  email?: unknown;
  nickname?: unknown;
  brief?: unknown;
};

/**
 * 将 profile 领域返回的用户资料映射为当前用户展示快照。
 */
export function toCurrentUserSnapshot(profile: UserProfileLike): CurrentUser {
  const id = String(profile.uid ?? "").trim();
  const email = String(profile.email ?? "").trim();
  const username = String(profile.nickname ?? "").trim();
  return {
    id,
    username,
    email,
    description: String(profile.brief ?? "").trim(),
    trustLevel: "authority_profile",
  };
}

/**
 * 当权威 profile 尚不可用时，按认证结果写入最小可信快照。
 *
 * 说明：
 * - 只写入认证链路中已经确认的字段；
 * - 不再猜测用户名，不再写入占位描述。
 */
export function applyAuthenticatedUserSnapshot(input: {
  uid?: string;
  email?: string;
}): CurrentUser {
  const snapshot: CurrentUser = {
    id: String(input.uid ?? "").trim(),
    username: "",
    email: String(input.email ?? "").trim(),
    description: "",
    trustLevel: "authenticated",
  };
  return replaceCurrentUserSnapshot(snapshot);
}

/**
 * 在不提升可信等级的前提下，将本地 profile 编辑结果投影到当前用户快照。
 *
 * 说明：
 * - 仅用于 profile 更新后的本地回显；
 * - 不把本地 patch 视为权威 profile；
 * - 保留当前 snapshot 的 `trustLevel`。
 */
export function applyCurrentUserProfilePatch(patch: CurrentUserProfilePatch): CurrentUser {
  const current = getCurrentUserSnapshot();
  const snapshot: CurrentUser = {
    id: current.id,
    username: typeof patch.username === "string" ? patch.username.trim() : current.username,
    email: typeof patch.email === "string" ? patch.email.trim() : current.email,
    description: typeof patch.description === "string" ? patch.description.trim() : current.description,
    trustLevel: current.trustLevel,
  };
  return replaceCurrentUserSnapshot(snapshot);
}

/**
 * 从权威 `me` 资料同步当前用户快照。
 */
export async function syncCurrentUserSnapshot(serverSocket: string, accessToken: string): Promise<CurrentUser> {
  const profile = await getCurrentUserProfile(serverSocket, accessToken);
  const snapshot = toCurrentUserSnapshot(profile);
  return replaceCurrentUserSnapshot(snapshot);
}
