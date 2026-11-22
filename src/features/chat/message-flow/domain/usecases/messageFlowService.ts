/**
 * @fileoverview message-flow application service。
 * @description
 * 该对象是 message-flow 子域在 application 层的唯一主服务。
 *
 * 它统一持有三类消息流语义：
 * - composer 语义：回复态、发送、错误回写
 * - timeline 语义：最新页加载、历史翻页、分页状态推进
 * - command 语义：删除消息与乐观更新回滚
 *
 * 这样 runtime 不需要再分别拼装多个零散 action/paging factory。
 */

import { compareMessages, dedupeMessages } from "../mappers/messageModel";
import { compareMessageIdForReadOrder } from "@/features/chat/domain/utils/readMarker";
import type { ChatMessagePage, ChatMessageRecord, ChatSendMessageInput } from "@/features/chat/domain/types/chatApiModels";
import type {
  ChatMessage,
  ComposerSubmitPayload,
  MentionCandidate,
  MessageSearchResult,
  RecallChatMessageOutcome,
  SendChatMessageOutcome,
} from "@/features/chat/message-flow/domain/contracts";
import { createMessageActionError, rejectMessageAction } from "../outcomes/messageActionOutcome";
import type {
  MessageComposerStatePort,
  MessageFlowApiPort,
  MessageFlowScopePort,
  MessageTimelineStatePort,
  ReadStateReporterPort,
} from "../ports";

type MapWireMessage = (serverSocket: string, msg: ChatMessageRecord) => ChatMessage;
type MergeMessages = (existing: ChatMessage[], incoming: ChatMessage[]) => Promise<ChatMessage[]>;

const LATEST_PAGE_LIMIT = 20;
const CONTEXT_LIMIT = 25;

/**
 * `MessageFlowApplicationService` 的依赖集合。
 *
 * 这些依赖刻意分成“远端动作 / 作用域 / 本地状态 / 纯映射函数”四类，
 * 便于阅读时快速判断某段逻辑在做什么。
 */
export type MessageFlowApplicationServiceDeps = {
  api: MessageFlowApiPort;
  scope: MessageFlowScopePort;
  timelineState: MessageTimelineStatePort;
  composerState: MessageComposerStatePort;
  mapWireMessage: MapWireMessage;
  mergeMessages: MergeMessages;
  readStateReporter: ReadStateReporterPort;
  currentUserId: string;
};

type LatestPage = {
  requestSocket: string;
  requestScopeVersion: number;
  channelId: string;
  mapped: ChatMessage[];
  nextCursor: string;
  hasMore: boolean;
};

/**
 * message-flow application service。
 *
 * 约束：
 * - 不依赖 Vue/ref/reactive；
 * - 不直接暴露内部状态容器；
 * - 所有写入都通过命名 state port 完成。
 */
export class MessageFlowApplicationService {
  private searchSeq = 0;
  private contextSeq = 0;

  constructor(private readonly deps: MessageFlowApplicationServiceDeps) {}

  /**
   * Worker 合并完成后覆盖前再读一次时间线，避免合并期间到达的新消息被冲掉。
   *
   * @param replaceExisting - true 时以 incoming 覆盖旧时间线（仅保留合并期间新到达的消息）。
   */
  private async replaceTimelineMerged(
    channelId: string,
    incoming: ChatMessage[],
    replaceExisting: boolean,
    shouldApply: () => boolean,
  ): Promise<boolean> {
    const existing = [...this.deps.timelineState.listMessages(channelId)];
    const before = new Map(existing.map((message) => [message.id, message]));
    // 即时撤回若未由 HTTP DTO 显式表示，仍保留本次会话中已经确认的撤回态。
    const page = incoming.map((message) => {
      const old = before.get(message.id);
      return old?.recalledAt && !message.recalledAt ? old : message;
    });
    const incomingIds = new Set(page.map((message) => message.id));
    const base = replaceExisting ? [] : existing.filter((message) => !incomingIds.has(message.id));
    const merged = await this.deps.mergeMessages(base, page);
    if (!shouldApply()) return false;
    const latest = this.deps.timelineState.listMessages(channelId);
    const updates = new Map(latest.filter((message) => before.get(message.id) !== message).map((message) => [message.id, message]));
    for (const message of merged) {
      const update = updates.get(message.id);
      updates.set(message.id, update?.recalledAt || (!message.recalledAt && update) ? update : message);
    }
    this.deps.timelineState.replaceTimeline(channelId, [...updates.values()].sort(compareMessages));
    return true;
  }

