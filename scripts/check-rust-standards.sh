#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/src-tauri/src"

cd "$ROOT_DIR"

fail=0

echo "[check-rust-standards] 1/7 scanning panic-prone patterns..."
if rg -n "unwrap\(|expect\(|panic!|todo!|unimplemented!|println!|eprintln!|dbg!" "$TARGET_DIR"; then
  echo "[check-rust-standards] ❌ found forbidden patterns in Rust source"
  fail=1
else
  echo "[check-rust-standards] ✅ no forbidden patterns found"
fi

echo "[check-rust-standards] 2/7 scanning tauri command return style..."
command_style_failed=0
while IFS= read -r file; do
  if ! awk -v file="$file" '
    BEGIN { in_command = 0; sig = ""; start = 0; bad = 0 }
    /#\[tauri::command\]/ {
      in_command = 1;
      sig = "";
      start = NR;
      next;
    }
    {
      if (in_command == 1) {
        sig = sig " " $0;
        if ($0 ~ /\{/) {
          if (sig !~ /->[[:space:]]*CommandResult</) {
            printf("%s:%d: %s\n", file, start, sig);
            bad = 1;
          }
          in_command = 0;
          sig = "";
        }
      }
    }
    END { exit bad }
  ' "$file"; then
    command_style_failed=1
  fi
done < <(rg --files "$TARGET_DIR" | rg '\.rs$')

if [[ "$command_style_failed" -ne 0 ]]; then
  echo "[check-rust-standards] ❌ tauri command should use CommandResult<T>"
  fail=1
else
  echo "[check-rust-standards] ✅ tauri command return style is unified"
fi

echo "[check-rust-standards] 3/7 scanning bare Result<_, String> usage..."
if rg -n "Result<[^\n>]+,\s*String>" "$TARGET_DIR" | rg -v "src-tauri/src/shared/error/mod.rs"; then
  echo "[check-rust-standards] ❌ found bare Result<_, String>; use anyhow::Result or CommandResult<T>"
  fail=1
else
  echo "[check-rust-standards] ✅ no bare Result<_, String> found"
fi

echo "[check-rust-standards] 4/7 scanning generic plugin error code..."
if rg -n "PLUGINS_COMMAND_FAILED" "$TARGET_DIR"; then
  echo "[check-rust-standards] ❌ found generic plugin error code; use per-command code"
  fail=1
else
  echo "[check-rust-standards] ✅ plugin error code granularity looks good"
fi

echo "[check-rust-standards] 5/7 scanning tracing action field..."
action_style_failed=0
while IFS= read -r file; do
  if ! awk -v file="$file" '
    BEGIN { in_log = 0; block = ""; start = 0; bad = 0 }
    {
      line = $0;
      sub(/\/\/.*$/, "", line);

      if (in_log == 0) {
        if (line ~ /(^|[^A-Za-z0-9_])((tracing::)?(trace|debug|info|warn|error))![[:space:]]*\(/) {
          in_log = 1;
          block = line;
          start = NR;
          if (line ~ /\);/) {
            if (block !~ /action[[:space:]]*=/) {
              printf("%s:%d: %s\n", file, start, block);
              bad = 1;
            }
            in_log = 0;
            block = "";
          }
        }
      } else {
        block = block "\n" line;
        if (line ~ /\);/) {
          if (block !~ /action[[:space:]]*=/) {
            printf("%s:%d: %s\n", file, start, block);
            bad = 1;
          }
          in_log = 0;
          block = "";
        }
      }
    }
    END { exit bad }
  ' "$file"; then
    action_style_failed=1
  fi
done < <(rg --files "$TARGET_DIR" | rg '\.rs$')

if [[ "$action_style_failed" -ne 0 ]]; then
  echo "[check-rust-standards] ❌ tracing logs must include action field"
  fail=1
else
  echo "[check-rust-standards] ✅ tracing action field is unified"
fi

echo "[check-rust-standards] 6/7 scanning tracing action layered prefixes..."
action_prefix_failed=0
while IFS= read -r line; do
  action="$(printf '%s' "$line" | sed -E 's/.*action\s*=\s*"([a-z0-9_]+)".*/\1/')"
  if [[ ! "$action" =~ ^(app|network|plugins|settings|windows|db|tauri|test)_[a-z0-9]+(_[a-z0-9]+)*$ ]]; then
    echo "$line"
    action_prefix_failed=1
  fi
done < <(rg --no-heading -n 'action\s*=\s*"[a-z0-9_]+"' "$TARGET_DIR")

if [[ "$action_prefix_failed" -ne 0 ]]; then
  echo "[check-rust-standards] ❌ tracing action should use layered prefix"
  fail=1
else
  echo "[check-rust-standards] ✅ tracing action layered prefixes are unified"
fi

echo "[check-rust-standards] 7/7 checking formatting..."
if cargo fmt --all -- --check >/dev/null 2>&1; then
  echo "[check-rust-standards] ✅ rustfmt check passed"
else
  echo "[check-rust-standards] ❌ rustfmt check failed"
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo "[check-rust-standards] failed"
  exit 1
fi

echo "[check-rust-standards] passed"
