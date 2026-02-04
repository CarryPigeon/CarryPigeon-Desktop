/**
 * @fileoverview chat.di.ts
 * @description Composition root for chat feature.
 *
 * Responsibilities:
 * - Choose which store implementation to use (mock vs live) based on runtime config.
 * - Provide the live store with its required ports (API + events).
 * - Provide usecase factories for domain operations.
 */

import { MOCK_MODE } from "@/shared/config/runtime";
import type { ChatApiPort } from "../domain/ports/chatApiPort";
import type { ChatEventsPort } from "../domain/ports/chatEventsPort";
import { httpChatApiPort } from "../data/httpChatApiPort";
import { wsChatEventsPort } from "../data/wsChatEventsPort";
import { createMockChatStore } from "@/features/chat/mock/mockChatStore";
import { createLiveChatStore } from "@/features/chat/presentation/store/liveChatStore";
import type { ChatStore } from "@/features/chat/presentation/store/chatStoreTypes";

// Usecases
import { ListChannels } from "../domain/usecases/ListChannels";
import { GetUnreads } from "../domain/usecases/GetUnreads";
import { ListChannelMessages } from "../domain/usecases/ListChannelMessages";
import { SendMessage } from "../domain/usecases/SendMessage";
import { DeleteMessage } from "../domain/usecases/DeleteMessage";
import { UpdateReadState } from "../domain/usecases/UpdateReadState";
import { ApplyJoinChannel } from "../domain/usecases/ApplyJoinChannel";
import { PatchChannel } from "../domain/usecases/PatchChannel";
import { ConnectChatEvents } from "../domain/usecases/ConnectChatEvents";

let apiPort: ChatApiPort | null = null;
let eventsPort: ChatEventsPort | null = null;
let store: ChatStore | null = null;

// ============================================================================
// Ports
// ============================================================================

/**
 * Get singleton chat API port.
 *
 * @returns ChatApiPort.
 */
export function getChatApiPort(): ChatApiPort {
  if (apiPort) return apiPort;
  apiPort = httpChatApiPort;
  return apiPort;
}

/**
 * Get singleton chat events port.
 *
 * @returns ChatEventsPort.
 */
export function getChatEventsPort(): ChatEventsPort {
  if (eventsPort) return eventsPort;
  eventsPort = wsChatEventsPort;
  return eventsPort;
}

// ============================================================================
// Store (presentation layer)
// ============================================================================

/**
 * Get singleton chat store.
 *
 * Mock rules:
 * - `MOCK_MODE="store"` uses a deterministic in-memory store.
 * - Other modes use the live store backed by ports.
 *
 * @returns ChatStore.
 */
export function getChatStore(): ChatStore {
  if (store) return store;
  if (MOCK_MODE === "store") {
    store = createMockChatStore();
    return store;
  }
  store = createLiveChatStore({ api: getChatApiPort(), events: getChatEventsPort() });
  return store;
}

// ============================================================================
// Usecases
// ============================================================================

/**
 * Get ListChannels usecase.
 *
 * @returns ListChannels usecase instance.
 */
export function getListChannelsUsecase(): ListChannels {
  return new ListChannels(getChatApiPort());
}

/**
 * Get GetUnreads usecase.
 *
 * @returns GetUnreads usecase instance.
 */
export function getGetUnreadsUsecase(): GetUnreads {
  return new GetUnreads(getChatApiPort());
}

/**
 * Get ListChannelMessages usecase.
 *
 * @returns ListChannelMessages usecase instance.
 */
export function getListChannelMessagesUsecase(): ListChannelMessages {
  return new ListChannelMessages(getChatApiPort());
}

/**
 * Get SendMessage usecase.
 *
 * @returns SendMessage usecase instance.
 */
export function getSendMessageUsecase(): SendMessage {
  return new SendMessage(getChatApiPort());
}

/**
 * Get DeleteMessage usecase.
 *
 * @returns DeleteMessage usecase instance.
 */
export function getDeleteMessageUsecase(): DeleteMessage {
  return new DeleteMessage(getChatApiPort());
}

/**
 * Get UpdateReadState usecase.
 *
 * @returns UpdateReadState usecase instance.
 */
export function getUpdateReadStateUsecase(): UpdateReadState {
  return new UpdateReadState(getChatApiPort());
}

/**
 * Get ApplyJoinChannel usecase.
 *
 * @returns ApplyJoinChannel usecase instance.
 */
export function getApplyJoinChannelUsecase(): ApplyJoinChannel {
  return new ApplyJoinChannel(getChatApiPort());
}

/**
 * Get PatchChannel usecase.
 *
 * @returns PatchChannel usecase instance.
 */
export function getPatchChannelUsecase(): PatchChannel {
  return new PatchChannel(getChatApiPort());
}

/**
 * Get ConnectChatEvents usecase.
 *
 * @returns ConnectChatEvents usecase instance.
 */
export function getConnectChatEventsUsecase(): ConnectChatEvents {
  return new ConnectChatEvents(getChatEventsPort());
}
