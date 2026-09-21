/**
 * @fileoverview markdown 插件｜领域纯函数：零依赖 markdown 解析器。
 * @description
 * 输出自定义渲染树（块/行内节点联合类型），所有文本一律落在文本节点，
 * 渲染层绝不使用 innerHTML，天然防御 HTML 注入。
 * 支持：#/##/### 标题、**bold**、*italic*、`inline code`、``` fenced code block ```、
 * - 无序列表、1. 有序列表、[text](url) 链接（仅 http/https）、空行分段。
 */

/** 行内节点：文本一律走 text 节点；bold/italic 内部可嵌套行内节点。 */
export type MarkdownInlineNode =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "bold"; children: MarkdownInlineNode[] }
  | { type: "italic"; children: MarkdownInlineNode[] }
  | { type: "link"; text: string; url: string };

/** 块节点：段落/标题/代码块/列表。 */
export type MarkdownBlockNode =
  | { type: "paragraph"; children: MarkdownInlineNode[] }
  | { type: "heading"; level: 1 | 2 | 3; children: MarkdownInlineNode[] }
  | { type: "codeBlock"; lang: string; text: string }
  | { type: "list"; ordered: boolean; items: MarkdownInlineNode[][] };

/** 仅允许 http/https scheme 的链接。 */
export function isSafeUrl(url: string): boolean {
  return /^https?:\/\/\S+$/iu.test(url);
}

const ESCAPABLE = new Set(["\\", "*", "`", "[", "]"]);

/** 行内解析：扫描单行文本，产出行内节点序列。 */
export function parseInline(text: string): MarkdownInlineNode[] {
  const nodes: MarkdownInlineNode[] = [];
  let buffer = "";
  let i = 0;

  const flush = (): void => {
    if (buffer) {
      nodes.push({ type: "text", text: buffer });
      buffer = "";
    }
  };

  while (i < text.length) {
    const ch = text[i]!;

    // 反斜杠转义：\* \` \[ \] \\ 输出字面字符。
    if (ch === "\\" && i + 1 < text.length && ESCAPABLE.has(text[i + 1]!)) {
      buffer += text[i + 1]!;
      i += 2;
      continue;
    }

    // 行内代码：内容原样保留，不再嵌套解析。
    if (ch === "`") {
      const close = text.indexOf("`", i + 1);
      if (close > i) {
        flush();
        nodes.push({ type: "code", text: text.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }

    // 加粗：**bold**，内部递归解析。
    if (ch === "*" && text[i + 1] === "*") {
      const close = text.indexOf("**", i + 2);
      if (close > i + 1) {
        flush();
        nodes.push({ type: "bold", children: parseInline(text.slice(i + 2, close)) });
        i = close + 2;
        continue;
      }
    }

    // 斜体：*italic*，内部递归解析；要求至少一个内容字符，
    // 避免 "**unclosed" 这类未闭合加粗降级为空斜体。
    if (ch === "*") {
      const close = text.indexOf("*", i + 1);
      if (close > i + 1) {
        flush();
        nodes.push({ type: "italic", children: parseInline(text.slice(i + 1, close)) });
        i = close + 1;
        continue;
      }
    }

    // 链接：[text](url)，url 仅允许 http(s)，否则整段降级为普通文本。
    if (ch === "[") {
      const match = /^\[([^\]]*)\]\(([^)\s]*)\)/u.exec(text.slice(i));
      if (match && isSafeUrl(match[2]!)) {
        flush();
        nodes.push({ type: "link", text: match[1]!, url: match[2]! });
        i += match[0].length;
        continue;
      }
    }

    buffer += ch;
    i += 1;
  }

  flush();
  return nodes;
}

const HEADING_RE = /^(#{1,3})\s+(.*)$/u;
const UL_ITEM_RE = /^-\s+(.*)$/u;
const OL_ITEM_RE = /^\d+\.\s+(.*)$/u;

/**
 * 块级解析：逐行扫描，空行分段；
 * fenced code block（``` 开闭）内容整体原样保留。
 */
export function parseMarkdown(source: string): MarkdownBlockNode[] {
  const lines = source.split(/\r?\n/u);
  const blocks: MarkdownBlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // 空行跳过。
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // fenced code block。
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.startsWith("```")) {
        body.push(lines[i]!);
        i += 1;
      }
      // 跳过闭合 ```（若存在；未闭合则按文件结尾收束，容错处理）。
      if (i < lines.length) i += 1;
      blocks.push({ type: "codeBlock", lang, text: body.join("\n") });
      continue;
    }

    // 标题。
    const heading = HEADING_RE.exec(line);
    if (heading) {
      const level = heading[1]!.length as 1 | 2 | 3;
      blocks.push({ type: "heading", level, children: parseInline(heading[2]!) });
      i += 1;
      continue;
    }

    // 无序列表（连续项合并为一个块）。
    if (UL_ITEM_RE.test(line)) {
      const items: MarkdownInlineNode[][] = [];
      while (i < lines.length) {
        const m = UL_ITEM_RE.exec(lines[i]!);
        if (!m) break;
        items.push(parseInline(m[1]!));
        i += 1;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    // 有序列表（连续项合并为一个块）。
    if (OL_ITEM_RE.test(line)) {
      const items: MarkdownInlineNode[][] = [];
      while (i < lines.length) {
        const m = OL_ITEM_RE.exec(lines[i]!);
        if (!m) break;
        items.push(parseInline(m[1]!));
        i += 1;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    // 普通段落：连续非空、非结构化行合并。
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !lines[i]!.startsWith("```") && !HEADING_RE.test(lines[i]!) && !UL_ITEM_RE.test(lines[i]!) && !OL_ITEM_RE.test(lines[i]!)) {
      para.push(lines[i]!.trim());
      i += 1;
    }
    blocks.push({ type: "paragraph", children: parseInline(para.join(" ")) });
  }

  return blocks;
}
