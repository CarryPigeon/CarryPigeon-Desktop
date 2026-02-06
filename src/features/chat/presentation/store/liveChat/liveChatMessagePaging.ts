/**
 * @fileoverview liveChat 消息分页与补拉（HTTP list + cursor 状态机）。
 * @description chat｜展示层状态（store）：liveChatMessagePaging。
 *
 * 职责：
 * - 首屏加载：拉取频道最新一页消息，并初始化 cursor/hasMore；
 * - 最新页刷新：在不打断历史分页状态的前提下补拉最新页（用于 WS catch-up / polling）；
 * - 历史分页：按 cursor 向更早消息翻页，并维护 loading/hasMore/cursor。
 *
 * 约定：
 * - 注释中文；日志英文（本模块不输出日志）。
 */

import type { Ref } from "vue";
import type { ChatApiPort } from "@/features/chat/domain/ports/chatApiPort";
import type { ListMessagesResponseDto, MessageDto } from "@/features/chat/domain/types/chatWireDtos";
import type { ChatMessage } from "../chatStoreTypes";

type MapWireMessage = (serverSocket: string, msg: MessageDto) => ChatMessage;
type MergeMessages = (existing: ChatMessage[], incoming: ChatMessage[]) => ChatMessage[];

/**
 * 创建消息分页与补拉能力的依赖集合。
 */
export type LiveChatMessagePagingDeps = {
  /**
   * chat HTTP API 端口。
   */
  api: ChatApiPort;
  /**
   * wire message → 展示层 message 的映射器。
   */
  mapWireMessage: MapWireMessage;
  /**
   * 合并消息列表（去重 + 排序 + 稳定合并语义）。
   */
  mergeMessages: MergeMessages;
  /**
   * 获取当前 server socket 与可用 token（均为 trim 后）。
   */
  getSocketAndValidToken: () => Promise<[string, string]>;
  /**
   * 当前频道 id（用于历史分页）。
   */
  currentChannelId: Ref<string>;
  /**
   * 频道 → 消息列表映射。
   */
  messagesByChannel: Record<string, ChatMessage[]>;
  /**
   * 频道 → next cursor 映射。
   */
  nextCursorByChannel: Record<string, string>;
  /**
   * 频道 → 是否还有更多历史消息。
   */
  hasMoreByChannel: Record<string, boolean>;
  /**
   * 是否正在加载更多历史消息（UI 用）。
   */
  loadingMoreMessages: Ref<boolean>;
};

/**
 * 消息分页与补拉能力集合（首屏加载/最新页刷新/历史翻页）。
 */
export type LiveChatMessagePaging = {
  /**
   * 加载某频道的最新消息（首屏）。
   *
   * @param cid - 频道 id。
   * @returns Promise<void>。
   */
  loadChannelMessages(cid: string): Promise<void>;
  /**
   * 刷新某频道的最新页消息（不清空历史分页状态）。
   *
   * @param cid - 频道 id。
   * @returns Promise<void>。
   */
  refreshChannelLatestPage(cid: string): Promise<void>;
  /**
   * 以 cursor 分页方式加载当前频道更早的历史消息。
   *
   * @returns Promise<void>。
   */
  loadMoreMessages(): Promise<void>;
};

/**
 * 创建消息分页与补拉能力。
 *
 * @param deps - 依赖注入。
 * @returns LiveChatMessagePaging。
 */
export function createLiveChatMessagePaging(deps: LiveChatMessagePagingDeps): LiveChatMessagePaging {
  /**
   * 加载某频道的最新消息（首屏）。
   *
   * @param cid - 频道 id。
   * @returns Promise<void>。
   */
  async function loadChannelMessages(cid: string): Promise<void> {
    const [socket, token] = await deps.getSocketAndValidToken();
    const channelId = String(cid).trim();
    if (!socket || !token || !channelId) return;

    const res: ListMessagesResponseDto = await deps.api.listChannelMessages(socket, token, channelId, undefined, 50);
    const items = Array.isArray(res.items) ? res.items : [];
    const mapped: ChatMessage[] = [];
    for (const m of items) mapped.push(deps.mapWireMessage(socket, m));
    deps.messagesByChannel[channelId] = deps.mergeMessages([], mapped);

    const nextCursor = String(res.next_cursor ?? "").trim();
    const hasMore = Boolean(res.has_more);
    deps.nextCursorByChannel[channelId] = nextCursor;
    deps.hasMoreByChannel[channelId] = hasMore && Boolean(nextCursor);
  }

  /**
   * 刷新某频道的最新页消息（不会清空已加载的历史页）。
   *
   * 用于 WS catch-up 与 polling 降级模式。
   *
   * @param cid - 频道 id。
   * @returns Promise<void>。
   */
  async function refreshChannelLatestPage(cid: string): Promise<void> {
    const [socket, token] = await deps.getSocketAndValidToken();
    const channelId = String(cid).trim();
    if (!socket || !token || !channelId) return;

    const res: ListMessagesResponseDto = await deps.api.listChannelMessages(socket, token, channelId, undefined, 50);
    const items = Array.isArray(res.items) ? res.items : [];
    const mapped: ChatMessage[] = [];
    for (const m of items) mapped.push(deps.mapWireMessage(socket, m));

    const existing = deps.messagesByChannel[channelId] ?? [];
    deps.messagesByChannel[channelId] = deps.mergeMessages(existing, mapped);

    // 仅在分页状态尚未初始化时写入（避免覆盖用户已拉取的历史分页状态）。
    if (!(channelId in deps.nextCursorByChannel) || !(channelId in deps.hasMoreByChannel)) {
      const nextCursor = String(res.next_cursor ?? "").trim();
      const hasMore = Boolean(res.has_more);
      deps.nextCursorByChannel[channelId] = nextCursor;
      deps.hasMoreByChannel[channelId] = hasMore && Boolean(nextCursor);
    }
  }

  /**
   * 以 cursor 分页方式加载当前频道更早的历史消息。
   *
   * @returns Promise<void>。
   */
  async function loadMoreMessages(): Promise<void> {
    const channelId = deps.currentChannelId.value.trim();
    if (!channelId) return;
    if (deps.loadingMoreMessages.value) return;
    if (!deps.hasMoreByChannel[channelId]) return;

    const cursor = String(deps.nextCursorByChannel[channelId] ?? "").trim();
    if (!cursor) {
      deps.hasMoreByChannel[channelId] = false;
      return;
    }

    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) return;

    deps.loadingMoreMessages.value = true;
    try {
      const res: ListMessagesResponseDto = await deps.api.listChannelMessages(socket, token, channelId, cursor, 50);
      const items = Array.isArray(res.items) ? res.items : [];
      const mapped: ChatMessage[] = [];
      for (const m of items) mapped.push(deps.mapWireMessage(socket, m));

      const existing = deps.messagesByChannel[channelId] ?? [];
      deps.messagesByChannel[channelId] = deps.mergeMessages(existing, mapped);

      const nextCursor = String(res.next_cursor ?? "").trim();
      const hasMore = Boolean(res.has_more);
      deps.nextCursorByChannel[channelId] = nextCursor;
      deps.hasMoreByChannel[channelId] = hasMore && Boolean(nextCursor);
    } finally {
      deps.loadingMoreMessages.value = false;
    }
  }

  return { loadChannelMessages, refreshChannelLatestPage, loadMoreMessages };
}
