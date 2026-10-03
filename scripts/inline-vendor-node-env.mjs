// @ts-nocheck
/**
 * @fileoverview vendor 构建后处理：把产物中的 `process.env.NODE_ENV` 内联为 `"production"`。
 *
 * 背景：
 * - `public/vendor/vendor.mjs` 供 index.html 的 import map 在浏览器中加载；
 * - vue / tdesign-vue-next 的 esm-bundler 产物含大量裸 `process.env.NODE_ENV` 引用；
 * - Vite 8（rolldown-vite）的 lib 构建不会把顶层 `define` 应用到 node_modules 依赖，
 *   产物进入浏览器后模块求值即抛 `ReferenceError: process is not defined`，
 *   导致 release 构建白屏卡死。
 *
 * 该脚本为确定性文本替换，幂等；替换后 `!!("production" !== "production")` 这类
 * 表达式由压缩器/引擎自然短路，dev-only 分支不再执行。
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// vendor.mjs（vue/tdesign）与 cordis.mjs（@cordisjs/core）都经 index.html import map
// 在浏览器加载，任一份残留裸 `process` 引用都会导致 release 白屏，故一并处理。
const targets = [
  path.resolve(process.cwd(), "public/vendor/vendor.mjs"),
  path.resolve(process.cwd(), "public/vendor/cordis.mjs"),
];

let total = 0;
for (const target of targets) {
  let source;
  try {
    source = readFileSync(target, "utf8");
  } catch {
    // 文件不存在（例如仅重建部分 vendor）时跳过，不视为错误。
    continue;
  }
  const replacementCount = source.split("process.env.NODE_ENV").length - 1;
  if (replacementCount === 0) continue;
  writeFileSync(target, source.replaceAll("process.env.NODE_ENV", '"production"'));
  total += replacementCount;
  console.log(
    `[inline-vendor-node-env] inlined ${replacementCount} process.env.NODE_ENV refs in ${path.basename(target)}`,
  );
}

if (total === 0) {
  console.log("[inline-vendor-node-env] no raw process.env.NODE_ENV found, skip");
}
