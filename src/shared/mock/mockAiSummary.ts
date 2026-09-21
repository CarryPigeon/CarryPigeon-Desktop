/**
 * @fileoverview mockAiSummary.ts
 * @description AI 总结与群通知的确定性 mock 数据构造（纯函数，便于单测）。
 */

/**
 * 对消息列表做确定性 extractive 摘要。
 *
 * 规则：
 * - 过滤空消息；
 * - 取前 5 条消息，各截断到 60 个字符；
 * - 以 "• " 前缀逐行拼接，并在头部带消息条数统计。
 *
 * @param messages - 原始消息文本列表。
 * @returns 摘要文本。
 */
export function buildMockAiSummary(messages: readonly string[]): string {
  const trimmed = messages.map((m) => String(m ?? "").trim()).filter(Boolean);
  if (trimmed.length === 0) return "No messages to summarize.";
  const head = trimmed.slice(0, 5).map((m) => `• ${m.length > 60 ? `${m.slice(0, 57)}...` : m}`);
  const more = trimmed.length > 5 ? `\n…and ${trimmed.length - 5} more message(s)` : "";
  return `Summary of ${trimmed.length} message(s):\n${head.join("\n")}${more}`;
}

/**
 * mock AI 摘要请求体。
 */
export type MockAiSummarizeRequest = {
  channel_id?: string;
  messages?: unknown;
};

/**
 * 构造 `/ai/summarize` 的 mock 响应体。
 *
 * @param body - 请求体。
 * @returns 响应体（含 summary 与 channel_id 回显）。
 */
export function buildMockAiSummarizeResponse(body: MockAiSummarizeRequest | null | undefined): {
  summary: string;
  channel_id: string;
  message_count: number;
} {
  const messages = Array.isArray(body?.messages) ? body.messages.map((m) => String(m)) : [];
  return {
    summary: buildMockAiSummary(messages),
    channel_id: String(body?.channel_id ?? ""),
    message_count: messages.length,
  };
}

/**
 * mock 群通知条目。
 */
export type MockGroupNotice = {
  notice_id: string;
  title: string;
  body: string;
  level: "info" | "warning" | "critical";
  issued_at: number;
};

/**
 * 固定种子的伪随机（确定性，避免测试抖动）。
 */
function seeded(n: number): number {
  const x = Math.sin(n + 1) * 10000;
  return x - Math.floor(x);
}

/**
 * 构造 `/group/notices` 的 mock 通知列表。
 *
 * 说明：条目内容固定；`issued_at` 基于固定基准时间加确定性偏移，
 * 保证同一输入得到稳定输出。
 *
 * @param channelId - 频道 id（用于条目去重命名）。
 * @returns 通知列表。
 */
export function buildMockGroupNotices(channelId: string): MockGroupNotice[] {
  const ch = String(channelId ?? "").trim() || "default";
  const base = 1735689600000; // 2025-01-01T00:00:00Z，固定基准
  const levels: MockGroupNotice["level"][] = ["info", "warning", "critical"];
  return [0, 1, 2].map((i) => ({
    notice_id: `mock-notice-${ch}-${i + 1}`,
    title: `Group notice ${i + 1} of ${ch}`,
    body:
      i === 0
        ? "Weekly maintenance window: Sunday 02:00-04:00 (UTC). Services may be briefly unavailable."
        : i === 1
          ? "Channel policy updated: keep discussions on-topic and tag off-topic messages."
          : "Security reminder: never share verification codes with anyone claiming to be staff.",
    level: levels[i],
    issued_at: base + Math.floor(seeded(i + 1) * 3600000),
  }));
}
