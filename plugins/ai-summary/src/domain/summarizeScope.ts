/**
 * @fileoverview AI 总结 domain 纯函数：参与范围（时间范围 + 聊天区多选）与集合指纹。
 * @description 不依赖 Vue / Tauri / 浏览器 API，可独立单测。
 *
 * 范围语义（两者同时生效时取交集）：
 * - **时间范围**：闭区间过滤，任一端为 `null` 表示该侧不限；结束端点补齐到所选分钟的
 *   最后一毫秒，避免用户选到 10:05 却漏掉 10:05:30 的消息；
 * - **消息范围**：`selection` 模式只取聊天区当前多选中的消息，`all` 模式取时间范围全部候选。
 */

import type { PluginChannelMessage } from "@/features/plugins/api-types";

/** 消息范围模式：`all` 取时间范围内全部候选；`selection` 只取聊天区多选中的消息。 */
export type ScopeMode = "all" | "selection";

/** 时间范围（ms 闭区间；`null` 表示该侧不限）。 */
export type ScopeTimeRange = {
  startMs: number | null;
  endMs: number | null;
};

/** 不做时间限定。 */
export const UNBOUNDED_RANGE: ScopeTimeRange = { startMs: null, endMs: null };

/** 快速范围预设。 */
export type QuickRangeKind = "none" | "hour" | "today" | "week";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const WEEK_MS = 7 * 24 * HOUR_MS;

/**
 * 把任意入参归一为时间戳（缺省 / 空值 / 非有限数 → null）。
 *
 * 注意：不能直接用 `Number(raw)` 判空——`Number(null)` 与 `Number("")` 都是 0，
 * 会把"不限"误判成 1970-01-01，导致时间范围过滤掉全部消息。
 *
 * @param raw - 原始值。
 * @returns 时间戳（ms）或 null。
 */
function normalizeBound(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : null;
}

/**
 * 把时间点补到所在分钟的最后一毫秒。
 *
 * @param ms - 时间戳（ms）。
 * @returns 该分钟末尾的时间戳。
 */
function ceilToMinuteEnd(ms: number): number {
  return ms - (ms % MINUTE_MS) + MINUTE_MS - 1;
}

/**
 * 归一化时间范围。
 *
 * 规则：
 * - 缺失 / 非数字端点 → `null`（该侧不限）；
 * - 起止逆序时自动交换；
 * - 结束端点补齐到所在分钟的最后一毫秒（含结束分钟）；开始端点保持原值。
 *
 * @param range - 待归一化范围（可为空）。
 * @returns 归一化后的范围。
 */
export function normalizeTimeRange(
  range: Partial<ScopeTimeRange> | null | undefined,
): ScopeTimeRange {
  const start = normalizeBound(range?.startMs);
  const end = normalizeBound(range?.endMs);
  if (start === null && end === null) return UNBOUNDED_RANGE;
  if (start === null) return { startMs: null, endMs: ceilToMinuteEnd(end as number) };
  if (end === null) return { startMs: start, endMs: null };
  if (start > end) return { startMs: end, endMs: ceilToMinuteEnd(start) };
  return { startMs: start, endMs: ceilToMinuteEnd(end) };
}

/**
 * 判断是否为"不限时间"（两端都不限）。
 *
 * @param range - 时间范围。
 * @returns 两端皆不限时为 `true`。
 */
export function isUnboundedRange(range: Partial<ScopeTimeRange> | null | undefined): boolean {
  return normalizeBound(range?.startMs) === null && normalizeBound(range?.endMs) === null;
}

/**
 * 按时间范围过滤消息（闭区间，保持传入顺序）。
 *
 * @param messages - 频道消息（时间升序）。
 * @param range - 时间范围；端点为 `null` 表示该侧不限。
 * @returns 范围内的消息；无时间戳（非有限数）的消息视为不在范围内。
 */
