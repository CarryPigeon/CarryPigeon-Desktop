/**
 * @fileoverview protocolMockTransport.ts
 * @description Mock 支撑：protocolMockTransport（用于本地预览/测试）。
 *
 * 该模块模拟 CarryPigeon 的一小部分 HTTP + WS 协议，使应用在没有真实后端时也能运行 live stores。
 *
 * 覆盖范围（按当前 UI 流程最小集）：
 * - HTTP `/api/*`：auth/server/chat/users/plugins/files/gates 等页面依赖的端点。
 * - Chat WS 事件流：best-effort 地发出 `message.created/deleted/read_state.updated` 等事件。
 */

import type { ApiErrorEnvelope } from "@/shared/net/http/apiErrors";
import { MOCK_DISABLE_REQUIRED_GATE } from "@/shared/config/runtime";
import { MOCK_PLUGIN_CATALOG } from "@/shared/mock/mockPluginCatalog";
import {
  buildMockAiSummarizeResponse,
  buildMockGroupNotices,
  type MockAiSummarizeRequest,
} from "@/shared/mock/mockAiSummary";
import { normalizeServerKey } from "@/shared/serverKey";

/**
 * Mock API 请求结构（供 protocol mock 路由器使用）。
 */
export type MockApiRequest = {
  serverSocket: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
};

/**
 * Mock API 返回结构（ok 或 error envelope）。
 */
export type MockApiResult =
  | { ok: true; status: number; body: unknown }
  | { ok: false; error: ApiErrorEnvelope };

/**
 * WS 事件封包（与服务端 wire contract 形态对齐的最小子集）。
 */
export type ProtocolWsEventEnvelope = {
  type: "event";
  id: null;
  error: null;
  data: {
    event_id: string;
    event_type: string;
    server_time: number;
    payload: unknown;
  };
};

/**
 * Mock WS client 句柄（用于关闭连接与刷新 token）。
 */
export type ProtocolWsClient = {
  close(): void;
  reauth(nextAccessToken: string): void;
};

type TokenSession = {
  uid: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAtMs: number;
};

type MockUserProfile = {
  uid: string;
  email: string;
  nickname: string;
  avatar: string;
  bio: string;
  backgroundUrl: string;
  password?: string;
  sex?: number;
  birthday?: number;
};

type Channel = {
  cid: string;
  name: string;
  brief: string;
  avatar?: string;
  owner_uid: string;
  system_channel?: boolean;
  created_at?: number;
};

function channelSummary(channel: Channel) {
  const { cid, name, brief, system_channel = false, created_at = 0 } = channel;
  return { cid, name, brief, system_channel, created_at };
}

function channelOk(data: unknown): MockApiResult {
  return { ok: true, status: 200, body: { code: 0, message: "OK", data } };
}

function channelPage<T>(items: T[], params: URLSearchParams): MockApiResult {
  const page = Math.max(1, Math.trunc(Number(params.get("page")) || 1));
  const page_size = Math.min(50, Math.max(1, Math.trunc(Number(params.get("page_size")) || 20)));
  const start = (page - 1) * page_size;
  return channelOk({ items: items.slice(start, start + page_size), page, page_size, total: items.length, has_more: start + page_size < items.length });
}

type ChannelMember = {
  uid: string;
  role: "owner" | "admin" | "member" | string;
  nickname: string;
  avatar?: string;
  join_time: number;
};

type ChannelApplication = {
  application_id: string;
  cid: string;
  uid: string;
  reason: string;
  apply_time: number;
  status: "pending" | "accepted" | "rejected";
};

type ChannelBan = {
  cid: string;
  uid: string;
  until: number;
  reason: string;
  create_time: number;
};

type ChatMessage = {
  mid: string;
  cid: string;
  uid: string;
  sender?: { uid: string; nickname: string; avatar?: string };
  send_time: number;
  domain: string;
  domain_version?: string;
  data: unknown;
  preview?: string;
  reply_to_mid?: string;
  status?: "recalled";
  mentions?: string[];
};

type MockMention = {
  mention_id: string;
  cid: string;
  mid: string;
  from_uid: string;
  target: { type: "user"; uid: string };
  created_at: number;
  read: boolean;
};

type WsListener = {
  token: string;
  onEvent: (env: ProtocolWsEventEnvelope) => void;
};

type ServerState = {
  serverSocket: string;
  serverId: string;
  sessionsByAccess: Map<string, TokenSession>;
  sessionsByRefresh: Map<string, TokenSession>;
  usersById: Map<string, MockUserProfile>;
  wsListeners: Set<WsListener>;
  eventSeq: number;
  channelsById: Map<string, Channel>;
  membersByCid: Map<string, ChannelMember[]>;
  messagesByCid: Map<string, ChatMessage[]>;
  pinsByCid: Map<string, Array<unknown>>;
  readStateByCidUid: Map<string, string>;
  mentionsById: Map<string, MockMention>;
  mentionSeq: number;
  applicationsByCid: Map<string, ChannelApplication[]>;
  bansByCid: Map<string, ChannelBan[]>;
  filesByShareKey: Map<string, { file_id: string; filename: string; mime_type: string; size_bytes: number; sha256?: string; uploaded?: boolean }>;
};

const servers = new Map<string, ServerState>();

/**
 * 基于 socket 字符串生成确定性的 mock `server_id`。
 *
 * @param input - 服务器 Socket 地址。
 * @returns 确定性的短 id。
 */
function hashToId(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = (h >>> 0).toString(16).padStart(8, "0");
  return `mock-${n}`;
}

/**
 * 从静态 mock catalog 中提取 required 插件 id 列表。
 *
 * @returns required 插件 id 列表。
 */
function listRequiredPluginIds(): string[] {
  if (MOCK_DISABLE_REQUIRED_GATE) return [];
  return MOCK_PLUGIN_CATALOG.filter((p) => p.required).map((p) => p.pluginId);
}

/**
 * 构造标准 API 错误封包（ApiErrorEnvelope）。
 *
 * @param status - HTTP status.
 * @param reason - 机器可读的错误原因字符串。
 * @param message - 面向用户的错误信息字符串。
 * @param details - 额外详情对象（可选）。
 * @returns `ApiErrorEnvelope`。
 */
function apiError(status: number, reason: string, message: string, details?: Record<string, unknown>): ApiErrorEnvelope {
  return {
    error: {
      status,
      reason,
      message,
      details: details ?? {},
    },
  };
}

/**
 * 从请求头中解析 Bearer token。
 *
 * @param headers - 请求头映射表。
 * @returns token 字符串；缺失时返回空字符串。
 */
function readBearer(headers: Record<string, string>): string {
  const raw = String(headers.Authorization ?? headers.authorization ?? "").trim();
  const prefix = "Bearer ";
  if (!raw.startsWith(prefix)) return "";
  return raw.slice(prefix.length).trim();
}

/**
 * 将 path 字符串解析为 pathname + query 参数集合。
 *
 * @param path - path 字符串（可能包含 query）。
 * @returns 解析结果。
 */
function parsePath(path: string): { pathname: string; searchParams: URLSearchParams } {
  const p = String(path ?? "").trim() || "/";
  const u = new URL(`http://mock.local${p.startsWith("/") ? p : `/${p}`}`);
  return { pathname: u.pathname, searchParams: u.searchParams };
}

/**
 * 获取或创建 server state 容器（按 serverSocket 作用域隔离）。
 *
 * @param serverSocket - 服务器 Socket 地址（作为 key）。
 * @returns `ServerState`。
 */
