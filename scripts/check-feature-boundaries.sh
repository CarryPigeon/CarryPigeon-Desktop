#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

FEATURES_DIR="src/features"
SEARCH_ROOTS=(
  "src/app"
  "src/features"
)
PUBLIC_ENTRY_CANDIDATES=(
  "api"
  "api-types"
  "routes"
  "styles"
)

declare -a TARGET_FEATURES=()
declare -a FORBIDDEN_REPORTS=()

for feature_dir in "$FEATURES_DIR"/*; do
  [[ -d "$feature_dir" ]] || continue
  feature_name="$(basename "$feature_dir")"
  declare -a public_entries=()

  for candidate in "${PUBLIC_ENTRY_CANDIDATES[@]}"; do
    if [[ -f "$feature_dir/$candidate.ts" ]]; then
      public_entries+=("$candidate")
    fi
  done

  if [[ "${#public_entries[@]}" -eq 0 ]]; then
    continue
  fi

  TARGET_FEATURES+=("$feature_name")

  import_pattern="(from|import)[[:space:]]+[\"']@/features/$feature_name/"
  matches="$(
    grep -RInE "$import_pattern" "${SEARCH_ROOTS[@]}" \
      | grep -v "^src/features/$feature_name/" \
      || true
  )"

  [[ -n "$matches" ]] || continue

  allowed_suffix_pattern="$(printf '%s|' "${public_entries[@]}")"
  allowed_suffix_pattern="${allowed_suffix_pattern%|}"
  forbidden="$(
    printf '%s\n' "$matches" \
      | grep -vE "@/features/$feature_name/($allowed_suffix_pattern)([\"']|$)" \
      || true
  )"

  if [[ -n "$forbidden" ]]; then
    FORBIDDEN_REPORTS+=("feature=$feature_name allowed={${public_entries[*]}}")
    FORBIDDEN_REPORTS+=("$forbidden")
  fi
done

if [[ "${#FORBIDDEN_REPORTS[@]}" -gt 0 ]]; then
  echo "[check-feature-boundaries] ❌ found forbidden cross-feature imports into feature internals:"
  printf '%s\n' "${FORBIDDEN_REPORTS[@]}"
  exit 1
fi

echo "[check-feature-boundaries] ✅ feature boundaries look good"
echo "[check-feature-boundaries] checked public entries for: ${TARGET_FEATURES[*]}"
