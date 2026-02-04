/**
 * @fileoverview httpChatApi.ts
 * @description HTTP data adapter for chat resources (channels/messages/read state).
 *
 * API doc reference:
 * - See `docs/api/*` for chat resource endpoints and error model.
 */

import { HttpJsonClient } from "@/shared/net/http/httpJsonClient";

export type ApiChannel = {
  cid: string;
  name: string;
  brief?: string;
  avatar?: string;
  owner_uid?: string;
};

export type ApiUserLite = {
  uid: string;
  nickname: string;
  avatar?: string;
};

export type ApiChannelMember = {
  uid: string;
  role: "owner" | "admin" | "member" | string;
  nickname: string;
  avatar?: string;
  join_time: number;
};

export type ApiChannelApplication = {
  application_id: string;
  cid: string;
  uid: string;
  reason: string;
  apply_time: number;
  status: "pending" | "approved" | "rejected" | string;
};

export type ApiChannelBan = {
  cid: string;
  uid: string;
  until: number;
  reason: string;
  create_time: number;
};

export type ApiMessage = {
  mid: string;
  cid: string;
  uid: string;
  sender?: ApiUserLite;
  send_time: number;
  domain: string;
  domain_version: string;
  data: unknown;
  preview?: string;
  reply_to_mid?: string;
};

type ApiListChannelsResponse = {
  channels: ApiChannel[];
};

type ApiListMessagesResponse = {
  items: ApiMessage[];
  next_cursor?: string;
  has_more?: boolean;
};

type ApiSendMessageRequest = {
  domain: string;
  domain_version: string;
  data: unknown;
  reply_to_mid?: string;
};

type ApiUnreadsResponse = {
  items: Array<{ cid: string; unread_count: number; last_read_time: number }>;
};

type ApiReadStateRequest = {
  last_read_mid: string;
  last_read_time: number;
};

type ApiApplyJoinRequest = {
  reason: string;
};

type ApiCreateChannelRequest = {
  name: string;
  brief?: string;
  avatar?: string;
};

type ApiListMembersResponse = {
  items: ApiChannelMember[];
};

type ApiListApplicationsResponse = {
  items: ApiChannelApplication[];
};

type ApiApplicationDecisionRequest = {
  decision: "approve" | "reject";
};

type ApiPutBanRequest = {
  until: number;
  reason: string;
};

type ApiListBansResponse = {
  items: ApiChannelBan[];
};

/**
 * Create an authenticated HTTP client bound to a server socket and token.
 *
 * @param serverSocket - Server socket (origin input).
 * @param accessToken - Bearer token.
 * @returns HttpJsonClient instance.
 */
function createAuthedClient(serverSocket: string, accessToken: string): HttpJsonClient {
  const socket = serverSocket.trim();
  const token = accessToken.trim();
  if (!socket) throw new Error("Missing server socket");
  if (!token) throw new Error("Missing access token");
  return new HttpJsonClient({ serverSocket: socket, apiVersion: 1, accessToken: token });
}

/**
 * Fetch channel list.
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @returns Channels array.
 */
export async function httpListChannels(serverSocket: string, accessToken: string): Promise<ApiChannel[]> {
  const client = createAuthedClient(serverSocket, accessToken);
  const res = await client.requestJson<ApiListChannelsResponse>("GET", "/channels");
  return Array.isArray(res?.channels) ? res.channels : [];
}

/**
 * Fetch per-channel unread counters for the current user.
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @returns Unread items array.
 */
export async function httpGetUnreads(
  serverSocket: string,
  accessToken: string,
): Promise<ApiUnreadsResponse["items"]> {
  const client = createAuthedClient(serverSocket, accessToken);
  const res = await client.requestJson<ApiUnreadsResponse>("GET", "/unreads");
  return Array.isArray(res?.items) ? res.items : [];
}

/**
 * Fetch messages for a channel.
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param cid - Channel id.
 * @param cursor - Optional pagination cursor.
 * @param limit - Page size (default 50).
 * @returns Messages + pagination hints.
 */
export async function httpListChannelMessages(
  serverSocket: string,
  accessToken: string,
  cid: string,
  cursor?: string,
  limit: number = 50,
): Promise<ApiListMessagesResponse> {
  const client = createAuthedClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const q: string[] = [];
  if (cursor) q.push(`cursor=${encodeURIComponent(cursor)}`);
  q.push(`limit=${encodeURIComponent(String(Math.max(1, Math.trunc(limit))))}`);
  const path = `/channels/${encodeURIComponent(channelId)}/messages?${q.join("&")}`;
  return client.requestJson<ApiListMessagesResponse>("GET", path);
}

/**
 * Send a message to a channel.
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param cid - Channel id.
 * @param req - Message request body.
 * @param idempotencyKey - Optional idempotency key used to avoid duplicates on retries.
 * @returns Created message object.
 */