function getServer(serverSocket: string): ServerState {
  const key = normalizeServerKey(serverSocket);
  const existing = servers.get(key);
  if (existing) return existing;

  const now = Date.now();
  const s: ServerState = {
    serverSocket: key,
    serverId: hashToId(key),
    sessionsByAccess: new Map(),
    sessionsByRefresh: new Map(),
    usersById: new Map(),
    wsListeners: new Set(),
    eventSeq: 0,
    channelsById: new Map(),
    membersByCid: new Map(),
    messagesByCid: new Map(),
    pinsByCid: new Map(),
    readStateByCidUid: new Map(),
    mentionsById: new Map(),
    mentionSeq: 4000,
    applicationsByCid: new Map(),
    bansByCid: new Map(),
    filesByShareKey: new Map(),
  };

  const seedChannels: Channel[] = [
    { cid: "cid-ann", name: "Announcements", brief: "Patch notes and release signals.", owner_uid: "1" },
    { cid: "cid-prod", name: "General", brief: "Default channel for day-to-day chat.", owner_uid: "1" },
    { cid: "cid-tech", name: "Troubleshooting", brief: "Connectivity + diagnostics.", owner_uid: "1" },
    { cid: "cid-lab", name: "Lab", brief: "Experiments and extensions.", owner_uid: "1" },
  ];

  const seedMembers: ChannelMember[] = [
    { uid: "1", nickname: "Operator", role: "owner", join_time: now - 1000 * 60 * 60 * 24 },
    { uid: "2", nickname: "Relay", role: "admin", join_time: now - 1000 * 60 * 60 * 24 },
    { uid: "3", nickname: "PatchCable", role: "member", join_time: now - 1000 * 60 * 60 * 12 },
    { uid: "4", nickname: "Guest", role: "member", join_time: now - 1000 * 60 * 10 },
  ];

  for (const member of seedMembers) {
    s.usersById.set(member.uid, {
      uid: member.uid,
      email: member.uid === "1" ? "user@example.com" : `user${member.uid}@example.com`,
      nickname: member.nickname,
      avatar: member.avatar ?? "",
      bio: member.uid === "1" ? "Protocol mock operator profile." : `Mock profile for ${member.nickname}.`,
      backgroundUrl: "",
    });
  }

  for (const c of seedChannels) {
    s.channelsById.set(c.cid, c);
    s.membersByCid.set(c.cid, seedMembers.map((m) => ({ ...m })));
    s.messagesByCid.set(c.cid, []);
    s.applicationsByCid.set(c.cid, []);
    s.bansByCid.set(c.cid, []);
  }

  s.messagesByCid.set("cid-ann", [
    {
      mid: "3001",
      cid: "cid-ann",
      uid: "1",
      sender: { uid: "1", nickname: "Operator" },
      send_time: now - 1000 * 60 * 30,
      domain: "Core:Text:V1",
      domain_version: "1.0.0",
      mentions: [],
      data: { content: "Welcome to Patchbay. This is the baseline text domain." },
      preview: "Welcome to Patchbay. This is the baseline text domain.",
    },
  ]);
  s.messagesByCid.set("cid-prod", [
    {
      mid: "3002",
      cid: "cid-prod",
      uid: "2",
      sender: { uid: "2", nickname: "Relay" },
      send_time: now - 1000 * 60 * 18,
      domain: "Core:Text:V1",
      domain_version: "1.0.0",
      mentions: ["1"],
      data: { content: "P0 checklist: required gate, unknown domain downgrade, hard delete disappears, weak disconnect hints." },
      preview: "P0 checklist: required gate, unknown domain downgrade, hard delete disappears, weak disconnect hints.",
    },
  ]);

  const seedMentionMessage = s.messagesByCid.get("cid-prod")?.[0];
  if (seedMentionMessage) addMockMentions(s, seedMentionMessage, ["1"], false);
  servers.set(key, s);
  return s;
}

/**
 * 生成 protocol-mock 文件下载 URL（data URL，避免访问真实网络）。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @param shareKey - 文件 share key。
 * @returns 可直接用于 <img src> / window.open 的 data URL。
 */
export function buildProtocolMockDownloadUrl(serverSocket: string, shareKey: string): string {
  const key = String(shareKey ?? "").trim();
  if (!key) return "";
  const server = getServer(serverSocket);
  const file = server.filesByShareKey.get(key) ?? null;
  const filename = String(file?.filename ?? key).trim() || key;
  const mimeType = String(file?.mime_type ?? "").trim().toLowerCase();

  if (mimeType.startsWith("image/")) {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">',
      '<rect width="480" height="270" fill="#0f172a"/>',
      '<rect x="24" y="24" width="432" height="222" rx="16" fill="#111827" stroke="#334155"/>',
      '<text x="40" y="96" fill="#cbd5e1" font-family="monospace" font-size="18">Mock Image</text>',
      `<text x="40" y="132" fill="#94a3b8" font-family="monospace" font-size="14">${filename}</text>`,
      `<text x="40" y="160" fill="#64748b" font-family="monospace" font-size="12">share_key=${key}</text>`,
      '</svg>',
    ].join("");
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  const body = `Mock file download\nfilename=${filename}\nshare_key=${key}`;
  return `data:text/plain;charset=utf-8,${encodeURIComponent(body)}`;
}

/**
 * 从请求头中解析并验证会话（Authorization: Bearer ...）。
 *
 * @param server - server state。
 * @param headers - 请求头。
 * @returns 会话；未登录/无效时返回 `null`。
 */
function requireSession(server: ServerState, headers: Record<string, string>): TokenSession | null {
  const token = readBearer(headers);
  if (!token) return null;
  return server.sessionsByAccess.get(token) ?? null;
}

/**
 * 向该 server 的所有 WS 监听者广播一条事件（mock 环境）。
 *
 * @param server - server state。
 * @param eventType - 事件类型字符串。
 * @param payload - 事件载荷。
 */
function mockBusinessFailure(code: number, message: string): MockApiResult {
  return { ok: true, status: 200, body: { code, message } };
}

function isPositiveMockId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]+$/.test(value) && /[1-9]/.test(value);
}

function isMockChannelMember(server: ServerState, cid: string, uid: string): boolean {
  return server.channelsById.has(cid) && Boolean(server.membersByCid.get(cid)?.some((member) => member.uid === uid));
}

function mockReadState(server: ServerState, cid: string, uid: string) {
  const last_read_mid = server.readStateByCidUid.get(`${cid}::${uid}`) ?? null;
  const unread = (server.messagesByCid.get(cid) ?? []).filter((message) =>
    message.uid !== uid && message.status !== "recalled" && (!last_read_mid || BigInt(message.mid) > BigInt(last_read_mid)));
  return { cid, uid, last_read_mid, unread_count: Math.min(10_000, unread.length) };
}

function addMockMentions(server: ServerState, message: ChatMessage, mentions: unknown, emit = true): void {
  if (!Array.isArray(mentions)) return;
  for (const uid of new Set(mentions)) {
    if (typeof uid !== "string" || !isMockChannelMember(server, message.cid, uid)) continue;
    const row: MockMention = {
      mention_id: String(++server.mentionSeq),
      cid: message.cid,
      mid: message.mid,
      from_uid: message.uid,
      target: { type: "user", uid },
      created_at: message.send_time,
      read: false,
    };
    server.mentionsById.set(row.mention_id, row);
    if (emit) emitWs(server, "mention.created", {
      mention_id: row.mention_id, cid: row.cid, mid: row.mid, from_uid: row.from_uid, uid, created_at: row.created_at,
    }, uid);
  }
}

