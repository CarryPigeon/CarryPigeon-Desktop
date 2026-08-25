/**
 * @fileoverview 十进制雪花 ID 校验契约测试。
 */
import { describe, expect, it } from "vitest";
import { isSnowflakeId, parseSnowflakeIdList } from "./snowflakeId";

describe("snowflakeId", () => {
  it("accepts positive decimal ids", () => {
    expect(isSnowflakeId("1")).toBe(true);
    expect(isSnowflakeId("2092085802191425536")).toBe(true);
  });

  it("rejects nicknames and padded zeros", () => {
    expect(isSnowflakeId("alice")).toBe(false);
    expect(isSnowflakeId("0123")).toBe(false);
    expect(isSnowflakeId("")).toBe(false);
  });

  it("parses comma-separated ids or returns empty on any invalid segment", () => {
    expect(parseSnowflakeIdList("11, 22")).toEqual(["11", "22"]);
    expect(parseSnowflakeIdList("11,alice")).toEqual([]);
  });
});