export async function httpSendChannelMessage(
  serverSocket: string,
  accessToken: string,
  cid: string,
  req: ApiSendMessageRequest,
  idempotencyKey?: string,
): Promise<ApiMessage> {
  const client = createAuthedClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const path = `/channels/${encodeURIComponent(channelId)}/messages`;
  const key = String(idempotencyKey ?? "").trim();
  const headers = key ? { "Idempotency-Key": key } : undefined;
  return client.requestJsonWithHeaders<ApiMessage>("POST", path, req, headers);
}

/**
 * Delete (hard-delete) a message by mid.
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param mid - Message id.
 * @returns Promise<void>.
 */
export async function httpDeleteMessage(serverSocket: string, accessToken: string, mid: string): Promise<void> {
  const client = createAuthedClient(serverSocket, accessToken);
  const messageId = String(mid).trim();
  if (!messageId) throw new Error("Missing mid");
  await client.requestJson<void>("DELETE", `/messages/${encodeURIComponent(messageId)}`);
}

/**
 * Update read state for a channel (only forward).
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param cid - Channel id.
 * @param req - Read state body.
 * @returns Promise<void>.
 */
export async function httpUpdateReadState(
  serverSocket: string,
  accessToken: string,
  cid: string,
  req: ApiReadStateRequest,
): Promise<void> {
  const client = createAuthedClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  await client.requestJson<void>("PUT", `/channels/${encodeURIComponent(channelId)}/read_state`, req);
}

/**
 * Patch channel metadata (name/brief).
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param cid - Channel id.
 * @param patch - Partial update body.
 * @returns Updated channel object.
 */
export async function httpPatchChannel(
  serverSocket: string,
  accessToken: string,
  cid: string,
  patch: Partial<Pick<ApiChannel, "name" | "brief" | "avatar">>,
): Promise<ApiChannel> {
  const client = createAuthedClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  return client.requestJson<ApiChannel>("PATCH", `/channels/${encodeURIComponent(channelId)}`, patch);
}

/**
 * Apply/join a channel (non-member).
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param cid - Channel id.
 * @param reason - Optional join reason.
 * @returns Promise<void>.
 */
export async function httpApplyJoinChannel(
  serverSocket: string,
  accessToken: string,
  cid: string,
  reason: string,
): Promise<void> {
  const client = createAuthedClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const body: ApiApplyJoinRequest = { reason: String(reason ?? "") };
  await client.requestJson<void>("POST", `/channels/${encodeURIComponent(channelId)}/applications`, body);
}

/**
 * Create a channel (owner).
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param req - Channel create request.
 * @returns Created channel object.
 */
export async function httpCreateChannel(
  serverSocket: string,
  accessToken: string,
  req: ApiCreateChannelRequest,
): Promise<ApiChannel> {
  const client = createAuthedClient(serverSocket, accessToken);
  const name = String(req?.name ?? "").trim();
  if (!name) throw new Error("Missing channel name");
  return client.requestJson<ApiChannel>("POST", "/channels", {
    name,
    brief: String(req?.brief ?? ""),
    avatar: String(req?.avatar ?? ""),
  });
}

/**
 * Delete a channel (owner).
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param cid - Channel id.
 * @returns Promise<void>.
 */
export async function httpDeleteChannel(serverSocket: string, accessToken: string, cid: string): Promise<void> {
  const client = createAuthedClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  await client.requestJson<void>("DELETE", `/channels/${encodeURIComponent(channelId)}`);
}

/**
 * Get channel profile by id.
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param cid - Channel id.
 * @returns Channel profile.
 */
export async function httpGetChannel(serverSocket: string, accessToken: string, cid: string): Promise<ApiChannel> {
  const client = createAuthedClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  return client.requestJson<ApiChannel>("GET", `/channels/${encodeURIComponent(channelId)}`);
}

/**
 * List channel members.
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param cid - Channel id.
 * @returns Members list.
 */
export async function httpListChannelMembers(
  serverSocket: string,
  accessToken: string,
  cid: string,
): Promise<ApiChannelMember[]> {
  const client = createAuthedClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const res = await client.requestJson<ApiListMembersResponse>("GET", `/channels/${encodeURIComponent(channelId)}/members`);
  return Array.isArray(res?.items) ? res.items : [];
}

/**
 * Kick a user from a channel (admin/owner).
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param cid - Channel id.
 * @param uid - User id to remove.
 * @returns Promise<void>.
 */
export async function httpKickChannelMember(
  serverSocket: string,
  accessToken: string,
  cid: string,
  uid: string,
): Promise<void> {
  const client = createAuthedClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  const userId = String(uid).trim();
  if (!channelId) throw new Error("Missing cid");
  if (!userId) throw new Error("Missing uid");
  await client.requestJson<void>("DELETE", `/channels/${encodeURIComponent(channelId)}/members/${encodeURIComponent(userId)}`);
}

