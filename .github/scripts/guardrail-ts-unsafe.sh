#!/usr/bin/env bash
set -euo pipefail

# Guardrail: Detect risky TS patterns that hide type mismatches
# - Double casts: "as unknown as"
# - Explicit unknown types in store/thunks
# Behavior: warns by default; set GUARDRAILS_ENFORCE=true to fail.

ENFORCE=${GUARDRAILS_ENFORCE:-false}
status=0
warn() { echo "⚠️  Guardrail Warning: $*"; }
fail() { echo "❌ Guardrail Failure: $*"; status=1; }
report() { if [[ "$ENFORCE" == "true" ]]; then fail "$1"; else warn "$1"; fi }

# Exclude backup files from scans to reduce noise
if command -v rg >/dev/null 2>&1; then
  DOUBLE_CASTS=$(rg -n "as unknown as" src --glob '!**/*.backup.*' --glob '!**/*.ts.backup' --glob '!**/*.tsx.backup' || true)
  UNKNOWN_PARAMS=$(rg -n -P ":\\s*unknown([),\\s])" src/store src/services src/utils --glob '!**/*.backup.*' --glob '!**/*.ts.backup' --glob '!**/*.tsx.backup' || true)
else
  DOUBLE_CASTS=$(grep -R -n "as unknown as" src --exclude='*.backup.*' --exclude='*.ts.backup' --exclude='*.tsx.backup' --exclude='*backup.tsx' --exclude='*backup.ts' || true)
  UNKNOWN_PARAMS=$(grep -R -nE ":\s*unknown([),\s])" src/store src/services src/utils --exclude='*.backup.*' --exclude='*.ts.backup' --exclude='*.tsx.backup' --exclude='*backup.tsx' --exclude='*backup.ts' || true)
fi

if [[ -n "$DOUBLE_CASTS" ]]; then
  report "Double casts detected (as unknown as ...):\n$DOUBLE_CASTS"
fi

if [[ -n "$UNKNOWN_PARAMS" ]]; then
  report "Explicit unknown types detected in critical code:\n$UNKNOWN_PARAMS"
fi

exit $status
