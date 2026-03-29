/**
 * @fileoverview room-session WS 连接管理器（连接/复用/关闭/reauth）。
 * @description chat/room-session｜application：会话 WS 连接句柄管理器。
 */

import type { ChatEventsClient, ChatEventsConnectOptions } from "@/features/chat/domain/ports/chatEventsPort";
import type { ChatEventEnvelope } from "@/features/chat/domain/types/chatEventModels";
import type { SessionEventsPort } from "./ports";

export type ChatSessionWsManager = {
  isConnectedFor(socketKey: string): boolean;
  close(): void;
  ensureConnected(
    socketKey: string,
    accessToken: string,
    onEvent: (evt: ChatEventEnvelope) => void,
    options?: ChatEventsConnectOptions,
  ): void;
  reauthIfConnectedFor(socketKey: string, nextAccessToken: string): void;
};

export function createSessionWsManager(events: SessionEventsPort): ChatSessionWsManager {
  let client: ChatEventsClient | null = null;
  let key: string = "";

  function close(): void {
    if (!client) return;
    client.close();
    client = null;
    key = "";
  }

  function isConnectedFor(socketKey: string): boolean {
    const nextKey = String(socketKey ?? "").trim();
    return Boolean(client) && Boolean(nextKey) && key === nextKey;
  }

  function ensureConnected(
    socketKey: string,
    accessToken: string,
    onEvent: (evt: ChatEventEnvelope) => void,
    options?: ChatEventsConnectOptions,
  ): void {
    const nextKey = String(socketKey ?? "").trim();
    if (!nextKey) return;
    if (isConnectedFor(nextKey)) return;
    close();
    key = nextKey;
    client = events.connect(nextKey, accessToken, onEvent, options);
  }

  function reauthIfConnectedFor(socketKey: string, nextAccessToken: string): void {
    if (!client) return;
    const nextKey = String(socketKey ?? "").trim();
    if (!nextKey || key !== nextKey) return;
    const token = String(nextAccessToken ?? "").trim();
    if (!token) return;
    client.reauth(token);
  }

  return { isConnectedFor, close, ensureConnected, reauthIfConnectedFor };
}
