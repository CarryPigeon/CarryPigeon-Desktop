#!/usr/bin/env node
/**
 * @fileoverview 性能基准回归检测脚本。
 *
 * 对比当前 benchmark 结果与基线，超过阈值时返回非零退出码。
 */

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("docs/performance-benchmarks/data");
const latestPath = path.join(DATA_DIR, "latest.json");
const baselinePath = path.join(DATA_DIR, "baseline.json");

/**
 * 阈值定义：当前值超过基线值的多少倍即视为回归。
 */
const THRESHOLDS = {
  build_time_ms: 1.2,
  typecheck_time_ms: 1.2,
  cargo_check_time_ms: 1.2,
  cargo_test_time_ms: 1.2,
  main_js_bytes: 1.05,
  all_js_bytes: 1.05,
};

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function checkRegression(latest, baseline) {
  const regressions = [];
  for (const [key, ratio] of Object.entries(THRESHOLDS)) {
    const baseValue = baseline[key];
    const latestValue = latest[key];
    if (typeof baseValue === "number" && typeof latestValue === "number" && latestValue > baseValue * ratio) {
      regressions.push(`${key} regressed: ${latestValue} vs baseline ${baseValue}`);
    }
  }
  return regressions;
}

const latest = loadJson(latestPath);
if (!latest) {
  console.error("No latest benchmark found at", latestPath);
  process.exit(1);
}

const baseline = loadJson(baselinePath);
if (!baseline) {
  console.log("No baseline found, skipping regression check");
  process.exit(0);
}

const regressions = checkRegression(latest, baseline);
if (regressions.length > 0) {
  console.error("Performance regressions detected:");
  for (const regression of regressions) {
    console.error(`  - ${regression}`);
  }
  process.exit(2);
}

console.log("No performance regressions detected");
