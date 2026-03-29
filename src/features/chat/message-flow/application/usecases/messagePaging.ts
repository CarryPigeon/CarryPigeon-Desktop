/**
 * @fileoverview 消息分页与补拉（HTTP list + cursor 状态机）。
 * @description chat/message-flow｜application：消息分页与最新页补拉编排。
 */

import type { ChatMessagePage, ChatMessageRecord } from "@/features/chat/domain/types/chatApiModels";
import type { ChatMessage } from "@/features/chat/message-flow/domain/contracts";
import type { MessageFlowApiPort, MessageFlowScopePort, MessageTimelineStatePort } from "../ports";

type MapWireMessage = (serverSocket: string, msg: ChatMessageRecord) => ChatMessage;
type MergeMessages = (existing: ChatMessage[], incoming: ChatMessage[]) => ChatMessage[];
const LATEST_PAGE_LIMIT = 50;

export type MessagePagingDeps = {
  /**
   * 该依赖集合回答三件事：
   * - 怎么拉一页消息
   * - 怎么把 wire record 映射成可渲染消息
   * - 怎么把请求结果安全写回当前 scope 的本地 timeline
   */
  api: MessageFlowApiPort;
  mapWireMessage: MapWireMessage;
  mergeMessages: MergeMessages;
  scope: MessageFlowScopePort;
  timelineState: MessageTimelineStatePort;
};

export type MessagePaging = {
  /**
   * 首次或切频道时加载“最新一页”。
   */
  loadChannelMessages(cid: string): Promise<void>;
  /**
   * 在保持既有历史页的前提下，重取最新一页并合并。
   *
   * 典型调用：
   * - reconnect 之后
   * - 某些事件提示当前频道需要补拉最新消息时
   */
  refreshChannelLatestPage(cid: string): Promise<void>;
  /**
   * 沿着 cursor 继续向更早历史翻页。
   */
  loadMoreMessages(): Promise<void>;
};

export function createMessagePaging(deps: MessagePagingDeps): MessagePaging {
  /**
   * 拉取某频道“最新一页”的统一内部 helper。
   *
   * 它负责：
   * - 拿 socket/token
   * - 记录请求时的 scopeVersion
   * - 请求返回后做 stale-scope 判断
   * - 输出标准化后的分页结果
   */
  async function fetchLatestPage(
    cid: string,
  ): Promise<{ requestSocket: string; channelId: string; mapped: ChatMessage[]; nextCursor: string; hasMore: boolean } | null> {
    const [socket, token] = await deps.scope.getSocketAndValidToken();
    const channelId = String(cid).trim();
    if (!socket || !token || !channelId) return null;
    const requestSocket = socket;
    const requestScopeVersion = deps.scope.getActiveScopeVersion();

    const res: ChatMessagePage = await deps.api.listChannelMessages(socket, token, channelId, undefined, LATEST_PAGE_LIMIT);
    if (deps.scope.getActiveServerSocket() !== requestSocket) return null;
    if (deps.scope.getActiveScopeVersion() !== requestScopeVersion) return null;
    const items = Array.isArray(res.items) ? res.items : [];
    const mapped: ChatMessage[] = [];
    for (const m of items) mapped.push(deps.mapWireMessage(socket, m));
    const nextCursor = String(res.nextCursor ?? "").trim();
    const hasMore = Boolean(res.hasMore);
    return { requestSocket, channelId, mapped, nextCursor, hasMore };
  }

  async function loadChannelMessages(cid: string): Promise<void> {
    const page = await fetchLatestPage(cid);
    if (!page) return;
    deps.timelineState.replaceTimeline(page.channelId, deps.mergeMessages([], page.mapped));
    deps.timelineState.writeNextCursor(page.channelId, page.nextCursor);
    deps.timelineState.writeHasMore(page.channelId, page.hasMore && Boolean(page.nextCursor));
  }

  async function refreshChannelLatestPage(cid: string): Promise<void> {
    const page = await fetchLatestPage(cid);
    if (!page) return;
    const existing = [...deps.timelineState.listMessages(page.channelId)];
    deps.timelineState.replaceTimeline(page.channelId, deps.mergeMessages(existing, page.mapped));

    if (!deps.timelineState.readNextCursor(page.channelId) && !deps.timelineState.readHasMore(page.channelId)) {
      deps.timelineState.writeNextCursor(page.channelId, page.nextCursor);
      deps.timelineState.writeHasMore(page.channelId, page.hasMore && Boolean(page.nextCursor));
    }
  }

  async function loadMoreMessages(): Promise<void> {
    /**
     * `loadMoreMessages()` 只认“当前频道”。
     *
     * 原因：
     * - UI 的“向上翻页”只发生在当前时间线；
     * - 其他频道的消息查询走只读 lookup，不应驱动隐式分页。
     */
    const channelId = deps.timelineState.readCurrentChannelId();
    if (!channelId) return;
    if (!deps.timelineState.readHasMore(channelId)) return;

    const cursor = deps.timelineState.readNextCursor(channelId);
    const loading = deps.timelineState.isLoadingMore(channelId);
    if (loading) return;
    if (!cursor) {
      deps.timelineState.writeHasMore(channelId, false);
      return;
    }

    const [socket, token] = await deps.scope.getSocketAndValidToken();
    if (!socket || !token) return;
    const requestSocket = socket;
    const requestScopeVersion = deps.scope.getActiveScopeVersion();

    deps.timelineState.setLoadingMore(channelId, true);
    try {
      const res: ChatMessagePage = await deps.api.listChannelMessages(socket, token, channelId, cursor, LATEST_PAGE_LIMIT);
      if (deps.scope.getActiveServerSocket() !== requestSocket) return;
      if (deps.scope.getActiveScopeVersion() !== requestScopeVersion) return;
      const items = Array.isArray(res.items) ? res.items : [];
      const mapped: ChatMessage[] = [];
      for (const m of items) mapped.push(deps.mapWireMessage(socket, m));

      const existing = [...deps.timelineState.listMessages(channelId)];
      deps.timelineState.replaceTimeline(channelId, deps.mergeMessages(existing, mapped));

      const nextCursor = String(res.nextCursor ?? "").trim();
      const hasMore = Boolean(res.hasMore);
      deps.timelineState.writeNextCursor(channelId, nextCursor);
      deps.timelineState.writeHasMore(channelId, hasMore && Boolean(nextCursor));
    } finally {
      if (deps.scope.getActiveServerSocket() !== requestSocket) return;
      if (deps.scope.getActiveScopeVersion() !== requestScopeVersion) return;
      deps.timelineState.setLoadingMore(channelId, false);
    }
  }

  return { loadChannelMessages, refreshChannelLatestPage, loadMoreMessages };
}
