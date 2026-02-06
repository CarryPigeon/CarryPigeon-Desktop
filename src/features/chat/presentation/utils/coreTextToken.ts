/**
 * @fileoverview Core-text 文件 token 解析工具。
 * @description chat｜模块：coreTextToken。
 * 为了在引入“文件 domain 消息”之前先支持附件引用，本模块提供对 core-text 文本内
 * `[file:{share_key}]` 形式 token 的识别与分段解析。
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
 * 标记（token）格式：`[file:{share_key}]`
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

