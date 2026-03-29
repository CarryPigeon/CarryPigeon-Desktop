/**
 * @fileoverview httpUserApi.ts
 * @description account/profile｜数据层实现：httpUserApi。
 *
 * API 文档：
 * - 见 `docs/api/*` → Users 相关接口与错误模型
 */

import { createAuthedHttpJsonClient } from "@/shared/net/http/authedHttpJsonClient";
import { isApiRequestError } from "@/shared/net/http/apiErrors";
import { ProfileError } from "../domain/errors/ProfileErrors";

/**
 * `/users/me` 响应：当前用户资料。
 */
export type ApiUserMe = {
  uid: string;
  email?: string;
  nickname?: string;
  avatar?: string;
};

/**
 * 用户公开资料（对外展示）。
 */
export type ApiUserPublic = {
  uid: string;
  nickname: string;
  avatar?: string;
};

type ApiUsersBatchResponse = {
  items: ApiUserPublic[];
};

/**
 * 将未知错误归一化为 ProfileError。
 *
 * @param code - 错误码。
 * @param fallback - 回退文案。
 * @param error - 原始错误对象。
 * @returns 该函数不会返回，只会抛错。
 */
function rethrowProfileError(code: ProfileError["code"], fallback: string, error: unknown): never {
  if (error instanceof ProfileError) throw error;
  if (isApiRequestError(error)) {
    throw new ProfileError({
      code,
      message: `${fallback}: ${error.reason} (HTTP ${error.status})`,
      status: error.status,
      reason: error.reason,
      details: error.details,
      cause: error,
    });
  }
  throw new ProfileError({ code, message: String(error) || fallback, cause: error });
}

/**
 * 获取当前用户资料（/users/me）。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @returns 当前用户资料。
 */
export async function httpGetCurrentUser(serverSocket: string, accessToken: string): Promise<ApiUserMe> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  try {
    return await client.requestJson<ApiUserMe>("GET", "/users/me");
  } catch (e) {
    rethrowProfileError("get_me_failed", "Get current user failed", e);
  }
}

/**
 * 按 uid 获取用户公开资料。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param uid - 用户 id。
 * @returns 用户公开资料。
 */
export async function httpGetUser(serverSocket: string, accessToken: string, uid: string): Promise<ApiUserPublic> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const userId = String(uid).trim();
  if (!userId) throw new ProfileError({ code: "missing_uid", message: "Missing uid." });
  try {
    return await client.requestJson<ApiUserPublic>("GET", `/users/${encodeURIComponent(userId)}`);
  } catch (e) {
    rethrowProfileError("get_user_failed", "Get user failed", e);
  }
}

/**
 * 批量获取用户公开资料。
 *
 * 说明：
 * - API 接收 CSV 形式的 `ids` query 参数。
 * - 客户端在发送前做去重，确保请求稳定且避免冗余。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param ids - 用户 id 列表。
 * @returns 用户公开资料列表。
 */
export async function httpListUsers(serverSocket: string, accessToken: string, ids: string[]): Promise<ApiUserPublic[]> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const unique = new Set<string>();
  for (const id of ids ?? []) {
    const v = String(id ?? "").trim();
    if (v) unique.add(v);
  }
  if (unique.size === 0) return [];
  const csv = Array.from(unique).join(",");
  try {
    const res = await client.requestJson<ApiUsersBatchResponse>("GET", `/users?ids=${encodeURIComponent(csv)}`);
    return Array.isArray(res?.items) ? res.items : [];
  } catch (e) {
    rethrowProfileError("list_users_failed", "List users failed", e);
  }
}
