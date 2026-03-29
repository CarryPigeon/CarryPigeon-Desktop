/**
 * @fileoverview chat Feature 对外公共 API。
 * @description
 * 聚合 room-session、message-flow、room-governance 三个子域能力。
 *
 * 边界约定：
 * - 跨 feature 仅通过本文件访问 chat 能力；
 * - `chat/domain/ports/*` 与 `chat/data/*` 属于 feature 内部边界，不作为跨 feature 稳定入口。
 */

import { createMessageFlowCapabilities } from "./message-flow/api";
import { createRoomGovernanceCapabilities } from "./room-governance/api";
import { createRoomSessionCapabilities } from "./room-session/api";
import type { ChatCapabilities } from "./api-types";

let cachedChatCapabilities: ChatCapabilities | null = null;

/**
 * 组装 chat feature 的公共 capability 对象（不缓存）。
 *
 * 说明：
 * - 返回值只公开跨 feature 真正需要的稳定能力面；
 * - 子域内部 store/runtime 细节保持封装在 feature 内部。
 */
export function createChatCapabilities(): ChatCapabilities {
  const roomSessionCapabilities = createRoomSessionCapabilities();
  const messageFlowCapabilities = createMessageFlowCapabilities();
  const roomGovernanceCapabilities = createRoomGovernanceCapabilities();

  return {
    session: {
      directory: roomSessionCapabilities.directory,
      currentChannel: roomSessionCapabilities.currentChannel,
    },
    messageFlow: {
      currentChannel: messageFlowCapabilities.currentChannel,
      composer: messageFlowCapabilities.composer,
      forChannel: messageFlowCapabilities.forChannel,
    },
    governance: {
      currentChannel: roomGovernanceCapabilities.currentChannel,
      createChannel: roomGovernanceCapabilities.createChannel,
      forChannel: roomGovernanceCapabilities.forChannel,
    },
  };
}

/**
 * 获取 chat feature 的应用级 capability 单例访问器。
 */
export function getChatCapabilities(): ChatCapabilities {
  if (!cachedChatCapabilities) {
    cachedChatCapabilities = createChatCapabilities();
  }
  return cachedChatCapabilities;
}