function visibleMockMentions(server: ServerState, uid: string, cid?: string): MockMention[] {
  return [...server.mentionsById.values()].filter((row) =>
    row.target.uid === uid && (!cid || row.cid === cid) && isMockChannelMember(server, row.cid, uid) &&
    Boolean(server.messagesByCid.get(row.cid)?.some((message) => message.mid === row.mid && message.status !== "recalled")));
}

function emitWs(server: ServerState, eventType: string, payload: unknown, recipientUid?: string): void {
  server.eventSeq += 1;
  const env: ProtocolWsEventEnvelope = {
    type: "event",
    id: null,
    error: null,
    data: {
      event_id: String(BigInt(Date.now()) * 1_000_000n + BigInt(server.eventSeq)),
      event_type: eventType,
      server_time: Date.now(),
      payload,
    },
  };
  const messageChannel = eventType.startsWith("message.")
    ? (payload as { channel_id?: string } | null)?.channel_id
    : undefined;
  for (const l of server.wsListeners) {
    const session = server.sessionsByAccess.get(l.token);
    if (!session || session.expiresAtMs < Date.now() || (recipientUid && session.uid !== recipientUid)) continue;
    if (messageChannel && !isMockChannelMember(server, messageChannel, session.uid)) continue;
    try {
      l.onEvent(env);
    } catch {
      // 忽略监听者异常：mock 不应导致宿主 UI 崩溃。
    }
  }
}

/**
 * 连接 protocol-mock 的聊天 WS 客户端。
 *
 * @param serverSocket - 服务器 Socket 地址。
 * @param accessToken - 访问令牌（Bearer token 的内容）。
 * @param onEvent - 事件回调。
 * @param options - 可选错误回调。
 * @returns WS 客户端句柄。
 */
export function connectProtocolMockChatWs(
  serverSocket: string,
  accessToken: string,
  onEvent: (env: ProtocolWsEventEnvelope) => void,
  options?: { onAuthError?: (reason: string) => void },
): ProtocolWsClient {
  const server = getServer(serverSocket);
  const token = accessToken.trim();
  const ok = Boolean(server.sessionsByAccess.get(token));
  if (!ok) options?.onAuthError?.("unauthorized");

  const listener: WsListener = { token, onEvent };
  server.wsListeners.add(listener);

  return {
    close(): void {
      server.wsListeners.delete(listener);
    },
    reauth(nextAccessToken: string): void {
      listener.token = nextAccessToken.trim();
    },
  };
}

/**
 * 处理 protocol-mock 的 `/api/*` 请求（用于 `HttpJsonClient` 的 mock transport）。
 *
 * @param req - 来自 `HttpJsonClient` 的请求载荷。
 * @returns mock API 响应。
 */
