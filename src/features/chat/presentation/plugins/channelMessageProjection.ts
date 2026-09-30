/**
 * @fileoverview chat｜presentation：频道消息 → 插件只读投影（纯函数）。
 * @description
 * 把渲染用 `ChatMessage` 归一为插件可消费的最小只读形状，供 AI 总结等面板型插件使用。
 * 该文件不依赖 store / Vue 运行时，便于单测覆盖裁剪与过滤规则。
 */

import type { ChatMessage } from "@/features/chat/message-flow/api-types";
import type { PluginChannelMessage } from "@/features/plugins/api-types";

/**
 * 单次读取允许返回的最大消息条数。
 *
 * 与宿主 AI 总结上限（`MAX_SUMMARIZE_MESSAGES`）保持一致，避免插件拿到不会被送进模型的尾部数据。
 */
export const MAX_PLUGIN_CHANNEL_MESSAGES = 500;

/**
 * 把一条渲染消息投影为可读文本。
 *
 * 规则与既有展示口径一致（`core_text` 取正文，其余取 `preview`）：
 * 图片/视频在 `preview` 为空时回退为 `[Image] 文件名` / `[Video] 文件名` 占位。
 *
 * @param message - 渲染用消息。
 * @returns 文本投影（可能为空字符串）。
 */
function projectMessageText(message: ChatMessage): string {
  switch (message.kind) {
    case "core_text":
      return String(message.text ?? "").trim();
    case "domain_message":
      return String(message.preview ?? "").trim();
    case "image":
    case "video": {
      const preview = String(message.preview ?? "").trim();
      if (preview) return preview;
      const placeholder = message.kind === "image" ? "[Image]" : "[Video]";
      const fileName = String(message.fileName ?? "").trim();
      return fileName ? `${placeholder} ${fileName}` : placeholder;
    }
    default:
      return "";
  }
}

/**
 * 投影结果。
 */
export type ChannelMessageProjection = {
  /** 已过滤、裁剪后的消息列表（时间线顺序，旧 → 新）。 */
  messages: PluginChannelMessage[];
  /** 传入时间线的消息总数（过滤与裁剪之前）。 */
  totalCount: number;
  /** 是否因 `maxMessages` 上限被裁剪。 */
  truncated: boolean;
};

/**
 * 项目化频道消息。
 *
 * 规则：
 * - 过滤已撤回消息（`recalledAt` 有值）与文本投影为空的条目；
 * - 保持传入顺序（时间线已按时间升序维护），只取**最后** `maxMessages` 条；
 * - `truncated` 以“可总结条数”是否超过上限为准，`totalCount` 以传入条数为准。
 *
 * @param messages - 时间线消息（按时间升序）。
 * @param maxMessages - 单次最大条数（调用方负责钳制到合法区间）。
 * @returns 投影结果。
 */
export function projectChannelMessages(
  messages: readonly ChatMessage[],
  maxMessages: number,
): ChannelMessageProjection {
  const source = Array.isArray(messages) ? messages : [];
  const limit = Number.isFinite(maxMessages) ? Math.max(1, Math.trunc(maxMessages)) : MAX_PLUGIN_CHANNEL_MESSAGES;

  const projected: PluginChannelMessage[] = [];
  for (const message of source) {
    if (!message) continue;
    if (message.recalledAt != null) continue;
    const text = projectMessageText(message);
    if (!text) continue;
    const senderId = String(message.from?.id ?? "").trim();
    const senderName = String(message.from?.name ?? "").trim() || senderId;
    projected.push({
      messageId: String(message.id ?? "").trim(),
      senderId,
      senderName,
      timeMs: Number(message.timeMs) || 0,
      text,
    });
  }

  const truncated = projected.length > limit;
  return {
    messages: truncated ? projected.slice(projected.length - limit) : projected,
    totalCount: source.length,
    truncated,
  };
}

/**
 * 把聊天视图的多选 id 收敛为本次快照中“可参与总结”的 id。
 *
 * 规则：
 * - 只保留能在 `messages` 中找到对应条目的 id（已撤回/投影为空/未载入的选中项被丢弃）；
 * - 保持 `messages` 的时间线顺序（旧 → 新），并去重；
 * - 空字符串 id 直接忽略。
 *
 * @param messages - 投影后的消息列表（时间线顺序）。
 * @param selectedIds - 聊天视图当前多选的原始 id 列表。
 * @returns 可参与总结的选中消息 id（时间线顺序）。
 */
export function intersectSelectedIds(
  messages: readonly PluginChannelMessage[],
  selectedIds: readonly string[],
): string[] {
  const source = Array.isArray(selectedIds) ? selectedIds : [];
  const wanted = new Set<string>();
  for (const raw of source) {
    const id = String(raw ?? "").trim();
    if (id) wanted.add(id);
  }
  if (wanted.size === 0) return [];

  const result: string[] = [];
  const seen = new Set<string>();
  for (const message of Array.isArray(messages) ? messages : []) {
    const id = String(message?.messageId ?? "").trim();
    if (!id || seen.has(id) || !wanted.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}
