#!/usr/bin/env bash
set -euo pipefail

# Scan for console.log in src (excluding tests/specs) and ignore allowlisted files.

ALLOWLIST_FILE=".console-allowlist.txt"

# Gather matches
matches=$(grep -R -nE "\\bconsole\\.log\\s*\\(" src \
  --include='*.ts' --include='*.tsx' \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=cypress \
  --exclude-dir=src/mocks \
  --exclude-dir=e2e --exclude-dir=src/test \
  --exclude='*.test.*' --exclude='*.spec.*' || true)

if [[ -z "$matches" ]]; then
  echo "✅ No console.log found in src (excluding tests)."
  exit 0
fi

if [[ -f "$ALLOWLIST_FILE" ]]; then
  # Filter allowlisted files
  filtered=$(echo "$matches" | grep -v -f "$ALLOWLIST_FILE" || true)
else
  filtered="$matches"
fi

if [[ -n "$filtered" ]]; then
  echo "❌ console.log occurrences found (not allowlisted):"
  echo "$filtered"
  echo
  echo "Use the centralized logger or console.warn/error instead."
  exit 1
else
  echo "✅ Only allowlisted console.log occurrences found."
fi
