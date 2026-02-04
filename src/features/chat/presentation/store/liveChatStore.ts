/**
 * @fileoverview 聊天实时 Store（HTTP + WS 事件流）。
 * @description
 * 实现聊天领域的核心交互闭环：
 * - HTTP：频道列表/未读/历史消息/成员/管理操作等
 * - WS：实时事件（新消息/删除/读状态/频道变更提示）
 *
 * 设计目标：
 * - 尽量把“协议语义”收敛在 store 内，UI 只消费状态与 action。
 * - 在 WS 不可用（如自签证书场景）时，自动降级为 HTTP polling。
 */

import { computed, reactive, ref, watch } from "vue";
import { readAuthToken } from "@/shared/utils/localState";
import { createLogger } from "@/shared/utils/logger";
import { ensureValidAccessToken, onAuthSessionChanged, startAuthSessionAutoRefresh } from "@/shared/net/auth/authSessionManager";
import { toHttpOrigin } from "@/shared/net/http/serverOrigin";
import { currentUser } from "@/features/user/presentation/store/userData";
import { currentServerSocket } from "@/features/servers/presentation/store/currentServer";
import { getTlsConfigForSocket } from "@/features/servers/presentation/store/serverList";
import { useServerInfoStore } from "@/features/servers/presentation/store/serverInfoStore";
import { usePluginCatalogStore } from "@/features/plugins/presentation/store/pluginCatalogStore";
import { usePluginInstallStore } from "@/features/plugins/presentation/store/pluginInstallStore";
import { dispatchChannelChanged } from "@/shared/utils/messageEvents";
import type { ChatApiPort } from "@/features/chat/domain/ports/chatApiPort";
import type { ChatEventsClient, ChatEventsPort } from "@/features/chat/domain/ports/chatEventsPort";
import type { ChannelDto, ListMessagesResponseDto, MessageDto, ReadStateRequestDto, SendMessageRequestDto, UnreadItemDto } from "@/features/chat/domain/types/chatWireDtos";
import type { WsEventDto } from "@/features/chat/domain/types/chatWireEvents";
import type { ChatChannel, ChatMessage, ChatMember, ChatStore, MessageDomain, ChannelMember, ChannelApplication, ChannelBan } from "./chatStoreTypes";
import { compareMessages, mapWireMessage, mergeMessages } from "./liveChat/liveChatMessageModel";
import {
  httpListChannelMembers,
  httpKickChannelMember,
  httpAddChannelAdmin,
  httpRemoveChannelAdmin,
  httpListChannelApplications,
  httpDecideChannelApplication,
  httpListChannelBans,
  httpPutChannelBan,
  httpDeleteChannelBan,
  httpCreateChannel,
  httpDeleteChannel,
  type ApiChannelMember,
  type ApiChannelApplication,
  type ApiChannelBan,
  type ApiChannel,
} from "@/features/chat/data/httpChatApi";

const logger = createLogger("liveChatStore");

export type LiveChatStoreDeps = {
  api: ChatApiPort;
  events: ChatEventsPort;
};

/**
 * 轮询间隔（WS 降级模式）。
 */
const POLL_INTERVAL_MS = 8000;

/**
 * `resume.failed` 后的补拉 fan-out 上限（避免风暴）。
 */
const CATCH_UP_PREFETCH_LIMIT = 5;

/**
 * 创建 live chat store 实例。
 *
 * @param deps - API + events 端口依赖。
 * @returns ChatStore。
 */
