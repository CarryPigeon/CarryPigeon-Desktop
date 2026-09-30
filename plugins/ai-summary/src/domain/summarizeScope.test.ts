/**
 * @fileoverview summarizeScope 单测。
 * @description
 * 覆盖时间范围归一化（逆序交换、结束补分钟、非法值）、快速范围预设、
 * 范围过滤、`all` / `selection` 两种模式的范围求解，以及集合指纹的确定性。
 */

import { describe, expect, it } from "vitest";
import type { PluginChannelMessage } from "@/features/plugins/api-types";
import {
  UNBOUNDED_RANGE,
  computeScopeFingerprint,
  filterMessagesByRange,
  isUnboundedRange,
  normalizeTimeRange,
  quickRangeOf,
  resolveScopeMessages,
} from "./summarizeScope";

/**
 * 构造频道消息。
 *
 * @param messageId - 消息 id。
 * @param timeMs - 发送时间（ms）。
 * @returns 插件可见消息。
 */
function message(messageId: string, timeMs: number): PluginChannelMessage {
  return { messageId, senderId: "u1", senderName: "Alice", timeMs, text: `text-${messageId}` };
}

/** 固定基准时间：2026-09-28 14:30:30.500 本地时间。 */
const NOW = new Date(2026, 8, 28, 14, 30, 30, 500).getTime();

describe("normalizeTimeRange", () => {
  it("returns the shared unbounded range when both bounds are missing", () => {
    expect(normalizeTimeRange({})).toEqual(UNBOUNDED_RANGE);
    expect(normalizeTimeRange(null)).toEqual(UNBOUNDED_RANGE);
    expect(isUnboundedRange(UNBOUNDED_RANGE)).toBe(true);
    expect(isUnboundedRange({ startMs: 1, endMs: null })).toBe(false);
  });

  it("normalizes non-finite bounds to null", () => {
    expect(normalizeTimeRange({ startMs: Number.NaN, endMs: Number.POSITIVE_INFINITY })).toEqual(
      UNBOUNDED_RANGE,
    );
  });

  it("swaps reversed bounds and rounds the end up to the end of its minute", () => {
    const start = new Date(2026, 8, 28, 10, 0, 30, 0).getTime();
    const end = new Date(2026, 8, 28, 9, 0, 0, 0).getTime();

    expect(normalizeTimeRange({ startMs: start, endMs: end })).toEqual({
      startMs: end,
      endMs: new Date(2026, 8, 28, 10, 0, 59, 999).getTime(),
    });
  });

  it("includes the whole end minute so a 10:05 bound covers 10:05:30", () => {
    const range = normalizeTimeRange({
      startMs: new Date(2026, 8, 28, 10, 0, 0, 0).getTime(),
      endMs: new Date(2026, 8, 28, 10, 5, 0, 0).getTime(),
    });
    const inside = message("m2", new Date(2026, 8, 28, 10, 5, 30, 0).getTime());

    expect(filterMessagesByRange([inside], range)).toEqual([inside]);
  });

  it("keeps an open ended side unbounded", () => {
    const start = new Date(2026, 8, 28, 10, 0, 0, 0).getTime();

    expect(normalizeTimeRange({ startMs: start, endMs: null })).toEqual({ startMs: start, endMs: null });
    expect(normalizeTimeRange({ startMs: null, endMs: start })).toEqual({
      startMs: null,
      endMs: new Date(2026, 8, 28, 10, 0, 59, 999).getTime(),
    });
  });
});

describe("filterMessagesByRange", () => {
  const messages = [
    message("m1", new Date(2026, 8, 28, 9, 59, 0, 0).getTime()),
    message("m2", new Date(2026, 8, 28, 10, 0, 0, 0).getTime()),
    message("m3", new Date(2026, 8, 28, 10, 5, 0, 0).getTime()),
  ];

  it("keeps everything for an unbounded range", () => {
    expect(filterMessagesByRange(messages, UNBOUNDED_RANGE).map((m) => m.messageId)).toEqual([
      "m1",
      "m2",
      "m3",
    ]);
  });

  it("applies a closed interval on both sides", () => {
    const range = normalizeTimeRange({
      startMs: messages[1]!.timeMs,
      endMs: messages[1]!.timeMs,
    });

    expect(filterMessagesByRange(messages, range).map((m) => m.messageId)).toEqual(["m2"]);
  });

  it("drops messages without a usable timestamp when a bound is set", () => {
    const broken = { ...message("m9", 0), timeMs: Number.NaN } as PluginChannelMessage;

    expect(filterMessagesByRange([broken], UNBOUNDED_RANGE)).toEqual([]);
    expect(filterMessagesByRange([broken], { startMs: 1, endMs: null })).toEqual([]);
  });
});

