/**
 * @fileoverview core-text 文件 token 解析工具。
 * @description
 * 在消息语义层统一处理 `[file:{share_key}]` 文法，避免页面层重复解析逻辑。
 */

/**
 * @constant
 * @description 用于识别 `[file:share_key]` 的正则（忽略大小写）。
 */
const FILE_TOKEN_RE = /\[file:([^\]\s]+)\]/i;

/**
 * @constant
 * @description 用于全局分段解析的正则（带 `g` 标志）。
 */
const FILE_TOKEN_RE_GLOBAL = /\[file:([^\]\s]+)\]/gi;

/**
 * core-text 分段结果：纯文本片段或文件引用片段。
 */
export type CoreTextPart = { kind: "text"; text: string } | { kind: "file"; shareKey: string };

/**
 * 检查 core-text 消息是否包含 `[file:share_key]` token。
 *
 * @param text - 消息文本。
 * @returns 当至少包含一个 token 时返回 `true`。
 */
export function hasFileToken(text: string): boolean {
  return FILE_TOKEN_RE.test(String(text ?? ""));
}

/**
 * 将 core-text 消息解析为可渲染分段（纯文本 + 文件 token）。
 *
 * @param text - 原始消息文本。
 * @returns 供渲染使用的分段结果。
 */
export function parseCoreTextParts(text: string): CoreTextPart[] {
  const s = String(text ?? "");
  const out: CoreTextPart[] = [];
  let lastIdx = 0;

  for (const m of s.matchAll(FILE_TOKEN_RE_GLOBAL)) {
    const start = m.index ?? 0;
    const end = start + String(m[0] ?? "").length;
    const shareKey = String(m[1] ?? "").trim();
    if (start > lastIdx) out.push({ kind: "text", text: s.slice(lastIdx, start) });
    if (shareKey) out.push({ kind: "file", shareKey });
    else out.push({ kind: "text", text: s.slice(start, end) });
    lastIdx = end;
  }

  if (lastIdx < s.length) out.push({ kind: "text", text: s.slice(lastIdx) });
  if (out.length === 0) out.push({ kind: "text", text: s });
  return out;
}

