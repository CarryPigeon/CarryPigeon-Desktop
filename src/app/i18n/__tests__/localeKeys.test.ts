import { describe, it, expect } from "vitest";
import { zh_cn } from "../messages/zh_cn";
import { en_us } from "../messages/en_us";

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      return flattenKeys(value as Record<string, unknown>, fullKey);
    }
    return [fullKey];
  });
}

describe("i18n key parity", () => {
  const zhKeys = new Set(flattenKeys(zh_cn));
  const enKeys = new Set(flattenKeys(en_us));

  it("should have same number of keys", () => {
    expect(zhKeys.size).toBe(enKeys.size);
  });

  it("should not have missing keys in en_us", () => {
    const missing = [...zhKeys].filter((key) => !enKeys.has(key));
    expect(missing).toEqual([]);
  });

  it("should not have extra keys in en_us", () => {
    const extra = [...enKeys].filter((key) => !zhKeys.has(key));
    expect(extra).toEqual([]);
  });
});
