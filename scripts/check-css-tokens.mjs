/**
 * @fileoverview 样式 token 守卫脚本。
 * @description
 * 解析 `src/App.vue` 中声明的全部 `--cp-*` token，扫描 `src/**` 的 `var(--cp-*)` 使用；
 * 发现未声明 token 时失败（防止 `--cp-text-secondary` 这类拼错/漏定义再次出现）。
 *
 * 允许清单用于运行时由内联 style/脚本注入的 token（不在 App.vue 静态声明）。
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const APP_VUE = path.join(SRC, "App.vue");

const IGNORED_DIRS = new Set([".git", ".vite", "dist", "node_modules", "target"]);
const SCAN_EXTS = new Set([".vue", ".scss", ".css", ".ts"]);

/** 运行时注入、无需在 App.vue 静态声明的 token。 */
const DYNAMIC_TOKENS = new Set([
  "--cp-avatar-hue",
  "--cp-avatar-size",
  "--cp-channel-port",
  "--cp-server-rail-width",
  "--cp-channel-rail-width",
  "--cp-members-rail-width",
]);

/** 去掉块注释，避免注释中的示例 token 参与判定。 */
function stripBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** 收集 App.vue 中声明的 token。 */
async function collectDefinedTokens() {
  const text = await fs.readFile(APP_VUE, "utf8");
  const defined = new Set();
  for (const match of text.matchAll(/(--cp-[a-z0-9-]+)\s*:/g)) {
    defined.add(match[1]);
  }
  return defined;
}

/** 递归遍历 src 下的待扫描源码文件。 */
async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      yield* walk(full);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!SCAN_EXTS.has(path.extname(entry.name).toLowerCase())) continue;
    yield full;
  }
}

const defined = await collectDefinedTokens();
const problems = [];

for await (const filePath of walk(SRC)) {
  const raw = await fs.readFile(filePath, "utf8");
  const text = stripBlockComments(raw);
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/var\(\s*(--cp-[a-z0-9-]+)/g)) {
      const token = match[1];
      if (defined.has(token) || DYNAMIC_TOKENS.has(token)) continue;
      problems.push({
        file: path.relative(ROOT, filePath).replace(/\\/g, "/"),
        line: index + 1,
        token,
      });
    }
  });
}

if (problems.length > 0) {
  console.error("[check-css-tokens] ❌ 发现未定义的 --cp-* token：\n");
  for (const problem of problems) {
    console.error(`  ${problem.file}:${problem.line}: var(${problem.token}) 未在 src/App.vue 中声明`);
  }
  console.error(`\n[check-css-tokens] 共 ${problems.length} 处违规；请改用已声明 token 或在 App.vue 补充声明。`);
  process.exitCode = 1;
} else {
  console.log(`[check-css-tokens] ✅ 未发现未定义 token（已声明 ${defined.size} 个）`);
}
