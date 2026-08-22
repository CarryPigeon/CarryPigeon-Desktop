/**
 * @fileoverview 用户 id 归一化工具单元测试。
 * @description 验证消息 wire 层与账户会话层用户 id 比较前的归一化行为。
 */

import { describe, expect, it } from "vitest";
import { isSameUserId, normalizeUserId } from "./userId";

describe("normalizeUserId", () => {
  it("should trim whitespace", () => {
    expect(normalizeUserId("  1001  ")).toBe("1001");
  });

  it("should strip u:/U: prefix case-insensitively", () => {
    expect(normalizeUserId("u:1001")).toBe("1001");
    expect(normalizeUserId("U:1001")).toBe("1001");
  });

  it("should lowercase the remainder", () => {
    expect(normalizeUserId("Abc-DEF")).toBe("abc-def");
  });

  it("should return empty string for empty input", () => {
    expect(normalizeUserId("")).toBe("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeUserId(undefined as any)).toBe("");
  });
});

describe("isSameUserId", () => {
  it("should match ids that differ only by prefix/case/whitespace", () => {
    expect(isSameUserId("U:1001", "u:1001")).toBe(true);
    expect(isSameUserId(" 1001 ", "u:1001")).toBe(true);
    expect(isSameUserId("Alice", "alice")).toBe(true);
  });

  it("should not match different users", () => {
    expect(isSameUserId("1001", "1002")).toBe(false);
  });

  it("should not match when either side is empty", () => {
    expect(isSameUserId("", "")).toBe(false);
    expect(isSameUserId("1001", "")).toBe(false);
  });
});
