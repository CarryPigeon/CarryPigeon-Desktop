/**
 * @fileoverview AI 总结 domain 纯函数：频道消息投影、请求体构造、响应与缓存解析。
 * @description 不依赖 Vue / Tauri / 浏览器 API，可独立单测。
 */

import type { PluginChannelMessage } from "@/features/plugins/api-types";
import { computeScopeFingerprint } from "./summarizeScope";

/** `/api/ai/summarize` 请求体（服务端契约固定，保持不变）。 */
export type SummarizeRequestBody = {
  channel_id: string;
  messages: string[];
};

/** 归一化后的总结响应 */
export type SummarizeResult = {
  summary: string;
  channelId: string;
  messageCount: number;
};

/** 响应解析结果：成功携带结果，失败携带结构化错误 */
export type SummarizeParseResult =
  | { ok: true; result: SummarizeResult }
  | { ok: false; error: string };

/** 总结来源：客户端自配 provider 或服务端端点。 */
export type SummarySource =
  | { kind: "client"; provider: string; model: string }
  | { kind: "server" };

/**
 * 落盘的单频道总结缓存。
 *
 * 说明：只保存摘要正文与“指纹”（参与总结消息集合的指纹 + 末条消息 id + 参与条数 + 读取时刻），
 * **不保存任何消息正文**，避免把聊天内容写进插件存储。
 */
export type CachedSummary = {
  summary: string;
  channelId: string;
  messageCount: number;
  latestMessageId: string;
  /** 参与总结消息集合的指纹（见 `computeScopeFingerprint`），用于新鲜度判定。 */
  scopeFingerprint: string;
  capturedAtMs: number;
  sourceKind: SummarySource["kind"];
  provider: string;
  model: string;
};

/**
 * 把频道消息投影为“每行一条”的总结输入。
 *
 * 规则：
 * - 形如 `发送者: 内容`，便于模型区分发言人与上下文；
 * - `senderName` 为空时退化为纯内容；
 * - trim 后为空的行丢弃。
 *
 * @param messages - 宿主读取到的频道消息（时间升序）。
 * @returns 逐行消息文本。
 */
export function buildChannelMessageLines(messages: readonly PluginChannelMessage[]): string[] {
  const source = Array.isArray(messages) ? messages : [];
  const lines: string[] = [];
  for (const message of source) {
    const text = String(message?.text ?? "").trim();
    if (!text) continue;
    const senderName = String(message?.senderName ?? "").trim();
    lines.push(senderName ? `${senderName}: ${text}` : text);
  }
  return lines;
}

/**
 * 构造总结请求体（服务端端点专用）。
 *
 * @param channelId - 频道 id。
 * @param messages - 宿主读取到的频道消息（时间升序）。
 * @returns 请求体对象。
 */
export function buildSummarizeRequestBody(
  channelId: string,
  messages: readonly PluginChannelMessage[],
): SummarizeRequestBody {
  return {
    channel_id: String(channelId ?? "").trim(),
    messages: buildChannelMessageLines(messages),
  };
}

/**
 * 读取末条消息 id（用于缓存新鲜度判定）。
 *
 * @param messages - 频道消息（时间升序）。
 * @returns 末条消息 id；无消息时为空字符串。
 */
export function latestMessageIdOf(messages: readonly PluginChannelMessage[]): string {
  const source = Array.isArray(messages) ? messages : [];
  for (let i = source.length - 1; i >= 0; i -= 1) {
    const id = String(source[i]?.messageId ?? "").trim();
    if (id) return id;
  }
  return "";
}

/**
 * 判断缓存是否仍然新鲜。
 *
 * 新鲜条件（同时成立）：
 * - 缓存带有集合指纹，且与本次参与总结的消息集合一致；
 * - 参与条数一致（指纹已隐含条数，此处作为二次防御）。
 *
 * 由于指纹按“实际参与总结的消息集合”计算，范围（时间范围 / 聊天多选）或时间线变化
 * 都会让旧摘要自然过期，而范围未变时（例如翻页后范围外新增历史）可直接复用。
 *
 * @param cached - 已落盘缓存；无缓存时为 `null`。
 * @param scopedMessages - 本次实际参与总结的消息（时间线顺序）。
 * @returns 新鲜时为 `true`（可跳过重新生成）。
 */
export function isCacheFresh(
  cached: CachedSummary | null,
  scopedMessages: readonly PluginChannelMessage[],
): boolean {
  if (!cached) return false;
  const fingerprint = computeScopeFingerprint(scopedMessages);
  if (!fingerprint || !cached.scopeFingerprint) return false;
  return cached.scopeFingerprint === fingerprint && cached.messageCount === scopedMessages.length;
}

/**
 * 解析缓存存储值（容错：形状不符时视为无缓存）。
 *
 * 兼容旧版本缓存：缺失 `scopeFingerprint` / `latestMessageId` / `capturedAtMs` 时按空值归一，
 * 由此在 {@link isCacheFresh} 中自然判定为“过期”，触发一次重新生成。
 *
 * @param raw - 存储读取到的原始值。
 * @returns 归一化缓存；不可用时为 `null`。
 */
export function parseCachedSummary(raw: unknown): CachedSummary | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const summary = typeof r.summary === "string" ? r.summary.trim() : "";
  if (!summary) return null;
  const countNum = Number(r.messageCount);
  const capturedNum = Number(r.capturedAtMs);
  const sourceKind = r.sourceKind === "client" ? "client" : "server";
  return {
    summary: r.summary as string,
    channelId: String(r.channelId ?? ""),
    messageCount: Number.isFinite(countNum) ? countNum : 0,
    latestMessageId: String(r.latestMessageId ?? ""),
    scopeFingerprint: String(r.scopeFingerprint ?? ""),
    capturedAtMs: Number.isFinite(capturedNum) && capturedNum > 0 ? capturedNum : 0,
    sourceKind,
    provider: String(r.provider ?? ""),
    model: String(r.model ?? ""),
  };
}

/**
 * 解析并校验 `/api/ai/summarize` 响应体 bodyText。
 *
 * 规则：
 * - bodyText 必须是合法 JSON 对象；
 * - summary 必须是非空 string，否则返回结构化错误；
 * - channel_id / message_count 容错归一化（缺省回退请求侧值由调用方处理）。
 *
 * @param bodyText - 响应体文本。
 * @returns 解析结果。
 */
export function parseSummarizeResponse(bodyText: string): SummarizeParseResult {
  const text = String(bodyText ?? "").trim();
  if (!text) {
    return { ok: false, error: "empty response body" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid JSON response" };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "response body is not an object" };
  }
  const r = parsed as Record<string, unknown>;
  if (typeof r.summary !== "string" || r.summary.trim() === "") {
    return { ok: false, error: "summary must be a non-empty string" };
  }
  const messageCountRaw = r.message_count;
  const messageCount =
    typeof messageCountRaw === "number"
      ? messageCountRaw
      : Number(String(messageCountRaw ?? "").trim() || Number.NaN);
  return {
    ok: true,
    result: {
      summary: r.summary,
      channelId: String(r.channel_id ?? ""),
      messageCount: Number.isFinite(messageCount) ? messageCount : 0,
    },
  };
}
