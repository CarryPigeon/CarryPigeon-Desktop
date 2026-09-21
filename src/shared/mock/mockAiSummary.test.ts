/**
 * @fileoverview mockAiSummary 单元测试。
 * @description 验证 AI 摘要与群通知 mock 的确定性与边界行为。
 */

import { describe, expect, it } from "vitest";
import {
  buildMockAiSummarizeResponse,
  buildMockAiSummary,
  buildMockGroupNotices,
} from "./mockAiSummary";

describe("buildMockAiSummary", () => {
  it("空消息列表返回占位摘要", () => {
    expect(buildMockAiSummary([])).toBe("No messages to summarize.");
  });

  it("过滤空白消息并统计有效条数", () => {
    const summary = buildMockAiSummary(["hello", "  ", "", "world"]);
    expect(summary).toContain("2 message(s)");
    expect(summary).toContain("hello");
    expect(summary).toContain("world");
  });

  it("超过 5 条时截断并提示剩余数量", () => {
    const messages = Array.from({ length: 8 }, (_, i) => `m${i}`);
    const summary = buildMockAiSummary(messages);
    expect(summary).toContain("8 message(s)");
    expect(summary).toContain("and 3 more message(s)");
    expect(summary).not.toContain("• m7");
  });

  it("单条超长消息被截断到 60 字符", () => {
    const long = "x".repeat(100);
    const summary = buildMockAiSummary([long]);
    const line = summary.split("\n")[1];
    expect(line.length).toBeLessThanOrEqual(63); // "• " + 57 + "..."
    expect(line.endsWith("...")).toBe(true);
  });
});

describe("buildMockAiSummarizeResponse", () => {
  it("回显 channel_id 与消息条数", () => {
    const res = buildMockAiSummarizeResponse({ channel_id: "ch-1", messages: ["a", "b"] });
    expect(res.channel_id).toBe("ch-1");
    expect(res.message_count).toBe(2);
    expect(res.summary).toContain("a");
  });

  it("畸形请求体按空消息处理", () => {
    expect(buildMockAiSummarizeResponse(null).message_count).toBe(0);
    expect(buildMockAiSummarizeResponse({ messages: "not-an-array" }).message_count).toBe(0);
  });
});

describe("buildMockGroupNotices", () => {
  it("返回 3 条确定性通知", () => {
    const a = buildMockGroupNotices("ch-1");
    const b = buildMockGroupNotices("ch-1");
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(a.map((n) => n.level)).toEqual(["info", "warning", "critical"]);
    expect(a.every((n) => n.notice_id.startsWith("mock-notice-ch-1-"))).toBe(true);
  });

  it("不同频道生成不同的 notice_id", () => {
    const a = buildMockGroupNotices("ch-1");
    const b = buildMockGroupNotices("ch-2");
    expect(a[0].notice_id).not.toBe(b[0].notice_id);
  });

  it("空频道 id 退化为 default 命名空间", () => {
    const a = buildMockGroupNotices("");
    expect(a[0].notice_id).toBe("mock-notice-default-1");
  });
});
