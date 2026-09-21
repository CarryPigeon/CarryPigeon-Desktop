/**
 * @fileoverview AI 总结 domain 纯函数：请求体构造与响应解析校验。
 * @description 不依赖 Vue / Tauri / 浏览器 API，可独立单测。
 */

/** `/api/ai/summarize` 请求体（宿主契约固定） */
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

/**
 * 构造总结请求体：messages 按行拆分、trim 并过滤空行。
 *
 * @param channelId - 频道 id。
 * @param text - 面板 textarea 文本（每行一条消息）。
 * @returns 请求体对象。
 */
export function buildSummarizeRequestBody(channelId: string, text: string): SummarizeRequestBody {
  const messages = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    channel_id: String(channelId ?? "").trim(),
    messages,
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