/**
 * Grant admin role for a user in a channel (owner).
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param cid - Channel id.
 * @param uid - User id.
 * @returns Promise<void>.
 */
export async function httpAddChannelAdmin(
  serverSocket: string,
  accessToken: string,
  cid: string,
  uid: string,
): Promise<void> {
  const client = createAuthedClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  const userId = String(uid).trim();
  if (!channelId) throw new Error("Missing cid");
  if (!userId) throw new Error("Missing uid");
  await client.requestJson<void>("PUT", `/channels/${encodeURIComponent(channelId)}/admins/${encodeURIComponent(userId)}`);
}

/**
 * Revoke admin role for a user in a channel (owner).
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param cid - Channel id.
 * @param uid - User id.
 * @returns Promise<void>.
 */
export async function httpRemoveChannelAdmin(
  serverSocket: string,
  accessToken: string,
  cid: string,
  uid: string,
): Promise<void> {
  const client = createAuthedClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  const userId = String(uid).trim();
  if (!channelId) throw new Error("Missing cid");
  if (!userId) throw new Error("Missing uid");
  await client.requestJson<void>("DELETE", `/channels/${encodeURIComponent(channelId)}/admins/${encodeURIComponent(userId)}`);
}

/**
 * List join applications for a channel (admin/owner).
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param cid - Channel id.
 * @returns Application list.
 */
export async function httpListChannelApplications(
  serverSocket: string,
  accessToken: string,
  cid: string,
): Promise<ApiChannelApplication[]> {
  const client = createAuthedClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const res = await client.requestJson<ApiListApplicationsResponse>("GET", `/channels/${encodeURIComponent(channelId)}/applications`);
  return Array.isArray(res?.items) ? res.items : [];
}

/**
 * Decide a join application (admin/owner).
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param cid - Channel id.
 * @param applicationId - Application id.
 * @param decision - `"approve"` or `"reject"`.
 * @returns Promise<void>.
 */
export async function httpDecideChannelApplication(
  serverSocket: string,
  accessToken: string,
  cid: string,
  applicationId: string,
  decision: ApiApplicationDecisionRequest["decision"],
): Promise<void> {
  const client = createAuthedClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  const aid = String(applicationId).trim();
  if (!channelId) throw new Error("Missing cid");
  if (!aid) throw new Error("Missing application_id");
  await client.requestJson<void>(
    "POST",
    `/channels/${encodeURIComponent(channelId)}/applications/${encodeURIComponent(aid)}/decisions`,
    { decision },
  );
}

/**
 * Put (create/update) a ban for a user in a channel (admin/owner).
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param cid - Channel id.
 * @param uid - User id.
 * @param untilMs - Unix epoch ms.
 * @param reason - Reason text.
 * @returns Promise<void>.
 */
export async function httpPutChannelBan(
  serverSocket: string,
  accessToken: string,
  cid: string,
  uid: string,
  untilMs: number,
  reason: string,
): Promise<void> {
  const client = createAuthedClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  const userId = String(uid).trim();
  if (!channelId) throw new Error("Missing cid");
  if (!userId) throw new Error("Missing uid");
  const until = Number.isFinite(untilMs) ? Math.trunc(untilMs) : 0;
  const body: ApiPutBanRequest = { until, reason: String(reason ?? "") };
  await client.requestJson<void>("PUT", `/channels/${encodeURIComponent(channelId)}/bans/${encodeURIComponent(userId)}`, body);
}

/**
 * Remove a ban for a user in a channel (admin/owner).
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param cid - Channel id.
 * @param uid - User id.
 * @returns Promise<void>.
 */
export async function httpDeleteChannelBan(
  serverSocket: string,
  accessToken: string,
  cid: string,
  uid: string,
): Promise<void> {
  const client = createAuthedClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  const userId = String(uid).trim();
  if (!channelId) throw new Error("Missing cid");
  if (!userId) throw new Error("Missing uid");
  await client.requestJson<void>("DELETE", `/channels/${encodeURIComponent(channelId)}/bans/${encodeURIComponent(userId)}`);
}

/**
 * List bans for a channel (admin/owner).
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param cid - Channel id.
 * @returns Ban list.
 */
export async function httpListChannelBans(
  serverSocket: string,
  accessToken: string,
  cid: string,
): Promise<ApiChannelBan[]> {
  const client = createAuthedClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const res = await client.requestJson<ApiListBansResponse>("GET", `/channels/${encodeURIComponent(channelId)}/bans`);
  return Array.isArray(res?.items) ? res.items : [];
}
