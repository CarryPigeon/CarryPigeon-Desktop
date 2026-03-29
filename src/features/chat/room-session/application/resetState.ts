/**
 * @fileoverview 会话状态重置与资源清理（server 切换场景）。
 * @description chat/room-session｜application：server 切换时的会话状态重置。
 *
 * 背景：
 * - chat session store 是“按 server socket”维度的状态机；
 * - 当用户切换 server（或 server socket 变化）时，必须清理旧连接/定时器，并重置所有缓存状态，
 *   避免消息/成员/分页 cursor 等跨 server 泄漏。
 *
 * 约定：
 * - 注释中文；日志英文（本模块不输出日志）。
 */

import type { Ref } from "vue";
import type { ChatMessage, ChatMessageActionErrorInfo } from "@/features/chat/message-flow/contracts";
import type { ChatMember } from "@/features/chat/room-governance/contracts";
import type { ChatChannel } from "@/features/chat/room-session/contracts";

/**
 * room-session 重置器的依赖集合。
 */
export type ResetRoomSessionStateDeps = {
  /**
   * 释放当前 server scope 下的连接链路资源。
   *
   * 说明：
   * - 由上层连接生命周期运行时提供；
   * - 内部负责关闭 WS、停止 polling、解绑会话 hooks。
   */
  teardownConnectionLifecycle: () => void;
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
   * 频道 → 最新读消息 id（mid）。
   */
  lastReadMidByChannel: Record<string, string>;
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
   * 频道 -> 历史分页加载态。
   */
  loadingMoreByChannel: Record<string, boolean>;
  /**
   * 当前 server-scope 版本号（用于异步写回防污染）。
   */
  scopeVersion: Ref<number>;
  /**
   * 发送错误提示。
   */
  messageActionError: Ref<ChatMessageActionErrorInfo | null>;
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
 * 重置 room-session 的全部状态，并清理资源（WS/轮询/会话钩子）。
 *
 * @param deps - 依赖注入。
 * @returns void。
 */
export function resetRoomSessionState(deps: ResetRoomSessionStateDeps): void {
  deps.teardownConnectionLifecycle();

  deps.channelsRef.value = [];
  deps.members.value = [];
  deps.currentChannelId.value = "";

  clearReactiveRecord(deps.messagesByChannel);
  clearReactiveRecord(deps.lastReadTimeMsByChannel);
  clearReactiveRecord(deps.lastReadMidByChannel);
  clearReactiveRecord(deps.lastReadReportAtMsByChannel);
  clearReactiveRecord(deps.nextCursorByChannel);
  clearReactiveRecord(deps.hasMoreByChannel);
  clearReactiveRecord(deps.loadingMoreByChannel);
  deps.scopeVersion.value += 1;

  deps.messageActionError.value = null;
  deps.composerDraft.value = "";
  deps.replyToMessageId.value = "";
  deps.selectedDomainId.value = "Core:Text";
}