  /**
   * 进入回复态，并清空上一次动作错误。
   */
  startReply(message: ChatMessage): void {
    const preview = message.kind === "core_text" ? message.text : message.preview;
    this.deps.composerState.setReplyDraft({
      messageId: message.id,
      senderName: message.from.name,
      preview,
      createdAt: message.timeMs,
    });
    this.deps.composerState.writeActionError(null);
  }

  /**
   * 退出回复态。
   */
  cancelReply(): void {
    this.deps.composerState.clearReplyDraft();
  }

  /**
   * 发送一条消息。
   *
   * 支持两种路径：
   * - `payload` 为空时，按当前 composer draft 发送 Core:Text
   * - `payload` 存在时，按插件/结构化 composer 结果发送
   *
   * 返回值始终是显式 `Outcome`，而不是依赖异常表达业务失败。
   */
  async sendComposerMessage(payload?: ComposerSubmitPayload): Promise<SendChatMessageOutcome> {
    const uiDomain = this.deps.composerState.readSelectedDomainId();
    const replyDraft = this.deps.composerState.readReplyDraft();
    const quoteReply = payload?.quoteReply ?? this.deps.composerState.readQuoteReplyDraft();

    const isCoreText = uiDomain === "Core:Text";
    const text = this.deps.composerState.readDraft().trim();

    if (!payload && isCoreText && !text) {
      return rejectMessageAction("chat_message_send_rejected", "missing_message_payload", "Missing message payload.");
    }
    if (!payload && !isCoreText) {
      const error = createMessageActionError("plugin_composer_required", "This domain requires a plugin composer.");
      this.deps.composerState.writeActionError(error);
      return { ok: false, kind: "chat_message_send_rejected", error };
    }

    const [socket, token] = await this.deps.scope.getSocketAndValidToken();
    if (!socket || !token) {
      const error = createMessageActionError("not_signed_in", "Not signed in.");
      this.deps.composerState.writeActionError(error);
      return { ok: false, kind: "chat_message_send_rejected", error };
    }
    const requestSocket = socket;
    const requestScopeVersion = this.deps.scope.getActiveScopeVersion();

    const cid = this.deps.timelineState.readCurrentChannelId();
    if (!cid) {
      const error = createMessageActionError("channel_not_selected", "No channel selected.");
      this.deps.composerState.writeActionError(error);
      return { ok: false, kind: "chat_message_send_rejected", error };
    }

    this.deps.composerState.writeActionError(null);

    // A payload carrying only linkPreview (no domain/data) should not override
    // the composer state — it is not a "real" plugin payload.
    const hasRealPayload = !!(payload && (String(payload.domain ?? "").trim() || payload.data !== undefined));
    const apiDomain = hasRealPayload ? String(payload.domain ?? "").trim() : uiDomain;
    const apiVersion = hasRealPayload ? String(payload.domainVersion ?? "").trim() : "1.0.0";
    const data = hasRealPayload ? payload.data : { text };
    const finalReplyToMid = payload?.replyToMessageId ? String(payload.replyToMessageId).trim() : replyDraft?.messageId;
    if (!apiDomain) {
      const error = createMessageActionError("missing_domain", "Missing domain.");
      this.deps.composerState.writeActionError(error);
      return { ok: false, kind: "chat_message_send_rejected", error };
    }
    if (!apiVersion) {
      const error = createMessageActionError("missing_domain_version", "Missing domainVersion.");
      this.deps.composerState.writeActionError(error);
      return { ok: false, kind: "chat_message_send_rejected", error };
    }

    try {
      const mentions = payload?.mentions ?? this.deps.composerState.listDraftMentions().map((m) => ({ userId: m.userId, displayName: m.displayName, type: m.type }));

      const replyId = finalReplyToMid || quoteReply?.messageId;
      const req: ChatSendMessageInput = {
        domain: apiDomain,
        domainVersion: apiVersion,
        data,
        mentions: mentions.length > 0 ? mentions : undefined,
        replyToMessageId: replyId,
      };
      const created = await this.deps.api.sendChannelMessage(socket, token, cid, req);
      const mapped = this.deps.mapWireMessage(socket, created);
      if (this.isScopeStale(requestSocket, requestScopeVersion)) {
        return rejectMessageAction(
          "chat_message_send_rejected",
          "stale_runtime_scope",
          "Chat runtime changed before the send result could be applied.",
          undefined,
          { requestSocket, cid },
        );
      }

      this.deps.timelineState.appendMessageIfMissing(
        cid,
        mapped,
        compareMessages,
      );
      this.deps.composerState.clearReplyDraft();
      this.deps.composerState.clearQuoteReplyDraft();
      if (!payload) this.deps.composerState.clearDraft();
      this.deps.composerState.clearDraftMentions();
      this.deps.composerState.clearChannelDraft(cid);

      const now = Date.now();
      const nextReadTime = this.deps.readStateReporter.advanceLocalReadTime(cid, now);
      void this.deps.readStateReporter.reportIfAllowed(cid, mapped.id, nextReadTime, now, 1500);
      return {
        ok: true,
        kind: "chat_message_sent",
        message: mapped,
      };
    } catch (e) {
      const error = createMessageActionError("send_failed", "Send failed.", e);
      this.deps.composerState.writeActionError(error);
      return {
        ok: false,
        kind: "chat_message_send_rejected",
        error,
      };
    }
  }

