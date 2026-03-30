/**
 * @fileoverview chat Feature 对外公共 API。
 * @description
 * 聚合 room-session、message-flow、room-governance 三个子域能力。
 *
 * 边界约定：
 * - 跨 feature 仅通过本文件访问 chat 能力；
 * - `chat/presentation/*`、`chat/application/*`、`chat/domain/*`、`chat/data/*` 与各子域内部目录都属于 feature 内部边界，不作为跨 feature 稳定入口。
 */

import { createMessageFlowCapabilities } from "../message-flow/api";
import { createRoomGovernanceCapabilities } from "../room-governance/api";
import { createRoomSessionCapabilities } from "../room-session/api";
import type { ChatCapabilities } from "./api-types";

let cachedChatCapabilities: ChatCapabilities | null = null;

/**
 * 组装 chat feature 的公共 capability 对象（不缓存）。
 *
 * 说明：
 * - 返回值只公开跨 feature 真正需要的稳定能力面；
 * - 子域内部 store/runtime 细节保持封装在 feature 内部。
 *
 * 分组原因：
 * - `session` 负责会话与当前频道切换语义；
 * - `messageFlow` 负责时间线与 composer；
 * - `governance` 负责成员/申请/封禁/频道治理。
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
 *
 * 适用场景：
 * - app composition root
 * - 需要跨 feature 复用 chat 能力的上层模块
 *
 * 不适用场景：
 * - chat feature 内部子模块之间相互调用
 *   这些场景应继续走内部 runtime / application 边界，而不是回绕公共 API。
 */
export function getChatCapabilities(): ChatCapabilities {
  if (!cachedChatCapabilities) {
    cachedChatCapabilities = createChatCapabilities();
  }
  return cachedChatCapabilities;
}
