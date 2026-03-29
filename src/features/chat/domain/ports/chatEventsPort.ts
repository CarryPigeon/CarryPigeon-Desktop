/**
 * @fileoverview chatEventsPort.ts
 * @description chat｜领域端口：chatEventsPort。
 *
 * 说明：
 * - 该端口抽象“推送通道”（通常为 WebSocket）。
 * - `connect` 的能力刻意保持“窄接口”：由 store 基于会话变更与 UI 生命周期驱动 reauth/close。
 * - 该端口用于 chat feature 内部（domain/usecase/di/data）依赖倒置；跨 feature 请使用 `@/features/chat/api`。
 */

import type { ChatEventEnvelope } from "../types/chatEventModels";

export type ChatEventsClient = {
  close(): void;
  reauth(nextAccessToken: string): void;
};

export type ChatEventsConnectOptions = {
  wsUrlOverride?: string;
  onResumeFailed?: (reason: string) => void;
  onAuthError?: (reason: string) => void;
};

export type ChatEventsPort = {
  connect(
    serverSocket: string,
    accessToken: string,
    onEvent: (evt: ChatEventEnvelope) => void,
    options?: ChatEventsConnectOptions,
  ): ChatEventsClient;
};
