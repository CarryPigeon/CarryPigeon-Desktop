/**
 * @fileoverview httpUserApi.ts
 * @description HTTP data adapter for user resources.
 *
 * API doc reference:
 * - See `docs/api/*` → Users section and error model
 */

import { HttpJsonClient } from "@/shared/net/http/httpJsonClient";

export type ApiUserMe = {
  uid: string;
  email?: string;
  nickname?: string;
  avatar?: string;
};

export type ApiUserPublic = {
  uid: string;
  nickname: string;
  avatar?: string;
};

type ApiUsersBatchResponse = {
  items: ApiUserPublic[];
};

/**
 * Create an authenticated HTTP client bound to a server socket and access token.
 *
 * @param serverSocket - Server socket string.
 * @param accessToken - Bearer access token.
 * @returns HttpJsonClient.
 */
function createAuthedClient(serverSocket: string, accessToken: string): HttpJsonClient {
  const socket = serverSocket.trim();
  const token = accessToken.trim();
  if (!socket) throw new Error("Missing server socket");
  if (!token) throw new Error("Missing access token");
  return new HttpJsonClient({ serverSocket: socket, apiVersion: 1, accessToken: token });
}

/**
 * Fetch current user profile.
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @returns User profile.
 */
export async function httpGetCurrentUser(serverSocket: string, accessToken: string): Promise<ApiUserMe> {
  const client = createAuthedClient(serverSocket, accessToken);
  return client.requestJson<ApiUserMe>("GET", "/users/me");
}

/**
 * Fetch a user's public profile by uid.
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param uid - User id.
 * @returns User public profile.
 */
export async function httpGetUser(serverSocket: string, accessToken: string, uid: string): Promise<ApiUserPublic> {
  const client = createAuthedClient(serverSocket, accessToken);
  const userId = String(uid).trim();
  if (!userId) throw new Error("Missing uid");
  return client.requestJson<ApiUserPublic>("GET", `/users/${encodeURIComponent(userId)}`);
}

/**
 * Batch fetch user public profiles.
 *
 * Notes:
 * - The API takes a CSV `ids` query param.
 * - The client uses a stable de-duplication strategy before sending.
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param ids - User id list.
 * @returns User public profiles list.
 */
export async function httpListUsers(serverSocket: string, accessToken: string, ids: string[]): Promise<ApiUserPublic[]> {
  const client = createAuthedClient(serverSocket, accessToken);
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
