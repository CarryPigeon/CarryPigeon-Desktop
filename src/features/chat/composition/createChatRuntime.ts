/**
 * @fileoverview chat runtime registry
 * @description
 * 负责组装 chat 聚合 store 与各子域公开 store。
 * chat 的对象缓存与复用策略统一收敛在本文件，作为唯一 application/runtime 装配根。
 *
 * 约束：
 * - 这里是 chat feature 内部唯一允许做“全局缓存”的位置；
 * - 其他模块只应通过 `getRoomSessionStore()` / `getMessageFlowStore()` /
 *   `getRoomGovernanceStore()` 获取稳定切片。
 */

import { getChatAggregateStore } from "@/features/chat/composition/chat.di";
import {
  createMessageFlowSlice,
  createRoomGovernanceSlice,
  createRoomSessionSlice,
} from "@/features/chat/composition/store/createChatStoreSlices";
import type {
  ChatRuntime,
  ChatRuntimeAggregateStore,
  MessageFlowRuntimeStore,
  RoomGovernanceRuntimeStore,
  RoomSessionRuntimeStore,
} from "@/features/chat/composition/contracts/chatStoreTypes";

type ChatRuntimeAssembly = {
  runtime: ChatRuntime;
};

let cachedChatRuntimeAssembly: ChatRuntimeAssembly | null = null;

/**
 * 基于聚合 store 构造 chat runtime。
 *
 * 设计原因：
 * - `aggregate` 负责承载完整状态与动作；
 * - 子域 runtime store 只在 feature 内部流转，避免暴露完整聚合对象。
 */
function createChatStoreRuntime(aggregateStore: ChatRuntimeAggregateStore): ChatRuntime {
  return {
    session: createRoomSessionSlice(aggregateStore),
    messageFlow: createMessageFlowSlice(aggregateStore),
    governance: createRoomGovernanceSlice(aggregateStore),
  };
}

/**
 * 构建 chat application/runtime 装配根。
 *
 * 顺序固定为：
 * 1. 创建底层 ports；
 * 2. 基于 ports 创建 application services；
 * 3. 基于 application services 组装 presentation gateway；
 * 4. 按 mock/live 选择聚合 store；
 * 5. 从聚合 store 切出子域公开 store。
 */
function buildChatRuntimeAssembly(): ChatRuntimeAssembly {
  const aggregateStore = getChatAggregateStore();
  return {
    runtime: createChatStoreRuntime(aggregateStore),
  };
}

function getChatRuntime(): ChatRuntime {
  if (!cachedChatRuntimeAssembly) cachedChatRuntimeAssembly = buildChatRuntimeAssembly();
  return cachedChatRuntimeAssembly.runtime;
}

/**
 * 获取 room-session 公开 runtime store。
 */
export function getRoomSessionStore(): RoomSessionRuntimeStore {
  return getChatRuntime().session;
}

/**
 * 获取 message-flow 公开 runtime store。
 */
export function getMessageFlowStore(): MessageFlowRuntimeStore {
  return getChatRuntime().messageFlow;
}

/**
 * 获取 room-governance 公开 runtime store。
 */
export function getRoomGovernanceStore(): RoomGovernanceRuntimeStore {
  return getChatRuntime().governance;
}
