/**
 * @fileoverview chat｜presentation：插件频道消息读取桥。
 * @description
 * 实现 `PluginMessagesApi`（`host.messages`，由 "messages:read" 权限门控），
 * 让面板型插件（如 ai-summary）读取**当前频道**已载入的消息，而不是要求用户手动粘贴。
 *
 * 边界：
 * - 只读当前频道，不接受任意 channelId；
 * - `readCurrentChannel` 纯粹读取时间线快照，不发起网络请求、不改动聊天视图；
 *   同时回报聊天视图当前多选中的消息 id（用户圈定范围，不构成额外读取权限）；
 * - `loadMoreHistory` 复用既有幂等翻页（无 cursor / 正在翻页 / 无会话时自动 no-op），
 *   调用方必须是用户显式动作（面板按钮）。
 */

import type { PluginMessagesApi } from "@/features/plugins/api-types";
import {
  currentChannelHasMore,
  currentChannelId,
  currentMessages,
  getSelectedIds,
  loadMoreMessages,
} from "@/features/chat/message-flow/presentation/store-access/messageFlowStoreAccess";
import { allChannels } from "@/features/chat/room-session/presentation/store-access/sessionStoreAccess";
import { createLogger } from "@/shared/utils/logger";
import {
  MAX_PLUGIN_CHANNEL_MESSAGES,
  intersectSelectedIds,
  projectChannelMessages,
} from "./channelMessageProjection";

const logger = createLogger("chatPluginMessagesBridge");

/** 宿主当前未选择频道时的空快照。 */
function emptySnapshot() {
  return {
    channelId: "",
    channelName: "",
    totalCount: 0,
    truncated: false,
    hasMoreHistory: false,
    capturedAtMs: 0,
    messages: [],
    selectedMessageIds: [],
    selectedTotalCount: 0,
  };
}

/**
 * 读取聊天视图当前多选的原始 id（store 未就绪或读取失败时回退为空）。
 *
 * 说明：多选读取失败不应让整份快照失败，否则插件会误判为“宿主不支持读取频道消息”。
 *
 * @returns 多选 id 列表；不可用时为空数组。
 */
function readSelectedIds(): string[] {
  try {
    const ids = getSelectedIds();
    return Array.isArray(ids) ? ids.map((id) => String(id ?? "")) : [];
  } catch (e) {
    logger.warn("Action: chat_plugin_messages_selection_read_failed", { error: String(e) });
    return [];
  }
}

/**
 * 把请求的上限钳制到 `[1, MAX_PLUGIN_CHANNEL_MESSAGES]`（非数字回退到上限）。
 *
 * @param raw - 插件传入的 `maxMessages`。
 * @returns 生效上限。
 */
function clampMaxMessages(raw: unknown): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return MAX_PLUGIN_CHANNEL_MESSAGES;
  return Math.min(MAX_PLUGIN_CHANNEL_MESSAGES, Math.max(1, Math.trunc(value)));
}

/**
 * 解析频道展示名（目录缺失时回退为频道 id）。
 *
 * @param channelId - 频道 id。
 * @returns 展示名。
 */
function resolveChannelName(channelId: string): string {
  const channel = allChannels.value.find((item) => item.id === channelId);
  return String(channel?.name ?? "").trim() || channelId;
}

export const chatPluginMessagesBridge: PluginMessagesApi = {
  async readCurrentChannel(input) {
    const channelId = String(currentChannelId.value ?? "").trim();
    if (!channelId) return emptySnapshot();
    const projected = projectChannelMessages(currentMessages.value, clampMaxMessages(input?.maxMessages));
    // 多选范围复用聊天视图既有状态：与 messages 同频道、同权限，只是按用户圈定收敛。
    const rawSelectedIds = readSelectedIds();
    return {
      channelId,
      channelName: resolveChannelName(channelId),
      totalCount: projected.totalCount,
      truncated: projected.truncated,
      hasMoreHistory: Boolean(currentChannelHasMore.value),
      capturedAtMs: Date.now(),
      messages: projected.messages,
      selectedMessageIds: intersectSelectedIds(projected.messages, rawSelectedIds),
      selectedTotalCount: rawSelectedIds.length,
    };
  },

  async loadMoreHistory() {
    const channelId = String(currentChannelId.value ?? "").trim();
    if (!channelId) return { loadedCount: 0, loadedDelta: 0, hasMore: false };

    const before = currentMessages.value.length;
    if (!currentChannelHasMore.value) {
      return { loadedCount: before, loadedDelta: 0, hasMore: false };
    }

    try {
      await loadMoreMessages();
    } catch (e) {
      // 翻页失败不抛进插件运行时：回报零增量，由面板提示“请稍后重试”。
      logger.warn("Action: chat_plugin_messages_load_more_failed", { channelId, error: String(e) });
      return {
        loadedCount: currentMessages.value.length,
        loadedDelta: 0,
        hasMore: Boolean(currentChannelHasMore.value),
      };
    }

    const after = currentMessages.value.length;
    return {
      loadedCount: after,
      loadedDelta: Math.max(0, after - before),
      hasMore: Boolean(currentChannelHasMore.value),
    };
  },
};
