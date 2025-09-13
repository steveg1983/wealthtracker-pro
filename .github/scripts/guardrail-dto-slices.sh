#!/usr/bin/env bash
set -euo pipefail

# Guardrail: Enforce DTO-in-state patterns in Redux slices and forbid double casts in slices.
# - Flags "as unknown as" in src/store/slices/**
# - Flags slice state typed as Account[] | Transaction[] | Budget[] | Goal[] (should be DTO arrays)
# Behavior: warns by default; set GUARDRAILS_ENFORCE=true to fail.

ENFORCE=${GUARDRAILS_ENFORCE:-false}
status=0

warn() { echo "⚠️  Guardrail Warning: $*"; }
fail() { echo "❌ Guardrail Failure: $*"; status=1; }
report() { if [[ "$ENFORCE" == "true" ]]; then fail "$1"; else warn "$1"; fi }

# 1) Double casts in slices
SLICE_DOUBLE_CASTS=$(rg -n "as unknown as" src/store/slices 2>/dev/null || true)
if [[ -n "$SLICE_DOUBLE_CASTS" ]]; then
  report "Double casts found in slices (use explicit types, avoid 'as unknown as'):\n$SLICE_DOUBLE_CASTS"
fi

# 2) State typed as Domain arrays (should use DTO arrays)
PATTERNS=(
  "accounts:\\s*Account\\[\\];"
  "transactions:\\s*Transaction\\[\\];"
  "budgets:\\s*Budget\\[\\];"
  "goals:\\s*Goal\\[\\];"
)
OFFENDERS=""
for pat in "${PATTERNS[@]}"; do
  MATCH=$(rg -n "$pat" src/store/slices 2>/dev/null || true)
  if [[ -n "$MATCH" ]]; then
    OFFENDERS+="$MATCH\n"
  fi
done

if [[ -n "$OFFENDERS" ]]; then
  report "Slice state typed as Domain arrays detected (use DTO arrays):\n$OFFENDERS"
fi

exit $status

