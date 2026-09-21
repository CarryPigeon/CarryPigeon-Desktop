// markdown 解析器单测：各语法、嵌套行内、转义、注入防护、链接 scheme 校验。
import { describe, expect, it } from "vitest";
import { isSafeUrl, parseInline, parseMarkdown } from "./markdownParser";

describe("markdownParser", () => {
  describe("headings", () => {
    it("parses #/##/### levels", () => {
      const blocks = parseMarkdown("# one\n## two\n### three");
      expect(blocks).toEqual([
        { type: "heading", level: 1, children: [{ type: "text", text: "one" }] },
        { type: "heading", level: 2, children: [{ type: "text", text: "two" }] },
        { type: "heading", level: 3, children: [{ type: "text", text: "three" }] },
      ]);
    });

    it("keeps inline styles inside headings", () => {
      const blocks = parseMarkdown("## hello **world**");
      expect(blocks[0]).toEqual({
        type: "heading",
        level: 2,
        children: [
          { type: "text", text: "hello " },
          { type: "bold", children: [{ type: "text", text: "world" }] },
        ],
      });
    });
  });

  describe("inline styles", () => {
    it("parses bold and italic", () => {
      expect(parseInline("**b** and *i*")).toEqual([
        { type: "bold", children: [{ type: "text", text: "b" }] },
        { type: "text", text: " and " },
        { type: "italic", children: [{ type: "text", text: "i" }] },
      ]);
    });

    it("parses inline code verbatim", () => {
      expect(parseInline("use `**not bold**` here")).toEqual([
        { type: "text", text: "use " },
        { type: "code", text: "**not bold**" },
        { type: "text", text: " here" },
      ]);
    });

    it("parses nested inline: bold containing italic and code", () => {
      expect(parseInline("**a *b* `c`**")).toEqual([
        {
          type: "bold",
          children: [
            { type: "text", text: "a " },
            { type: "italic", children: [{ type: "text", text: "b" }] },
            { type: "text", text: " " },
            { type: "code", text: "c" },
          ],
        },
      ]);
    });

    it("parses links with http/https", () => {
      expect(parseInline("see [docs](https://example.com/a?b=1) now")).toEqual([
        { type: "text", text: "see " },
        { type: "link", text: "docs", url: "https://example.com/a?b=1" },
        { type: "text", text: " now" },
      ]);
      expect(parseInline("[x](http://example.com)")).toEqual([
        { type: "link", text: "x", url: "http://example.com" },
      ]);
    });

    it("degrades non-http(s) links to plain text", () => {
      expect(parseInline("[x](javascript:alert(1))")).toEqual([
        { type: "text", text: "[x](javascript:alert(1))" },
      ]);
      expect(parseInline("[x](ftp://example.com/f)")).toEqual([
        { type: "text", text: "[x](ftp://example.com/f)" },
      ]);
    });

    it("handles escapes for markdown metacharacters", () => {
      expect(parseInline("\\*not italic\\*")).toEqual([{ type: "text", text: "*not italic*" }]);
      expect(parseInline("\\`code\\`")).toEqual([{ type: "text", text: "`code`" }]);
      expect(parseInline("\\[bracket\\]")).toEqual([{ type: "text", text: "[bracket]" }]);
      expect(parseInline("\\\\star")).toEqual([{ type: "text", text: "\\star" }]);
    });

    it("keeps unmatched markers as literal text", () => {
      expect(parseInline("a * b")).toEqual([{ type: "text", text: "a * b" }]);
      expect(parseInline("**unclosed")).toEqual([{ type: "text", text: "**unclosed" }]);
    });
  });

  describe("blocks", () => {
    it("parses fenced code block with lang", () => {
      const blocks = parseMarkdown("intro\n```ts\nconst a = 1;\n**bold?**\n```\nafter");
      expect(blocks).toEqual([
        { type: "paragraph", children: [{ type: "text", text: "intro" }] },
        { type: "codeBlock", lang: "ts", text: "const a = 1;\n**bold?**" },
        { type: "paragraph", children: [{ type: "text", text: "after" }] },
      ]);
    });

    it("tolerates unclosed fenced block", () => {
      const blocks = parseMarkdown("```\nabc");
      expect(blocks).toEqual([{ type: "codeBlock", lang: "", text: "abc" }]);
    });

    it("parses unordered lists", () => {
      const blocks = parseMarkdown("- a\n- b **c**");
      expect(blocks).toEqual([
        {
          type: "list",
          ordered: false,
          items: [
            [{ type: "text", text: "a" }],
            [
              { type: "text", text: "b " },
              { type: "bold", children: [{ type: "text", text: "c" }] },
            ],
          ],
        },
      ]);
    });

    it("parses ordered lists", () => {
      const blocks = parseMarkdown("1. first\n2. second");
      expect(blocks).toEqual([
        {
          type: "list",
          ordered: true,
          items: [
            [{ type: "text", text: "first" }],
            [{ type: "text", text: "second" }],
          ],
        },
      ]);
    });

    it("splits paragraphs on blank lines and joins consecutive lines", () => {
      const blocks = parseMarkdown("line one\nline two\n\nline three");
      expect(blocks).toEqual([
        { type: "paragraph", children: [{ type: "text", text: "line one line two" }] },
        { type: "paragraph", children: [{ type: "text", text: "line three" }] },
      ]);
    });
  });

  describe("injection safety", () => {
    it("renders <script> as plain text nodes", () => {
      const blocks = parseMarkdown('<script>alert("xss")</script>');
      expect(blocks).toEqual([
        {
          type: "paragraph",
          children: [{ type: "text", text: '<script>alert("xss")</script>' }],
        },
      ]);
    });

    it("renders html tags inside inline styles as text", () => {
      const nodes = parseInline("**<img src=x onerror=1>**");
      expect(nodes).toEqual([
        { type: "bold", children: [{ type: "text", text: "<img src=x onerror=1>" }] },
      ]);
    });

    it("keeps html inside code blocks verbatim (rendered as text)", () => {
      const blocks = parseMarkdown("```\n<div>hi</div>\n```");
      expect(blocks).toEqual([{ type: "codeBlock", lang: "", text: "<div>hi</div>" }]);
    });

    it("never yields link nodes for dangerous schemes", () => {
      const nodes = parseInline("[a](javascript:x) [b](data:text/html,x) [c](HTTPS://ok.com)");
      const links = nodes.filter((n) => n.type === "link");
      expect(links).toEqual([{ type: "link", text: "c", url: "HTTPS://ok.com" }]);
    });
  });

  describe("isSafeUrl", () => {
    it("accepts only http/https", () => {
      expect(isSafeUrl("https://a.com")).toBe(true);
      expect(isSafeUrl("http://a.com")).toBe(true);
      expect(isSafeUrl("javascript:alert(1)")).toBe(false);
      expect(isSafeUrl("data:text/html,x")).toBe(false);
      expect(isSafeUrl("ftp://a.com")).toBe(false);
      expect(isSafeUrl("")).toBe(false);
    });
  });
});