  /**
   * 撤回一条消息。
   *
   * HTTP 成功没有消息对象；按 MID 更新本地时间线，后续 WS 事件可幂等重复标记。
   */
  async recallMessage(messageId: string): Promise<RecallChatMessageOutcome> {
    const mid = String(messageId).trim();
    if (!mid) {
      return rejectMessageAction("chat_message_recall_rejected", "recall_failed", "no message id");
    }

    const channelId = this.deps.timelineState.readCurrentChannelId();
    if (!channelId) {
      return rejectMessageAction("chat_message_recall_rejected", "recall_failed", "no active channel");
    }

    const [socket, token] = await this.deps.scope.getSocketAndValidToken();
    if (!socket || !token) {
      return rejectMessageAction("chat_message_recall_rejected", "recall_failed", "not authenticated");
    }
    const requestSocket = socket;
    const requestScopeVersion = this.deps.scope.getActiveScopeVersion();

    try {
      await this.deps.api.recallMessage(socket, token, channelId, mid);
      if (this.isScopeStale(requestSocket, requestScopeVersion)) {
        return rejectMessageAction(
          "chat_message_recall_rejected",
          "stale_runtime_scope",
          "Chat runtime changed before the recall result could be applied.",
        );
      }
      this.deps.timelineState.markMessageRecalled(channelId, mid, Date.now(), this.deps.currentUserId);
      return {
        ok: true,
        kind: "chat_message_recalled",
        messageId: mid,
      };
    } catch (e) {
      const error = createMessageActionError("recall_failed", "Recall failed.", e, { messageId: mid, channelId });
      this.deps.composerState.writeActionError(error);
      return {
        ok: false,
        kind: "chat_message_recall_rejected",
        error,
      };
    }
  }

  /**
   * 列出当前频道的提及候选成员列表。
   *
   * @param channelId - 可选，不传时使用当前时间线的频道 ID。
   * @returns 提及候选项数组。
   */
  async listMentionCandidates(channelId?: string): Promise<MentionCandidate[]> {
    const cid = String(channelId || this.deps.timelineState.readCurrentChannelId()).trim();
    if (!cid) return [];
    const [socket, token] = await this.deps.scope.getSocketAndValidToken();
    if (!socket || !token) return [];
    try {
      const members = await this.deps.api.listChannelMembers(socket, token, cid);
      return members.map((member) => ({
        userId: member.userId,
        displayName: member.nickname || member.userId,
        avatar: member.avatar,
      }));
    } catch {
      return [];
    }
  }

  /**
   * 在当前频道中搜索消息。
   */
  async searchCurrentChannel(query: string): Promise<void> {
    const q = String(query ?? "").trim();
    const seq = ++this.searchSeq;
    if (!q) {
      this.deps.timelineState.writeSearchState({ query: "", loading: false, error: "", results: [] });
      return;
    }
    const cid = this.deps.timelineState.readCurrentChannelId();
    if (!cid) return;
    this.deps.timelineState.writeSearchState({ query: q, loading: true, error: "", results: [] });
    const [socket, token] = await this.deps.scope.getSocketAndValidToken();
    if (seq !== this.searchSeq) return;
    if (!socket || !token) {
      this.deps.timelineState.writeSearchState({ query: q, loading: false, error: "", results: [] });
      return;
    }
    const requestSocket = socket;
    const requestScopeVersion = this.deps.scope.getActiveScopeVersion();
    try {
      const page = await this.deps.api.searchChannelMessages(socket, token, cid, { q, limit: 30 });
      if (seq !== this.searchSeq) return;
      if (this.isScopeStale(requestSocket, requestScopeVersion)) return;
      const results: MessageSearchResult[] = page.items.map((item) => {
        const message = this.deps.mapWireMessage(socket, item);
        return {
          message,
          preview: message.kind === "core_text" ? message.text : message.preview,
        };
      });
      this.deps.timelineState.writeSearchState({ query: q, loading: false, error: "", results });
    } catch {
      if (seq !== this.searchSeq) return;
      if (this.isScopeStale(requestSocket, requestScopeVersion)) return;
      this.deps.timelineState.writeSearchState({ query: q, loading: false, error: "search_failed", results: [] });
    }
  }

