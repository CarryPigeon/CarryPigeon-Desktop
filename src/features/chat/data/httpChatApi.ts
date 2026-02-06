/**
 * @fileoverview httpChatApi.ts
 * @description chat｜数据层实现：httpChatApi。
 *
 * 接口文档参考：
 * - 参见 `docs/api/*`（聊天资源端点、错误模型）。
 */

import { createAuthedHttpJsonClient } from "@/shared/net/http/authedHttpJsonClient";

/**
 * 频道 API 响应模型（snake_case，与服务端对齐）。
 */
export type ApiChannel = {
  cid: string;
  name: string;
  brief?: string;
  avatar?: string;
  owner_uid?: string;
};

/**
 * 用户轻量 API 响应模型（snake_case）。
 */
export type ApiUserLite = {
  uid: string;
  nickname: string;
  avatar?: string;
};

/**
 * 频道成员 API 响应模型（snake_case）。
 */
export type ApiChannelMember = {
  uid: string;
  role: "owner" | "admin" | "member" | string;
  nickname: string;
  avatar?: string;
  join_time: number;
};

/**
 * 入群申请 API 响应模型（snake_case）。
 */
export type ApiChannelApplication = {
  application_id: string;
  cid: string;
  uid: string;
  reason: string;
  apply_time: number;
  status: "pending" | "approved" | "rejected" | string;
};

/**
 * 封禁条目 API 响应模型（snake_case）。
 */
export type ApiChannelBan = {
  cid: string;
  uid: string;
  until: number;
  reason: string;
  create_time: number;
};

/**
 * 消息 API 响应模型（snake_case）。
 */
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
 * 获取频道列表。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @returns 频道数组。
 */
export async function httpListChannels(serverSocket: string, accessToken: string): Promise<ApiChannel[]> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const res = await client.requestJson<ApiListChannelsResponse>("GET", "/channels");
  return Array.isArray(res?.channels) ? res.channels : [];
}

/**
 * 获取当前用户在各频道的未读计数。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @returns 未读计数条目数组。
 */
export async function httpGetUnreads(
  serverSocket: string,
  accessToken: string,
): Promise<ApiUnreadsResponse["items"]> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const res = await client.requestJson<ApiUnreadsResponse>("GET", "/unreads");
  return Array.isArray(res?.items) ? res.items : [];
}

/**
 * 获取频道消息列表（支持游标分页）。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param cid - 频道 id。
 * @param cursor - 可选分页游标。
 * @param limit - 每页大小（默认 50）。
 * @returns 消息列表与分页提示信息。
 */
export async function httpListChannelMessages(
  serverSocket: string,
  accessToken: string,
  cid: string,
  cursor?: string,
  limit: number = 50,
): Promise<ApiListMessagesResponse> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const q: string[] = [];
  if (cursor) q.push(`cursor=${encodeURIComponent(cursor)}`);
  q.push(`limit=${encodeURIComponent(String(Math.max(1, Math.trunc(limit))))}`);
  const path = `/channels/${encodeURIComponent(channelId)}/messages?${q.join("&")}`;
  return client.requestJson<ApiListMessagesResponse>("GET", path);
}

/**
 * 向频道发送消息。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param cid - 频道 id。
 * @param req - 消息请求体。
 * @param idempotencyKey - 幂等 key（可选）：用于避免重试时重复写入。
 * @returns 创建后的消息对象。
 */
export async function httpSendChannelMessage(
  serverSocket: string,
  accessToken: string,
  cid: string,
  req: ApiSendMessageRequest,
  idempotencyKey?: string,
): Promise<ApiMessage> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const path = `/channels/${encodeURIComponent(channelId)}/messages`;
  const key = String(idempotencyKey ?? "").trim();
  const headers = key ? { "Idempotency-Key": key } : undefined;
  return client.requestJsonWithHeaders<ApiMessage>("POST", path, req, headers);
}

/**
 * 按 `mid` 删除消息（硬删除）。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param mid - 消息 id。
 * @returns `Promise<void>`。
 */