describe("quickRangeOf", () => {
  it("maps each preset to an interval ending at now", () => {
    expect(quickRangeOf("none", NOW)).toEqual(UNBOUNDED_RANGE);
    expect(quickRangeOf("hour", NOW).startMs).toBe(NOW - 3_600_000);
    expect(quickRangeOf("week", NOW).startMs).toBe(NOW - 7 * 24 * 3_600_000);
    expect(quickRangeOf("today", NOW).startMs).toBe(new Date(2026, 8, 28, 0, 0, 0, 0).getTime());
    for (const kind of ["hour", "today", "week"] as const) {
      expect(quickRangeOf(kind, NOW).endMs).toBeGreaterThanOrEqual(NOW);
    }
  });
});

describe("resolveScopeMessages", () => {
  const messages = [message("m1", 1), message("m2", 2), message("m3", 3)];

  it("returns every candidate in `all` mode", () => {
    expect(resolveScopeMessages(messages, UNBOUNDED_RANGE, "all", []).map((m) => m.messageId)).toEqual([
      "m1",
      "m2",
      "m3",
    ]);
  });

  it("returns only the selected messages in `selection` mode, in timeline order", () => {
    expect(
      resolveScopeMessages(messages, UNBOUNDED_RANGE, "selection", ["m3", "m1"]).map((m) => m.messageId),
    ).toEqual(["m1", "m3"]);
  });

  it("intersects selection with the time range", () => {
    const range = normalizeTimeRange({ startMs: 2, endMs: 2 });

    expect(resolveScopeMessages(messages, range, "selection", ["m1", "m2"]).map((m) => m.messageId)).toEqual([
      "m2",
    ]);
  });

  it("returns an empty list for an empty selection", () => {
    expect(resolveScopeMessages(messages, UNBOUNDED_RANGE, "selection", [])).toEqual([]);
    expect(resolveScopeMessages(messages, UNBOUNDED_RANGE, "selection", ["  ", "unknown"])).toEqual([]);
  });

  it("tolerates missing input", () => {
    expect(resolveScopeMessages([], UNBOUNDED_RANGE, "all", [])).toEqual([]);
    expect(resolveScopeMessages(messages, UNBOUNDED_RANGE, "all", []).length).toBe(3);
  });
});

describe("computeScopeFingerprint", () => {
  it("is deterministic for the same message list", () => {
    const a = [message("m1", 1), message("m2", 2)];

    expect(computeScopeFingerprint(a)).toBe(computeScopeFingerprint([...a]));
    expect(computeScopeFingerprint(a)).toMatch(/^[0-9a-f]{8}$/u);
  });

  it("changes when the set, the length or the order changes", () => {
    const base = [message("m1", 1), message("m2", 2)];

    expect(computeScopeFingerprint(base)).not.toBe(computeScopeFingerprint([base[0]!]));
    expect(computeScopeFingerprint(base)).not.toBe(computeScopeFingerprint([...base].reverse()));
    expect(computeScopeFingerprint(base)).not.toBe(
      computeScopeFingerprint([message("m1", 1), message("m3", 2)]),
    );
  });

  it("avoids the classic concatenation collision", () => {
    expect(computeScopeFingerprint([message("ab", 1), message("c", 2)])).not.toBe(
      computeScopeFingerprint([message("a", 1), message("bc", 2)]),
    );
  });

  it("returns an empty fingerprint for an empty list", () => {
    expect(computeScopeFingerprint([])).toBe("");
    expect(computeScopeFingerprint(undefined as never)).toBe("");
  });
});
