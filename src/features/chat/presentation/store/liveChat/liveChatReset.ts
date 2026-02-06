/**
 * @fileoverview liveChat 状态重置与资源清理（server 切换场景）。
 * @description chat｜展示层状态（store）：liveChatReset。
 *
 * 背景：
 * - liveChatStore 是“按 server socket”维度的状态机；
 * - 当用户切换 server（或 server socket 变化）时，必须清理旧连接/定时器，并重置所有缓存状态，
 *   避免消息/成员/分页 cursor 等跨 server 泄漏。
 *
 * 约定：
 * - 注释中文；日志英文（本模块不输出日志）。
 */

import type { Ref } from "vue";
import type { ChatChannel, ChatMember, ChatMessage } from "../chatStoreTypes";
import type { LiveChatWsManager } from "./liveChatWsManager";

/**
 * liveChat 重置器的依赖集合。
 */
export type LiveChatResetDeps = {
  /**
   * WS 连接管理器（用于关闭旧连接）。
   */
  wsManager: LiveChatWsManager;
  /**
   * 停止 polling（幂等）。
   */
  stopPolling: () => void;
  /**
   * 停止 session hooks（自动刷新 + 会话监听）（幂等）。
   */
  stopSessionHooks: () => void;
  /**
   * 频道列表容器。
   */
  channelsRef: Ref<ChatChannel[]>;
  /**
   * 成员侧栏容器。
   */
  members: Ref<ChatMember[]>;
  /**
   * 当前频道 id。
   */
  currentChannelId: Ref<string>;
  /**
   * 频道 → 消息列表映射。
   */
  messagesByChannel: Record<string, ChatMessage[]>;
  /**
   * 频道 → 最新读时间（ms）。
   */
  lastReadTimeMsByChannel: Record<string, number>;
  /**
   * 频道 → 上一次读状态上报时间（ms）。
   */
  lastReadReportAtMsByChannel: Record<string, number>;
  /**
   * 频道 → next cursor 映射。
   */
  nextCursorByChannel: Record<string, string>;
  /**
   * 频道 → 是否还有更多历史消息。
   */
  hasMoreByChannel: Record<string, boolean>;
  /**
   * 历史分页加载态。
   */
  loadingMoreMessages: Ref<boolean>;
  /**
   * 发送错误提示。
   */
  sendError: Ref<string>;
  /**
   * 文本输入草稿。
   */
  composerDraft: Ref<string>;
  /**
   * 回复目标消息 id。
   */
  replyToMessageId: Ref<string>;
  /**
   * 当前选中 domain id。
   */
  selectedDomainId: Ref<string>;
};

/**
 * 清空 reactive record（通过 delete 保持响应性）。
 *
 * @param record - reactive 对象。
 * @returns void。
 */
function clearReactiveRecord(record: Record<string, unknown>): void {
  for (const k of Object.keys(record)) delete record[k];
}

/**
 * 重置 liveChat 的全部状态，并清理资源（WS/轮询/会话钩子）。
 *
 * @param deps - 依赖注入。
 * @returns void。
 */
export function resetLiveChatState(deps: LiveChatResetDeps): void {
  deps.wsManager.close();
  deps.stopPolling();
  deps.stopSessionHooks();

  deps.channelsRef.value = [];
  deps.members.value = [];
  deps.currentChannelId.value = "";

  clearReactiveRecord(deps.messagesByChannel);
  clearReactiveRecord(deps.lastReadTimeMsByChannel);
  clearReactiveRecord(deps.lastReadReportAtMsByChannel);
  clearReactiveRecord(deps.nextCursorByChannel);
  clearReactiveRecord(deps.hasMoreByChannel);

  deps.loadingMoreMessages.value = false;
  deps.sendError.value = "";
  deps.composerDraft.value = "";
  deps.replyToMessageId.value = "";
  deps.selectedDomainId.value = "Core:Text";
}
