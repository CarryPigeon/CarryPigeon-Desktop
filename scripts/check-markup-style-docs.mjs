import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const IGNORED_DIRS = new Set([
  ".git",
  ".vite",
  "dist",
  "node_modules",
  "target",
  "src-tauri",
]);

const MARKUP_EXTS = new Set([".html"]);
const STYLE_EXTS = new Set([".css", ".scss", ".sass", ".less"]);

function extractLang(attrs) {
  const m = /\blang\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(attrs ?? "");
  const lang = (m?.[1] ?? m?.[2] ?? m?.[3] ?? "").trim().toLowerCase();
  return lang || null;
}

function supportsLineComment(lang) {
  return ["scss", "sass", "less", "styl", "stylus"].includes(lang ?? "");
}

function stripBom(s) {
  return s.startsWith("\uFEFF") ? s.slice(1) : s;
}

function hasLeadingCssDocComment(text, { allowLineComment }) {
  const raw = stripBom(text);
  const trimmedStart = raw.replace(/^\s+/, "");

  if (trimmedStart.startsWith("/*")) return true;
  if (allowLineComment && trimmedStart.startsWith("//")) return true;

  // CSS @charset must be the first non-whitespace token (comments before it are not allowed).
  const lower = trimmedStart.toLowerCase();
  if (lower.startsWith("@charset")) {
    const semi = trimmedStart.indexOf(";");
    if (semi === -1) return false;
    const after = trimmedStart.slice(semi + 1).replace(/^\s+/, "");
    if (after.startsWith("/*")) return true;
    if (allowLineComment && after.startsWith("//")) return true;
  }

  return false;
}

function checkHtmlFile(filePath, text) {
  const errors = [];

  const bodyRe = /<body\b[^>]*>/i;
  const bodyMatch = bodyRe.exec(text);
  if (bodyMatch) {
    const afterBody = text.slice(bodyMatch.index + bodyMatch[0].length).replace(/^\s+/, "");
    if (!afterBody.startsWith("<!--")) {
      errors.push("HTML <body> 内第一段内容必须以注释 (<!-- ... -->) 开头。");
    }
  }

  const styleRe = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = styleRe.exec(text))) {
    const attrs = m[1] ?? "";
    const content = m[2] ?? "";
    const lang = extractLang(attrs);
    const allowLineComment = supportsLineComment(lang);
    if (!hasLeadingCssDocComment(content, { allowLineComment })) {
      errors.push(
        `HTML <style> 内容必须以注释开头（默认仅允许 /* ... */；当 lang 支持时允许 // ...）。`,
      );
      break;
    }
  }

  if (errors.length > 0) {
    return [`${filePath}:`, ...errors.map((e) => `  - ${e}`)];
  }
  return [];
}

function checkStyleFile(filePath, text) {
  const ext = path.extname(filePath).toLowerCase();
  const allowLineComment = ext !== ".css";
  if (hasLeadingCssDocComment(text, { allowLineComment })) return [];
  return [
    `${filePath}:`,
    `  - 文件必须以注释开头（.css 仅允许 /* ... */；预处理器允许 // ...）。`,
  ];
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name.startsWith(".")) {
      if (ent.isDirectory() && IGNORED_DIRS.has(ent.name)) continue;
      if (ent.isDirectory() && ent.name === ".git") continue;
    }
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (IGNORED_DIRS.has(ent.name)) continue;
      yield* walk(full);
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (MARKUP_EXTS.has(ext) || STYLE_EXTS.has(ext)) yield full;
    }
  }
}

const problems = [];
for await (const filePath of walk(ROOT)) {
  const rel = path.relative(ROOT, filePath);
  const text = await fs.readFile(filePath, "utf8");
  const ext = path.extname(filePath).toLowerCase();
  if (MARKUP_EXTS.has(ext)) problems.push(...checkHtmlFile(rel, text));
  if (STYLE_EXTS.has(ext)) problems.push(...checkStyleFile(rel, text));
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
}