export function filterMessagesByRange(
  messages: readonly PluginChannelMessage[],
  range: Partial<ScopeTimeRange> | null | undefined,
): PluginChannelMessage[] {
  const source = Array.isArray(messages) ? messages : [];
  const start = normalizeBound(range?.startMs);
  const end = normalizeBound(range?.endMs);
  const result: PluginChannelMessage[] = [];
  for (const message of source) {
    const timeMs = Number(message?.timeMs);
    if (!Number.isFinite(timeMs)) continue;
    if (start !== null && timeMs < start) continue;
    if (end !== null && timeMs > end) continue;
    result.push(message);
  }
  return result;
}

/**
 * 本地当天零点时间戳。
 *
 * @param ms - 基准时间戳（ms）。
 * @returns 当地 00:00:00.000 的时间戳。
 */
function startOfLocalDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * 计算快速范围预设。
 *
 * - `none`：不限时间；
 * - `hour`：最近 1 小时 → 现在；
 * - `today`：本地当天零点 → 现在；
 * - `week`：最近 7 天 → 现在。
 *
 * @param kind - 预设类型。
 * @param nowMs - 基准时间戳（ms），便于测试注入。
 * @returns 归一化后的时间范围。
 */
export function quickRangeOf(kind: QuickRangeKind, nowMs: number): ScopeTimeRange {
  const now = normalizeBound(nowMs) ?? Date.now();
  switch (kind) {
    case "hour":
      return normalizeTimeRange({ startMs: now - HOUR_MS, endMs: now });
    case "today":
      return normalizeTimeRange({ startMs: startOfLocalDay(now), endMs: now });
    case "week":
      return normalizeTimeRange({ startMs: now - WEEK_MS, endMs: now });
    default:
      return UNBOUNDED_RANGE;
  }
}

/**
 * 计算实际参与总结的消息。
 *
 * 顺序：先按时间范围筛出候选，再按模式取子集；结果保持时间升序。
 *
 * @param messages - 频道消息（时间升序）。
 * @param range - 时间范围。
 * @param mode - 消息范围模式。
 * @param selectedIds - 聊天区多选中的消息 id（`selection` 模式使用）。
 * @returns 参与总结的消息；交集为空时返回空数组。
 */
export function resolveScopeMessages(
  messages: readonly PluginChannelMessage[],
  range: Partial<ScopeTimeRange> | null | undefined,
  mode: ScopeMode,
  selectedIds: readonly string[],
): PluginChannelMessage[] {
  const candidates = filterMessagesByRange(messages, range);
  if (mode !== "selection") return candidates;

  const wanted = new Set<string>();
  for (const raw of Array.isArray(selectedIds) ? selectedIds : []) {
    const id = String(raw ?? "").trim();
    if (id) wanted.add(id);
  }
  if (wanted.size === 0) return [];
  return candidates.filter((message) => wanted.has(String(message?.messageId ?? "").trim()));
}

/** FNV-1a 32 位初始值与质数。 */
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
/** id 之间的分隔符，避免 `["ab","c"]` 与 `["a","bc"]` 碰撞。 */
const ID_SEPARATOR = 0x1f;

/**
 * 计算消息集合指纹（FNV-1a 32 位，8 位十六进制）。
 *
 * 用途：缓存新鲜度判定——指纹一致说明"参与总结的这批消息"没变，可直接复用上次摘要。
 * 约束：入参必须按时间线顺序传入，指纹对顺序敏感（顺序不同 → 指纹不同）。
 *
 * @param messages - 参与总结的消息（时间线顺序）。
 * @returns 指纹；空集合返回空字符串（调用方据此判定为不可复用）。
 */
export function computeScopeFingerprint(messages: readonly PluginChannelMessage[]): string {
  const source = Array.isArray(messages) ? messages : [];
  if (source.length === 0) return "";

  let hash = FNV_OFFSET_BASIS;
  for (const message of source) {
    const id = String(message?.messageId ?? "");
    for (let i = 0; i < id.length; i += 1) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, FNV_PRIME);
    }
    hash ^= ID_SEPARATOR;
    hash = Math.imul(hash, FNV_PRIME);
  }
  hash ^= source.length;
  hash = Math.imul(hash, FNV_PRIME);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
