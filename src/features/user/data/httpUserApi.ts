/**
 * @fileoverview httpUserApi.ts
 * @description user｜数据层实现：httpUserApi。
 *
 * API 文档：
 * - 见 `docs/api/*` → Users 相关接口与错误模型
 */

import { createAuthedHttpJsonClient } from "@/shared/net/http/authedHttpJsonClient";

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
 * 获取当前用户资料（/users/me）。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @returns 当前用户资料。
 */
export async function httpGetCurrentUser(serverSocket: string, accessToken: string): Promise<ApiUserMe> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  return client.requestJson<ApiUserMe>("GET", "/users/me");
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
  if (!userId) throw new Error("Missing uid");
  return client.requestJson<ApiUserPublic>("GET", `/users/${encodeURIComponent(userId)}`);
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
  const res = await client.requestJson<ApiUsersBatchResponse>("GET", `/users?ids=${encodeURIComponent(csv)}`);
  return Array.isArray(res?.items) ? res.items : [];
}
