/**
 * @fileoverview httpChatApi.ts
 * @description chat｜数据层实现：httpChatApi。
 *
 * 接口文档参考：
 * - 参见 `docs/api/*`（聊天资源端点、错误模型）。
 */

import { createAuthedHttpJsonClient } from "@/shared/net/http/authedHttpJsonClient";
import type {
  ChatChannelApplicationWire,
  ChatChannelBanWire,
  ChatChannelMemberWire,
  ChatChannelWire,
  ChatMessagePageWire,
  ChatMessageWire,
  ChatReadStateWire,
  ChatSendMessageWire,
  ChatUnreadStateWire,
} from "../protocol/chatWireModels";

type ApiListChannelsResponse = {
  channels: ChatChannelWire[];
};

type ApiUnreadsResponse = {
  items: ChatUnreadStateWire[];
};

type ApiApplyJoinRequest = {
  reason: string;
};

type ApiListMembersResponse = {
  items: ChatChannelMemberWire[];
};

type ApiListApplicationsResponse = {
  items: ChatChannelApplicationWire[];
};

type ApiApplicationDecisionRequest = {
  decision: "approve" | "reject";
};

type ApiPutBanRequest = {
  until: number;
  reason: string;
};

type ApiListBansResponse = {
  items: ChatChannelBanWire[];
};

export async function httpListChannels(serverSocket: string, accessToken: string): Promise<ChatChannelWire[]> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const res = await client.requestJson<ApiListChannelsResponse>("GET", "/channels");
  return Array.isArray(res?.channels) ? res.channels : [];
}

export async function httpGetUnreads(
  serverSocket: string,
  accessToken: string,
): Promise<ChatUnreadStateWire[]> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const res = await client.requestJson<ApiUnreadsResponse>("GET", "/unreads");
  return Array.isArray(res?.items) ? res.items : [];
}

export async function httpListChannelMessages(
  serverSocket: string,
  accessToken: string,
  cid: string,
  cursor?: string,
  limit: number = 50,
): Promise<ChatMessagePageWire> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const q: string[] = [];
  if (cursor) q.push(`cursor=${encodeURIComponent(cursor)}`);
  q.push(`limit=${encodeURIComponent(String(Math.max(1, Math.trunc(limit))))}`);
  const path = `/channels/${encodeURIComponent(channelId)}/messages?${q.join("&")}`;
  return client.requestJson<ChatMessagePageWire>("GET", path);
}

export async function httpSendChannelMessage(
  serverSocket: string,
  accessToken: string,
  cid: string,
  req: ChatSendMessageWire,
  idempotencyKey?: string,
): Promise<ChatMessageWire> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const path = `/channels/${encodeURIComponent(channelId)}/messages`;
  const key = String(idempotencyKey ?? "").trim();
  const headers = key ? { "Idempotency-Key": key } : undefined;
  return client.requestJsonWithHeaders<ChatMessageWire>("POST", path, req, headers);
}

export async function httpDeleteMessage(serverSocket: string, accessToken: string, mid: string): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const messageId = String(mid).trim();
  if (!messageId) throw new Error("Missing mid");
  await client.requestJson<void>("DELETE", `/messages/${encodeURIComponent(messageId)}`);
}

export async function httpUpdateReadState(
  serverSocket: string,
  accessToken: string,
  cid: string,
  req: ChatReadStateWire,
): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  await client.requestJson<void>("PUT", `/channels/${encodeURIComponent(channelId)}/read_state`, req);
}

export async function httpPatchChannel(
  serverSocket: string,
  accessToken: string,
  cid: string,
  patch: Partial<Pick<ChatChannelWire, "name" | "brief" | "avatar">>,
): Promise<ChatChannelWire> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  return client.requestJson<ChatChannelWire>("PATCH", `/channels/${encodeURIComponent(channelId)}`, patch);
}

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

export async function httpCreateChannel(
  serverSocket: string,
  accessToken: string,
  req: Pick<ChatChannelWire, "name"> & Partial<Pick<ChatChannelWire, "brief" | "avatar">>,
): Promise<ChatChannelWire> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const name = String(req?.name ?? "").trim();
  if (!name) throw new Error("Missing channel name");
  return client.requestJson<ChatChannelWire>("POST", "/channels", {
    name,
    brief: String(req?.brief ?? ""),
    avatar: String(req?.avatar ?? ""),
  });
}

export async function httpDeleteChannel(serverSocket: string, accessToken: string, cid: string): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  await client.requestJson<void>("DELETE", `/channels/${encodeURIComponent(channelId)}`);
}

export async function httpListChannelMembers(
  serverSocket: string,
  accessToken: string,
  cid: string,
): Promise<ChatChannelMemberWire[]> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const res = await client.requestJson<ApiListMembersResponse>("GET", `/channels/${encodeURIComponent(channelId)}/members`);
  return Array.isArray(res?.items) ? res.items : [];
}

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

export async function httpListChannelApplications(
  serverSocket: string,
  accessToken: string,
  cid: string,
): Promise<ChatChannelApplicationWire[]> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const res = await client.requestJson<ApiListApplicationsResponse>("GET", `/channels/${encodeURIComponent(channelId)}/applications`);
  return Array.isArray(res?.items) ? res.items : [];
}

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

export async function httpListChannelBans(
  serverSocket: string,
  accessToken: string,
  cid: string,
): Promise<ChatChannelBanWire[]> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const res = await client.requestJson<ApiListBansResponse>("GET", `/channels/${encodeURIComponent(channelId)}/bans`);
  return Array.isArray(res?.items) ? res.items : [];
}
