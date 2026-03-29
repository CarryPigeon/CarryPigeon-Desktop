/**
 * @fileoverview 消息分页与补拉（HTTP list + cursor 状态机）。
 * @description chat/message-flow｜application：消息分页与最新页补拉编排。
 */

import type { Ref } from "vue";
import type { ChatMessagePage, ChatMessageRecord } from "@/features/chat/domain/types/chatApiModels";
import type { ChatMessage } from "@/features/chat/message-flow/contracts";
import type { MessageFlowApiPort } from "./ports";

type MapWireMessage = (serverSocket: string, msg: ChatMessageRecord) => ChatMessage;
type MergeMessages = (existing: ChatMessage[], incoming: ChatMessage[]) => ChatMessage[];
const LATEST_PAGE_LIMIT = 50;

export type MessagePagingDeps = {
  api: MessageFlowApiPort;
  mapWireMessage: MapWireMessage;
  mergeMessages: MergeMessages;
  getSocketAndValidToken: () => Promise<[string, string]>;
  getActiveServerSocket: () => string;
  getActiveScopeVersion: () => number;
  currentChannelId: Ref<string>;
  messagesByChannel: Record<string, ChatMessage[]>;
  nextCursorByChannel: Record<string, string>;
  hasMoreByChannel: Record<string, boolean>;
  loadingMoreByChannel: Record<string, boolean>;
};

export type MessagePaging = {
  loadChannelMessages(cid: string): Promise<void>;
  refreshChannelLatestPage(cid: string): Promise<void>;
  loadMoreMessages(): Promise<void>;
};

export function createMessagePaging(deps: MessagePagingDeps): MessagePaging {
  async function fetchLatestPage(
    cid: string,
  ): Promise<{ requestSocket: string; channelId: string; mapped: ChatMessage[]; nextCursor: string; hasMore: boolean } | null> {
    const [socket, token] = await deps.getSocketAndValidToken();
    const channelId = String(cid).trim();
    if (!socket || !token || !channelId) return null;
    const requestSocket = socket;
    const requestScopeVersion = deps.getActiveScopeVersion();

    const res: ChatMessagePage = await deps.api.listChannelMessages(socket, token, channelId, undefined, LATEST_PAGE_LIMIT);
    if (deps.getActiveServerSocket() !== requestSocket) return null;
    if (deps.getActiveScopeVersion() !== requestScopeVersion) return null;
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
    deps.messagesByChannel[page.channelId] = deps.mergeMessages([], page.mapped);
    deps.nextCursorByChannel[page.channelId] = page.nextCursor;
    deps.hasMoreByChannel[page.channelId] = page.hasMore && Boolean(page.nextCursor);
  }

  async function refreshChannelLatestPage(cid: string): Promise<void> {
    const page = await fetchLatestPage(cid);
    if (!page) return;
    const existing = deps.messagesByChannel[page.channelId] ?? [];
    deps.messagesByChannel[page.channelId] = deps.mergeMessages(existing, page.mapped);

    if (!(page.channelId in deps.nextCursorByChannel) || !(page.channelId in deps.hasMoreByChannel)) {
      deps.nextCursorByChannel[page.channelId] = page.nextCursor;
      deps.hasMoreByChannel[page.channelId] = page.hasMore && Boolean(page.nextCursor);
    }
  }

  async function loadMoreMessages(): Promise<void> {
    const channelId = deps.currentChannelId.value.trim();
    if (!channelId) return;
    if (!deps.hasMoreByChannel[channelId]) return;

    const cursor = String(deps.nextCursorByChannel[channelId] ?? "").trim();
    const loading = Boolean(deps.loadingMoreByChannel[channelId]);
    if (loading) return;
    if (!cursor) {
      deps.hasMoreByChannel[channelId] = false;
      return;
    }

    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) return;
    const requestSocket = socket;
    const requestScopeVersion = deps.getActiveScopeVersion();

    deps.loadingMoreByChannel[channelId] = true;
    try {
      const res: ChatMessagePage = await deps.api.listChannelMessages(socket, token, channelId, cursor, LATEST_PAGE_LIMIT);
      if (deps.getActiveServerSocket() !== requestSocket) return;
      if (deps.getActiveScopeVersion() !== requestScopeVersion) return;
      const items = Array.isArray(res.items) ? res.items : [];
      const mapped: ChatMessage[] = [];
      for (const m of items) mapped.push(deps.mapWireMessage(socket, m));

      const existing = deps.messagesByChannel[channelId] ?? [];
      deps.messagesByChannel[channelId] = deps.mergeMessages(existing, mapped);

      const nextCursor = String(res.nextCursor ?? "").trim();
      const hasMore = Boolean(res.hasMore);
      deps.nextCursorByChannel[channelId] = nextCursor;
      deps.hasMoreByChannel[channelId] = hasMore && Boolean(nextCursor);
    } finally {
      if (deps.getActiveServerSocket() !== requestSocket) return;
      if (deps.getActiveScopeVersion() !== requestScopeVersion) return;
      deps.loadingMoreByChannel[channelId] = false;
    }
  }

  return { loadChannelMessages, refreshChannelLatestPage, loadMoreMessages };
}