export async function httpDeleteMessage(serverSocket: string, accessToken: string, mid: string): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const messageId = String(mid).trim();
  if (!messageId) throw new Error("Missing mid");
  await client.requestJson<void>("DELETE", `/messages/${encodeURIComponent(messageId)}`);
}

/**
 * 更新频道已读状态（仅允许“前进”更新）。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param cid - 频道 id。
 * @param req - 已读状态请求体。
 * @returns `Promise<void>`。
 */
export async function httpUpdateReadState(
  serverSocket: string,
  accessToken: string,
  cid: string,
  req: ApiReadStateRequest,
): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  await client.requestJson<void>("PUT", `/channels/${encodeURIComponent(channelId)}/read_state`, req);
}

/**
 * 局部更新频道元信息（name/brief/avatar）。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param cid - 频道 id。
 * @param patch - 部分更新请求体。
 * @returns 更新后的频道对象。
 */
export async function httpPatchChannel(
  serverSocket: string,
  accessToken: string,
  cid: string,
  patch: Partial<Pick<ApiChannel, "name" | "brief" | "avatar">>,
): Promise<ApiChannel> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  return client.requestJson<ApiChannel>("PATCH", `/channels/${encodeURIComponent(channelId)}`, patch);
}

/**
 * 申请加入频道（非成员）。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param cid - 频道 id。
 * @param reason - 申请理由（可选）。
 * @returns `Promise<void>`。
 */
export async function httpApplyJoinChannel(
  serverSocket: string,
  accessToken: string,
  cid: string,
  reason: string,
): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const body: ApiApplyJoinRequest = { reason: String(reason ?? "") };
  await client.requestJson<void>("POST", `/channels/${encodeURIComponent(channelId)}/applications`, body);
}

/**
 * 创建频道（owner）。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param req - 创建频道请求体。
 * @returns 创建后的频道对象。
 */
export async function httpCreateChannel(
  serverSocket: string,
  accessToken: string,
  req: ApiCreateChannelRequest,
): Promise<ApiChannel> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const name = String(req?.name ?? "").trim();
  if (!name) throw new Error("Missing channel name");
  return client.requestJson<ApiChannel>("POST", "/channels", {
    name,
    brief: String(req?.brief ?? ""),
    avatar: String(req?.avatar ?? ""),
  });
}

/**
 * 删除频道（owner）。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param cid - 频道 id。
 * @returns `Promise<void>`。
 */
export async function httpDeleteChannel(serverSocket: string, accessToken: string, cid: string): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  await client.requestJson<void>("DELETE", `/channels/${encodeURIComponent(channelId)}`);
}

/**
 * 获取频道信息。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param cid - 频道 id。
 * @returns 频道信息。
 */
export async function httpGetChannel(serverSocket: string, accessToken: string, cid: string): Promise<ApiChannel> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  return client.requestJson<ApiChannel>("GET", `/channels/${encodeURIComponent(channelId)}`);
}

/**
 * 获取频道成员列表。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param cid - 频道 id。
 * @returns 成员列表。
 */
export async function httpListChannelMembers(
  serverSocket: string,
  accessToken: string,
  cid: string,
): Promise<ApiChannelMember[]> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const res = await client.requestJson<ApiListMembersResponse>("GET", `/channels/${encodeURIComponent(channelId)}/members`);
  return Array.isArray(res?.items) ? res.items : [];
}

/**
 * 将用户踢出频道（admin/owner）。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param cid - 频道 id。
 * @param uid - 需要移除的用户 id。
 * @returns `Promise<void>`。
 */
export async function httpKickChannelMember(
  serverSocket: string,
  accessToken: string,
  cid: string,
  uid: string,
): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  const userId = String(uid).trim();
  if (!channelId) throw new Error("Missing cid");
  if (!userId) throw new Error("Missing uid");
  await client.requestJson<void>("DELETE", `/channels/${encodeURIComponent(channelId)}/members/${encodeURIComponent(userId)}`);
}

