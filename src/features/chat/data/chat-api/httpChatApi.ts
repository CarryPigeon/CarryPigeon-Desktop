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
  ChatMentionPageWire,
  ChatMentionWire,
  ChatChannelReadStateWire,
  ChatMessagePageWire,
  ChatMessageSearchQueryWire,
  ChatMessageWire,
  ChatPinListWire,
  ChatReadStateResponseWire,
  ChatReadStateWire,
  ChatSendMessageWire,
  ChatUnreadStateWire,
} from "../protocol/chatWireModels";

type ChannelPageWire<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
};

async function listChannelPages<T>(
  client: ReturnType<typeof createAuthedHttpJsonClient>,
  path: string,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page += 1) {
    const result = await client.requestJson<ChannelPageWire<T>>("GET", `${path}?page=${page}&page_size=50`);
    if (!Array.isArray(result?.items)) throw new Error("Invalid channel page response");
    items.push(...result.items);
    if (!result.has_more) return items;
    if (result.page !== page || result.items.length === 0) throw new Error("Invalid channel page continuation");
  }
}

type ApiUnreadsResponse = {
  total: number;
  items: ChatUnreadStateWire[];
};

type ApiApplyJoinRequest = {
  reason: string;
};

type ApiApplicationDecisionRequest = {
  decision: "approve" | "reject";
};

type ApiPutBanRequest = {
  until: number;
  reason: string;
};

export async function httpListChannels(serverSocket: string, accessToken: string): Promise<ChatChannelWire[]> {
  return listChannelPages(createAuthedHttpJsonClient(serverSocket, accessToken), "/channels");
}

export async function httpBatchGetChannels(serverSocket: string, accessToken: string, cids: readonly string[]) {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  return client.requestJson<{ total: number; items: ChatChannelWire[] }>("POST", "/channels/list", cids);
}

export async function httpTransferChannel(serverSocket: string, accessToken: string, cid: string, newOwner: string): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  await client.requestJson<null>("PUT", `/channels/${encodeURIComponent(cid.trim())}/transfer`, { new_owner: newOwner.trim() });
}

export async function httpQuitChannel(serverSocket: string, accessToken: string, cid: string): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  await client.requestJson<null>("POST", `/channels/${encodeURIComponent(cid.trim())}/quit`);
}

export async function httpListMyChannelApplications(serverSocket: string, accessToken: string): Promise<ChatChannelApplicationWire[]> {
  return listChannelPages(createAuthedHttpJsonClient(serverSocket, accessToken), "/channels/applications");
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
  limit: number = 20,
): Promise<ChatMessagePageWire> {
  return httpMessagePage(serverSocket, accessToken, cid, cursor ? "before" : "", cursor, limit);
}

export function httpListChannelMessagesAfter(
  serverSocket: string, accessToken: string, cid: string, cursor: string, limit = 20,
): Promise<ChatMessagePageWire> {
  return httpMessagePage(serverSocket, accessToken, cid, "after", cursor, limit);
}

function httpMessagePage(
  serverSocket: string, accessToken: string, cid: string, direction: "" | "before" | "after",
  cursor: string | undefined, limit: number,
): Promise<ChatMessagePageWire> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  if (direction && !cursor) throw new Error("Missing cursor");
  const q: string[] = [];
  if (cursor) q.push(`cursor=${encodeURIComponent(cursor)}`);
  q.push(`limit=${Math.max(1, Math.trunc(limit))}`);
  const suffix = direction ? `/${direction}` : "";
  return client.requestJson<ChatMessagePageWire>("GET", `/channels/${encodeURIComponent(channelId)}/messages${suffix}?${q.join("&")}`);
}

export function httpGetMessage(serverSocket: string, accessToken: string, mid: string): Promise<ChatMessageWire> {
  const messageId = String(mid).trim();
  if (!messageId) throw new Error("Missing mid");
  return createAuthedHttpJsonClient(serverSocket, accessToken).requestJson<ChatMessageWire>(
    "GET", `/channels/messages/${encodeURIComponent(messageId)}`,
  );
}

export function httpGetMessagesByIds(
  serverSocket: string, accessToken: string, messageIds: string[],
): Promise<{ items: ChatMessageWire[]; total: number }> {
  return createAuthedHttpJsonClient(serverSocket, accessToken).requestJson("POST", "/channels/messages/ids", {
    message_ids: messageIds,
  });
}

