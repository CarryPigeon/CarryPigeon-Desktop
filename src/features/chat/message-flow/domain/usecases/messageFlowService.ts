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
  startReply(messageId: string): void {
    this.deps.composerState.setReplyToMessageId(messageId);
    this.deps.composerState.writeActionError(null);
  }

  /**
   * 退出回复态。
   */
  cancelReply(): void {
    this.deps.composerState.clearReplyToMessageId();
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
    const replyToMid = this.deps.composerState.readReplyToMessageId() || undefined;

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

    const apiDomain = payload ? String(payload.domain ?? "").trim() : uiDomain;
    const apiVersion = payload ? String(payload.domainVersion ?? "").trim() : "1.0.0";
    const data = payload ? payload.data : { text };
    const finalReplyToMid = payload?.replyToMessageId ? String(payload.replyToMessageId).trim() : replyToMid;
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
      const req: ChatSendMessageInput = { domain: apiDomain, domainVersion: apiVersion, data, replyToMessageId: finalReplyToMid };
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
      this.deps.composerState.clearReplyToMessageId();
      if (!payload) this.deps.composerState.clearDraft();

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