  /**
   * 加载某条消息周围的上下文，并在本地 timeline 中高亮它。
   */
  async loadContextAroundMessage(messageId: string): Promise<void> {
    const mid = String(messageId ?? "").trim();
    if (!mid) return;
    const cid = this.deps.timelineState.readCurrentChannelId();
    if (!cid) return;
    const state = this.deps.timelineState;
    const seq = ++this.contextSeq;
    const edge = state.readContextEdges(cid)?.after;
    const existing = (!edge || compareMessageIdForReadOrder(mid, edge) <= 0) &&
      state.listMessages(cid).some((message) => message.id === mid);
    if (existing) {
      this.deps.timelineState.setHighlightedMessageId(mid);
      return;
    }
    const requestScopeVersion = this.deps.scope.getActiveScopeVersion();
    const [socket, token] = await this.deps.scope.getSocketAndValidToken();
    const isCurrent = () => seq === this.contextSeq && state.readCurrentChannelId() === cid &&
      !this.isScopeStale(socket, requestScopeVersion);
    if (!socket || !token || !isCurrent()) return;
    try {
      const page = await this.deps.api.listChannelMessagesAround(socket, token, cid, mid, CONTEXT_LIMIT, CONTEXT_LIMIT);
      if (!isCurrent()) return;
      const mapped = this.mapContextMessages(socket, page.items);
      const anchorIndex = mapped.findIndex((message) => message.id === mid);
      if (anchorIndex < 0 || !await this.replaceTimelineMerged(cid, mapped, true, isCurrent)) return;
      const before = anchorIndex >= CONTEXT_LIMIT ? mapped[0].id : "";
      const after = mapped.length - anchorIndex - 1 >= CONTEXT_LIMIT ? mapped[mapped.length - 1].id : "";
      state.writeContextEdges(cid, { before, after });
      state.writeNextCursor(cid, "");
      state.writeHasMore(cid, Boolean(before));
      state.setHighlightedMessageId(mid);
    } catch {
      // 锚点不存在或请求失败时保留当前时间线。
    }
  }

  private mapContextMessages(socket: string, items: ChatMessageRecord[]): ChatMessage[] {
    return dedupeMessages(items.map((item) => this.deps.mapWireMessage(socket, item))).sort(compareMessages);
  }

  /**
   * 清除消息定位高亮。
   *
   * @returns 无返回值。
   */
  clearHighlightedMessage(): void {
    this.deps.timelineState.setHighlightedMessageId("");
  }

  /**
   * 清除搜索状态。
   */
  clearSearch(): void {
    this.contextSeq += 1;
    this.deps.timelineState.writeSearchState({ query: "", loading: false, error: "", results: [] });
    this.clearHighlightedMessage();
  }

  /**
   * 加载指定频道的最新一页消息，并覆盖本地 timeline。
   *
   * 典型触发点：
   * - 首次进入频道
   * - 当前频道切换后重建时间线
   */
  async loadChannelMessages(cid: string): Promise<void> {
    const state = this.deps.timelineState;
    const edges = state.readContextEdges(cid.trim());
    const page = await this.fetchLatestPage(cid);
    if (!page) return;
    const isCurrent = () => !this.isScopeStale(page.requestSocket, page.requestScopeVersion) &&
      state.readContextEdges(page.channelId) === edges;
    if (!isCurrent() || !await this.replaceTimelineMerged(page.channelId, page.mapped, true, isCurrent)) return;
    state.writeContextEdges(page.channelId);
    state.writeNextCursor(page.channelId, page.nextCursor);
    state.writeHasMore(page.channelId, page.hasMore && Boolean(page.nextCursor));
  }

  /**
   * 重新抓取当前频道的最新一页，并与已有时间线合并。
   *
   * 典型触发点：
   * - reconnect 之后
   * - catch-up 之后
   * - 需要纠正本地最新页时
   */
  async refreshChannelLatestPage(cid: string): Promise<void> {
    const page = await this.fetchLatestPage(cid);
    if (!page) return;
    const state = this.deps.timelineState;
    const edges = state.readContextEdges(page.channelId);
    const isCurrent = () => !this.isScopeStale(page.requestSocket, page.requestScopeVersion) &&
      state.readContextEdges(page.channelId) === edges;
    if (!await this.replaceTimelineMerged(page.channelId, page.mapped, false, isCurrent)) return;

    if (!edges && !state.readNextCursor(page.channelId) && !state.readHasMore(page.channelId)) {
      state.writeNextCursor(page.channelId, page.nextCursor);
      state.writeHasMore(page.channelId, page.hasMore && Boolean(page.nextCursor));
    }
  }