/**
 * 授予频道管理员（owner）。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param cid - 频道 id。
 * @param uid - 用户 id。
 * @returns `Promise<void>`。
 */
export async function httpAddChannelAdmin(
  serverSocket: string,
  accessToken: string,
  cid: string,
  uid: string,
): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  const userId = String(uid).trim();
  if (!channelId) throw new Error("Missing cid");
  if (!userId) throw new Error("Missing uid");
  await client.requestJson<void>("PUT", `/channels/${encodeURIComponent(channelId)}/admins/${encodeURIComponent(userId)}`);
}

/**
 * 撤销频道管理员（owner）。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param cid - 频道 id。
 * @param uid - 用户 id。
 * @returns `Promise<void>`。
 */
export async function httpRemoveChannelAdmin(
  serverSocket: string,
  accessToken: string,
  cid: string,
  uid: string,
): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  const userId = String(uid).trim();
  if (!channelId) throw new Error("Missing cid");
  if (!userId) throw new Error("Missing uid");
  await client.requestJson<void>("DELETE", `/channels/${encodeURIComponent(channelId)}/admins/${encodeURIComponent(userId)}`);
}

/**
 * 获取频道入群申请列表（admin/owner）。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param cid - 频道 id。
 * @returns 申请列表。
 */
export async function httpListChannelApplications(
  serverSocket: string,
  accessToken: string,
  cid: string,
): Promise<ApiChannelApplication[]> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const res = await client.requestJson<ApiListApplicationsResponse>("GET", `/channels/${encodeURIComponent(channelId)}/applications`);
  return Array.isArray(res?.items) ? res.items : [];
}

/**
 * 审批/拒绝入群申请（admin/owner）。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param cid - 频道 id。
 * @param applicationId - 申请 id。
 * @param decision - `"approve"` 或 `"reject"`。
 * @returns `Promise<void>`。
 */
export async function httpDecideChannelApplication(
  serverSocket: string,
  accessToken: string,
  cid: string,
  applicationId: string,
  decision: ApiApplicationDecisionRequest["decision"],
): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
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
 * 对频道内某用户设置禁言/封禁（创建或更新）（admin/owner）。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param cid - 频道 id。
 * @param uid - 用户 id。
 * @param untilMs - 截止时间（Unix epoch ms）。
 * @param reason - 原因说明。
 * @returns `Promise<void>`。
 */
export async function httpPutChannelBan(
  serverSocket: string,
  accessToken: string,
  cid: string,
  uid: string,
  untilMs: number,
  reason: string,
): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  const userId = String(uid).trim();
  if (!channelId) throw new Error("Missing cid");
  if (!userId) throw new Error("Missing uid");
  const until = Number.isFinite(untilMs) ? Math.trunc(untilMs) : 0;
  const body: ApiPutBanRequest = { until, reason: String(reason ?? "") };
  await client.requestJson<void>("PUT", `/channels/${encodeURIComponent(channelId)}/bans/${encodeURIComponent(userId)}`, body);
}

/**
 * 解除频道内某用户禁言/封禁（admin/owner）。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param cid - 频道 id。
 * @param uid - 用户 id。
 * @returns `Promise<void>`。
 */
export async function httpDeleteChannelBan(
  serverSocket: string,
  accessToken: string,
  cid: string,
  uid: string,
): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  const userId = String(uid).trim();
  if (!channelId) throw new Error("Missing cid");
  if (!userId) throw new Error("Missing uid");
  await client.requestJson<void>("DELETE", `/channels/${encodeURIComponent(channelId)}/bans/${encodeURIComponent(userId)}`);
}

/**
 * 获取频道封禁列表（admin/owner）。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param cid - 频道 id。
 * @returns 封禁列表。
 */
export async function httpListChannelBans(
  serverSocket: string,
  accessToken: string,
  cid: string,
): Promise<ApiChannelBan[]> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const res = await client.requestJson<ApiListBansResponse>("GET", `/channels/${encodeURIComponent(channelId)}/bans`);
  return Array.isArray(res?.items) ? res.items : [];
}