export async function handleProtocolMockApiRequest(req: MockApiRequest): Promise<MockApiResult> {
  const server = getServer(req.serverSocket);
  const method = String(req.method ?? "GET").trim().toUpperCase();
  const { pathname, searchParams } = parsePath(req.path);
  const pathnameParts = pathname.split("/").filter(Boolean);

  // -------------------------------------------------------------------------
  // Server info (public)
  // -------------------------------------------------------------------------
  if (method === "GET" && pathname === "/server") {
    const required_plugins = listRequiredPluginIds();
    return {
      ok: true,
      status: 200,
      body: {
        code: 0,
        message: "OK",
        data: {
          server_id: server.serverId,
          name: server.serverSocket.startsWith("mock://") ? "Mock Rack" : "CarryPigeon Server",
          brief: "Protocol-mock server for local UI preview (no backend required).",
          avatar: "",
          api_version: "1",
          min_supported_api_version: "1",
          ws_url: "ws://mock.local/api/ws",
          required_plugins,
          capabilities: { protocol_mock: true },
          server_time: Date.now(),
        },
      },
    };
  }

  // -------------------------------------------------------------------------
  // Plugins catalog (public)
  // -------------------------------------------------------------------------
  if (method === "GET" && pathname === "/plugins/catalog") {
    const required_plugins = listRequiredPluginIds();
    return {
      ok: true,
      status: 200,
      body: {
        required_plugins,
        plugins: MOCK_PLUGIN_CATALOG.map((p) => ({
          plugin_id: p.pluginId,
          name: p.name,
          version: p.versions[0] ?? "0.0.0",
          required: !MOCK_DISABLE_REQUIRED_GATE && p.required,
          permissions: (p.permissions ?? []).map((x) => x.key),
          provides_domains: (p.providesDomains ?? []).map((d) => ({ domain: d.id, domain_version: d.version })),
          download: p.downloadUrl ? { url: p.downloadUrl, sha256: p.sha256 } : { sha256: p.sha256 },
        })),
      },
    };
  }

  // -------------------------------------------------------------------------
  // Domains catalog (public)
  // -------------------------------------------------------------------------
  if (method === "GET" && pathname === "/domains/catalog") {
    const items = [
      {
        domain: "Core:Text",
        supported_versions: ["1.0.0"],
        recommended_version: "1.0.0",
        constraints: { max_payload_bytes: 16384, max_depth: 6 },
        providers: [{ type: "core" }],
      },
      ...MOCK_PLUGIN_CATALOG.flatMap((p) =>
        (p.providesDomains ?? []).map((d) => ({
          domain: d.id,
          supported_versions: [d.version],
          recommended_version: d.version,
          constraints: { max_payload_bytes: 16384, max_depth: 6 },
          providers: [{ type: "plugin", plugin_id: p.pluginId, min_plugin_version: p.versions[p.versions.length - 1] ?? "0.0.0" }],
        })),
      ),
    ];
    return { ok: true, status: 200, body: { items } };
  }

  // -------------------------------------------------------------------------
  // AI summarize（mock 确定性 extractive 摘要端点，供 ai-summary 插件消费）
  // -------------------------------------------------------------------------
  if (method === "POST" && pathname === "/ai/summarize") {
    const result = buildMockAiSummarizeResponse(req.body as MockAiSummarizeRequest | null);
    return { ok: true, status: 200, body: result };
  }

  // -------------------------------------------------------------------------
  // Group notices（mock 群通知列表端点，供 group-notice 插件消费）
  // -------------------------------------------------------------------------
  if (method === "GET" && pathname === "/group/notices") {
    const channelId = searchParams.get("channel_id") ?? searchParams.get("channel") ?? "";
    return { ok: true, status: 200, body: { notices: buildMockGroupNotices(channelId) } };
  }

  // -------------------------------------------------------------------------
  // Required gate precheck (public)
  // -------------------------------------------------------------------------
  if (method === "POST" && pathname === "/gates/required/check") {
    const required = new Set(listRequiredPluginIds());
    const installed = new Set<string>();
    const client = (req.body as { client?: { installed_plugins?: Array<{ plugin_id?: string }> } } | null)?.client ?? null;
    for (const p of client?.installed_plugins ?? []) {
      const id = String(p?.plugin_id ?? "").trim();
      if (id) installed.add(id);
    }
    const missing = Array.from(required).filter((id) => !installed.has(id));
    return { ok: true, status: 200, body: { missing_plugins: missing } };
  }

  // -------------------------------------------------------------------------
  // Auth (public)
  // -------------------------------------------------------------------------
  const accountOk = (data: unknown): MockApiResult => ({ ok: true, status: 200, body: { code: 0, message: "OK", data } });
  const accountError = (code: number, message: string): MockApiResult => ({ ok: true, status: 200, body: { code, message } });
  const issueAccountTokens = (uid: string, email: string): MockApiResult => {
    const nonce = `${Date.now().toString(16)}:${Math.random().toString(16).slice(2)}`;
    const session: TokenSession = {
      uid,
      email,
      accessToken: `pmock-access:${uid}:${nonce}`,
      refreshToken: `pmock-refresh:${uid}:${nonce}`,
      expiresAtMs: Date.now() + 1800 * 1000,
    };
    server.sessionsByAccess.set(session.accessToken, session);
    server.sessionsByRefresh.set(session.refreshToken, session);
    return accountOk({ token_type: "Bearer", access_token: session.accessToken, expires_in: 1800, refresh_token: session.refreshToken, uid });
  };

  if (method === "POST" && pathname === "/auth/email_codes") {
    const body = req.body as { email?: string; purpose?: string } | null;
    if (!body?.email?.trim() || !["REGISTER", "LOGIN", "CHANGE_EMAIL", "password_change"].includes(body.purpose ?? "")) {
      return accountError(10001, "Missing email or invalid verification purpose");
    }
    return accountOk(null);
  }

  if (method === "POST" && pathname === "/auth/register") {
    const body = req.body as { username?: string; password?: string; email?: string; code?: string } | null;
    const username = String(body?.username ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!username || !body?.password || !email || !body.code?.trim()) {
      return accountError(10001, "Missing registration fields");
    }
    const users = [...server.usersById.values()];
    if (users.some((user) => user.nickname === username)) return accountError(11010, "Username already exists");
    if (users.some((user) => user.email === email)) return accountError(11011, "Email already exists");
    const uid = String(1000 + server.usersById.size);
    server.usersById.set(uid, {
      uid,
      email,
      nickname: username,
      password: body.password,
      avatar: "",
      bio: "",
      backgroundUrl: "",
    });
    return accountOk({ uid, username });
  }

  if (method === "POST" && pathname === "/auth/login/pwd") {
    const body = req.body as { username?: string; password?: string } | null;
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");
    if (!username || !password) {
      return { ok: false, error: apiError(422, "validation_failed", "Missing username or password") };
    }
    const user = [...server.usersById.values()].find((item) => item.nickname === username);
    if (!user || (user.password !== undefined && user.password !== password)) {
      return accountError(11006, "Invalid username or password");
    }
    return issueAccountTokens(user.uid, user.email);
  }

  if (method === "POST" && pathname === "/auth/login/email") {
    const body = req.body as { email?: string; code?: string } | null;
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!email || !body?.code?.trim()) return accountError(10001, "Missing email or verification code");

    const user = [...server.usersById.values()].find((item) => item.email === email);
    if (!user) return accountError(11009, "Account does not exist");
    return issueAccountTokens(user.uid, user.email);
  }

  if (method === "POST" && pathname === "/auth/refresh") {
    const body = req.body as { refresh_token?: string } | null;
    const rt = String(body?.refresh_token ?? "").trim();
    const prev = server.sessionsByRefresh.get(rt) ?? null;
    if (!prev) return accountError(11004, "Invalid refresh token");
    server.sessionsByRefresh.delete(rt);
    return issueAccountTokens(prev.uid, server.usersById.get(prev.uid)?.email ?? prev.email);
  }

  if (method === "POST" && pathname === "/auth/revoke") {
    const body = req.body as { refresh_token?: string } | null;
    const rt = String(body?.refresh_token ?? "").trim();
    if (!server.sessionsByRefresh.delete(rt)) return accountError(11004, "Invalid refresh token");
    return accountOk(null);
  }

  // -------------------------------------------------------------------------
  // Users (auth)
  // -------------------------------------------------------------------------
  if (method === "GET" && pathname === "/users/me") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const user = server.usersById.get(session.uid);
    return accountOk({
      uid: session.uid,
      email: user?.email ?? session.email,
      username: user?.nickname ?? "Operator",
      avatar: user?.avatar || null,
      bio: user?.bio ?? "",
      sex: user?.sex ?? 0,
      birthday: user?.birthday ?? 0,
    });
  }

  if (method === "PUT" && pathname === "/auth/me/email") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const body = req.body as { email?: string; code?: string } | null;
    const email = String(body?.email ?? "").trim().toLowerCase();
    const code = String(body?.code ?? "").trim();
    if (!email) return { ok: false, error: apiError(400, "invalid_request", "Missing email") };
    if (!code) return { ok: false, error: apiError(400, "invalid_request", "Missing verification code") };
    session.email = email;
    const user = server.usersById.get(session.uid) ?? {
      uid: session.uid,
      email,
      nickname: "Operator",
      avatar: "",
      bio: "",
      backgroundUrl: "",
    };
    server.usersById.set(session.uid, { ...user, email });
    return accountOk(null);
  }

  if (method === "PUT" && pathname === "/auth/me/password") {
    const session = requireSession(server, req.headers);
    if (!session) return accountError(11001, "Missing access token");
    const body = req.body as { password?: string; code?: string } | null;
    if (!body?.password || !body.code?.trim()) return accountError(10001, "Missing password or verification code");
    const user = server.usersById.get(session.uid);
    if (!user) return accountError(11009, "Account does not exist");
    user.password = body.password;
    return accountOk(null);
  }

  if (method === "PATCH" && pathname === "/users/me") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const body = req.body as { avatar?: string; sex?: number; brief?: string; birthday?: number } | null;
    const user = server.usersById.get(session.uid) ?? {
      uid: session.uid,
      email: session.email,
      nickname: "Operator",
      avatar: "",
      bio: "",
      backgroundUrl: "",
    };
    server.usersById.set(session.uid, {
      ...user,
      avatar: body?.avatar ?? user.avatar,
      bio: body?.brief ?? user.bio,
      sex: body?.sex ?? user.sex,
      birthday: body?.birthday ?? user.birthday,
    });
    return accountOk(null);
  }

  const userDetailPath = /^\/users\/([^/]+)\/detail$/.exec(pathname);
  if (method === "GET" && userDetailPath) {
    if (!requireSession(server, req.headers)) return accountError(11001, "Missing access token");
    const uid = decodeURIComponent(userDetailPath[1] ?? "");
    const user = server.usersById.get(uid);
    if (!user) return accountError(11009, "Account does not exist");
    return accountOk({ uid, username: user.nickname, avatar: user.avatar || null, email: user.email,
      bio: user.bio, sex: user.sex ?? 0, birthday: user.birthday ?? 0 });
  }

  if (method === "GET" && pathname === "/users") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const csv = String(searchParams.get("ids") ?? "").trim();
    const ids = csv ? csv.split(",").map((x) => x.trim()).filter(Boolean) : [];
    const items = ids.flatMap((uid) => {
      const user = server.usersById.get(uid);
      return user ? [{ uid, username: user.nickname, avatar: user.avatar || null }] : [];
    });
    return accountOk({ items });
  }

  // -------------------------------------------------------------------------
  // Files (auth)
  // -------------------------------------------------------------------------
  if (method === "POST" && pathname === "/files/uploads") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };

    const body = req.body as { filename?: string; sha256?: string; size_bytes?: number } | null;
    const filename = String(body?.filename ?? "").trim();
    const sha256 = String(body?.sha256 ?? "").trim();
    const size_bytes = body?.size_bytes ?? -1;
    if (!filename || !/^[0-9a-f]{64}$/.test(sha256) || !Number.isSafeInteger(size_bytes) || size_bytes < 0) {
      return { ok: true, status: 200, body: { code: 10001, message: "Invalid upload request" } };
    }

    const same = [...server.filesByShareKey.values()].find((file) => file.uploaded && file.sha256 === sha256);
    const now = Date.now();
    const file_id = same?.file_id ?? String(now * 1000 + server.filesByShareKey.size);
    const share_key = `pmock-share-${file_id}-${server.filesByShareKey.size}`;
    server.filesByShareKey.set(share_key, {
      file_id, filename, mime_type: same?.mime_type ?? "application/octet-stream", size_bytes, sha256, uploaded: !!same,
    });
    return {
      ok: true,
      status: 200,
      body: {
        code: 0,
        message: "OK",
        data: {
          file_id,
          share_key,
          upload: {
            method: "PUT",
            url: `/api/files/uploads/${encodeURIComponent(share_key)}`,
            headers: { "Content-Length": String(size_bytes) },
            expires_at: now + 3600_000,
            has_same: !!same,
          },
        },
      },
    };
  }

  if (method === "PUT" && pathnameParts.length === 3 && pathname.startsWith("/files/uploads/")) {
    if (!requireSession(server, req.headers)) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const file = server.filesByShareKey.get(pathnameParts[2]);
    if (!file) return { ok: true, status: 200, body: { code: 40002, message: "Invalid share_key" } };
    const size = req.body instanceof Blob ? req.body.size : req.body instanceof ArrayBuffer ? req.body.byteLength : -1;
    if (size !== file.size_bytes) return { ok: true, status: 200, body: { code: 40007, message: "Upload size mismatch" } };
    file.mime_type = req.headers["Content-Type"] || file.mime_type;
    file.uploaded = true;
    return { ok: true, status: 200, body: { code: 0, message: "OK", data: null } };
  }

  // -------------------------------------------------------------------------
  // Chat (auth)
  // -------------------------------------------------------------------------
  if (pathname === "/channels" && method === "GET") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const channels = [...server.channelsById.values()].filter((channel) =>
      server.membersByCid.get(channel.cid)?.some((member) => member.uid === session.uid),
    );
    return channelPage(channels.map(channelSummary), searchParams);
  }

  if (pathname === "/channels/discover" && method === "GET") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const query = (searchParams.get("q") ?? "").trim().toLowerCase();
    const limit = Math.min(50, Math.max(1, Math.trunc(Number(searchParams.get("limit")) || 20)));
    const cursor = searchParams.get("cursor");
    const channels = [...server.channelsById.values()].filter((channel) =>
      `${channel.name} ${channel.brief}`.toLowerCase().includes(query),
    );
    const cursorFor = (cid: string) => JSON.stringify([query, cid]);
    const cursorIndex = cursor == null ? -1 : channels.findIndex((channel) => cursorFor(channel.cid) === cursor);
    if (cursor != null && cursorIndex < 0) {
      return { ok: true, status: 200, body: { code: 10013, message: "Invalid cursor" } };
    }
    const start = cursorIndex + 1;
    const items = channels.slice(start, start + limit).map((channel) => ({
      cid: channel.cid,
      name: channel.name,
      brief: channel.brief,
      avatar: channel.avatar ?? null,
      member_count: server.membersByCid.get(channel.cid)?.length ?? 0,
      requires_application: true,
    }));
    const has_more = start + limit < channels.length;
    return channelOk({ items, has_more, next_cursor: has_more ? cursorFor(items[items.length - 1].cid) : null });
  }

  if (pathname === "/channels/list" && method === "POST") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    if (!Array.isArray(req.body)) return { ok: true, status: 200, body: { code: 10001, message: "Invalid channel IDs" } };
    const items = req.body.flatMap((cid) => {
      const channel = server.channelsById.get(String(cid));
      return channel ? [channelSummary(channel)] : [];
    });
    return channelOk({ total: req.body.length, items });
  }

  if (pathname === "/channels/applications" && method === "GET") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const items = [...server.applicationsByCid.values()].flat().filter((app) => app.uid === session.uid);
    return channelPage(items, searchParams);
  }

  if (pathnameParts.length === 3 && pathnameParts[0] === "channels" &&
      ((pathnameParts[2] === "transfer" && method === "PUT") || (pathnameParts[2] === "quit" && method === "POST"))) {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const cid = decodeURIComponent(pathnameParts[1]);
    const channel = server.channelsById.get(cid);
    if (!channel) return { ok: true, status: 200, body: { code: 20001, message: "Channel not found" } };
    const members = server.membersByCid.get(cid) ?? [];
    if (method === "PUT") {
      if (channel.owner_uid !== session.uid) return { ok: true, status: 200, body: { code: 20006, message: "Owner required" } };
      const newOwner = members.find((member) => member.uid === (req.body as { new_owner?: string } | null)?.new_owner);
      if (!newOwner) return { ok: true, status: 200, body: { code: 20003, message: "Member not found" } };
      for (const member of members) if (member.role === "owner") member.role = "member";
      newOwner.role = "owner";
      channel.owner_uid = newOwner.uid;
      emitWs(server, "channel.changed", { cid });
    } else {
      if (channel.owner_uid === session.uid) return { ok: true, status: 200, body: { code: 20008, message: "Transfer channel ownership first" } };
      server.membersByCid.set(cid, members.filter((member) => member.uid !== session.uid));
      emitWs(server, "channels.changed", { cid });
    }
    return channelOk(null);
  }

  if (pathname === "/channels" && method === "POST") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const body = req.body as { name?: string; brief?: string } | null;
    const name = String(body?.name ?? "").trim();
    if (!name) return { ok: false, error: apiError(400, "invalid_request", "Missing channel name") };
    const created_at = Date.now();
    const cid = String(BigInt(created_at) * 10000n + BigInt(server.eventSeq % 10000));
    const channel: Channel = { cid, name, brief: String(body?.brief ?? ""), owner_uid: session.uid, created_at };
    server.channelsById.set(cid, channel);
    server.membersByCid.set(cid, [{ uid: session.uid, nickname: "Operator", role: "owner", join_time: Date.now() }]);
    server.messagesByCid.set(cid, []);
    server.applicationsByCid.set(cid, []);
    server.bansByCid.set(cid, []);
    emitWs(server, "channels.changed", { cid });
    return channelOk(channelSummary(channel));
  }

  if (pathname.startsWith("/channels/") && pathname.split("/").length === 3 && method === "GET") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const cid = decodeURIComponent(pathname.split("/")[2] ?? "").trim();
    const channel = server.channelsById.get(cid) ?? null;
    if (!channel) return { ok: false, error: apiError(404, "not_found", "Channel not found", { cid }) };
    return channelOk(channelSummary(channel));
  }

  if (pathname.startsWith("/channels/") && pathname.split("/").length === 3 && method === "PATCH") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const cid = decodeURIComponent(pathname.split("/")[2] ?? "").trim();
    const channel = server.channelsById.get(cid) ?? null;
    if (!channel) return { ok: false, error: apiError(404, "not_found", "Channel not found", { cid }) };
    const role = server.membersByCid.get(cid)?.find((member) => member.uid === session.uid)?.role;
    if (role !== "owner" && role !== "admin") {
      return { ok: true, status: 200, body: { code: 20010, message: "Cannot edit channel" } };
    }
    const patch = req.body as Partial<Pick<Channel, "name" | "brief">>;
    if (typeof patch?.name === "string") channel.name = patch.name.trim() || channel.name;
    if (typeof patch?.brief === "string") channel.brief = patch.brief;
    emitWs(server, "channel.changed", { cid });
    return channelOk(null);
  }

  if (pathname.startsWith("/channels/") && pathname.split("/").length === 3 && method === "DELETE") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const cid = decodeURIComponent(pathname.split("/")[2] ?? "").trim();
    const channel = server.channelsById.get(cid);
    if (!channel) return { ok: true, status: 200, body: { code: 20001, message: "Channel not found" } };
    if (channel.owner_uid !== session.uid) return { ok: true, status: 200, body: { code: 20006, message: "Owner required" } };
    server.channelsById.delete(cid);
    server.membersByCid.delete(cid);
    server.messagesByCid.delete(cid);
    server.applicationsByCid.delete(cid);
    server.bansByCid.delete(cid);
    emitWs(server, "channels.changed", { cid });
    return channelOk(null);
  }

  if (pathname === "/unreads" && method === "GET") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const items: Array<{ cid: string; unread_count: number }> = [];
    for (const cid of server.channelsById.keys()) {
      if (!isMockChannelMember(server, cid, session.uid)) continue;
      const { unread_count } = mockReadState(server, cid, session.uid);
      if (unread_count > 0) items.push({ cid, unread_count });
    }
    return { ok: true, status: 200, body: { total: items.length, items } };
  }

  if (pathnameParts[0] === "channels" && pathnameParts[1] === "messages" && pathnameParts.length === 3) {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const available = [...server.messagesByCid.values()].flat().filter((msg) => isMockChannelMember(server, msg.cid, session.uid));
    if (method === "GET") {
      const found = available.find((msg) => msg.mid === decodeURIComponent(pathnameParts[2]));
      return found ? channelOk(found) : mockBusinessFailure(30001, "Message not found");
    }
    if (method === "POST" && pathnameParts[2] === "ids") {
      const ids = (req.body as { message_ids?: string[] } | null)?.message_ids;
      if (!Array.isArray(ids) || !ids.length || ids.some((id) => !/^\d+$/.test(id))) {
        return { ok: true, status: 200, body: { code: 10001, message: "Invalid message_ids" } };
      }
      const items = [...new Set(ids)].flatMap((id) => available.find((msg) => msg.mid === id) ?? []);
      return channelOk({ total: items.length, items });
    }
  }

  if (pathnameParts[0] === "channels" && pathnameParts[2] === "messages" && method === "GET" &&
      (pathnameParts.length === 3 || (pathnameParts.length === 4 && ["before", "after", "around", "search"].includes(pathnameParts[3])))) {
    if (pathnameParts.length === 3 && (searchParams.has("around_mid") || searchParams.has("cursor"))) {
      return mockBusinessFailure(10001, "Use the before or around endpoint");
    }
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const cid = decodeURIComponent(pathnameParts[1] ?? "");
    if (!isMockChannelMember(server, cid, session.uid)) return { ok: true, status: 200, body: { code: 20002, message: "Channel membership required" } };
    const kind = pathnameParts[3] ?? "";
    const value = (msg: ChatMessage) => BigInt(msg.mid);
    const asc = [...(server.messagesByCid.get(cid) ?? [])].sort((a, b) => value(a) < value(b) ? -1 : value(a) > value(b) ? 1 : 0);
    if (kind === "around") {
      const index = asc.findIndex((msg) => msg.mid === searchParams.get("anchor_mid"));
      if (index < 0) return mockBusinessFailure(30001, "Message not found");
      const before = Number(searchParams.get("before") ?? 25);
      const after = Number(searchParams.get("after") ?? 25);
      if (![before, after].every((count) => Number.isInteger(count) && count >= 0 && count <= 50)) {
        return mockBusinessFailure(10001, "Invalid message context size");
      }
      return channelOk({ items: asc.slice(Math.max(0, index - before), index + after + 1).reverse() });
    }
    const limit = Math.max(1, Math.min(50, Math.trunc(Number(searchParams.get("limit") ?? 20)) || 20));
    const q = searchParams.get("q") ?? "";
    const sender = searchParams.get("sender_uid") ?? "";
    const domain = searchParams.get("domain") ?? "";
    const scope = JSON.stringify([session.uid, cid, ...(kind === "search" ? ["search", q, sender, domain] : [])]);
    const cursor = searchParams.get("cursor");
    const prefix = `${encodeURIComponent(scope)}:`;
    const edge = cursor?.startsWith(prefix) ? cursor.slice(prefix.length) : "";
    if ((cursor !== null || kind === "before" || kind === "after") && !/^\d+$/.test(edge)) {
      return { ok: true, status: 200, body: { code: 10013, message: "Invalid cursor" } };
    }
    let matches = kind === "after" ? asc : asc.reverse();
    if (edge) matches = matches.filter((msg) => kind === "after" ? value(msg) > BigInt(edge) : value(msg) < BigInt(edge));
    if (kind === "search") matches = matches.filter((msg) => msg.status !== "recalled" &&
      (!sender || msg.uid === sender) && (!domain || msg.domain === domain) && (msg.preview ?? "").toLowerCase().includes(q.toLowerCase()));
    const items = matches.slice(0, limit);
    const hasMore = matches.length > items.length;
    return channelOk({ items, next_cursor: hasMore ? `${prefix}${items[items.length - 1]?.mid}` : null, has_more: hasMore });
  }

  if (
    pathname.startsWith("/channels/") &&
    pathname.endsWith("/messages") &&
    method === "POST"
  ) {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };

    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    if (!cid) return { ok: false, error: apiError(400, "invalid_request", "Missing cid") };
    if (!server.channelsById.get(cid)) return { ok: false, error: apiError(404, "not_found", "Channel not found", { cid }) };

    if (!isMockChannelMember(server, cid, session.uid)) return { ok: true, status: 200, body: { code: 20002, message: "Channel membership required" } };
    const body = req.body as { domain?: string; data?: Record<string, unknown>; mentions?: unknown } | null;
    const domain = String(body?.domain ?? "").trim();
    if (!domain || !body?.data || (domain === "Core:Text:V1" && typeof body.data.content !== "string")) {
      return { ok: true, status: 200, body: { code: 10001, message: "Invalid message" } };
    }
    const data = { ...body.data };
    if (domain === "Core:Text:V1") {
      data.reply_to_mid ??= null;
      data.reply_to_user = server.messagesByCid.get(cid)?.find((msg) => msg.mid === data.reply_to_mid)?.uid ?? null;
    }
    const mid = String(BigInt(Date.now()) * 1_000_000n + BigInt(server.eventSeq + 1));
    const msg: ChatMessage = {
      mid, cid, uid: session.uid, send_time: Date.now(), domain, data,
      preview: typeof data.content === "string" ? data.content : "",
      mentions: Array.isArray(body.mentions) ? body.mentions.map(String) : [],
    };
    const list = server.messagesByCid.get(cid) ?? [];
    list.push(msg);
    server.messagesByCid.set(cid, list);
    emitWs(server, "message.created", { channel_id: cid, message_id: mid, event_sequence: server.eventSeq + 1 });
    addMockMentions(server, msg, body.mentions);
    return channelOk(msg);
  }

  if (method === "POST" && pathnameParts.length === 5 && pathnameParts[0] === "channels" && pathnameParts[2] === "messages" && pathnameParts[4] === "recall") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const cid = decodeURIComponent(pathnameParts[1]);
    const mid = decodeURIComponent(pathnameParts[3]);
    if (!isMockChannelMember(server, cid, session.uid)) return mockBusinessFailure(20002, "Channel membership required");
    const msg = server.messagesByCid.get(cid)?.find((entry) => entry.mid === mid);
    if (!msg) return mockBusinessFailure(30001, "Message not found");
    const role = server.membersByCid.get(cid)?.find((member) => member.uid === session.uid)?.role;
    if (msg.uid !== session.uid && role !== "owner" && role !== "admin") return mockBusinessFailure(30007, "Recall is not permitted");
    if (msg.status !== "recalled") {
      msg.status = "recalled";
      msg.data = null;
      msg.preview = "";
      msg.mentions = [];
      emitWs(server, "message.recalled", { channel_id: cid, message_id: mid, event_sequence: server.eventSeq + 1 });
    }
    return channelOk(null);
  }

  if (pathnameParts.length === 3 && pathnameParts[0] === "channels" && pathnameParts[2] === "read_state" && (method === "GET" || method === "PUT")) {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const cid = decodeURIComponent(pathnameParts[1]);
    const uid = session.uid;
    if (!server.channelsById.has(cid)) return mockBusinessFailure(20001, "Channel not found");
    if (!isMockChannelMember(server, cid, uid)) return mockBusinessFailure(20002, "Channel membership is required");
    if (method === "GET") return { ok: true, status: 200, body: mockReadState(server, cid, uid) };
    const raw = (req.body as { last_read_mid?: unknown } | null)?.last_read_mid;
    const mid = typeof raw === "number" && Number.isSafeInteger(raw) ? String(raw) : raw;
    if (!isPositiveMockId(mid)) return mockBusinessFailure(10001, "Invalid last_read_mid");
    if (!server.messagesByCid.get(cid)?.some((message) => message.mid === mid)) return mockBusinessFailure(30001, "Message not found");
    const key = `${cid}::${uid}`;
    const previous = server.readStateByCidUid.get(key);
    const advanced = !previous || BigInt(mid) > BigInt(previous);
    const result = { cid, uid, last_read_mid: advanced ? mid : previous };
    if (advanced) {
      server.readStateByCidUid.set(key, mid);
      emitWs(server, "read_state.updated", result, uid);
    }
    return { ok: true, status: 200, body: result };
  }

  if (pathname.startsWith("/channels/") && pathname.endsWith("/members") && method === "GET") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const items = (server.membersByCid.get(cid) ?? []).map(({ nickname, ...member }) => ({ ...member, username: nickname }));
    return channelPage(items, searchParams);
  }

  if (pathname.includes("/members/") && method === "DELETE") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const uid = decodeURIComponent(parts[3] ?? "").trim();
    const list = server.membersByCid.get(cid) ?? [];
    const next = list.filter((m) => m.uid !== uid);
    server.membersByCid.set(cid, next);
    return channelOk(null);
  }

  if (pathname.includes("/admins/") && method === "PUT") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const uid = decodeURIComponent(parts[3] ?? "").trim();
    const list = server.membersByCid.get(cid) ?? [];
    for (const m of list) if (m.uid === uid) m.role = "admin";
    server.membersByCid.set(cid, list);
    return channelOk(null);
  }

  if (pathname.includes("/admins/") && method === "DELETE") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const uid = decodeURIComponent(parts[3] ?? "").trim();
    const list = server.membersByCid.get(cid) ?? [];
    for (const m of list) if (m.uid === uid) m.role = "member";
    server.membersByCid.set(cid, list);
    return channelOk(null);
  }

  if (pathname.startsWith("/channels/") && pathname.endsWith("/applications") && method === "POST") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    if (!server.channelsById.has(cid)) return mockBusinessFailure(20001, "Channel not found");
    if (isMockChannelMember(server, cid, session.uid)) return mockBusinessFailure(20017, "Already a member");
    const body = req.body as { reason?: string } | null;
    const reason = String(body?.reason ?? "");
    const applyTime = Date.now();
    const serial = [...server.applicationsByCid.values()].reduce((total, items) => total + items.length, 0);
    const app: ChannelApplication = {
      application_id: String(BigInt(applyTime) * 10000n + BigInt(serial % 10000)),
      cid,
      uid: session.uid,
      reason,
      apply_time: Date.now(),
      status: "pending",
    };
    const list = server.applicationsByCid.get(cid) ?? [];
    list.push(app);
    server.applicationsByCid.set(cid, list);
    return channelOk(app);
  }

  if (pathname.startsWith("/channels/") && pathname.endsWith("/applications") && method === "GET") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const role = server.membersByCid.get(cid)?.find((member) => member.uid === session.uid)?.role;
    if (role !== "owner" && role !== "admin") return mockBusinessFailure(20012, "Cannot list applications");
    return channelPage(server.applicationsByCid.get(cid) ?? [], searchParams);
  }

  if (pathname.includes("/applications/") && pathname.endsWith("/decisions") && method === "POST") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const application_id = decodeURIComponent(parts[3] ?? "").trim();
    const body = req.body as { decision?: string } | null;
    const decision = String(body?.decision ?? "").trim();
    const members = server.membersByCid.get(cid) ?? [];
    const role = members.find((member) => member.uid === session.uid)?.role;
    if (role !== "owner" && role !== "admin") return { ok: true, status: 200, body: { code: 20013, message: "Cannot decide applications" } };
    if (decision !== "approve" && decision !== "reject") return { ok: true, status: 200, body: { code: 10001, message: "Invalid decision" } };
    const app = server.applicationsByCid.get(cid)?.find((item) => item.application_id === application_id);
    if (!app) return { ok: true, status: 200, body: { code: 20005, message: "Application not found" } };
    if (app.status !== "pending") return { ok: true, status: 200, body: { code: 20016, message: "Application already decided" } };
    if (decision === "approve") {
      if (members.some((member) => member.uid === app.uid)) return { ok: true, status: 200, body: { code: 20017, message: "Already a member" } };
      members.push({ uid: app.uid, nickname: server.usersById.get(app.uid)?.nickname ?? app.uid, role: "member", join_time: Date.now() });
      server.membersByCid.set(cid, members);
      emitWs(server, "channels.changed", { cid });
    }
    app.status = decision === "approve" ? "accepted" : "rejected";
    return channelOk(app);
  }

  if (pathname.startsWith("/channels/") && pathname.endsWith("/bans") && method === "GET") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    return channelPage(server.bansByCid.get(cid) ?? [], searchParams);
  }

  if (pathname.includes("/bans/") && method === "PUT") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const uid = decodeURIComponent(parts[3] ?? "").trim();
    const body = req.body as { until?: number; reason?: string } | null;
    const ban: ChannelBan = {
      cid,
      uid,
      until: Number(body?.until ?? 0),
      reason: String(body?.reason ?? ""),
      create_time: Date.now(),
    };
    const list = (server.bansByCid.get(cid) ?? []).filter((b) => b.uid !== uid);
    list.push(ban);
    server.bansByCid.set(cid, list);
    return channelOk(ban);
  }

  if (pathname.includes("/bans/") && method === "DELETE") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const uid = decodeURIComponent(parts[3] ?? "").trim();
    const list = (server.bansByCid.get(cid) ?? []).filter((b) => b.uid !== uid);
    server.bansByCid.set(cid, list);
    return channelOk(null);
  }

  // -------------------------------------------------------------------------
  // Message edit (auth)
  // -------------------------------------------------------------------------
  if (method === "PATCH" && pathnameParts.length === 2 && pathnameParts[0] === "messages") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const mid = decodeURIComponent(pathnameParts[1] ?? "").trim();
    for (const [, msgs] of server.messagesByCid) {
      const idx = msgs.findIndex((m) => (m as { mid: string }).mid === mid);
      if (idx >= 0) {
        const msg = msgs[idx] as Record<string, unknown>;
        const body = req.body as { data?: { text?: string } } | null;
        if (body?.data && typeof body.data === "object") {
          (msg.data as Record<string, unknown>).text = (body.data as { text?: string }).text ?? "";
        }
        msg.edited_at = Date.now();
        msg.edit_version = ((msg.edit_version as number) ?? 0) + 1;
        emitWs(server, "message.updated", { cid: msg.cid, message: msg });
        return { ok: true, status: 200, body: msg };
      }
    }
    return { ok: false, error: apiError(404, "not_found", "Message not found", { mid }) };
  }

  // -------------------------------------------------------------------------
  // Pin message (auth)
  // -------------------------------------------------------------------------
  if (method === "POST" && pathnameParts.length === 4 && pathnameParts[0] === "channels" && pathnameParts[2] === "pins") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const cid = decodeURIComponent(pathnameParts[1] ?? "").trim();
    const mid = decodeURIComponent(pathnameParts[3] ?? "").trim();
    const pin = { pin_id: `pin-${Date.now().toString(16)}`, cid, mid, pinned_by_uid: session.uid, pinned_at: Date.now() };
    const pins = server.pinsByCid.get(cid) ?? [];
    pins.push(pin);
    server.pinsByCid.set(cid, pins);
    emitWs(server, "message.pinned", { cid, mid });
    return { ok: true, status: 204, body: null };
  }

  // -------------------------------------------------------------------------
  // Unpin message (auth)
  // -------------------------------------------------------------------------
  if (method === "DELETE" && pathnameParts.length === 4 && pathnameParts[0] === "channels" && pathnameParts[2] === "pins") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const cid = decodeURIComponent(pathnameParts[1] ?? "").trim();
    const mid = decodeURIComponent(pathnameParts[3] ?? "").trim();
    const pins = server.pinsByCid.get(cid) ?? [];
    const idx = pins.findIndex((p) => (p as { mid: string }).mid === mid);
    if (idx >= 0) {
      pins.splice(idx, 1);
      emitWs(server, "message.unpinned", { cid, mid });
    }
    return { ok: true, status: 204, body: null };
  }

  // -------------------------------------------------------------------------
  // List pins (auth)
  // -------------------------------------------------------------------------
  if (method === "GET" && pathnameParts.length === 3 && pathnameParts[0] === "channels" && pathnameParts[2] === "pins") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const cid = decodeURIComponent(pathnameParts[1] ?? "").trim();
    const pins = server.pinsByCid.get(cid) ?? [];
    return { ok: true, status: 200, body: { items: pins, next_cursor: "", has_more: false } };
  }

  // -------------------------------------------------------------------------
  // List mentions (auth)
  // -------------------------------------------------------------------------
  const channelMentionPath = pathnameParts[0] === "channels" && pathnameParts[2] === "mentions";
  const listMentions = method === "GET" && (pathname === "/mentions" || (channelMentionPath && pathnameParts.length === 3));
  const rangeMentions = method === "PUT" && (pathname === "/mentions/read" || (channelMentionPath && pathnameParts.length === 4 && pathnameParts[3] === "read"));
  const detailMention = method === "GET" && pathnameParts[0] === "mentions" && pathnameParts.length === 2;
  const singleRead = method === "PUT" && pathnameParts[0] === "mentions" && pathnameParts.length === 3 && pathnameParts[2] === "read";
  const batchMentions = method === "POST" && pathname === "/mentions/ids";
  if (listMentions || rangeMentions || detailMention || singleRead || batchMentions) {
    const session = requireSession(server, req.headers);
    if (!session) return mockBusinessFailure(11001, "Missing access token");
    const cid = channelMentionPath ? decodeURIComponent(pathnameParts[1]) : undefined;
    if (cid && !server.channelsById.has(cid)) return mockBusinessFailure(20001, "Channel not found");
    if (cid && !isMockChannelMember(server, cid, session.uid)) return mockBusinessFailure(20002, "Channel membership is required");
    const rows = visibleMockMentions(server, session.uid, cid);
    if (detailMention || singleRead) {
      const id = decodeURIComponent(pathnameParts[1]);
      const row = rows.find((item) => item.mention_id === id);
      if (!row) return mockBusinessFailure(30002, "Mention not found");
      if (singleRead) row.read = true;
      return { ok: true, status: 200, body: singleRead ? null : { ...row } };
    }
    if (batchMentions) {
      const ids = (req.body as { mention_ids?: unknown } | null)?.mention_ids;
      if (!Array.isArray(ids) || ids.length < 1 || ids.length > 50 || !ids.every(isPositiveMockId)) {
        return mockBusinessFailure(10001, "Invalid mention_ids");
      }
      const byId = new Map(rows.map((row) => [row.mention_id, row]));
      const items = [...new Set(ids)].flatMap((id) => {
        const row = byId.get(id);
        return row ? [{ ...row }] : [];
      });
      return { ok: true, status: 200, body: { items } };
    }
    if (rangeMentions) {
      const through = (req.body as { through_mention_id?: unknown } | null)?.through_mention_id;
      if (req.body !== undefined && !isPositiveMockId(through)) return mockBusinessFailure(10001, "Invalid through_mention_id");
      for (const row of rows) {
        if (typeof through !== "string" || BigInt(row.mention_id) <= BigInt(through)) row.read = true;
      }
      return { ok: true, status: 200, body: null };
    }
    const unreadOnly = searchParams.get("unread_only") ?? "false";
    const limit = Number(searchParams.get("limit") ?? 20);
    if ((unreadOnly !== "true" && unreadOnly !== "false") || !Number.isInteger(limit) || limit < 1 || limit > 50) {
      return mockBusinessFailure(10001, "Invalid mention filters");
    }
    const prefix = `${session.uid}:${cid ?? ""}:${unreadOnly}:`;
    const cursor = searchParams.get("cursor");
    const upper = cursor?.startsWith(prefix) ? cursor.slice(prefix.length) : undefined;
    if (cursor !== null && !isPositiveMockId(upper)) return mockBusinessFailure(10013, "Invalid mention cursor");
    const matches = rows.filter((row) => (unreadOnly === "false" || !row.read) && (!upper || BigInt(row.mention_id) < BigInt(upper)))
      .sort((left, right) => BigInt(left.mention_id) > BigInt(right.mention_id) ? -1 : 1);
    const items = matches.slice(0, limit).map((row) => ({ ...row }));
    const has_more = matches.length > limit;
    const next_cursor = has_more ? `${prefix}${items[items.length - 1].mention_id}` : null;
    return { ok: true, status: 200, body: { items, next_cursor, has_more } };
  }

  // -------------------------------------------------------------------------
  // Files list (auth)
  // -------------------------------------------------------------------------
  if (method === "GET" && pathname === "/files/list") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    return { ok: true, status: 200, body: { items: [], next_cursor: "", has_more: false } };
  }

  return { ok: false, error: apiError(404, "not_found", "Mock endpoint not implemented", { method, path: pathname }) };
}