export async function httpSendChannelMessage(
  serverSocket: string,
  accessToken: string,
  cid: string,
  req: ChatSendMessageWire,
): Promise<ChatMessageWire> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  return client.requestJson<ChatMessageWire>("POST", `/channels/${encodeURIComponent(channelId)}/messages`, req);
}

/** 撤回成功时 data 为 null，客户端使用消息 ID 更新本地时间线。 */
export async function httpRecallMessage(
  serverSocket: string,
  accessToken: string,
  cid: string,
  mid: string,
): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  const messageId = String(mid).trim();
  if (!channelId) throw new Error("Missing cid");
  if (!messageId) throw new Error("Missing mid");
  await client.requestJson<null>(
    "POST",
    `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}/recall`,
  );
}

export async function httpGetChannelReadState(serverSocket: string, accessToken: string, cid: string): Promise<ChatChannelReadStateWire> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  return client.requestJson<ChatChannelReadStateWire>("GET", `/channels/${encodeURIComponent(channelId)}/read_state`);
}

export async function httpUpdateReadState(
  serverSocket: string,
  accessToken: string,
  cid: string,
  req: ChatReadStateWire,
): Promise<ChatReadStateResponseWire> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  return client.requestJson<ChatReadStateResponseWire>("PUT", `/channels/${encodeURIComponent(channelId)}/read_state`, req);
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
  // 更新成功的 data 为 null；治理层仍需要频道详情。
  const next = await client.requestJson<ChatChannelWire | null>(
    "PATCH",
    `/channels/${encodeURIComponent(channelId)}`,
    { name: patch.name, brief: patch.brief },
  );
  if (next && typeof next === "object" && String(next.cid ?? "").trim()) {
    return next;
  }
  return httpGetChannel(serverSocket, accessToken, channelId);
}

export async function httpApplyJoinChannel(
  serverSocket: string,
  accessToken: string,
  cid: string,
  reason: string,
): Promise<ChatChannelApplicationWire> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const body: ApiApplyJoinRequest = { reason: String(reason ?? "") };
  return client.requestJson<ChatChannelApplicationWire>("POST", `/channels/${encodeURIComponent(channelId)}/applications`, body);
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
  return listChannelPages(client, `/channels/${encodeURIComponent(channelId)}/members`);
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
  return listChannelPages(client, `/channels/${encodeURIComponent(channelId)}/applications`);
}

export async function httpDecideChannelApplication(
  serverSocket: string,
  accessToken: string,
  cid: string,
  applicationId: string,
  decision: ApiApplicationDecisionRequest["decision"],
): Promise<ChatChannelApplicationWire> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  const aid = String(applicationId).trim();
  if (!channelId) throw new Error("Missing cid");
  if (!aid) throw new Error("Missing application_id");
  return client.requestJson<ChatChannelApplicationWire>(
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
): Promise<ChatChannelBanWire> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  const userId = String(uid).trim();
  if (!channelId) throw new Error("Missing cid");
  if (!userId) throw new Error("Missing uid");
  const until = Number.isFinite(untilMs) ? Math.trunc(untilMs) : 0;
  const body: ApiPutBanRequest = { until, reason: String(reason ?? "") };
  return client.requestJson<ChatChannelBanWire>("PUT", `/channels/${encodeURIComponent(channelId)}/bans/${encodeURIComponent(userId)}`, body);
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
  return listChannelPages(client, `/channels/${encodeURIComponent(channelId)}/bans`);
}

export async function httpGetChannel(serverSocket: string, accessToken: string, cid: string): Promise<ChatChannelWire> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  return client.requestJson<ChatChannelWire>("GET", `/channels/${encodeURIComponent(channelId)}`);
}

export async function httpListChannelMessagesAround(
  serverSocket: string,
  accessToken: string,
  cid: string,
  aroundMid: string,
  before = 25,
  after = 25,
): Promise<{ items: ChatMessageWire[] }> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const anchor = aroundMid.trim();
  if (!anchor) throw new Error("Missing anchor_mid");
  const count = (value: number) => Math.max(0, Math.min(50, Math.trunc(value) || 0));
  const path = `/channels/${encodeURIComponent(channelId)}/messages/around?anchor_mid=${encodeURIComponent(anchor)}&before=${count(before)}&after=${count(after)}`;
  return client.requestJson("GET", path);
}

