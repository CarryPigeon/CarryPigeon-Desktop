#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/src"

cd "$ROOT_DIR"

fail=0

echo "[check-log-standards] 1/3 scanning direct console usage..."
if rg -n "console\.(debug|info|warn|error|log)\(" "$FRONTEND_DIR" --glob '!src/shared/utils/logger.ts'; then
  echo "[check-log-standards] ❌ direct console usage found; use createLogger(scope)"
  fail=1
else
  echo "[check-log-standards] ✅ no direct console usage found"
fi

echo "[check-log-standards] 2/3 scanning Action message format..."
if rg --pcre2 -n "\b(?:tauriLog|(?:this\.)?logger|deps\.logger)\.(?:debug|info|warn|error)\(\s*['\"](?!Action:\s*[a-z0-9]+(?:_[a-z0-9]+)*['\"])" "$FRONTEND_DIR"; then
  echo "[check-log-standards] ❌ logger message must be: Action: <snake_case>"
  fail=1
else
  echo "[check-log-standards] ✅ Action message format is unified"
fi

echo "[check-log-standards] 3/3 scanning Action layered prefixes..."
action_prefix_failed=0
while IFS= read -r line; do
  action="$(printf '%s' "$line" | sed -E 's/.*Action:\s*([a-z0-9_]+).*/\1/')"
  if [[ ! "$action" =~ ^(chat|network|plugins|servers|auth|http|api)_[a-z0-9]+(_[a-z0-9]+)*$ ]]; then
    echo "$line"
    action_prefix_failed=1
  fi
done < <(rg --no-heading -n "Action:\s*[a-z0-9_]+" "$FRONTEND_DIR" -S)

if [[ "$action_prefix_failed" -ne 0 ]]; then
  echo "[check-log-standards] ❌ Action must use layered prefix: <domain>_<subdomain>_..."
  fail=1
else
  echo "[check-log-standards] ✅ Action layered prefixes are unified"
fi

if [[ "$fail" -ne 0 ]]; then
  echo "[check-log-standards] failed"
  exit 1
fi

echo "[check-log-standards] passed"
