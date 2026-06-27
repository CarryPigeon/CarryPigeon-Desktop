import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const IGNORED_DIRS = new Set([
  ".git",
  ".vite",
  "dist",
  "node_modules",
  "target",
  "src-tauri",
]);

const STYLE_EXTS = new Set([".css", ".scss", ".sass", ".less"]);

const FORBIDDEN_PATTERNS = [
  {
    name: "oklab-literal",
    re: /\boklab\s*\(/g,
    message:
      "禁止在样式中直接使用 oklab( 数字字面量；改用 var(--cp-*) token + color-mix(...) 派生。",
  },
  {
    name: "oklch-literal",
    re: /\boklch\s*\(/g,
    message:
      "禁止在样式中直接使用 oklch( 数字字面量；改用 var(--cp-*) token + color-mix(...) 派生。",
  },
  {
    name: "lab-literal",
    re: /\blab\s*\(\s*[-\d.]+/g,
    message: "禁止在样式中直接使用 lab( 数字字面量；改用 var(--cp-*) token。",
  },
  {
    name: "lch-literal",
    re: /\blch\s*\(\s*[-\d.]+/g,
    message: "禁止在样式中直接使用 lch( 数字字面量；改用 var(--cp-*) token。",
  },
];

function stripComments(text, ext) {
  let out = text;
  if (ext === ".css") {
    out = out.replace(/\/\*[\s\S]*?\*\//g, "");
  } else {
    out = out.replace(/\/\*[\s\S]*?\*\//g, "");
    out = out.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  }
  return out;
}

function findViolations(text) {
  const violations = [];
  for (const { name, re, message } of FORBIDDEN_PATTERNS) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      const before = text.slice(0, m.index);
      const line = (before.match(/\n/g) ?? []).length + 1;
      const lineText = text.split("\n")[line - 1] ?? "";
      violations.push({ name, line, message, snippet: lineText.trim() });
    }
  }
  return violations;
}

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (IGNORED_DIRS.has(ent.name)) continue;
      yield* walk(path.join(dir, ent.name));
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (STYLE_EXTS.has(ext)) yield path.join(dir, ent.name);
    }
  }
}

const SCAN_DIRS = [path.join(ROOT, "src")];

const problems = [];
for (const dir of SCAN_DIRS) {
  for await (const filePath of walk(dir)) {
    const rel = path.relative(ROOT, filePath);
    const ext = path.extname(filePath).toLowerCase();
    let raw;
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }
    const stripped = stripComments(raw, ext);
    const violations = findViolations(stripped);
    for (const v of violations) {
      problems.push(
        [
          `${rel}:${v.line}:`,
          `  - [${v.name}] ${v.message}`,
          `    snippet: ${v.snippet}`,
        ].join("\n"),
      );
    }
  }
}

if (problems.length > 0) {
  console.error("[check-color-literals] ❌ 发现硬编码颜色字面量：\n");
  console.error(problems.join("\n\n"));
  console.error(`\n[check-color-literals] 共 ${problems.length} 处违规。`);
  process.exitCode = 1;
} else {
  console.log("[check-color-literals] ✅ 未发现 oklab/oklch/lab/lch 颜色字面量");
}
