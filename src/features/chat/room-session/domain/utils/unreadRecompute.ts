/**
 * @fileoverview unread 角标本地重算工具。
 * @description
 * 服务端 unread 接口存在已知缺陷（已删除/撤回消息仍计入未读、两套未读体系不联动）。
 * 由于服务端不可改动，客户端在「已加载本地时间线」的频道上以本地可见消息 + 已读标记为
 * 准重算角标数字，覆盖服务端返回的值。
 *
 * 设计约束：
 * - 纯函数，不依赖 Vue / Tauri / 浏览器 API；
 * - 未加载本地时间线的频道无法重算，必须回退到服务端原始值；
 * - 仅影响显示，不修改服务端已读游标。
 */

import type { ChatMessage } from "@/features/chat/message-flow/api-types";
import { isMessageAfterReadMarker } from "@/features/chat/domain/utils/readMarker";

/**
 * 本地重算未读数的入参。
 */
export type RecomputeChannelUnreadInput = {
  /** 服务端返回的未读数（回退值）。 */
  serverUnread: number;
  /** 本地时间线消息（仅已加载过消息的频道才有）。 */
  messages: readonly ChatMessage[];
  /** 本地已读标记时间（epoch 毫秒）。 */
  lastReadTimeMs: number;
  /** 本地已读标记消息 id。 */
  lastReadMessageId: string;
};

/**
 * 以本地可见消息重算频道未读数。
 *
 * 规则：
 * - 统计「位于已读标记之后」且「未被撤回」的消息条数；
 * - 已删除消息已从时间线移除，天然不计入；
 * - 已撤回消息（`recalledAt` 有值）显式排除，与服务端缺陷对齐。
 *
 * @returns 重算后的未读数；若本地时间线为空（未加载）返回 null，调用方应回退服务端值。
 */
export function recomputeChannelUnread(input: RecomputeChannelUnreadInput): number | null {
  const list = input.messages;
  if (!list || list.length === 0) return null;

  let count = 0;
  for (const message of list) {
    if (message.recalledAt != null && message.recalledAt > 0) continue;
    if (isMessageAfterReadMarker(message.timeMs ?? 0, message.id ?? "", input.lastReadTimeMs, input.lastReadMessageId)) {
      count += 1;
    }
  }
  return count;
}

/**
 * 选择上报已读时应使用的最后消息 id。
 *
 * 服务端要求 `last_read_mid` 必须对应一条真实存在的消息；若本地最后一条消息已被
 * 撤回或删除，上报会被服务端拒绝并导致已读游标卡死。因此从尾部向前跳过撤回消息，
 * 回退到已存读标记或空串。
 *
 * @param messages 本地时间线消息（按时间/序号升序，末位为最新）。
 * @param fallbackMid 当时间线无可上报消息时回退的已读标记 id。
 */
export function pickReportableLastMid(
  messages: readonly ChatMessage[],
  fallbackMid: string,
): string {
  const list = messages;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const message = list[i];
    if (!message?.id) continue;
    if (message.recalledAt != null && message.recalledAt > 0) continue;
    return String(message.id);
  }
  return String(fallbackMid ?? "").trim();
}