export function createLiveChatStore(deps: LiveChatStoreDeps): ChatStore {
  const channelsRef = ref<ChatChannel[]>([]);
  const channelSearch = ref<string>("");
  const channelTab = ref<"joined" | "discover">("joined");
  const composerDraft = ref<string>("");
  const selectedDomainId = ref<string>("Core:Text");
  const replyToMessageId = ref<string>("");
  const sendError = ref<string>("");
  const currentChannelId = ref<string>("");
  const members = ref<ChatMember[]>([]);

  const messagesByChannel = reactive<Record<string, ChatMessage[]>>({});
  const lastReadTimeMsByChannel = reactive<Record<string, number>>({});
  const lastReadReportAtMsByChannel = reactive<Record<string, number>>({});
  const nextCursorByChannel = reactive<Record<string, string>>({});
  const hasMoreByChannel = reactive<Record<string, boolean>>({});
  const loadingMoreMessages = ref<boolean>(false);

  let wsClient: ChatEventsClient | null = null;
  let wsKey: string = "";
  let stopAutoRefresh: (() => void) | null = null;
  let stopSessionListener: (() => void) | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let pollKey: string = "";
  let pollInFlight: boolean = false;

  const allChannels = computed(() => channelsRef.value);

  const channels = computed(() => {
    const needle = channelSearch.value.trim().toLowerCase();
    const base: ChatChannel[] = [];
    const showJoined = channelTab.value === "joined";
    for (const c of channelsRef.value) {
      const ok = showJoined ? c.joined : !c.joined;
      if (ok) base.push(c);
    }
    if (!needle) return base;
    const filtered: ChatChannel[] = [];
    for (const c of base) {
      if (c.name.toLowerCase().includes(needle) || c.id.toLowerCase().includes(needle)) filtered.push(c);
    }
    return filtered;
  });

  const currentMessages = computed(() => messagesByChannel[currentChannelId.value] ?? []);
  const currentChannelHasMore = computed(() => Boolean(hasMoreByChannel[currentChannelId.value]));
  const currentChannelLoadingMore = computed(() => loadingMoreMessages.value);
  const currentChannelLastReadTimeMs = computed(() => lastReadTimeMsByChannel[currentChannelId.value] ?? 0);

  /**
   * 若已连接 WS，则关闭连接。
   *
   * @returns void
   */
  function closeWs(): void {
    if (!wsClient) return;
    wsClient.close();
    wsClient = null;
    wsKey = "";
  }

  /**
   * 若正在进行 HTTP 轮询（WS 降级模式），则停止轮询。
   *
   * @returns void
   */
  function stopPolling(): void {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
    pollKey = "";
    pollInFlight = false;
  }

  /**
   * 停止“按 server 维度”的会话钩子（自动刷新 + 会话监听）。
   *
   * @returns void
   */
  function stopSessionHooks(): void {
    if (stopAutoRefresh) stopAutoRefresh();
    if (stopSessionListener) stopSessionListener();
    stopAutoRefresh = null;
    stopSessionListener = null;
  }

  /**
   * 获取当前 server socket 与可用 access token。
   *
   * 若本地 token 接近过期且存在 refresh_token，会优先尝试刷新，避免立刻鉴权失败。
   *
   * @returns 二元组 `[socket, token]`（均已 trim）。
   */
  async function getSocketAndValidToken(): Promise<[string, string]> {
    const socket = currentServerSocket.value.trim();
    if (!socket) return ["", ""];
    const token = (await ensureValidAccessToken(socket)).trim() || readAuthToken(socket).trim();
    return [socket, token];
  }

  /**
   * 从服务端刷新频道列表 + 未读数据。
   *
   * @returns Promise<void>。
   */
  async function refreshChannels(): Promise<void> {
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    const list = await deps.api.listChannels(socket, token);
    const unreads = await deps.api.getUnreads(socket, token).catch(() => [] as UnreadItemDto[]);
    const unreadByCid: Record<string, { unread: number; lastReadTime: number }> = {};
    for (const x of unreads) {
      unreadByCid[String(x.cid ?? "").trim()] = { unread: Number(x.unread_count ?? 0), lastReadTime: Number(x.last_read_time ?? 0) };
    }

    const next: ChatChannel[] = [];
    for (const c of list) {
      const cid = String(c.cid ?? "").trim();
      if (!cid) continue;
      const u = unreadByCid[cid];
      if (u && Number.isFinite(u.lastReadTime)) lastReadTimeMsByChannel[cid] = u.lastReadTime;
      next.push({
        id: cid,
        name: String(c.name ?? cid).trim() || cid,
        brief: String(c.brief ?? "").trim(),
        unread: u ? Math.max(0, Math.trunc(u.unread)) : 0,
        joined: true,
        joinRequested: false,
      });
    }
    channelsRef.value = next;
  }

  /**
   * 加载某频道的最新消息（首屏）。
   *
   * @param cid - 频道 id。
   * @returns Promise<void>。
   */
  async function loadChannelMessages(cid: string): Promise<void> {
    const [socket, token] = await getSocketAndValidToken();
    const channelId = String(cid).trim();
    if (!socket || !token || !channelId) return;

    const res: ListMessagesResponseDto = await deps.api.listChannelMessages(socket, token, channelId, undefined, 50);
    const items = Array.isArray(res.items) ? res.items : [];
    const mapped: ChatMessage[] = [];
    for (const m of items) mapped.push(mapWireMessage(socket, m));
    messagesByChannel[channelId] = mergeMessages([], mapped);

    const nextCursor = String(res.next_cursor ?? "").trim();
    const hasMore = Boolean(res.has_more);
    nextCursorByChannel[channelId] = nextCursor;
    hasMoreByChannel[channelId] = hasMore && Boolean(nextCursor);
  }

  /**
   * 刷新某频道的最新页消息（不会清空已加载的历史页）。
   *
   * 用于 WS catch-up 与 polling 降级模式。
   *
   * @param cid - 频道 id。
   * @returns Promise<void>
   */
  async function refreshChannelLatestPage(cid: string): Promise<void> {
    const [socket, token] = await getSocketAndValidToken();
    const channelId = String(cid).trim();
    if (!socket || !token || !channelId) return;

    const res: ListMessagesResponseDto = await deps.api.listChannelMessages(socket, token, channelId, undefined, 50);
    const items = Array.isArray(res.items) ? res.items : [];
    const mapped: ChatMessage[] = [];
    for (const m of items) mapped.push(mapWireMessage(socket, m));

    const existing = messagesByChannel[channelId] ?? [];
    messagesByChannel[channelId] = mergeMessages(existing, mapped);

    // 仅在分页状态尚未初始化时写入（避免覆盖用户已拉取的历史分页状态）。
    if (!(channelId in nextCursorByChannel) || !(channelId in hasMoreByChannel)) {
      const nextCursor = String(res.next_cursor ?? "").trim();
      const hasMore = Boolean(res.has_more);
      nextCursorByChannel[channelId] = nextCursor;
      hasMoreByChannel[channelId] = hasMore && Boolean(nextCursor);
    }
  }

  /**
   * 刷新某频道的成员侧栏（尽力而为）。
   *
   * @param cid - 频道 id。
   * @returns Promise<void>
   */
  async function refreshMembersRail(cid: string): Promise<void> {
    const channelId = String(cid).trim();
    if (!channelId) return;
    try {
      const list = await listMembers(channelId);
      const out: ChatMember[] = [];
      for (const m of list) {
        const role = m.role === "owner" || m.role === "admin" ? (m.role as "owner" | "admin") : "member";
        out.push({ id: m.uid, name: m.nickname || `u:${String(m.uid).slice(-6)}`, role });
      }
      members.value = out;
    } catch {
      members.value = [];
    }
  }

  /**
   * 以 cursor 分页方式加载当前频道更早的历史消息。
   *
   * @returns Promise<void>
   */
  async function loadMoreMessages(): Promise<void> {
    const channelId = currentChannelId.value.trim();
    if (!channelId) return;
    if (loadingMoreMessages.value) return;
    if (!hasMoreByChannel[channelId]) return;

    const cursor = String(nextCursorByChannel[channelId] ?? "").trim();
    if (!cursor) {
      hasMoreByChannel[channelId] = false;
      return;
    }

    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    loadingMoreMessages.value = true;
    try {
      const res: ListMessagesResponseDto = await deps.api.listChannelMessages(socket, token, channelId, cursor, 50);
      const items = Array.isArray(res.items) ? res.items : [];
      const mapped: ChatMessage[] = [];
      for (const m of items) mapped.push(mapWireMessage(socket, m));

      const existing = messagesByChannel[channelId] ?? [];
      messagesByChannel[channelId] = mergeMessages(existing, mapped);

      const nextCursor = String(res.next_cursor ?? "").trim();
      const hasMore = Boolean(res.has_more);
      nextCursorByChannel[channelId] = nextCursor;
      hasMoreByChannel[channelId] = hasMore && Boolean(nextCursor);
    } finally {
      loadingMoreMessages.value = false;
    }
  }

  /**
   * 处理 WS 事件（P0）。
   *
   * @param env - WS event envelope。
   * @returns void。
   */
  function handleWsEvent(env: WsEventDto): void {
    const eventType = String(env.event_type ?? "").trim();
    const payload = env.payload as Record<string, unknown> | null;

    if (eventType === "channels.changed") {
      void refreshChannels();
      return;
    }

    if (eventType === "channel.changed") {
      const cid = String(payload?.cid ?? "").trim();
      const scope = String(payload?.scope ?? "").trim();
      void refreshChannels();
      if (cid) dispatchChannelChanged(cid, scope);
      if (cid && cid === currentChannelId.value) {
        // 最小对齐：根据 scope 做尽力刷新（避免过度补拉）。
        if (!scope || scope === "messages") void refreshChannelLatestPage(cid);
        if (!scope || scope === "members") void refreshMembersRail(cid);
      }
      return;
    }

    if (eventType === "message.created") {
      const cid = String(payload?.cid ?? "").trim();
      const msg = (payload?.message ?? null) as MessageDto | null;
      if (!cid || !msg) return;
      const mapped = mapWireMessage(currentServerSocket.value.trim(), msg);
      const list = messagesByChannel[cid] ?? (messagesByChannel[cid] = []);
      if (!list.some((x) => x.id === mapped.id)) {
        list.push(mapped);
        list.sort(compareMessages);
      }
      const ch = channelsRef.value.find((x) => x.id === cid);
      if (ch && currentChannelId.value !== cid) ch.unread += 1;
      return;
    }

    if (eventType === "message.deleted") {
      const cid = String(payload?.cid ?? "").trim();
      const mid = String(payload?.mid ?? "").trim();
      if (!cid || !mid) return;
      const list = messagesByChannel[cid] ?? [];
      const idx = list.findIndex((m) => m.id === mid);
      if (idx >= 0) list.splice(idx, 1);
      return;
    }

    if (eventType === "read_state.updated") {
      const cid = String(payload?.cid ?? "").trim();
      const uid = String(payload?.uid ?? "").trim();
      const t = Number(payload?.last_read_time ?? 0);
      if (!cid || !uid || !Number.isFinite(t)) return;
      lastReadTimeMsByChannel[cid] = t;
      if (uid === currentUser.id) {
        const ch = channelsRef.value.find((x) => x.id === cid);
        if (ch && currentChannelId.value === cid) ch.unread = 0;
      }
      return;
    }

    logger.debug("WS event ignored", { eventType });
  }

  /**
   * 当 WS resume 失败后，执行一次“尽力而为”的 HTTP 补拉。
   *
   * 协议约定：收到 `resume.failed` 后，客户端必须走 HTTP 补拉（频道列表/未读/消息等）。
   *
   * 本实现策略：
   * - `refreshChannels()`：刷新频道列表与未读计数
   * - 当前频道：刷新最新页
   * - 少量未读频道：刷新最新页（恢复上下文；限制上限避免风暴）
   *
   * @param socketKey - resume 失败对应的 server socket key。
   * @param reason - 服务端返回的失败原因。
   * @returns Promise<void>
   */
  async function catchUpAfterResumeFailed(socketKey: string, reason: string): Promise<void> {
    const key = String(socketKey ?? "").trim();
    if (!key) return;
    if (currentServerSocket.value.trim() !== key) return;

    logger.warn("HTTP catch-up after resume.failed", { socket: key, reason });

    await refreshChannels();
    if (currentServerSocket.value.trim() !== key) return;

    const ordered: string[] = [];
    const seen = new Set<string>();

    const current = currentChannelId.value.trim();
    if (current) {
      ordered.push(current);
      seen.add(current);
    }

    // 尽力而为：预取少量未读频道，恢复上下文（限制 fan-out，避免风暴）。
    for (const c of channelsRef.value) {
      if (ordered.length >= CATCH_UP_PREFETCH_LIMIT) break;
      const cid = String(c.id ?? "").trim();
      if (!cid || seen.has(cid)) continue;
      if ((c.unread ?? 0) <= 0) continue;
      ordered.push(cid);
      seen.add(cid);
    }

    for (const cid of ordered) {
      if (currentServerSocket.value.trim() !== key) return;
      try {
        await refreshChannelLatestPage(cid);
      } catch (e) {
        logger.warn("Catch-up: refreshChannelLatestPage failed", { cid, error: String(e) });
      }
    }

    if (current && currentServerSocket.value.trim() === key) void refreshMembersRail(current);
  }

  /**
   * 确保当前 server 的聊天数据与 WS/轮询链路已就绪。
   *
   * 该函数可被重复调用（幂等/可重入的“尽力而为”语义）。
   *
   * @returns Promise<void>。
   */
  async function ensureChatReady(): Promise<void> {
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    // 为当前 socket 绑定一次“自动刷新 token + WS reauth”。
    if (!stopAutoRefresh) stopAutoRefresh = startAuthSessionAutoRefresh(socket).stop;
    if (!stopSessionListener) {
      stopSessionListener = onAuthSessionChanged(socket, (s) => {
        const next = s?.accessToken ?? "";
        if (next && wsClient && wsKey === socket) wsClient.reauth(next);
      });
    }

    await refreshChannels();

    if (!currentChannelId.value) currentChannelId.value = channelsRef.value[0]?.id ?? "";
    if (currentChannelId.value) {
      await loadChannelMessages(currentChannelId.value);
      void refreshMembersRail(currentChannelId.value);
    }

    const key = socket;

    const tls = getTlsConfigForSocket(key);
    const origin = toHttpOrigin(key);
    const shouldDisableWs = origin.startsWith("https://") && tls.tlsPolicy !== "strict";

    if (shouldDisableWs) {
      // WebView WebSocket 无法绕过证书校验；此处降级为 HTTP 轮询。
      closeWs();
      if (pollTimer && pollKey === key) return;
      stopPolling();
      pollKey = key;
      logger.info("WS disabled by TLS policy; starting polling fallback", { socket: key, tlsPolicy: tls.tlsPolicy });
      pollTimer = setInterval(() => {
        if (pollInFlight) return;
        pollInFlight = true;
        void (async () => {
          try {
            if (currentServerSocket.value.trim() !== key) return;
            await refreshChannels();
            const cid = currentChannelId.value.trim();
            if (cid) await refreshChannelLatestPage(cid);
          } finally {
            pollInFlight = false;
          }
        })();
      }, POLL_INTERVAL_MS);
      return;
    }

    // TLS strict（或非 HTTPS）模式：使用 WS。
    stopPolling();
    if (wsClient && wsKey === key) return;
    closeWs();
    wsKey = key;
    logger.info("WS connect", { socket: key });
    const wsUrlOverride = String(useServerInfoStore(key).info.value?.wsUrl ?? "").trim() || undefined;
    wsClient = deps.events.connect(key, token, handleWsEvent, {
      wsUrlOverride,
      onResumeFailed: (reason) => {
        void catchUpAfterResumeFailed(key, reason);
      },
      onAuthError: () => {
        closeWs();
        void ensureChatReady();
      },
    });
  }

  /**
   * 供 composer 使用的 domain 列表：Core + 已启用插件 domains。
   *
   * @returns domain 列表。
   */
  function availableDomains(): MessageDomain[] {
    const socket = currentServerSocket.value.trim();
    const catalog = usePluginCatalogStore(socket).catalog.value;
    const install = usePluginInstallStore(socket).installedById;

    const enabledDomains: MessageDomain[] = [];
    for (const p of catalog) {
      const st = install[p.pluginId];
      const ok = Boolean(st?.enabled) && st?.status === "ok";
      if (!ok) continue;
      for (const d of p.providesDomains) enabledDomains.push({ ...d, pluginIdHint: p.pluginId });
    }

    const core: MessageDomain = { id: "Core:Text", label: "Core:Text", colorVar: "--cp-domain-core", pluginIdHint: "core.text", version: "1.0.0" };
    const unique = new Map<string, MessageDomain>();
    unique.set(core.id, core);
    for (const d of enabledDomains) unique.set(d.id, d);
    return Array.from(unique.values());
  }

  /**
   * 在指定频道内按 id 查找消息。
   *
   * @param channelId - 频道 id。
   * @param messageId - 消息 id。
   * @returns 找到时返回消息；否则返回 `null`。
   */
  function getMessageById(channelId: string, messageId: string): ChatMessage | null {
    const list = messagesByChannel[channelId] ?? [];
    for (const m of list) {
      if (m.id === messageId) return m;
    }
    return null;
  }

  /**
   * 切换到指定频道，并刷新最新消息与成员侧栏。
   *
   * @param id - 目标频道 id。
   * @returns Promise<void>。
   */
  async function selectChannel(id: string): Promise<void> {
    const cid = String(id).trim();
    if (!cid) return;
    currentChannelId.value = cid;

    const ch = channelsRef.value.find((x) => x.id === cid);
    const prevUnread = ch?.unread ?? 0;
    if (ch) ch.unread = 0;

    await loadChannelMessages(cid);
    void refreshMembersRail(cid);

    const list = messagesByChannel[cid] ?? [];
    const last = list[list.length - 1];
    const lastMid = last?.id ? String(last.id) : "";
    if (lastMid) {
      const now = Date.now();
      const prevReadTime = Number(lastReadTimeMsByChannel[cid] ?? 0);
      const nextReadTime = Math.max(now, prevReadTime + 1);
      lastReadTimeMsByChannel[cid] = nextReadTime;

      const lastReportAt = Number(lastReadReportAtMsByChannel[cid] ?? 0);
      const shouldReport =
        (prevUnread > 0 || prevReadTime <= 0 || now - lastReportAt > 60_000) &&
        now - lastReportAt > 1500;
      const [socket, token] = await getSocketAndValidToken();
      if (socket && token && shouldReport) {
        const req: ReadStateRequestDto = { last_read_mid: lastMid, last_read_time: nextReadTime };
        void deps.api.updateReadState(socket, token, cid, req);
        lastReadReportAtMsByChannel[cid] = now;
      }
    }
  }

  /**
   * 上报当前频道的读状态（尽力而为）。
   *
   * 预期触发点：
   * - 用户滚动到消息底部
   * - 窗口重新获得焦点且仍在底部
   *
   * 本函数保证：
   * - 节流（避免频繁请求）
   * - `last_read_time` 单调递增（只前进）
   *
   * @returns Promise<void>。
   */
  async function reportCurrentReadState(): Promise<void> {
    const cid = currentChannelId.value.trim();
    if (!cid) return;
    const list = messagesByChannel[cid] ?? [];
    const last = list[list.length - 1] ?? null;
    const lastMid = last?.id ? String(last.id) : "";
    if (!lastMid) return;

    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    const now = Date.now();
    const prevReadTime = Number(lastReadTimeMsByChannel[cid] ?? 0);
    const nextReadTime = Math.max(now, prevReadTime + 1);
    lastReadTimeMsByChannel[cid] = nextReadTime;

    const lastReportAt = Number(lastReadReportAtMsByChannel[cid] ?? 0);
    if (now - lastReportAt <= 1500) return;
    lastReadReportAtMsByChannel[cid] = now;
    void deps.api.updateReadState(socket, token, cid, { last_read_mid: lastMid, last_read_time: nextReadTime });
  }

  /**
   * 申请加入频道（或加入已公开频道，具体行为由服务端决定）。
   *
   * @param channelId - 目标频道 id。
   * @returns Promise<void>
   */
  async function applyJoin(channelId: string): Promise<void> {
    const cid = String(channelId).trim();
    if (!cid) return;
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    const target = channelsRef.value.find((c) => c.id === cid);
    if (target) target.joinRequested = true;
    try {
      await deps.api.applyJoinChannel(socket, token, cid, "");
      await refreshChannels();
    } finally {
      if (target) target.joinRequested = false;
    }
  }

  /**
   * 更新频道元信息（名称/简介）。
   *
   * @param channelId - 频道 id。
   * @param patch - 要更新的部分字段。
   * @returns Promise<void>
   */
  async function updateChannelMeta(channelId: string, patch: Partial<Pick<ChatChannel, "name" | "brief">>): Promise<void> {
    const cid = String(channelId).trim();
    if (!cid) return;
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    const next: ChannelDto = await deps.api.patchChannel(socket, token, cid, { name: patch.name, brief: patch.brief });
    const ch = channelsRef.value.find((c) => c.id === cid);
    if (!ch) return;
    if (typeof next.name === "string") ch.name = next.name.trim() || ch.name;
    if (typeof next.brief === "string") ch.brief = String(next.brief ?? "").trim();
  }

  /**
   * 进入回复模式（引用某条消息）。
   *
   * @param messageId - 要回复的消息 id。
   * @returns void
   */
  function startReply(messageId: string): void {
    replyToMessageId.value = messageId;
    sendError.value = "";
  }

  /**
   * 退出回复模式（不发送）。
   *
   * @returns void
   */
  function cancelReply(): void {
    replyToMessageId.value = "";
  }

  /**
   * 按消息 id 硬删除消息（hard-delete）。
   *
   * @param messageId - 消息 id（mid）。
   * @returns Promise<void>
   */
  async function deleteMessage(messageId: string): Promise<void> {
    const mid = String(messageId).trim();
    if (!mid) return;
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    const cid = currentChannelId.value;
    const list = messagesByChannel[cid] ?? [];
    const idx = list.findIndex((m) => m.id === mid);
    const removed = idx >= 0 ? list.splice(idx, 1)[0] : null;

    try {
      await deps.api.deleteMessage(socket, token, mid);
    } catch (e) {
      if (removed && idx >= 0) list.splice(idx, 0, removed);
      sendError.value = `Delete failed: ${String(e)}`;
      throw e;
    }
  }

  /**
   * 向当前频道发送消息。
   *
   * 支持两种模式：
   * - Core:Text：使用当前 `composerDraft` 作为 `{ text }` 发送。
   * - 插件模式：由插件 composer 提供完整 payload `{ domain, domain_version, data }`。
   *
   * @param payload - 可选插件 payload。
   * @returns Promise<void>。
   */
  async function sendComposerMessage(payload?: Parameters<ChatStore["sendComposerMessage"]>[0]): Promise<void> {
    const uiDomain = selectedDomainId.value.trim();
    const replyToMid = replyToMessageId.value.trim() || undefined;

    const isCoreText = uiDomain === "Core:Text";
    const text = composerDraft.value.trim();

    if (!payload && isCoreText && !text) return;
    if (!payload && !isCoreText) {
      sendError.value = "This domain requires a plugin composer.";
      return;
    }

    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) {
      sendError.value = "Not signed in.";
      return;
    }

    const cid = currentChannelId.value;
    if (!cid) {
      sendError.value = "No channel selected.";
      return;
    }

    sendError.value = "";

    const apiDomain = payload ? String(payload.domain ?? "").trim() : uiDomain;
    const apiVersion = payload ? String(payload.domain_version ?? "").trim() : "1.0.0";
    const data = payload ? payload.data : { text };
    const finalReplyToMid = payload?.reply_to_mid ? String(payload.reply_to_mid).trim() : replyToMid;
    if (!apiDomain) {
      sendError.value = "Missing domain.";
      return;
    }
    if (!apiVersion) {
      sendError.value = "Missing domain_version.";
      return;
    }

    /**
     * 生成发送消息的幂等键（用于重试去重）。
     *
     * @returns 幂等键字符串。
     */
    function createIdempotencyKey(): string {
      const v = globalThis.crypto?.randomUUID?.();
      if (typeof v === "string" && v.trim()) return v;
      return `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }

    try {
      const req: SendMessageRequestDto = { domain: apiDomain, domain_version: apiVersion, data, reply_to_mid: finalReplyToMid };
      const created = await deps.api.sendChannelMessage(socket, token, cid, req, createIdempotencyKey());
      const mapped = mapWireMessage(socket, created);
      const list = messagesByChannel[cid] ?? (messagesByChannel[cid] = []);
      list.push(mapped);
      replyToMessageId.value = "";
      if (!payload) composerDraft.value = "";
      const now = Date.now();
      const prevReadTime = Number(lastReadTimeMsByChannel[cid] ?? 0);
      const nextReadTime = Math.max(now, prevReadTime + 1);
      lastReadTimeMsByChannel[cid] = nextReadTime;

      const lastReportAt = Number(lastReadReportAtMsByChannel[cid] ?? 0);
      if (now - lastReportAt > 1500) {
        void deps.api.updateReadState(socket, token, cid, { last_read_mid: mapped.id, last_read_time: nextReadTime });
        lastReadReportAtMsByChannel[cid] = now;
      }
    } catch (e) {
      sendError.value = String(e) || "Send failed.";
      throw e;
    }
  }

  watch(
    () => currentServerSocket.value,
    () => {
      closeWs();
      stopPolling();
      stopSessionHooks();
      channelsRef.value = [];
      members.value = [];
      currentChannelId.value = "";
      for (const k of Object.keys(messagesByChannel)) delete messagesByChannel[k];
      for (const k of Object.keys(lastReadTimeMsByChannel)) delete lastReadTimeMsByChannel[k];
      for (const k of Object.keys(nextCursorByChannel)) delete nextCursorByChannel[k];
      for (const k of Object.keys(hasMoreByChannel)) delete hasMoreByChannel[k];
      loadingMoreMessages.value = false;
      sendError.value = "";
      composerDraft.value = "";
      replyToMessageId.value = "";
      selectedDomainId.value = "Core:Text";
    },
  );

  // ============================================================================
  // 频道管理相关方法
  // ============================================================================

  /**
   * 将 API member 映射为展示层类型。
   *
   * @param m - API member。
   * @returns 展示层 member。
   */
  function mapApiMember(m: ApiChannelMember): ChannelMember {
    return {
      uid: String(m.uid ?? "").trim(),
      nickname: String(m.nickname ?? "").trim(),
      avatar: m.avatar,
      role: String(m.role ?? "member").trim() as ChannelMember["role"],
      joinTime: Number(m.join_time ?? 0),
    };
  }

  /**
   * 将 API application 映射为展示层类型。
   *
   * @param a - API application。
   * @returns 展示层 application。
   */
  function mapApiApplication(a: ApiChannelApplication): ChannelApplication {
    return {
      applicationId: String(a.application_id ?? "").trim(),
      cid: String(a.cid ?? "").trim(),
      uid: String(a.uid ?? "").trim(),
      reason: String(a.reason ?? "").trim(),
      applyTime: Number(a.apply_time ?? 0),
      status: String(a.status ?? "pending").trim() as ChannelApplication["status"],
    };
  }

  /**
   * 将 API ban 映射为展示层类型。
   *
   * @param b - API ban。
   * @returns 展示层 ban。
   */
  function mapApiBan(b: ApiChannelBan): ChannelBan {
    return {
      cid: String(b.cid ?? "").trim(),
      uid: String(b.uid ?? "").trim(),
      until: Number(b.until ?? 0),
      reason: String(b.reason ?? "").trim(),
      createTime: Number(b.create_time ?? 0),
    };
  }

  /**
   * 将 API channel 映射为展示层类型。
   *
   * @param c - API channel。
   * @returns 展示层 channel。
   */
  function mapApiChannel(c: ApiChannel): ChatChannel {
    const cid = String(c.cid ?? "").trim();
    return {
      id: cid,
      name: String(c.name ?? cid).trim() || cid,
      brief: String(c.brief ?? "").trim(),
      unread: 0,
      joined: true,
      joinRequested: false,
    };
  }

  /**
   * 列出频道成员列表。
   *
   * @param channelId - 频道 id。
   * @returns Promise<ChannelMember[]>。
   */
  async function listMembers(channelId: string): Promise<ChannelMember[]> {
    const cid = String(channelId).trim();
    if (!cid) return [];
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return [];

    const list = await httpListChannelMembers(socket, token, cid);
    return list.map(mapApiMember);
  }

  /**
   * 将成员踢出频道。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @returns Promise<void>。
   */
  async function kickMember(channelId: string, uid: string): Promise<void> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid || !userId) return;
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    await httpKickChannelMember(socket, token, cid, userId);
  }

  /**
   * 将用户设为管理员。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @returns Promise<void>。
   */
  async function setAdmin(channelId: string, uid: string): Promise<void> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid || !userId) return;
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    await httpAddChannelAdmin(socket, token, cid, userId);
  }

  /**
   * 撤销用户管理员身份。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @returns Promise<void>。
   */
  async function removeAdmin(channelId: string, uid: string): Promise<void> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid || !userId) return;
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    await httpRemoveChannelAdmin(socket, token, cid, userId);
  }

  /**
   * 列出频道入群申请列表。
   *
   * @param channelId - 频道 id。
   * @returns Promise<ChannelApplication[]>。
   */
  async function listApplications(channelId: string): Promise<ChannelApplication[]> {
    const cid = String(channelId).trim();
    if (!cid) return [];
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return [];

    const list = await httpListChannelApplications(socket, token, cid);
    return list.map(mapApiApplication);
  }

  /**
   * 审批（通过/拒绝）入群申请。
   *
   * @param channelId - 频道 id。
   * @param applicationId - 申请 id。
   * @param approved - 是否通过。
   * @returns Promise<void>。
   */
  async function decideApplication(channelId: string, applicationId: string, approved: boolean): Promise<void> {
    const cid = String(channelId).trim();
    const aid = String(applicationId).trim();
    if (!cid || !aid) return;
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    await httpDecideChannelApplication(socket, token, cid, aid, approved ? "approve" : "reject");
  }

  /**
   * 列出频道禁言列表。
   *
   * @param channelId - 频道 id。
   * @returns Promise<ChannelBan[]>。
   */
  async function listBans(channelId: string): Promise<ChannelBan[]> {
    const cid = String(channelId).trim();
    if (!cid) return [];
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return [];

    const list = await httpListChannelBans(socket, token, cid);
    return list.map(mapApiBan);
  }

  /**
   * 对频道成员设置禁言。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @param until - 禁言截止时间戳（ms；0 表示永久）。
   * @param reason - 禁言原因。
   * @returns Promise<void>。
   */
  async function setBan(channelId: string, uid: string, until: number, reason: string): Promise<void> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid || !userId) return;
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    await httpPutChannelBan(socket, token, cid, userId, until, reason);
  }

  /**
   * 解除用户禁言。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @returns Promise<void>。
   */
  async function removeBan(channelId: string, uid: string): Promise<void> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid || !userId) return;
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    await httpDeleteChannelBan(socket, token, cid, userId);
  }

  /**
   * 创建频道。
   *
   * @param name - 频道名称。
   * @param brief - 频道简介。
   * @returns Promise<ChatChannel>。
   */
  async function createChannel(name: string, brief?: string): Promise<ChatChannel> {
    const channelName = String(name ?? "").trim();
    if (!channelName) throw new Error("Channel name is required");
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) throw new Error("Not signed in");

    const created = await httpCreateChannel(socket, token, { name: channelName, brief });
    await refreshChannels();
    return mapApiChannel(created);
  }

  /**
   * 删除频道。
   *
   * @param channelId - 频道 id。
   * @returns Promise<void>。
   */
  async function deleteChannel(channelId: string): Promise<void> {
    const cid = String(channelId).trim();
    if (!cid) return;
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    await httpDeleteChannel(socket, token, cid);
    await refreshChannels();

    if (currentChannelId.value === cid) {
      currentChannelId.value = channelsRef.value[0]?.id ?? "";
    }
  }

  return {
    channels,
    allChannels,
    channelSearch,
    channelTab,
    composerDraft,
    selectedDomainId,
    replyToMessageId,
    sendError,
    currentChannelId,
    currentMessages,
    currentChannelHasMore,
    loadingMoreMessages: currentChannelLoadingMore,
    currentChannelLastReadTimeMs,
    members,
    ensureChatReady,
    availableDomains,
    getMessageById,
    selectChannel,
    reportCurrentReadState,
    loadMoreMessages,
    applyJoin,
    updateChannelMeta,
    startReply,
    cancelReply,
    deleteMessage,
    sendComposerMessage,
    // 频道管理
    listMembers,
    kickMember,
    setAdmin,
    removeAdmin,
    listApplications,
    decideApplication,
    listBans,
    setBan,
    removeBan,
    createChannel,
    deleteChannel,
  };
}
