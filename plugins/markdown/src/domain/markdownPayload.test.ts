// markdown payload 构造单测：与宿主 PluginComposerPayload 契约形状对齐。
import { describe, expect, it } from "vitest";
import {
  MARKDOWN_DOMAIN,
  MARKDOWN_DOMAIN_VERSION,
  buildMarkdownComposerPayload,
} from "./markdownPayload";

describe("buildMarkdownComposerPayload", () => {
  it("builds payload matching the host composer contract", () => {
    expect(buildMarkdownComposerPayload("hello **world**")).toEqual({
      domain: "markdown",
      domainVersion: "1",
      data: { text: "hello **world**" },
    });
  });

  it("keeps domain identifiers stable", () => {
    expect(MARKDOWN_DOMAIN).toBe("markdown");
    expect(MARKDOWN_DOMAIN_VERSION).toBe("1");
  });

  it("attaches replyToMessageId when reply context exists", () => {
    expect(buildMarkdownComposerPayload("reply", "mid-1")).toEqual({
      domain: "markdown",
      domainVersion: "1",
      data: { text: "reply" },
      replyToMessageId: "mid-1",
    });
  });

  it("omits replyToMessageId for empty reply context", () => {
    const payload = buildMarkdownComposerPayload("hi", "");
    expect(payload).not.toHaveProperty("replyToMessageId");
  });

  it("trims draft text", () => {
    expect(buildMarkdownComposerPayload("  spaced  ")?.data.text).toBe("spaced");
  });

  it("returns null for empty or whitespace-only drafts", () => {
    expect(buildMarkdownComposerPayload("")).toBeNull();
    expect(buildMarkdownComposerPayload("   \n  ")).toBeNull();
  });
});
