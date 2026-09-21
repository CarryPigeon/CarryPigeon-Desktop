import { describe, expect, it } from "vitest";
import { diffNewNotices, normalizeGroupNotice, parseGroupNoticesResponse } from "./groupNotice";

describe("parseGroupNoticesResponse", () => {
  it("parses a valid notices response", () => {
    const body = JSON.stringify({
      notices: [
        { notice_id: "n1", title: "T1", body: "B1", level: "warning", issued_at: 100 },
        { notice_id: "n2", title: "T2", body: "B2", level: "info", issued_at: "200" },
      ],
    });
    const result = parseGroupNoticesResponse(body);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.notices).toHaveLength(2);
      expect(result.notices[0]).toMatchObject({ noticeId: "n1", level: "warning", issuedAt: 100 });
      // issued_at 字符串数字应被数字化
      expect(result.notices[1]?.issuedAt).toBe(200);
    }
  });

  it("rejects invalid JSON", () => {
    const result = parseGroupNoticesResponse("not-json{");
    expect(result).toEqual({ ok: false, error: "invalid JSON response" });
  });

  it("rejects empty body", () => {
    const result = parseGroupNoticesResponse("   ");
    expect(result).toEqual({ ok: false, error: "empty response body" });
  });

  it("rejects missing notices array", () => {
    const result = parseGroupNoticesResponse(JSON.stringify({ foo: [] }));
    expect(result).toEqual({ ok: false, error: "missing notices array" });
  });

  it("skips entries without notice_id", () => {
    const body = JSON.stringify({
      notices: [{ title: "no id" }, { notice_id: "ok", title: "T", body: "B" }],
    });
    const result = parseGroupNoticesResponse(body);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.notices.map((n) => n.noticeId)).toEqual(["ok"]);
  });
});

describe("normalizeGroupNotice level fallback", () => {
  it("falls back to info for unknown or missing level", () => {
    expect(normalizeGroupNotice({ notice_id: "a", level: "severe" })?.level).toBe("info");
    expect(normalizeGroupNotice({ notice_id: "b" })?.level).toBe("info");
    expect(normalizeGroupNotice({ notice_id: "c", level: "critical" })?.level).toBe("critical");
  });

  it("coerces invalid issued_at to 0 and stringified numbers", () => {
    expect(normalizeGroupNotice({ notice_id: "a", issued_at: "abc" })?.issuedAt).toBe(0);
    expect(normalizeGroupNotice({ notice_id: "b", issued_at: "123" })?.issuedAt).toBe(123);
  });
});

describe("diffNewNotices", () => {
  const n = (id: string) => ({
    noticeId: id,
    title: id,
    body: "",
    level: "info" as const,
    issuedAt: 0,
  });

  it("returns only notices not present in the read set", () => {
    const read = new Set(["a", "c"]);
    const fresh = diffNewNotices([n("a"), n("b"), n("c"), n("d")], read);
    expect(fresh.map((x) => x.noticeId)).toEqual(["b", "d"]);
  });

  it("returns everything when the read set is empty", () => {
    const fresh = diffNewNotices([n("a"), n("b")], new Set());
    expect(fresh).toHaveLength(2);
  });

  it("returns nothing when all are read", () => {
    const fresh = diffNewNotices([n("a")], new Set(["a"]));
    expect(fresh).toEqual([]);
  });
});
