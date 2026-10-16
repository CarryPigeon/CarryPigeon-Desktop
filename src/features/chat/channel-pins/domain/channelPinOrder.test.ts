/**
 * @fileoverview channelPinOrder.test.ts
 * @description 测试置顶频道顺序编辑纯逻辑：归一化、增删、相邻移动与重排边界。
 */

import { describe, expect, it } from "vitest";
import { addPin, movePin, normalizePinOrder, removePin, reorderPin } from "./channelPinOrder";

describe("normalizePinOrder", () => {
  it("trims, drops blanks and dedupes keeping first occurrence", () => {
    expect(normalizePinOrder([" c1 ", "", "c1", "c2", "   ", "c2"])).toEqual(["c1", "c2"]);
  });

  it("returns a new empty array for empty input", () => {
    const input: string[] = [];
    const result = normalizePinOrder(input);
    expect(result).toEqual([]);
    expect(result).not.toBe(input);
  });
});

describe("addPin / removePin", () => {
  it("appends new pins at the end", () => {
    expect(addPin(["c2"], "c1")).toEqual(["c2", "c1"]);
  });

  it("keeps the order unchanged when the pin already exists", () => {
    expect(addPin(["c2", "c1"], " c2 ")).toEqual(["c2", "c1"]);
  });

  it("ignores blank ids", () => {
    expect(addPin(["c1"], "  ")).toEqual(["c1"]);
  });

  it("removes pins and normalizes the remainder", () => {
    expect(removePin(["c1", "c2", "c1"], "c1")).toEqual(["c2"]);
    expect(removePin(["c1"], "ghost")).toEqual(["c1"]);
  });
});

describe("movePin", () => {
  it("swaps with the neighbour", () => {
    expect(movePin(["c1", "c2", "c3"], "c2", -1)).toEqual(["c2", "c1", "c3"]);
    expect(movePin(["c1", "c2", "c3"], "c2", 1)).toEqual(["c1", "c3", "c2"]);
  });

  it("clamps at both ends", () => {
    expect(movePin(["c1", "c2"], "c1", -1)).toEqual(["c1", "c2"]);
    expect(movePin(["c1", "c2"], "c2", 1)).toEqual(["c1", "c2"]);
  });

  it("returns the normalized order when the id is missing", () => {
    expect(movePin([" c1 ", "c1"], "ghost", 1)).toEqual(["c1"]);
  });
});

describe("reorderPin", () => {
  it("moves an item down and up", () => {
    expect(reorderPin(["c1", "c2", "c3"], 0, 2)).toEqual(["c2", "c3", "c1"]);
    expect(reorderPin(["c1", "c2", "c3"], 2, 0)).toEqual(["c3", "c1", "c2"]);
  });

  it("clamps out-of-range targets", () => {
    expect(reorderPin(["c1", "c2", "c3"], 0, 99)).toEqual(["c2", "c3", "c1"]);
    expect(reorderPin(["c1", "c2", "c3"], 2, -5)).toEqual(["c3", "c1", "c2"]);
  });

  it("keeps the order for invalid indexes or short lists", () => {
    expect(reorderPin(["c1", "c2"], -1, 0)).toEqual(["c1", "c2"]);
    expect(reorderPin(["c1", "c2"], 5, 0)).toEqual(["c1", "c2"]);
    expect(reorderPin(["c1", "c2"], 1.5, 0)).toEqual(["c1", "c2"]);
    expect(reorderPin(["c1"], 0, 0)).toEqual(["c1"]);
    expect(reorderPin([], 0, 0)).toEqual([]);
  });
});
