/**
 * @fileoverview code-review｜domain｜代码块解析器。
 * @description
 * 把 core-text 内容拆分为普通文本段和 fenced code block 段，用于渲染可评论代码块。
 */

export type CodeBlockSegment = {
  kind: "code";
  language: string;
  code: string;
};

export type TextSegmentValue = {
  kind: "text";
  text: string;
};

export type CoreTextSegment = TextSegmentValue | CodeBlockSegment;

const CODE_FENCE_RE = /```(?:([\w+-]*)\n)?([\s\S]*?)```/g;

/**
 * 解析文本中的 triple-backtick 代码块。
 *
 * @param text 原始消息文本。
 * @returns 文本段与代码块段的有序列表。
 */
export function parseCoreTextWithCodeBlocks(text: string): CoreTextSegment[] {
  const segments: CoreTextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CODE_FENCE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: "text", text: text.slice(lastIndex, match.index) });
    }
    const language = (match[1] ?? "").trim();
    const code = match[2] ?? "";
    // 去掉末尾多余的换行，提升展示效果。
    segments.push({ kind: "code", language, code: code.replace(/\n$/, "") });
    lastIndex = CODE_FENCE_RE.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: "text", text: text.slice(lastIndex) });
  }

  return segments;
}

/**
 * 判断文本是否包含 fenced code block。
 */
export function hasCodeBlock(text: string): boolean {
  CODE_FENCE_RE.lastIndex = 0;
  return CODE_FENCE_RE.test(text);
}