  /**
   * 首页沿游标向旧消息翻页，锚点上下文沿两侧边缘消息继续浏览。
   */
  async loadMoreMessages(direction: "older" | "newer" = "older"): Promise<void> {
    const state = this.deps.timelineState;
    const channelId = state.readCurrentChannelId();
    if (!channelId || state.isLoadingMore(channelId)) return;
    const edges = state.readContextEdges(channelId);
    const key = direction === "older" ? "before" : "after";
    const anchor = edges?.[key];
    if (edges ? !anchor : direction === "newer" || !state.readHasMore(channelId)) return;
    const cursor = edges ? "" : state.readNextCursor(channelId);
    if (!edges && !cursor) {
      state.writeHasMore(channelId, false);
      return;
    }

    const requestSocket = this.deps.scope.getActiveServerSocket();
    const requestScopeVersion = this.deps.scope.getActiveScopeVersion();
    const isCurrent = () => !this.isScopeStale(requestSocket, requestScopeVersion) &&
      state.readCurrentChannelId() === channelId && state.readContextEdges(channelId) === edges;

    state.setLoadingMore(channelId, true);
    try {
      const [socket, token] = await this.deps.scope.getSocketAndValidToken();
      if (!token || socket !== requestSocket || !isCurrent()) return;
      if (edges && anchor) {
        const older = direction === "older";
        const { items } = await this.deps.api.listChannelMessagesAround(socket, token, channelId, anchor,
          older ? LATEST_PAGE_LIMIT : 0, older ? 0 : LATEST_PAGE_LIMIT);
        if (!isCurrent()) return;
        const mapped = this.mapContextMessages(socket, items);
        if (!mapped.some((message) => message.id === anchor)) return;
        if (!await this.replaceTimelineMerged(channelId, mapped, false, isCurrent)) return;
        // 响应中包含重复的锚点，只用该方向的新消息数判断是否还可继续。
        const next = mapped.length > LATEST_PAGE_LIMIT ? mapped[older ? 0 : mapped.length - 1].id : "";
        state.writeContextEdges(channelId, { ...edges, [key]: next });
        if (older) state.writeHasMore(channelId, Boolean(next));
        return;
      }

      const page = await this.deps.api.listChannelMessages(socket, token, channelId, cursor, LATEST_PAGE_LIMIT);
      if (!isCurrent()) return;
      const mapped = page.items.map((item) => this.deps.mapWireMessage(socket, item));
      if (!await this.replaceTimelineMerged(channelId, mapped, false, isCurrent)) return;
      const nextCursor = page.nextCursor ?? "";
      state.writeNextCursor(channelId, nextCursor);
      state.writeHasMore(channelId, Boolean(page.hasMore && nextCursor));
    } finally {
      if (!this.isScopeStale(requestSocket, requestScopeVersion)) {
        state.setLoadingMore(channelId, false);
      }
    }
  }

  /**
   * 判断当前请求结果是否已经落在过期 scope 上。
   */
  private isScopeStale(requestSocket: string, requestScopeVersion: number): boolean {
    return (
      this.deps.scope.getActiveServerSocket() !== requestSocket ||
      this.deps.scope.getActiveScopeVersion() !== requestScopeVersion
    );
  }

  /**
   * 抓取某频道的最新一页，并做统一的 scope 一致性校验与 DTO 映射。
   */
  private async fetchLatestPage(cid: string): Promise<LatestPage | null> {
    const requestScopeVersion = this.deps.scope.getActiveScopeVersion();
    const [socket, token] = await this.deps.scope.getSocketAndValidToken();
    const channelId = String(cid).trim();
    if (!socket || !token || !channelId || this.isScopeStale(socket, requestScopeVersion)) return null;
    const requestSocket = socket;

    const res: ChatMessagePage = await this.deps.api.listChannelMessages(socket, token, channelId, undefined, LATEST_PAGE_LIMIT);
    if (this.isScopeStale(requestSocket, requestScopeVersion)) return null;
    const items = Array.isArray(res.items) ? res.items : [];
    const mapped: ChatMessage[] = [];
    for (const message of items) mapped.push(this.deps.mapWireMessage(socket, message));
    const nextCursor = res.nextCursor ?? "";
    const hasMore = Boolean(res.hasMore);
    return { requestSocket, requestScopeVersion, channelId, mapped, nextCursor, hasMore };
  }
}

