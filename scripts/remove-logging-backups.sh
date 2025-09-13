#!/usr/bin/env bash
set -euo pipefail

# Remove all *.logging-backup files from the repository
# Dry-run: set DRY_RUN=true to preview

DRY_RUN=${DRY_RUN:-false}

echo "Scanning for *.logging-backup files..."
files=$(git ls-files "*.logging-backup" 2>/dev/null || true)

# Fallback to ripgrep if git isn't available or returns empty
if [[ -z "$files" ]]; then
  if command -v rg >/dev/null 2>&1; then
    files=$(rg --files | rg "\\.logging-backup$" || true)
  else
    files=$(find . -type f -name "*.logging-backup" 2>/dev/null || true)
  fi
fi

if [[ -z "$files" ]]; then
  echo "No backup files found."
  exit 0
fi

echo "Found $(echo "$files" | wc -l | xargs) backup files."

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry run enabled. Files that would be removed:"
  echo "$files"
  exit 0
fi

while IFS= read -r f; do
  if [[ -z "$f" ]]; then continue; fi
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git rm -f -- "$f" >/dev/null 2>&1 || rm -f -- "$f"
  else
    rm -f -- "$f"
  fi
done <<< "$files"
echo "Backup files removed. Commit these deletions to finalize cleanup."
