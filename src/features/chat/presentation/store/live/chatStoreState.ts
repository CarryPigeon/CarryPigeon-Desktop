/**
 * @fileoverview chat 实时 Store 状态容器（refs/reactive/computed）。
 * @description chat｜展示层状态（store）：chat store state。
 *
 * 职责：
 * - 组合 session / message-flow / governance 三块局部状态；
 * - 继续对外提供稳定的聚合状态形状，避免影响装配层。
 */

import { createChatGovernanceState } from "./chatGovernanceState";
import { createChatMessageFlowState } from "./chatMessageFlowState";
import { createChatSessionState } from "./chatSessionState";

/**
 * 创建 chat 实时 Store 的状态容器。
 *
 * @returns chat 状态与派生视图。
 */
export function createChatStoreState() {
  const session = createChatSessionState();
  const messageFlow = createChatMessageFlowState({
    currentChannelId: session.currentChannelId,
  });
  const governance = createChatGovernanceState();

  return {
    ...session,
    ...messageFlow,
    ...governance,
    loadingMoreMessages: messageFlow.currentChannelLoadingMore,
  };
}
