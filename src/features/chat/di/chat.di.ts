/**
 * @fileoverview chat.di.ts
 * @description chat｜依赖组装（DI）：chat.di。
 *
 * 职责：
 * - 根据运行时配置选择 store 实现（mock vs live）。
 * - 为 live store 提供所需 ports（API + events）。
 * - 提供领域用例（usecase）的工厂方法，供展示层调用。
 */

import { selectByMockMode } from "@/shared/config/mockModeSelector";
import type { ChatApiPort } from "../domain/ports/chatApiPort";
import type { ChatEventsPort } from "../domain/ports/chatEventsPort";
import { httpChatApiPort } from "../data/httpChatApiPort";
import { wsChatEventsPort } from "../data/wsChatEventsPort";
import { createMockChatStore } from "@/features/chat/mock/mockChatStore";
import { createLiveChatStore } from "@/features/chat/presentation/store/liveChatStore";
import type { ChatStore } from "@/features/chat/presentation/store/chatStoreTypes";

// 用例
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
 * 获取 chat API port（单例）。
 *
 * @returns `ChatApiPort` 实例。
 */
export function getChatApiPort(): ChatApiPort {
  if (apiPort) return apiPort;
  apiPort = httpChatApiPort;
  return apiPort;
}

/**
 * 获取 chat events port（单例）。
 *
 * @returns `ChatEventsPort` 实例。
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
 * 获取 chat store（展示层 store，单例）。
 *
 * mock 选择规则：
 * - `IS_STORE_MOCK=true`：使用确定性的内存 store（用于 UI 预览/开发联调）。
 * - 其它情况：使用由 ports 驱动的 live store。
 *
 * @returns `ChatStore` 实例。
 */
export function getChatStore(): ChatStore {
  if (store) return store;
  store = selectByMockMode<ChatStore>({
    off: () => createLiveChatStore({ api: getChatApiPort(), events: getChatEventsPort() }),
    store: () => createMockChatStore(),
    protocol: () => createLiveChatStore({ api: getChatApiPort(), events: getChatEventsPort() }),
  });
  return store;
}

// ============================================================================
// 用例
// ============================================================================

/**
 * 获取 `ListChannels` 用例实例。
 *
 * @returns `ListChannels` 实例。
 */
export function getListChannelsUsecase(): ListChannels {
  return new ListChannels(getChatApiPort());
}

/**
 * 获取 `GetUnreads` 用例实例。
 *
 * @returns `GetUnreads` 实例。
 */
export function getGetUnreadsUsecase(): GetUnreads {
  return new GetUnreads(getChatApiPort());
}

/**
 * 获取 `ListChannelMessages` 用例实例。
 *
 * @returns `ListChannelMessages` 实例。
 */
export function getListChannelMessagesUsecase(): ListChannelMessages {
  return new ListChannelMessages(getChatApiPort());
}

/**
 * 获取 `SendMessage` 用例实例。
 *
 * @returns `SendMessage` 实例。
 */
export function getSendMessageUsecase(): SendMessage {
  return new SendMessage(getChatApiPort());
}

/**
 * 获取 `DeleteMessage` 用例实例。
 *
 * @returns `DeleteMessage` 实例。
 */
export function getDeleteMessageUsecase(): DeleteMessage {
  return new DeleteMessage(getChatApiPort());
}

/**
 * 获取 `UpdateReadState` 用例实例。
 *
 * @returns `UpdateReadState` 实例。
 */
export function getUpdateReadStateUsecase(): UpdateReadState {
  return new UpdateReadState(getChatApiPort());
}

/**
 * 获取 `ApplyJoinChannel` 用例实例。
 *
 * @returns `ApplyJoinChannel` 实例。
 */
export function getApplyJoinChannelUsecase(): ApplyJoinChannel {
  return new ApplyJoinChannel(getChatApiPort());
}

/**
 * 获取 `PatchChannel` 用例实例。
 *
 * @returns `PatchChannel` 实例。
 */
export function getPatchChannelUsecase(): PatchChannel {
  return new PatchChannel(getChatApiPort());
}

/**
 * 获取 `ConnectChatEvents` 用例实例。
 *
 * @returns `ConnectChatEvents` 实例。
 */
export function getConnectChatEventsUsecase(): ConnectChatEvents {
  return new ConnectChatEvents(getChatEventsPort());
}