export async function httpSearchChannelMessages(
  serverSocket: string,
  accessToken: string,
  cid: string,
  query: ChatMessageSearchQueryWire,
): Promise<ChatMessagePageWire> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const q: string[] = [];
  q.push(`q=${encodeURIComponent(query.q)}`);
  if (query.cursor) q.push(`cursor=${encodeURIComponent(query.cursor)}`);
  if (query.limit != null) q.push(`limit=${encodeURIComponent(String(Math.max(1, Math.min(50, Math.trunc(query.limit)))))}`);
  if (query.sender_uid) q.push(`sender_uid=${encodeURIComponent(query.sender_uid)}`);
  if (query.domain) q.push(`domain=${encodeURIComponent(query.domain)}`);
  const path = `/channels/${encodeURIComponent(channelId)}/messages/search?${q.join("&")}`;
  return client.requestJson<ChatMessagePageWire>("GET", path);
}

export async function httpPinMessage(serverSocket: string, accessToken: string, cid: string, mid: string, note?: string): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  const messageId = String(mid).trim();
  if (!channelId) throw new Error("Missing cid");
  if (!messageId) throw new Error("Missing mid");
  await client.requestJson<void>("POST", `/channels/${encodeURIComponent(channelId)}/pins/${encodeURIComponent(messageId)}`, note ? { note } : undefined);
}

export async function httpUnpinMessage(serverSocket: string, accessToken: string, cid: string, mid: string): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  const messageId = String(mid).trim();
  if (!channelId) throw new Error("Missing cid");
  if (!messageId) throw new Error("Missing mid");
  await client.requestJson<void>("DELETE", `/channels/${encodeURIComponent(channelId)}/pins/${encodeURIComponent(messageId)}`);
}

export async function httpListPins(serverSocket: string, accessToken: string, cid: string, cursor?: string, limit?: number): Promise<ChatPinListWire> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const channelId = String(cid).trim();
  if (!channelId) throw new Error("Missing cid");
  const q: string[] = [];
  if (cursor) q.push(`cursor=${encodeURIComponent(cursor)}`);
  if (limit != null) q.push(`limit=${encodeURIComponent(String(Math.max(1, Math.min(50, Math.trunc(limit)))))}`);
  const path = `/channels/${encodeURIComponent(channelId)}/pins${q.length ? `?${q.join("&")}` : ""}`;
  return client.requestJson<ChatPinListWire>("GET", path);
}

export async function httpListMentions(serverSocket: string, accessToken: string, cursor?: string, limit?: number, unreadOnly?: boolean, cid?: string): Promise<ChatMentionPageWire> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const q: string[] = [];
  if (cursor) q.push(`cursor=${encodeURIComponent(cursor)}`);
  if (limit != null) q.push(`limit=${encodeURIComponent(String(Math.max(1, Math.min(50, Math.trunc(limit)))))}`);
  if (unreadOnly) q.push(`unread_only=true`);
  const scopePath = cid ? `/channels/${encodeURIComponent(cid)}/mentions` : "/mentions";
  const path = `${scopePath}${q.length ? `?${q.join("&")}` : ""}`;
  return client.requestJson<ChatMentionPageWire>("GET", path);
}

export async function httpGetMention(serverSocket: string, accessToken: string, mentionId: string): Promise<ChatMentionWire> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  return client.requestJson<ChatMentionWire>("GET", `/mentions/${encodeURIComponent(mentionId)}`);
}

export async function httpGetMentionsByIds(serverSocket: string, accessToken: string, mentionIds: string[]): Promise<ChatMentionWire[]> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const result = await client.requestJson<{ items: ChatMentionWire[] }>("POST", "/mentions/ids", { mention_ids: mentionIds });
  return result.items;
}

export async function httpMarkMentionRead(
  serverSocket: string,
  accessToken: string,
  mentionId: string,
): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const id = String(mentionId).trim();
  if (!id) throw new Error("Missing mention_id");
  await client.requestJson<void>("PUT", `/mentions/${encodeURIComponent(id)}/read`);
}

export async function httpBatchMarkMentionsRead(serverSocket: string, accessToken: string, throughMentionId?: string, cid?: string): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const path = cid ? `/channels/${encodeURIComponent(cid)}/mentions/read` : "/mentions/read";
  const body = throughMentionId === undefined ? undefined : { through_mention_id: throughMentionId };
  await client.requestJson<void>("PUT", path, body);
}
