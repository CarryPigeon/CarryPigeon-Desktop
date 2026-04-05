/**
 * @fileoverview chatEventsPort.ts
 * @description chat｜领域端口：chatEventsPort。
 *
 * 说明：
 * - 该端口抽象“推送通道”（通常为 WebSocket）。
 * - `connect` 的能力刻意保持“窄接口”：由 store 基于会话变更与 UI 生命周期驱动 reauth/close。
 * - 该端口用于 chat feature 内部（domain/usecase/composition/adapters）依赖倒置；跨 feature 请使用 `@/features/chat/public/api`。
 */

import type { ChatEventEnvelope, ChatEventsClient, ChatEventsConnectOptions } from "../types/chatEventModels";

/**
 * chat 领域事件流端口。
 */
export type ChatEventsPort = {
  connect(
    serverSocket: string,
    accessToken: string,
    onEvent: (evt: ChatEventEnvelope) => void,
    options?: ChatEventsConnectOptions,
  ): ChatEventsClient;
};
