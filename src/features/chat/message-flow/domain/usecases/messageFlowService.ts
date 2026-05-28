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

import type { ChatMessagePage, ChatMessageRecord, ChatSendMessageInput } from "@/features/chat/domain/types/chatApiModels";
import type {
  ChatMessage,
  ComposerSubmitPayload,
  DeleteChatMessageOutcome,
  EditChatMessageOutcome,
  MentionCandidate,
  MessageReactionSummary,
  MessageSearchResult,
  ReactToMessageOutcome,
  RecallChatMessageOutcome,
  RemoveReactionOutcome,
  SendChatMessageOutcome,
  ServerMessageSearchResult,
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
type MergeMessages = (existing: ChatMessage[], incoming: ChatMessage[]) => ChatMessage[];

const LATEST_PAGE_LIMIT = 50;

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
};

type LatestPage = {
  requestSocket: string;
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
  constructor(private readonly deps: MessageFlowApplicationServiceDeps) {}

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
      const req: ChatSendMessageInput = {
        domain: apiDomain,
        domainVersion: apiVersion,
        data,
        replyToMessageId: finalReplyToMid,
        replyTo: replyDraft
          ? {
              messageId: replyDraft.messageId,
              senderName: replyDraft.senderName,
              preview: replyDraft.preview,
              createdAt: replyDraft.createdAt,
              unavailable: replyDraft.unavailable,
            }
          : undefined,
        quoteReply: quoteReply
          ? {
              messageId: quoteReply.messageId,
              userId: quoteReply.userId,
              preview: quoteReply.preview,
            }
          : undefined,
        mentions: payload?.mentions ?? this.deps.composerState.listDraftMentions().map((m) => ({ userId: m.userId, displayName: m.displayName, type: m.type })),
        linkPreview: payload?.linkPreview,
      };
      const created = await this.deps.api.sendChannelMessage(socket, token, cid, req, this.createIdempotencyKey());
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
        (a, b) => (a.timeMs === b.timeMs ? a.id.localeCompare(b.id) : a.timeMs - b.timeMs),
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
   * 删除一条消息。
   *
   * 采用“本地先移除，失败再回滚”的乐观删除策略。
   */
  async deleteMessage(messageId: string): Promise<DeleteChatMessageOutcome> {
    const mid = String(messageId).trim();
    if (!mid) {
      const error = createMessageActionError("missing_message_id", "Missing message id.");
      this.deps.composerState.writeActionError(error);
      return rejectMessageAction("chat_message_delete_rejected", "missing_message_id", "Missing message id.");
    }
    const [socket, token] = await this.deps.scope.getSocketAndValidToken();
    if (!socket || !token) {
      const error = createMessageActionError("not_signed_in", "Not signed in.");
      this.deps.composerState.writeActionError(error);
      return rejectMessageAction("chat_message_delete_rejected", "not_signed_in", "Not signed in.");
    }
    const requestSocket = socket;
    const requestScopeVersion = this.deps.scope.getActiveScopeVersion();

    const cid = this.deps.timelineState.readCurrentChannelId();
    const removal = this.deps.timelineState.beginOptimisticMessageRemoval(cid, mid);

    try {
      await this.deps.api.deleteMessage(socket, token, mid);
      if (!this.isScopeStale(requestSocket, requestScopeVersion)) {
        this.deps.composerState.writeActionError(null);
      }
      return {
        ok: true,
        kind: "chat_message_deleted",
        messageId: mid,
      };
    } catch (e) {
      if (this.isScopeStale(requestSocket, requestScopeVersion)) {
        return rejectMessageAction(
          "chat_message_delete_rejected",
          "stale_runtime_scope",
          "Chat runtime changed before the delete result could be applied.",
          undefined,
          { requestSocket, messageId: mid },
        );
      }
      removal.restore();
      const error = createMessageActionError("delete_failed", "Delete failed.", e, { messageId: mid, channelId: cid });
      this.deps.composerState.writeActionError(error);
      return {
        ok: false,
        kind: "chat_message_delete_rejected",
        error,
      };
    }
  }

  /**
   * 编辑一条消息。
   *
   * 采用"本地先更新，失败再回滚"的乐观编辑策略。
   */
  async editMessage(messageId: string, request: { text: string }): Promise<EditChatMessageOutcome> {
    const mid = String(messageId).trim();
    if (!mid) {
      const error = createMessageActionError("missing_message_id", "Missing message id.");
      this.deps.composerState.writeActionError(error);
      return rejectMessageAction("chat_message_edit_rejected", "missing_message_id", "Missing message id.");
    }
    const [socket, token] = await this.deps.scope.getSocketAndValidToken();
    if (!socket || !token) {
      const error = createMessageActionError("not_signed_in", "Not signed in.");
      this.deps.composerState.writeActionError(error);
      return rejectMessageAction("chat_message_edit_rejected", "not_signed_in", "Not signed in.");
    }
    const requestSocket = socket;
    const requestScopeVersion = this.deps.scope.getActiveScopeVersion();

    const cid = this.deps.timelineState.readCurrentChannelId();
    if (!cid) {
      const error = createMessageActionError("channel_not_selected", "No channel selected.");
      this.deps.composerState.writeActionError(error);
      return rejectMessageAction("chat_message_edit_rejected", "channel_not_selected", "No channel selected.");
    }

    // Capture original message for rollback
    const messages = this.deps.timelineState.listMessages(cid);
    const originalMessage = messages.find((m) => m.id === mid) ?? null;

    // Optimistic update: apply new text locally
    if (originalMessage) {
      this.deps.timelineState.updateMessage(cid, mid, (old) => ({
        ...old,
        kind: "core_text" as const,
        text: request.text,
      }));
    }

    try {
      const edited = await this.deps.api.editMessage(socket, token, mid, {
        domain: "Core:Text",
        domainVersion: "1.0.0",
        data: { text: request.text },
        mentions: [],
      });
      if (this.isScopeStale(requestSocket, requestScopeVersion)) {
        // Rollback optimistic update
        if (originalMessage) {
          this.deps.timelineState.updateMessage(cid, mid, () => originalMessage);
        }
        return rejectMessageAction(
          "chat_message_edit_rejected",
          "stale_runtime_scope",
          "Chat runtime changed before the edit result could be applied.",
          undefined,
          { requestSocket, messageId: mid },
        );
      }

      const mapped = this.deps.mapWireMessage(socket, edited);
      this.deps.timelineState.updateMessage(cid, mid, () => mapped);
      this.deps.composerState.writeActionError(null);

      return {
        ok: true,
        kind: "chat_message_edited",
        message: mapped,
      };
    } catch (e) {
      if (this.isScopeStale(requestSocket, requestScopeVersion)) {
        if (originalMessage) {
          this.deps.timelineState.updateMessage(cid, mid, () => originalMessage);
        }
        return rejectMessageAction(
          "chat_message_edit_rejected",
          "stale_runtime_scope",
          "Chat runtime changed before the edit result could be applied.",
          undefined,
          { requestSocket, messageId: mid },
        );
      }
      // Rollback on failure
      if (originalMessage) {
        this.deps.timelineState.updateMessage(cid, mid, () => originalMessage);
      }
      const error = createMessageActionError("edit_failed", "Edit failed.", e, { messageId: mid, channelId: cid });
      this.deps.composerState.writeActionError(error);
      return {
        ok: false,
        kind: "chat_message_edit_rejected",
        error,
      };
    }
  }

  /**
   * 添加消息回应。
   *
   * 采用"本地先更新，失败再回滚"的乐观更新策略。
   */
  async reactToMessage(
    messageId: string,
    emoji: string,
  ): Promise<ReactToMessageOutcome> {
    const channelId = this.deps.timelineState.readCurrentChannelId();
    if (!channelId) {
      return rejectMessageAction("message_reaction_rejected", "reaction_failed", "No channel selected.");
    }
    if (!emoji) {
      return rejectMessageAction("message_reaction_rejected", "reaction_failed", "Missing emoji.");
    }

    const messages = this.deps.timelineState.listMessages(channelId);
    const message = messages.find((m) => m.id === messageId);
    const prevReactions = message?.reactions;

    const updated = computeOptimisticReactions(prevReactions, emoji);
    this.deps.timelineState.updateMessageReactions(channelId, messageId, updated);

    const [socket, token] = await this.deps.scope.getSocketAndValidToken();
    if (!socket || !token) {
      if (prevReactions) {
        this.deps.timelineState.updateMessageReactions(channelId, messageId, prevReactions);
      } else {
        this.deps.timelineState.updateMessageReactions(channelId, messageId, []);
      }
      return rejectMessageAction("message_reaction_rejected", "reaction_failed", "Not authenticated.");
    }
    const requestSocket = socket;
    const requestScopeVersion = this.deps.scope.getActiveScopeVersion();

    try {
      const result = await this.deps.api.reactToMessage(socket, token, channelId, messageId, emoji);
      if (this.isScopeStale(requestSocket, requestScopeVersion)) {
        // Rollback optimistic update, don't apply potentially wrong server state.
        if (prevReactions) {
          this.deps.timelineState.updateMessageReactions(channelId, messageId, prevReactions);
        } else {
          this.deps.timelineState.updateMessageReactions(channelId, messageId, []);
        }
        return rejectMessageAction(
          "message_reaction_rejected",
          "stale_runtime_scope",
          "Chat runtime changed before the reaction result could be applied.",
          undefined,
          { requestSocket, messageId },
        );
      }

      const serverReactions: MessageReactionSummary[] = result.map((r) => ({
        emoji: r.emoji,
        count: r.count,
        reactedByMe: r.reactedByMe,
      }));
      this.deps.timelineState.updateMessageReactions(channelId, messageId, serverReactions);

      return {
        ok: true,
        kind: "message_reacted",
        messageId,
        emoji,
        reactions: serverReactions,
      };
    } catch (err) {
      if (this.isScopeStale(requestSocket, requestScopeVersion)) {
        return rejectMessageAction(
          "message_reaction_rejected",
          "stale_runtime_scope",
          "Chat runtime changed before the reaction result could be applied.",
          undefined,
          { requestSocket, messageId },
        );
      }
      if (prevReactions) {
        this.deps.timelineState.updateMessageReactions(channelId, messageId, prevReactions);
      } else {
        this.deps.timelineState.updateMessageReactions(channelId, messageId, []);
      }
      return rejectMessageAction("message_reaction_rejected", "reaction_failed", String(err));
    }
  }

  /**
   * 移除消息回应。
   *
   * 采用"本地先移除，失败再回滚"的乐观更新策略。
   */
  async removeReaction(
    messageId: string,
    emoji: string,
  ): Promise<RemoveReactionOutcome> {
    const channelId = this.deps.timelineState.readCurrentChannelId();
    if (!channelId) {
      return rejectMessageAction("message_reaction_removal_rejected", "reaction_failed", "No channel selected.");
    }
    if (!emoji) {
      return rejectMessageAction("message_reaction_removal_rejected", "reaction_failed", "Missing emoji.");
    }

    const messages = this.deps.timelineState.listMessages(channelId);
    const message = messages.find((m) => m.id === messageId);
    const prevReactions = message?.reactions;

    const updated = (prevReactions ?? []).filter((r) => !(r.emoji === emoji && r.reactedByMe));
    this.deps.timelineState.updateMessageReactions(channelId, messageId, updated);

    const [socket, token] = await this.deps.scope.getSocketAndValidToken();
    if (!socket || !token) {
      if (prevReactions) {
        this.deps.timelineState.updateMessageReactions(channelId, messageId, prevReactions);
      } else {
        this.deps.timelineState.updateMessageReactions(channelId, messageId, []);
      }
      return rejectMessageAction("message_reaction_removal_rejected", "reaction_failed", "Not authenticated.");
    }
    const requestSocket = socket;
    const requestScopeVersion = this.deps.scope.getActiveScopeVersion();

    try {
      const result = await this.deps.api.removeReaction(socket, token, channelId, messageId, emoji);
      if (this.isScopeStale(requestSocket, requestScopeVersion)) {
        // Rollback optimistic update, don't apply potentially wrong server state.
        if (prevReactions) {
          this.deps.timelineState.updateMessageReactions(channelId, messageId, prevReactions);
        } else {
          this.deps.timelineState.updateMessageReactions(channelId, messageId, []);
        }
        return rejectMessageAction(
          "message_reaction_removal_rejected",
          "stale_runtime_scope",
          "Chat runtime changed before the reaction removal result could be applied.",
          undefined,
          { requestSocket, messageId },
        );
      }

      const serverReactions: MessageReactionSummary[] = result.map((r) => ({
        emoji: r.emoji,
        count: r.count,
        reactedByMe: r.reactedByMe,
      }));
      this.deps.timelineState.updateMessageReactions(channelId, messageId, serverReactions);

      return {
        ok: true,
        kind: "message_reaction_removed",
        messageId,
        emoji,
        reactions: serverReactions,
      };
    } catch (err) {
      if (this.isScopeStale(requestSocket, requestScopeVersion)) {
        return rejectMessageAction(
          "message_reaction_removal_rejected",
          "stale_runtime_scope",
          "Chat runtime changed before the reaction removal result could be applied.",
          undefined,
          { requestSocket, messageId },
        );
      }
      if (prevReactions) {
        this.deps.timelineState.updateMessageReactions(channelId, messageId, prevReactions);
      } else {
        this.deps.timelineState.updateMessageReactions(channelId, messageId, []);
      }
      return rejectMessageAction("message_reaction_removal_rejected", "reaction_failed", String(err));
    }
  }

  /**
   * 撤回一条消息。
   *
   * 没有乐观更新——服务器通过 `message.recalled` 事件广播结果给所有客户端。
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
      await this.deps.api.recallMessage(socket, token, mid);
      if (this.isScopeStale(requestSocket, requestScopeVersion)) {
        return rejectMessageAction(
          "chat_message_recall_rejected",
          "stale_runtime_scope",
          "Chat runtime changed before the recall result could be applied.",
        );
      }
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
    if (!q) {
      this.deps.timelineState.writeSearchState({ query: "", loading: false, error: "", results: [], serverResults: [], searchScope: "channel" });
      return;
    }
    const cid = this.deps.timelineState.readCurrentChannelId();
    if (!cid) return;
    this.deps.timelineState.writeSearchState({ query: q, loading: true, error: "", results: [], serverResults: [], searchScope: "channel" });
    const [socket, token] = await this.deps.scope.getSocketAndValidToken();
    if (!socket || !token) {
      this.deps.timelineState.writeSearchState({ query: q, loading: false, error: "", results: [], serverResults: [], searchScope: "channel" });
      return;
    }
    const requestSocket = socket;
    const requestScopeVersion = this.deps.scope.getActiveScopeVersion();
    try {
      const page = await this.deps.api.searchChannelMessages(socket, token, cid, { q, limit: 30 });
      if (this.isScopeStale(requestSocket, requestScopeVersion)) return;
      const results: MessageSearchResult[] = page.items.map((item) => {
        const message = this.deps.mapWireMessage(socket, item);
        return {
          message,
          preview: message.kind === "core_text" ? message.text : message.preview,
        };
      });
      this.deps.timelineState.writeSearchState({ query: q, loading: false, error: "", results, serverResults: [], searchScope: "channel" });
    } catch {
      if (this.isScopeStale(requestSocket, requestScopeVersion)) return;
      this.deps.timelineState.writeSearchState({ query: q, loading: false, error: "Search failed.", results: [], serverResults: [], searchScope: "channel" });
    }
  }

  /**
   * 在服务器范围内搜索消息。
   */
  async searchServerMessages(query: string, channelIds?: string[]): Promise<void> {
    const q = String(query ?? "").trim();
    if (!q) {
      this.deps.timelineState.writeServerSearchState({ query: "", loading: false, error: "", results: [] });
      return;
    }
    this.deps.timelineState.writeSearchScope("server");
    this.deps.timelineState.writeServerSearchState({ query: q, loading: true, error: "", results: [] });
    const [socket, token] = await this.deps.scope.getSocketAndValidToken();
    if (!socket || !token) {
      this.deps.timelineState.writeServerSearchState({ query: q, loading: false, error: "", results: [] });
      return;
    }
    const requestSocket = socket;
    const requestScopeVersion = this.deps.scope.getActiveScopeVersion();
    try {
      const page = await this.deps.api.searchMessages(socket, token, { q, channelIds, limit: 30 });
      if (this.isScopeStale(requestSocket, requestScopeVersion)) return;
      const results: ServerMessageSearchResult[] = page.items.map((item) => {
        const message = this.deps.mapWireMessage(socket, item);
        return {
          message,
          preview: message.kind === "core_text" ? message.text : message.preview,
          channelId: (item as any).channelId ?? "",
          channelName: "",
        };
      });
      this.deps.timelineState.writeServerSearchState({ query: q, loading: false, error: "", results });
    } catch {
      if (this.isScopeStale(requestSocket, requestScopeVersion)) return;
      this.deps.timelineState.writeServerSearchState({ query: q, loading: false, error: "Search failed.", results: [] });
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
    const existing = this.deps.timelineState.listMessages(cid).some((message) => message.id === mid);
    if (existing) {
      this.deps.timelineState.setHighlightedMessageId(mid);
      return;
    }
    const [socket, token] = await this.deps.scope.getSocketAndValidToken();
    if (!socket || !token) return;
    const requestSocket = socket;
    const requestScopeVersion = this.deps.scope.getActiveScopeVersion();
    try {
      const page = await this.deps.api.listChannelMessagesAround(socket, token, cid, mid, 20, 20);
      if (this.isScopeStale(requestSocket, requestScopeVersion)) return;
      const mapped = page.items.map((item) => this.deps.mapWireMessage(socket, item));
      this.deps.timelineState.replaceTimeline(cid, mapped);
      this.deps.timelineState.setHighlightedMessageId(mid);
    } catch {
      // Context load failed, leave current timeline intact
    }
  }

  /**
   * 清除搜索状态。
   */
  clearSearch(): void {
    this.deps.timelineState.writeSearchState({ query: "", loading: false, error: "", results: [], serverResults: [], searchScope: "channel" });
    this.deps.timelineState.writeServerSearchState({ query: "", loading: false, error: "", results: [] });
    this.deps.timelineState.setHighlightedMessageId("");
  }

  /**
   * 加载指定频道的最新一页消息，并覆盖本地 timeline。
   *
   * 典型触发点：
   * - 首次进入频道
   * - 当前频道切换后重建时间线
   */
  async loadChannelMessages(cid: string): Promise<void> {
    const page = await this.fetchLatestPage(cid);
    if (!page) return;
    this.deps.timelineState.replaceTimeline(page.channelId, this.deps.mergeMessages([], page.mapped));
    this.deps.timelineState.writeNextCursor(page.channelId, page.nextCursor);
    this.deps.timelineState.writeHasMore(page.channelId, page.hasMore && Boolean(page.nextCursor));
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
    const existing = [...this.deps.timelineState.listMessages(page.channelId)];
    this.deps.timelineState.replaceTimeline(page.channelId, this.deps.mergeMessages(existing, page.mapped));

    if (!this.deps.timelineState.readNextCursor(page.channelId) && !this.deps.timelineState.readHasMore(page.channelId)) {
      this.deps.timelineState.writeNextCursor(page.channelId, page.nextCursor);
      this.deps.timelineState.writeHasMore(page.channelId, page.hasMore && Boolean(page.nextCursor));
    }
  }

  /**
   * 沿当前频道的 cursor 继续向旧消息方向翻页。
   */
  async loadMoreMessages(): Promise<void> {
    const channelId = this.deps.timelineState.readCurrentChannelId();
    if (!channelId) return;
    if (!this.deps.timelineState.readHasMore(channelId)) return;

    const cursor = this.deps.timelineState.readNextCursor(channelId);
    if (this.deps.timelineState.isLoadingMore(channelId)) return;
    if (!cursor) {
      this.deps.timelineState.writeHasMore(channelId, false);
      return;
    }

    const [socket, token] = await this.deps.scope.getSocketAndValidToken();
    if (!socket || !token) return;
    const requestSocket = socket;
    const requestScopeVersion = this.deps.scope.getActiveScopeVersion();

    this.deps.timelineState.setLoadingMore(channelId, true);
    try {
      const res: ChatMessagePage = await this.deps.api.listChannelMessages(socket, token, channelId, cursor, LATEST_PAGE_LIMIT);
      if (this.isScopeStale(requestSocket, requestScopeVersion)) return;
      const items = Array.isArray(res.items) ? res.items : [];
      const mapped: ChatMessage[] = [];
      for (const message of items) mapped.push(this.deps.mapWireMessage(socket, message));

      const existing = [...this.deps.timelineState.listMessages(channelId)];
      this.deps.timelineState.replaceTimeline(channelId, this.deps.mergeMessages(existing, mapped));

      const nextCursor = String(res.nextCursor ?? "").trim();
      const hasMore = Boolean(res.hasMore);
      this.deps.timelineState.writeNextCursor(channelId, nextCursor);
      this.deps.timelineState.writeHasMore(channelId, hasMore && Boolean(nextCursor));
    } finally {
      if (!this.isScopeStale(requestSocket, requestScopeVersion)) {
        this.deps.timelineState.setLoadingMore(channelId, false);
      }
    }
  }

  /**
   * 生成消息发送的幂等键。
   */
  private createIdempotencyKey(): string {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (typeof uuid === "string" && uuid.trim()) return uuid;
    return `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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
    const [socket, token] = await this.deps.scope.getSocketAndValidToken();
    const channelId = String(cid).trim();
    if (!socket || !token || !channelId) return null;
    const requestSocket = socket;
    const requestScopeVersion = this.deps.scope.getActiveScopeVersion();

    const res: ChatMessagePage = await this.deps.api.listChannelMessages(socket, token, channelId, undefined, LATEST_PAGE_LIMIT);
    if (this.isScopeStale(requestSocket, requestScopeVersion)) return null;
    const items = Array.isArray(res.items) ? res.items : [];
    const mapped: ChatMessage[] = [];
    for (const message of items) mapped.push(this.deps.mapWireMessage(socket, message));
    const nextCursor = String(res.nextCursor ?? "").trim();
    const hasMore = Boolean(res.hasMore);
    return { requestSocket, channelId, mapped, nextCursor, hasMore };
  }
}

/**
 * 根据当前回应对列表，计算切换指定 emoji 后的乐观回应列表。
 *
 * 逻辑：
 * - 如果 emoji 已存在且当前用户已回应，则移除该用户的回应（count 减 1 或删除整行）；
 * - 如果 emoji 已存在但当前用户未回应，则增加该 emoji 的计数；
 * - 如果 emoji 不存在，则新增一条记录。
 */
function computeOptimisticReactions(
  current: readonly MessageReactionSummary[] | undefined,
  emoji: string,
): MessageReactionSummary[] {
  const list = [...(current ?? [])];
  const idx = list.findIndex((r) => r.emoji === emoji);
  if (idx >= 0) {
    if (list[idx].reactedByMe) {
      if (list[idx].count <= 1) {
        list.splice(idx, 1);
      } else {
        list[idx] = { ...list[idx], count: list[idx].count - 1, reactedByMe: false };
      }
    } else {
      list[idx] = { ...list[idx], count: list[idx].count + 1, reactedByMe: true };
    }
  } else {
    list.push({ emoji, count: 1, reactedByMe: true });
  }
  return list;
}
