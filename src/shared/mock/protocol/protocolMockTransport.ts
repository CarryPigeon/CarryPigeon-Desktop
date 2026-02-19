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

type Channel = {
  cid: string;
  name: string;
  brief: string;
  avatar?: string;
  owner_uid: string;
};

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
  status: "pending" | "approved" | "rejected" | string;
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
  domain_version: string;
  data: unknown;
  preview?: string;
  reply_to_mid?: string;
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
  wsListeners: Set<WsListener>;
  eventSeq: number;
  channelsById: Map<string, Channel>;
  membersByCid: Map<string, ChannelMember[]>;
  messagesByCid: Map<string, ChatMessage[]>;
  readStateByCidUid: Map<string, number>;
  applicationsByCid: Map<string, ChannelApplication[]>;
  bansByCid: Map<string, ChannelBan[]>;
  filesByShareKey: Map<string, { file_id: string; filename: string; mime_type: string; size_bytes: number }>;
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
    wsListeners: new Set(),
    eventSeq: 0,
    channelsById: new Map(),
    membersByCid: new Map(),
    messagesByCid: new Map(),
    readStateByCidUid: new Map(),
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

  for (const c of seedChannels) {
    s.channelsById.set(c.cid, c);
    s.membersByCid.set(c.cid, seedMembers.map((m) => ({ ...m })));
    s.messagesByCid.set(c.cid, []);
    s.applicationsByCid.set(c.cid, []);
    s.bansByCid.set(c.cid, []);
  }

  s.messagesByCid.set("cid-ann", [
    {
      mid: "m-1",
      cid: "cid-ann",
      uid: "1",
      sender: { uid: "1", nickname: "Operator" },
      send_time: now - 1000 * 60 * 30,
      domain: "Core:Text",
      domain_version: "1.0.0",
      data: { text: "Welcome to Patchbay. This is the baseline text domain." },
      preview: "Welcome to Patchbay. This is the baseline text domain.",
    },
  ]);
  s.messagesByCid.set("cid-prod", [
    {
      mid: "m-2",
      cid: "cid-prod",
      uid: "2",
      sender: { uid: "2", nickname: "Relay" },
      send_time: now - 1000 * 60 * 18,
      domain: "Core:Text",
      domain_version: "1.0.0",
      data: { text: "P0 checklist: required gate, unknown domain downgrade, hard delete disappears, weak disconnect hints." },
      preview: "P0 checklist: required gate, unknown domain downgrade, hard delete disappears, weak disconnect hints.",
    },
  ]);

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
function emitWs(server: ServerState, eventType: string, payload: unknown): void {
  server.eventSeq += 1;
  const env: ProtocolWsEventEnvelope = {
    type: "event",
    data: {
      event_id: `${server.serverId}:${server.eventSeq}`,
      event_type: eventType,
      server_time: Date.now(),
      payload,
    },
  };
  for (const l of server.wsListeners) {
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
  options?: { onAuthError?: (reason: string) => void; onResumeFailed?: (reason: string) => void },
): ProtocolWsClient {
  void options?.onResumeFailed;
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

  // -------------------------------------------------------------------------
  // Server info (public)
  // -------------------------------------------------------------------------
  if (method === "GET" && pathname === "/server") {
    const required_plugins = listRequiredPluginIds();
    return {
      ok: true,
      status: 200,
      body: {
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
  if (method === "POST" && pathname === "/auth/email_codes") {
    const body = req.body as { email?: string } | null;
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!email) return { ok: false, error: apiError(400, "invalid_request", "Missing email") };
    return { ok: true, status: 204, body: null };
  }

  if (method === "POST" && pathname === "/auth/tokens") {
    const body = req.body as
      | {
          grant_type?: string;
          email?: string;
          code?: string;
          client?: { device_id?: string; installed_plugins?: Array<{ plugin_id?: string; version?: string }> };
        }
      | null;
    const grantType = String(body?.grant_type ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (grantType !== "email_code") {
      return { ok: false, error: apiError(400, "invalid_grant", "Unsupported grant_type", { grant_type: grantType }) };
    }
    if (!email) return { ok: false, error: apiError(400, "invalid_request", "Missing email") };

    const required = listRequiredPluginIds();
    const installed = new Set<string>();
    for (const p of body?.client?.installed_plugins ?? []) {
      const id = String(p?.plugin_id ?? "").trim();
      if (id) installed.add(id);
    }
    const missing = required.filter((id) => !installed.has(id));
    if (missing.length > 0) {
      return {
        ok: false,
        error: apiError(403, "required_plugin_missing", "Required plugins missing", { missing_plugins: missing }),
      };
    }

    const uid = "1";
    const now = Date.now();
    const access_token = `pmock-access:${uid}:${now.toString(16)}`;
    const refresh_token = `pmock-refresh:${uid}:${now.toString(16)}`;
    const session: TokenSession = {
      uid,
      email,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAtMs: now + 1800 * 1000,
    };
    server.sessionsByAccess.set(access_token, session);
    server.sessionsByRefresh.set(refresh_token, session);

    return {
      ok: true,
      status: 200,
      body: {
        token_type: "bearer",
        access_token,
        expires_in: 1800,
        refresh_token,
        uid,
        is_new_user: false,
      },
    };
  }

  if (method === "POST" && pathname === "/auth/refresh") {
    const body = req.body as { refresh_token?: string } | null;
    const rt = String(body?.refresh_token ?? "").trim();
    const prev = server.sessionsByRefresh.get(rt) ?? null;
    if (!prev) return { ok: false, error: apiError(401, "unauthorized", "Invalid refresh token") };

    const now = Date.now();
    const access_token = `pmock-access:${prev.uid}:${now.toString(16)}`;
    const refresh_token = `pmock-refresh:${prev.uid}:${now.toString(16)}`;
    const session: TokenSession = {
      uid: prev.uid,
      email: prev.email,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAtMs: now + 1800 * 1000,
    };
    server.sessionsByAccess.set(access_token, session);
    server.sessionsByRefresh.set(refresh_token, session);
    server.sessionsByRefresh.delete(rt);

    return {
      ok: true,
      status: 200,
      body: {
        token_type: "bearer",
        access_token,
        expires_in: 1800,
        refresh_token,
        uid: prev.uid,
        is_new_user: false,
      },
    };
  }

  if (method === "POST" && pathname === "/auth/revoke") {
    const body = req.body as { refresh_token?: string } | null;
    const rt = String(body?.refresh_token ?? "").trim();
    if (rt) server.sessionsByRefresh.delete(rt);
    return { ok: true, status: 204, body: null };
  }

  // -------------------------------------------------------------------------
  // Users (auth)
  // -------------------------------------------------------------------------
  if (method === "GET" && pathname === "/users/me") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    return {
      ok: true,
      status: 200,
      body: { uid: session.uid, email: session.email, nickname: "Operator", avatar: "" },
    };
  }

  if (method === "GET" && pathname.startsWith("/users/") && pathname !== "/users/me") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const uid = decodeURIComponent(pathname.slice("/users/".length)).trim();
    if (!uid) return { ok: false, error: apiError(400, "invalid_request", "Missing uid") };
    return { ok: true, status: 200, body: { uid, nickname: uid === "1" ? "Operator" : "User", avatar: "" } };
  }

  if (method === "GET" && pathname === "/users") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const csv = String(searchParams.get("ids") ?? "").trim();
    const ids = csv ? csv.split(",").map((x) => x.trim()).filter(Boolean) : [];
    const items = ids.map((uid) => ({ uid, nickname: uid === "1" ? "Operator" : "User", avatar: "" }));
    return { ok: true, status: 200, body: { items } };
  }

  // -------------------------------------------------------------------------
  // Files (auth)
  // -------------------------------------------------------------------------
  if (method === "POST" && pathname === "/files/uploads") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };

    const body = req.body as { filename?: string; mime_type?: string; size_bytes?: number } | null;
    const filename = String(body?.filename ?? "").trim();
    const mime_type = String(body?.mime_type ?? "").trim() || "application/octet-stream";
    const size_bytes = Number(body?.size_bytes ?? 0);
    if (!filename) return { ok: false, error: apiError(400, "invalid_request", "Missing filename") };
    if (!Number.isFinite(size_bytes) || size_bytes <= 0) return { ok: false, error: apiError(400, "invalid_request", "Invalid size_bytes") };

    const now = Date.now();
    const file_id = `pmock-file-${now.toString(16)}`;
    const share_key = `pmock-share-${now.toString(16)}`;
    server.filesByShareKey.set(share_key, { file_id, filename, mime_type, size_bytes: Math.trunc(size_bytes) });
    return {
      ok: true,
      status: 200,
      body: {
        file_id,
        share_key,
        upload: {
          method: "PUT",
          url: `http://mock.local/upload/${encodeURIComponent(file_id)}`,
          headers: { "Content-Type": mime_type },
          expires_at: now + 3600_000,
        },
      },
    };
  }

  // -------------------------------------------------------------------------
  // Chat (auth)
  // -------------------------------------------------------------------------
  if (pathname === "/channels" && method === "GET") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const channels = Array.from(server.channelsById.values());
    return { ok: true, status: 200, body: { channels } };
  }

  if (pathname === "/channels" && method === "POST") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const body = req.body as { name?: string; brief?: string; avatar?: string } | null;
    const name = String(body?.name ?? "").trim();
    if (!name) return { ok: false, error: apiError(400, "invalid_request", "Missing channel name") };
    const cid = `cid-${Date.now().toString(16)}`;
    const channel: Channel = { cid, name, brief: String(body?.brief ?? ""), avatar: String(body?.avatar ?? "") || undefined, owner_uid: session.uid };
    server.channelsById.set(cid, channel);
    server.membersByCid.set(cid, [{ uid: session.uid, nickname: "Operator", role: "owner", join_time: Date.now() }]);
    server.messagesByCid.set(cid, []);
    server.applicationsByCid.set(cid, []);
    server.bansByCid.set(cid, []);
    emitWs(server, "channels.changed", { cid });
    return { ok: true, status: 200, body: channel };
  }

  if (pathname.startsWith("/channels/") && pathname.split("/").length === 3 && method === "GET") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const cid = decodeURIComponent(pathname.split("/")[2] ?? "").trim();
    const channel = server.channelsById.get(cid) ?? null;
    if (!channel) return { ok: false, error: apiError(404, "not_found", "Channel not found", { cid }) };
    return { ok: true, status: 200, body: channel };
  }

  if (pathname.startsWith("/channels/") && pathname.split("/").length === 3 && method === "PATCH") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const cid = decodeURIComponent(pathname.split("/")[2] ?? "").trim();
    const channel = server.channelsById.get(cid) ?? null;
    if (!channel) return { ok: false, error: apiError(404, "not_found", "Channel not found", { cid }) };
    const patch = req.body as Partial<Pick<Channel, "name" | "brief" | "avatar">>;
    if (typeof patch?.name === "string") channel.name = patch.name.trim() || channel.name;
    if (typeof patch?.brief === "string") channel.brief = patch.brief;
    if (typeof patch?.avatar === "string") channel.avatar = patch.avatar;
    emitWs(server, "channel.changed", { cid });
    return { ok: true, status: 200, body: channel };
  }

  if (pathname.startsWith("/channels/") && pathname.split("/").length === 3 && method === "DELETE") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const cid = decodeURIComponent(pathname.split("/")[2] ?? "").trim();
    server.channelsById.delete(cid);
    server.membersByCid.delete(cid);
    server.messagesByCid.delete(cid);
    server.applicationsByCid.delete(cid);
    server.bansByCid.delete(cid);
    emitWs(server, "channels.changed", { cid });
    return { ok: true, status: 204, body: null };
  }

  if (pathname === "/unreads" && method === "GET") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const items: Array<{ cid: string; unread_count: number; last_read_time: number }> = [];
    for (const c of server.channelsById.values()) {
      const key = `${c.cid}::${session.uid}`;
      const last_read_time = server.readStateByCidUid.get(key) ?? 0;
      const list = server.messagesByCid.get(c.cid) ?? [];
      const unread_count = list.filter((m) => m.send_time > last_read_time).length;
      items.push({ cid: c.cid, unread_count, last_read_time });
    }
    return { ok: true, status: 200, body: { items } };
  }

  if (pathname.startsWith("/channels/") && pathname.includes("/messages") && method === "GET") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };

    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    if (!cid) return { ok: false, error: apiError(400, "invalid_request", "Missing cid") };
    const limit = Math.max(1, Math.trunc(Number(searchParams.get("limit") ?? 50)));
    const list = (server.messagesByCid.get(cid) ?? []).slice().sort((a, b) => a.send_time - b.send_time);
    const items = list.slice(Math.max(0, list.length - limit));
    return { ok: true, status: 200, body: { items, next_cursor: "", has_more: false } };
  }

  if (pathname.startsWith("/channels/") && pathname.includes("/messages") && method === "POST") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };

    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    if (!cid) return { ok: false, error: apiError(400, "invalid_request", "Missing cid") };
    if (!server.channelsById.get(cid)) return { ok: false, error: apiError(404, "not_found", "Channel not found", { cid }) };

    const body = req.body as { domain?: string; domain_version?: string; data?: unknown; reply_to_mid?: string } | null;
    const domain = String(body?.domain ?? "").trim() || "Core:Text";
    const domain_version = String(body?.domain_version ?? "").trim() || "1.0.0";
    const now = Date.now();
    const mid = `m-${now.toString(16)}-${Math.random().toString(16).slice(2, 6)}`;
    const data = body?.data ?? { text: "" };
    const preview =
      domain === "Core:Text" && data && typeof data === "object" && typeof (data as { text?: unknown }).text === "string"
        ? String((data as { text: string }).text)
        : "";

    const msg: ChatMessage = {
      mid,
      cid,
      uid: session.uid,
      sender: { uid: session.uid, nickname: "Operator" },
      send_time: now,
      domain,
      domain_version,
      data,
      preview: preview || undefined,
      reply_to_mid: String(body?.reply_to_mid ?? "").trim() || undefined,
    };
    const list = server.messagesByCid.get(cid) ?? [];
    list.push(msg);
    server.messagesByCid.set(cid, list);

    emitWs(server, "message.created", { cid, message: msg });
    return { ok: true, status: 200, body: msg };
  }

  if (pathname.startsWith("/messages/") && method === "DELETE") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const mid = decodeURIComponent(pathname.slice("/messages/".length)).trim();
    if (!mid) return { ok: false, error: apiError(400, "invalid_request", "Missing mid") };

    let cid = "";
    for (const [c, list] of server.messagesByCid.entries()) {
      const idx = list.findIndex((m) => m.mid === mid);
      if (idx >= 0) {
        cid = c;
        list.splice(idx, 1);
        break;
      }
    }
    if (!cid) return { ok: false, error: apiError(404, "not_found", "Message not found", { mid }) };
    emitWs(server, "message.deleted", { cid, mid });
    return { ok: true, status: 204, body: null };
  }

  if (pathname.startsWith("/channels/") && pathname.endsWith("/read_state") && method === "PUT") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    if (!cid) return { ok: false, error: apiError(400, "invalid_request", "Missing cid") };
    const body = req.body as { last_read_time?: number; last_read_mid?: string } | null;
    const t = Number(body?.last_read_time ?? 0);
    const last_read_time = Number.isFinite(t) ? Math.trunc(t) : 0;
    server.readStateByCidUid.set(`${cid}::${session.uid}`, last_read_time);
    emitWs(server, "read_state.updated", { cid, uid: session.uid, last_read_time, last_read_mid: String(body?.last_read_mid ?? "") });
    return { ok: true, status: 204, body: null };
  }

  if (pathname.startsWith("/channels/") && pathname.endsWith("/members") && method === "GET") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const items = server.membersByCid.get(cid) ?? [];
    return { ok: true, status: 200, body: { items } };
  }

  if (pathname.includes("/members/") && method === "DELETE") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const uid = decodeURIComponent(parts[4] ?? "").trim();
    const list = server.membersByCid.get(cid) ?? [];
    const next = list.filter((m) => m.uid !== uid);
    server.membersByCid.set(cid, next);
    return { ok: true, status: 204, body: null };
  }

  if (pathname.includes("/admins/") && method === "PUT") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const uid = decodeURIComponent(parts[4] ?? "").trim();
    const list = server.membersByCid.get(cid) ?? [];
    for (const m of list) if (m.uid === uid) m.role = "admin";
    server.membersByCid.set(cid, list);
    return { ok: true, status: 204, body: null };
  }

  if (pathname.includes("/admins/") && method === "DELETE") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const uid = decodeURIComponent(parts[4] ?? "").trim();
    const list = server.membersByCid.get(cid) ?? [];
    for (const m of list) if (m.uid === uid) m.role = "member";
    server.membersByCid.set(cid, list);
    return { ok: true, status: 204, body: null };
  }

  if (pathname.startsWith("/channels/") && pathname.endsWith("/applications") && method === "POST") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const body = req.body as { reason?: string } | null;
    const reason = String(body?.reason ?? "");
    const app: ChannelApplication = {
      application_id: `app-${Date.now().toString(16)}`,
      cid,
      uid: session.uid,
      reason,
      apply_time: Date.now(),
      status: "pending",
    };
    const list = server.applicationsByCid.get(cid) ?? [];
    list.push(app);
    server.applicationsByCid.set(cid, list);
    return { ok: true, status: 204, body: null };
  }

  if (pathname.startsWith("/channels/") && pathname.endsWith("/applications") && method === "GET") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const items = server.applicationsByCid.get(cid) ?? [];
    return { ok: true, status: 200, body: { items } };
  }

  if (pathname.includes("/applications/") && pathname.endsWith("/decisions") && method === "POST") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const application_id = decodeURIComponent(parts[3] ?? "").trim();
    const body = req.body as { decision?: string } | null;
    const decision = String(body?.decision ?? "").trim();
    const list = server.applicationsByCid.get(cid) ?? [];
    for (const a of list) {
      if (a.application_id !== application_id) continue;
      a.status = decision === "approve" ? "approved" : "rejected";
    }
    server.applicationsByCid.set(cid, list);
    return { ok: true, status: 204, body: null };
  }

  if (pathname.startsWith("/channels/") && pathname.endsWith("/bans") && method === "GET") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const items = server.bansByCid.get(cid) ?? [];
    return { ok: true, status: 200, body: { items } };
  }

  if (pathname.includes("/bans/") && method === "PUT") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const uid = decodeURIComponent(parts[4] ?? "").trim();
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
    return { ok: true, status: 204, body: null };
  }

  if (pathname.includes("/bans/") && method === "DELETE") {
    const session = requireSession(server, req.headers);
    if (!session) return { ok: false, error: apiError(401, "unauthorized", "Missing access token") };
    const parts = pathname.split("/").filter(Boolean);
    const cid = decodeURIComponent(parts[1] ?? "").trim();
    const uid = decodeURIComponent(parts[4] ?? "").trim();
    const list = (server.bansByCid.get(cid) ?? []).filter((b) => b.uid !== uid);
    server.bansByCid.set(cid, list);
    return { ok: true, status: 204, body: null };
  }

  return { ok: false, error: apiError(404, "not_found", "Mock endpoint not implemented", { method, path: pathname }) };
}
