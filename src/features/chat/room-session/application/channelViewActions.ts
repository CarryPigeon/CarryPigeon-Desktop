/**
 * @fileoverview 频道视图动作（选择频道/读状态上报/消息定位）。
 * @description chat/room-session｜application：当前频道会话视图动作编排。
 *
 * 职责：
 * - 提供“进入某频道”的编排：切换当前频道、拉取消息、刷新成员侧栏、推进读状态。
 * - 提供“上报当前读状态”的轻量动作（节流/单调推进由 readStateReporter 负责）。
 * - 提供“按 id 定位消息”的查询能力，便于回复/高亮等交互。
 *
 * 说明：
 * - 本模块不直接依赖网络层；所有 IO 通过注入的函数完成。
 */

import type { Ref } from "vue";
import type { ChatReadStateReporterPort } from "@/features/chat/application/ports/runtimePorts";
import type { ChatMessage } from "@/features/chat/message-flow/contracts";
import type {
  ChannelSelectionErrorCode,
  ChannelSelectionErrorInfo,
  ChannelSelectionOutcome,
  ChatChannel,
} from "@/features/chat/room-session/contracts";

/**
 * 读状态上报器能力子集（避免对具体实现产生强耦合）。
 */
export type ReadStateReporterPort = ChatReadStateReporterPort;

/**
 * 频道视图动作集合的依赖集合。
 */
export type ChannelViewActionsDeps = {
  /**
   * 频道列表引用（用于清空未读计数等 UI 状态）。
   */
  channelsRef: Ref<ChatChannel[]>;
  /**
   * 当前频道 id 引用（将被 `selectChannel` 更新）。
   */
  currentChannelId: Ref<string>;
  /**
   * channelId → message list（UI 缓存）。
   */
  messagesByChannel: Record<string, ChatMessage[]>;
  /**
   * channelId → lastReadTime（毫秒）。
   */
  lastReadTimeMsByChannel: Record<string, number>;
  /**
   * channelId → lastReadMessageId。
   */
  lastReadMidByChannel: Record<string, string>;
  /**
   * channelId → 上一次上报时间（毫秒）。
   */
  lastReadReportAtMsByChannel: Record<string, number>;
  /**
   * 加载指定频道消息（通常为“拉取最新页 + 合并缓存”）。
   */
  loadChannelMessages: (cid: string) => Promise<void>;
  /**
   * 刷新成员侧栏（尽力而为）。
   */
  refreshMembersRail: (cid: string) => Promise<void>;
  /**
   * 读状态推进与上报能力。
   */
  readStateReporter: ReadStateReporterPort;
};

/**
 * 创建频道视图动作集合。
 *
 * @param deps - 依赖集合。
 * @returns `{ getMessageById, selectChannel, reportCurrentReadState }`。
 */
export function createChannelViewActions(deps: ChannelViewActionsDeps) {
  function createSelectionError(
    code: ChannelSelectionErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): ChannelSelectionErrorInfo {
    return {
      code,
      message,
      retryable: code === "select_channel_failed",
      details,
    };
  }

  /**
   * 在指定频道内按 id 查找消息。
   *
   * @param channelId - 频道 id。
   * @param messageId - 消息 id。
   * @returns 找到时返回消息；否则返回 `null`。
   */
  function getMessageById(channelId: string, messageId: string): ChatMessage | null {
    const list = deps.messagesByChannel[channelId] ?? [];
    for (const m of list) {
      if (m.id === messageId) return m;
    }
    return null;
  }

  /**
   * 切换到指定频道，并刷新最新消息与成员侧栏。
   *
   * @param id - 目标频道 id。
   * @returns 显式频道切换结果。
   */
  async function selectChannel(id: string): Promise<ChannelSelectionOutcome> {
    const cid = String(id).trim();
    if (!cid) {
      return {
        ok: false,
        kind: "chat_channel_selection_rejected",
        error: createSelectionError("missing_channel_id", "Missing channel id."),
      };
    }
    const ch = deps.channelsRef.value.find((x) => x.id === cid);
    if (!ch) {
      return {
        ok: false,
        kind: "chat_channel_selection_rejected",
        error: createSelectionError("channel_not_found", "Channel not found.", { channelId: cid }),
      };
    }

    deps.currentChannelId.value = cid;
    const prevUnread = ch?.unread ?? 0;
    if (ch) ch.unread = 0;

    try {
      await deps.loadChannelMessages(cid);
    } catch (e) {
      if (ch) ch.unread = prevUnread;
      return {
        ok: false,
        kind: "chat_channel_selection_rejected",
        error: createSelectionError(
          "select_channel_failed",
          e instanceof Error ? e.message || "Select channel failed." : String(e) || "Select channel failed.",
          { channelId: cid },
        ),
      };
    }
    void deps.refreshMembersRail(cid);

    const list = deps.messagesByChannel[cid] ?? [];
    const last = list[list.length - 1];
    const lastMid = last?.id ? String(last.id) : "";
    if (!lastMid) {
      return {
        ok: true,
        kind: "chat_channel_selected",
        channelId: cid,
      };
    }

    const now = Date.now();
    const prevReadTime = Number(deps.lastReadTimeMsByChannel[cid] ?? 0);
    const nextReadTime = deps.readStateReporter.advanceLocalReadTime(cid, now);
    deps.lastReadMidByChannel[cid] = lastMid;
    const lastReportAt = Number(deps.lastReadReportAtMsByChannel[cid] ?? 0);
    const shouldReport =
      (prevUnread > 0 || prevReadTime <= 0 || now - lastReportAt > 60_000) &&
      deps.readStateReporter.canReportNow(cid, now, 1500);
    if (!shouldReport) {
      return {
        ok: true,
        kind: "chat_channel_selected",
        channelId: cid,
      };
    }

    void deps.readStateReporter.reportIfAllowed(cid, lastMid, nextReadTime, now, 1500);
    return {
      ok: true,
      kind: "chat_channel_selected",
      channelId: cid,
    };
  }

  /**
   * 上报当前频道的读状态（尽力而为）。
   *
   * 预期触发点：
   * - 用户滚动到消息底部
   * - 窗口重新获得焦点且仍在底部
   *
   * @returns Promise<void>。
   */
  async function reportCurrentReadState(): Promise<void> {
    const cid = deps.currentChannelId.value.trim();
    if (!cid) return;
    const list = deps.messagesByChannel[cid] ?? [];
    const last = list[list.length - 1] ?? null;
    const lastMid = last?.id ? String(last.id) : "";
    if (!lastMid) return;

    const now = Date.now();
    const nextReadTime = deps.readStateReporter.advanceLocalReadTime(cid, now);
    deps.lastReadMidByChannel[cid] = lastMid;
    void deps.readStateReporter.reportIfAllowed(cid, lastMid, nextReadTime, now, 1500);
  }

  return { getMessageById, selectChannel, reportCurrentReadState };
}
