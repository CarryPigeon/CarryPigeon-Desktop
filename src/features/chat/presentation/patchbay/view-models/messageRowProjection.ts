/**
 * @fileoverview message row projection
 * @description chat｜view-model：消息流分组投影（纯函数）。
 *
 * 同一发送者在「半天」内连续发送的消息视为一组：仅组首展示名字、头像与时间戳，
 * 组内其余消息只保留消息内容本身。本模块不依赖 Vue / Tauri / 浏览器 API，便于单测。
 */

import type { ChatMessage } from "@/features/chat/message-flow/api-types";
import { isSameUserId } from "@/features/chat/shared-kernel/userId";
import { isMessageAfterReadMarker } from "@/features/chat/presentation/utils/readMarker";

/**
 * 消息分组窗口：半天（12 小时）。
 *
 * 相邻两条消息时间差小于该值时，若发送者相同则归入同一组。
 */
export const MESSAGE_GROUP_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * 单条消息行所需的派生投影字段。
 */
export type MessageRowProjection = {
  /** 是否为分组首条（决定名字 / 头像 / 时间戳是否渲染）。 */
  isGroupStart: boolean;
  /** 是否为未读边界（该条消息之前插入未读分隔符）。 */
  isUnreadStart: boolean;
  /** 组首时间戳是否需要带上日期（与上一条消息不在同一自然日）。 */
  showDate: boolean;
};

/**
 * 读标记投影输入。
 */
export type ReadMarkerProjectionInput = {
  lastReadTimeMs: number;
  lastReadMessageId: string;
};

/**
 * 判断两个时间戳是否落在同一自然日（按本地时区）。
 *
 * @param a - 时间戳 A。
 * @param b - 时间戳 B。
 * @returns 同年同月同日时为 `true`。
 */
export function isSameCalendarDay(a: number, b: number): boolean {
  const left = new Date(a);
  const right = new Date(b);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

/**
 * 按「同发送者 + 半天窗口」把消息列表投影为行级分组信息。
 *
 * 规则：
 * - 列表首条（无上一条）恒为组首；
 * - 发送者变化（按归一化 userId 比较）或时间差 ≥ {@link MESSAGE_GROUP_WINDOW_MS} 时为组首；
 * - 未读边界条强制为组首，避免未读分隔符后出现「无头像无名字」的孤行；
 * - 组首与上一条消息不在同一自然日时标记 `showDate`。
 *
 * @param messages - 按时间正序排列的消息列表。
 * @param readMarker - 当前会话读标记。
 * @returns 与 `messages` 等长的行投影数组。
 */
export function projectMessageRows(
  messages: readonly ChatMessage[],
  readMarker: ReadMarkerProjectionInput,
): MessageRowProjection[] {
  const rows: MessageRowProjection[] = [];
  const { lastReadTimeMs, lastReadMessageId } = readMarker;

  for (let idx = 0; idx < messages.length; idx += 1) {
    const m = messages[idx];
    const prev = idx > 0 ? messages[idx - 1] : null;

    const sameSender = prev ? isSameUserId(prev.from.id, m.from.id) : false;
    const closeInTime = prev ? Math.abs(m.timeMs - prev.timeMs) < MESSAGE_GROUP_WINDOW_MS : false;
    const isGroupStart = !(sameSender && closeInTime);

    const isUnread = isMessageAfterReadMarker(m.timeMs, m.id, lastReadTimeMs, lastReadMessageId);
    const prevUnread = prev
      ? isMessageAfterReadMarker(prev.timeMs, prev.id, lastReadTimeMs, lastReadMessageId)
      : false;
    const isUnreadStart = isUnread && !prevUnread;

    rows.push({
      // 未读边界条自身需要可见的头像与名字，因此强制开启新组。
      isGroupStart: isGroupStart || isUnreadStart,
      isUnreadStart,
      showDate: prev ? !isSameCalendarDay(prev.timeMs, m.timeMs) : false,
    });
  }

  return rows;
}

/**
 * 格式化组首时间戳。
 *
 * @param timeMs - 消息时间戳。
 * @param showDate - 是否需要带上 `MM-DD` 日期前缀。
 * @returns `HH:MM` 或 `MM-DD HH:MM`。
 */
export function formatGroupHeadTime(timeMs: number, showDate: boolean): string {
  const d = new Date(timeMs);
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  if (!showDate) return `${hour}:${minute}`;
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}
