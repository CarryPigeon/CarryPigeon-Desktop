/**
 * @fileoverview messageRowProjection.test.ts
 * @description chat｜view-model：消息分组投影纯函数验证。
 *
 * 覆盖：半天分组窗口、发送者归一化比较、未读边界强制成组、跨自然日时间戳格式化。
 */

import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/features/chat/message-flow/api-types";
import {
  MESSAGE_GROUP_WINDOW_MS,
  formatGroupHeadTime,
  projectMessageRows,
} from "./messageRowProjection";

/**
 * 构造一条 core_text 消息。
 *
 * @param overrides - 需要覆盖的字段。
 * @returns 测试用消息。
 */
function makeMessage(overrides: Partial<ChatMessage> & { id: string; timeMs: number }): ChatMessage {
  return {
    kind: "core_text",
    from: { id: "u-1", name: "Operator" },
    domain: { id: "Core:Text", label: "Core:Text", colorVar: "--cp-domain-core" },
    text: "",
    ...overrides,
  } as ChatMessage;
}

/**
 * 构造本地时区的自然日时间戳。
 *
 * @param month - 月份（1-12）。
 * @param day - 日。
 * @param hour - 小时。
 * @param minute - 分钟。
 * @returns 本地时间毫秒戳。
 */
function localTime(year: number, month: number, day: number, hour: number, minute: number): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

const READ_NONE = { lastReadTimeMs: 0, lastReadMessageId: "" };

describe("projectMessageRows 分组窗口", () => {
  it("同一发送者在半天内连续发送时，只有首条是组首", () => {
    const base = localTime(2024, 6, 10, 9, 0);
    const rows = projectMessageRows(
      [
        makeMessage({ id: "m1", timeMs: base }),
        makeMessage({ id: "m2", timeMs: base + 11 * 60 * 60 * 1000 }),
      ],
      READ_NONE,
    );

    expect(rows.map((r) => r.isGroupStart)).toEqual([true, false]);
  });

  it("时间差达到半天时开启新组", () => {
    const base = localTime(2024, 6, 10, 9, 0);
    const rows = projectMessageRows(
      [
        makeMessage({ id: "m1", timeMs: base }),
        makeMessage({ id: "m2", timeMs: base + MESSAGE_GROUP_WINDOW_MS }),
      ],
      READ_NONE,
    );

    expect(rows.map((r) => r.isGroupStart)).toEqual([true, true]);
  });

  it("发送者变化时开启新组（忽略 u: 前缀与大小写差异）", () => {
    const base = localTime(2024, 6, 10, 9, 0);
    const rows = projectMessageRows(
      [
        makeMessage({ id: "m1", timeMs: base, from: { id: "u-1", name: "Operator" } }),
        makeMessage({ id: "m2", timeMs: base + 1000, from: { id: "U:U-1", name: "Operator" } }),
        makeMessage({ id: "m3", timeMs: base + 2000, from: { id: "u-2", name: "Relay" } }),
      ],
      READ_NONE,
    );

    expect(rows.map((r) => r.isGroupStart)).toEqual([true, false, true]);
  });

  it("发送者 id 为空串时各自成组", () => {
    const base = localTime(2024, 6, 10, 9, 0);
    const rows = projectMessageRows(
      [
        makeMessage({ id: "m1", timeMs: base, from: { id: "", name: "System" } }),
        makeMessage({ id: "m2", timeMs: base + 1000, from: { id: "", name: "System" } }),
      ],
      READ_NONE,
    );

    expect(rows.map((r) => r.isGroupStart)).toEqual([true, true]);
  });
});

describe("projectMessageRows 未读边界", () => {
  it("未读起始条强制为组首，并标记 isUnreadStart", () => {
    const base = localTime(2024, 6, 10, 9, 0);
    const rows = projectMessageRows(
      [
        makeMessage({ id: "1", timeMs: base }),
        makeMessage({ id: "2", timeMs: base + 60 * 1000 }),
      ],
      { lastReadTimeMs: base, lastReadMessageId: "1" },
    );

    expect(rows[0]).toMatchObject({ isGroupStart: true, isUnreadStart: false });
    expect(rows[1]).toMatchObject({ isGroupStart: true, isUnreadStart: true, showDate: false });
  });

  it("不修改传入的消息数组", () => {
    const base = localTime(2024, 6, 10, 9, 0);
    const messages = [
      makeMessage({ id: "m1", timeMs: base }),
      makeMessage({ id: "m2", timeMs: base + 1000 }),
    ];
    const snapshot = JSON.parse(JSON.stringify(messages));

    projectMessageRows(messages, READ_NONE);

    expect(messages).toEqual(snapshot);
  });
});

describe("projectMessageRows 跨自然日标记", () => {
  it("与上一条消息不在同一自然日时标记 showDate", () => {
    const dayOne = localTime(2024, 6, 10, 23, 50);
    const dayTwo = localTime(2024, 6, 11, 8, 0);
    const rows = projectMessageRows(
      [
        makeMessage({ id: "m1", timeMs: dayOne }),
        makeMessage({ id: "m2", timeMs: dayTwo, from: { id: "u-2", name: "Relay" } }),
      ],
      READ_NONE,
    );

    expect(rows.map((r) => r.showDate)).toEqual([false, true]);
  });

  it("同一天内不标记 showDate", () => {
    const base = localTime(2024, 6, 10, 9, 0);
    const rows = projectMessageRows(
      [
        makeMessage({ id: "m1", timeMs: base }),
        makeMessage({ id: "m2", timeMs: base + 13 * 60 * 60 * 1000 }),
      ],
      READ_NONE,
    );

    expect(rows.map((r) => r.showDate)).toEqual([false, false]);
    expect(rows[1].isGroupStart).toBe(true);
  });
});

describe("formatGroupHeadTime", () => {
  it("同日只显示 HH:MM", () => {
    expect(formatGroupHeadTime(localTime(2024, 6, 10, 9, 5), false)).toBe("09:05");
  });

  it("跨日显示 MM-DD HH:MM", () => {
    expect(formatGroupHeadTime(localTime(2024, 6, 10, 23, 50), true)).toBe("06-10 23:50");
  });

  it("月/日/时/分均零填充", () => {
    expect(formatGroupHeadTime(localTime(2024, 1, 2, 3, 4), true)).toBe("01-02 03:04");
  });
});
