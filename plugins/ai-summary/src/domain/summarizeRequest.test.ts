import { describe, expect, it } from "vitest";
import { buildSummarizeRequestBody, parseSummarizeResponse } from "./summarizeRequest";

describe("buildSummarizeRequestBody", () => {
  it("splits messages by line, trims and filters empty lines", () => {
    const body = buildSummarizeRequestBody("ch1", "  hello \n\nworld\r\n  \n  foo  ");
    expect(body).toEqual({
      channel_id: "ch1",
      messages: ["hello", "world", "foo"],
    });
  });

  it("returns empty messages for blank input", () => {
    const body = buildSummarizeRequestBody("ch1", " \n \n");
    expect(body.messages).toEqual([]);
    expect(body.channel_id).toBe("ch1");
  });

  it("trims channel id", () => {
    const body = buildSummarizeRequestBody("  ch1  ", "x");
    expect(body.channel_id).toBe("ch1");
  });
});

describe("parseSummarizeResponse", () => {
  it("parses a valid response", () => {
    const res = parseSummarizeResponse(
      JSON.stringify({ summary: "S of 2", channel_id: "ch1", message_count: 2 }),
    );
    expect(res).toEqual({
      ok: true,
      result: { summary: "S of 2", channelId: "ch1", messageCount: 2 },
    });
  });

  it("rejects invalid JSON", () => {
    expect(parseSummarizeResponse("{oops")).toEqual({
      ok: false,
      error: "invalid JSON response",
    });
  });

  it("rejects empty body", () => {
    expect(parseSummarizeResponse("  ")).toEqual({ ok: false, error: "empty response body" });
  });

  it("rejects missing summary", () => {
    expect(parseSummarizeResponse(JSON.stringify({ channel_id: "ch1", message_count: 1 }))).toEqual({
      ok: false,
      error: "summary must be a non-empty string",
    });
  });

  it("rejects non-string summary", () => {
    expect(parseSummarizeResponse(JSON.stringify({ summary: 123 }))).toEqual({
      ok: false,
      error: "summary must be a non-empty string",
    });
  });

  it("rejects blank summary", () => {
    expect(parseSummarizeResponse(JSON.stringify({ summary: "   " }))).toEqual({
      ok: false,
      error: "summary must be a non-empty string",
    });
  });

  it("coerces missing message_count to 0", () => {
    const res = parseSummarizeResponse(JSON.stringify({ summary: "s", channel_id: "c" }));
    expect(res).toEqual({ ok: true, result: { summary: "s", channelId: "c", messageCount: 0 } });
  });
});
