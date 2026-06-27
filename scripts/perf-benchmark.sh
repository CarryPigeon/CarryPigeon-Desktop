#!/usr/bin/env bash
# ============================================================
# perf-benchmark.sh — CarryPigeon Desktop 性能基准测试
# ============================================================
# 用法: bash scripts/perf-benchmark.sh
#
# 测量项:
#   1. 前端构建时间 (pnpm build)
#   2. 主 JS 包体积
#   3. TypeScript 类型检查时间
#   4. Rust 编译时间 (cargo check)
#   5. Rust 测试时间 (cargo test)
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
RESULTS="{}"

measure_ms() {
  local start
  local duration
  start=$(date +%s%N)
  "$@" > /dev/null 2>&1 || true
  duration=$(( ($(date +%s%N) - start) / 1000000 ))
  echo "$duration"
}

fmt_ms() { awk "BEGIN { printf \"%.2f\", $1 / 1000 }"; }

echo "===== CarryPigeon Desktop 性能基准 ====="
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ---------- 1. 前端构建时间 ----------
echo "1. 前端构建..."
BUILD_MS=$(measure_ms pnpm run build)
echo "   构建时间: $(fmt_ms "$BUILD_MS")s (${BUILD_MS}ms)"
RESULTS=$(echo "$RESULTS" | jq --arg v "$BUILD_MS" '. + {"build_time_ms": ($v|tonumber)}' 2>/dev/null || echo "$RESULTS")

# ---------- 2. JS 包体积 ----------
echo ""
echo "2. 包体积分析..."
if [ -d dist/assets ]; then
  TOTAL_SIZE=$(find dist/assets -name 'index-*.js' -exec stat -c%s {} \; 2>/dev/null | awk '{s+=$1} END {print s}')
  TOTAL_SIZE=${TOTAL_SIZE:-0}
  echo "   主入口 JS 大小: $(awk "BEGIN { printf \"%.1f\", $TOTAL_SIZE / 1024 }") KB"
  RESULTS=$(echo "$RESULTS" | jq --argjson v "$TOTAL_SIZE" '. + {"main_js_bytes": $v}' 2>/dev/null || echo "$RESULTS")

  ALL_JS_SIZE=$(find dist/assets -name '*.js' -exec stat -c%s {} \; 2>/dev/null | awk '{s+=$1} END {print s}')
  ALL_JS_SIZE=${ALL_JS_SIZE:-0}
  echo "   全部 JS 资源: $(awk "BEGIN { printf \"%.1f\", $ALL_JS_SIZE / 1024 }") KB"
  RESULTS=$(echo "$RESULTS" | jq --argjson v "$ALL_JS_SIZE" '. + {"all_js_bytes": $v}' 2>/dev/null || echo "$RESULTS")
fi

# ---------- 3. TypeScript 类型检查 ----------
echo ""
echo "3. TypeScript 类型检查..."
TSC_MS=$(measure_ms pnpm run typecheck)
echo "   耗时: $(fmt_ms "$TSC_MS")s (${TSC_MS}ms)"
RESULTS=$(echo "$RESULTS" | jq --arg v "$TSC_MS" '. + {"typecheck_time_ms": ($v|tonumber)}' 2>/dev/null || echo "$RESULTS")

# ---------- 4. Rust 编译 ----------
echo ""
echo "4. Rust 编译检查..."
CARGO_MS=$(measure_ms cargo check --manifest-path src-tauri/Cargo.toml)
echo "   cargo check: $(fmt_ms "$CARGO_MS")s (${CARGO_MS}ms)"
RESULTS=$(echo "$RESULTS" | jq --arg v "$CARGO_MS" '. + {"cargo_check_time_ms": ($v|tonumber)}' 2>/dev/null || echo "$RESULTS")

# ---------- 5. Rust 测试 ----------
echo ""
echo "5. Rust 测试..."
TEST_MS=$(measure_ms cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1)
echo "   测试耗时: $(fmt_ms "$TEST_MS")s (${TEST_MS}ms)"
RESULTS=$(echo "$RESULTS" | jq --arg v "$TEST_MS" '. + {"cargo_test_time_ms": ($v|tonumber)}' 2>/dev/null || echo "$RESULTS")

# ---------- 输出 ----------
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
RESULTS=$(echo "$RESULTS" | jq --arg v "$COMMIT" '. + {"commit": $v}' 2>/dev/null || echo "$RESULTS")

DATA_DIR="docs/performance-benchmarks/data"
mkdir -p "$DATA_DIR"
LATEST_FILE="$DATA_DIR/latest.json"
BASELINE_FILE="$DATA_DIR/baseline.json"

echo "$RESULTS" > "$LATEST_FILE"

echo ""
echo "===== 基准测试完成 ====="
echo "$RESULTS" | jq '.' 2>/dev/null || echo "$RESULTS"

# ---------- 回归检测 ----------
echo ""
if command -v node >/dev/null 2>&1; then
  node scripts/benchmark-compare.mjs
  COMPARE_STATUS=$?
else
  echo "node not available, skipping regression check"
  COMPARE_STATUS=0
fi

# ---------- 基线管理 ----------
if [ ! -f "$BASELINE_FILE" ]; then
  echo "Creating initial baseline..."
  cp "$LATEST_FILE" "$BASELINE_FILE"
fi

# ---------- Markdown 报告追加 ----------
REPORT_FILE="docs/performance-benchmarks.md"
REPORT_DATE=$(date '+%Y-%m-%d %H:%M:%S')
{
  echo ""
  echo "## Benchmark $REPORT_DATE"
  echo ""
  echo "- Commit: $COMMIT"
  echo "- build_time_ms: $BUILD_MS"
  echo "- main_js_bytes: ${TOTAL_SIZE:-0}"
  echo "- all_js_bytes: ${ALL_JS_SIZE:-0}"
  echo "- typecheck_time_ms: $TSC_MS"
  echo "- cargo_check_time_ms: $CARGO_MS"
  echo "- cargo_test_time_ms: $TEST_MS"
  if [ $COMPARE_STATUS -eq 2 ]; then
    echo "- **Status: REGRESSION DETECTED**"
  else
    echo "- Status: OK"
  fi
} >> "$REPORT_FILE"

exit $COMPARE_STATUS
