/**
 * @fileoverview liveChat 频道视图动作（选择频道/读状态上报/消息定位）。
 * @description chat｜展示层（store 子模块）：liveChatChannelView。
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
import type { ChatChannel, ChatMessage } from "../chatStoreTypes";

/**
 * 读状态上报器能力子集（避免对具体实现产生强耦合）。
 */
export type LiveChatReadStateReporterPort = {
  advanceLocalReadTime: (cid: string, nowMs: number) => number;
  canReportNow: (cid: string, nowMs: number, minIntervalMs: number) => boolean;
  reportIfAllowed: (
    cid: string,
    lastReadMid: string,
    lastReadTimeMs: number,
    nowMs: number,
    minIntervalMs: number,
  ) => Promise<boolean>;
};

/**
 * 频道视图动作集合的依赖集合。
 */
export type LiveChatChannelViewDeps = {
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
   * channelId → last_read_time（毫秒）。
   */
  lastReadTimeMsByChannel: Record<string, number>;
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
  readStateReporter: LiveChatReadStateReporterPort;
};

/**
 * 创建频道视图动作集合。
 *
 * @param deps - 依赖集合。
 * @returns `{ getMessageById, selectChannel, reportCurrentReadState }`。
 */
export function createLiveChatChannelViewActions(deps: LiveChatChannelViewDeps) {
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
   * @returns Promise<void>。
   */
  async function selectChannel(id: string): Promise<void> {
    const cid = String(id).trim();
    if (!cid) return;
    deps.currentChannelId.value = cid;

    const ch = deps.channelsRef.value.find((x) => x.id === cid);
    const prevUnread = ch?.unread ?? 0;
    if (ch) ch.unread = 0;

    await deps.loadChannelMessages(cid);
    void deps.refreshMembersRail(cid);

    const list = deps.messagesByChannel[cid] ?? [];
    const last = list[list.length - 1];
    const lastMid = last?.id ? String(last.id) : "";
    if (!lastMid) return;

    const now = Date.now();
    const prevReadTime = Number(deps.lastReadTimeMsByChannel[cid] ?? 0);
    const nextReadTime = deps.readStateReporter.advanceLocalReadTime(cid, now);
    const lastReportAt = Number(deps.lastReadReportAtMsByChannel[cid] ?? 0);
    const shouldReport =
      (prevUnread > 0 || prevReadTime <= 0 || now - lastReportAt > 60_000) &&
      deps.readStateReporter.canReportNow(cid, now, 1500);
    if (!shouldReport) return;

    void deps.readStateReporter.reportIfAllowed(cid, lastMid, nextReadTime, now, 1500);
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
    void deps.readStateReporter.reportIfAllowed(cid, lastMid, nextReadTime, now, 1500);
  }

  return { getMessageById, selectChannel, reportCurrentReadState };
}
