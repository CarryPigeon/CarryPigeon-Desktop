/**
 * @fileoverview chat runtime registry
 * @description
 * 负责组装 chat 聚合 store 与各子域公开 store。
 * chat 的对象缓存与复用策略统一收敛在本文件，作为唯一 composition root。
 */

import { selectByMockMode } from "@/shared/config/mockModeSelector";
import { createMockChatStore } from "@/features/chat/mock/mockChatStore";
import { createChatRuntimeStore } from "@/features/chat/presentation/store/live/chatRuntimeStore";
import {
  createMessageFlowSlice,
  createRoomGovernanceSlice,
  createRoomSessionSlice,
} from "@/features/chat/presentation/store/chatStoreSlices";
import type {
  ChatRuntime,
  ChatRuntimeStore,
  MessageFlowRuntimeStore,
  RoomGovernanceRuntimeStore,
  RoomSessionRuntimeStore,
} from "@/features/chat/presentation/store/chatStoreTypes";
import { createChatApiGateway, createChatEventsGateway } from "./chatGatewayFactory";
import { createChatPorts } from "./chatPorts";
import { createChatUsecases } from "./chatUsecases";

type ChatCompositionRoot = {
  runtime: ChatRuntime;
};

let cachedChatCompositionRoot: ChatCompositionRoot | null = null;

/**
 * 基于聚合 store 构造 chat runtime。
 *
 * 设计原因：
 * - `aggregate` 负责承载完整状态与动作；
 * - 子域 runtime store 只在 feature 内部流转，避免暴露完整聚合对象。
 */
function createChatStoreRuntime(aggregateStore: ChatRuntimeStore): ChatRuntime {
  return {
    session: createRoomSessionSlice(aggregateStore),
    messageFlow: createMessageFlowSlice(aggregateStore),
    governance: createRoomGovernanceSlice(aggregateStore),
  };
}

/**
 * 构建 chat composition root。
 *
 * 顺序固定为：
 * 1. 创建底层 ports；
 * 2. 基于 ports 创建用例；
 * 3. 基于用例组装 presentation gateway；
 * 4. 按 mock/live 选择聚合 store；
 * 5. 从聚合 store 切出子域公开 store。
 */
function buildChatCompositionRoot(): ChatCompositionRoot {
  const ports = createChatPorts();
  const usecases = createChatUsecases(ports);
  const chatApiGateway = createChatApiGateway({
    listChannels: usecases.listChannels,
    getUnreads: usecases.getUnreads,
    listChannelMessages: usecases.listChannelMessages,
    sendMessage: usecases.sendMessage,
    deleteMessage: usecases.deleteMessage,
    updateReadState: usecases.updateReadState,
    applyJoinChannel: usecases.applyJoinChannel,
    patchChannel: usecases.patchChannel,
    listChannelMembers: usecases.listChannelMembers,
    kickChannelMember: usecases.kickChannelMember,
    addChannelAdmin: usecases.addChannelAdmin,
    removeChannelAdmin: usecases.removeChannelAdmin,
    listChannelApplications: usecases.listChannelApplications,
    decideChannelApplication: usecases.decideChannelApplication,
    listChannelBans: usecases.listChannelBans,
    putChannelBan: usecases.putChannelBan,
    deleteChannelBan: usecases.deleteChannelBan,
    createChannel: usecases.createChannel,
    deleteChannel: usecases.deleteChannel,
  });
  const chatEventsGateway = createChatEventsGateway(usecases.connectChatEvents);
  const aggregateStore = selectByMockMode<ChatRuntimeStore>({
    off: () => createChatRuntimeStore({ api: chatApiGateway, events: chatEventsGateway }),
    store: () => createMockChatStore(),
    protocol: () => createChatRuntimeStore({ api: chatApiGateway, events: chatEventsGateway }),
  });
  return {
    runtime: createChatStoreRuntime(aggregateStore),
  };
}

function getChatRuntime(): ChatRuntime {
  if (!cachedChatCompositionRoot) cachedChatCompositionRoot = buildChatCompositionRoot();
  return cachedChatCompositionRoot.runtime;
}

export function getRoomSessionStore(): RoomSessionRuntimeStore {
  return getChatRuntime().session;
}

export function getMessageFlowStore(): MessageFlowRuntimeStore {
  return getChatRuntime().messageFlow;
}

export function getRoomGovernanceStore(): RoomGovernanceRuntimeStore {
  return getChatRuntime().governance;
}
