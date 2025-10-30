#!/usr/bin/env bash
set -euo pipefail

ENFORCE=${GUARDRAILS_ENFORCE:-false}
status=0

warn() { echo "⚠️  Guardrail Warning: $*"; }
fail() { echo "❌ Guardrail Failure: $*"; status=1; }
report() { if [[ "$ENFORCE" == "true" ]]; then fail "$1"; else warn "$1"; fi }

MATCHES=$(rg -n --no-heading \
  -g '!**/*.test.*' -g '!**/__tests__/**' \
  -g '!**/*.logging-backup' \
  -e '@ts-ignore' \
  -e 'as\s+any' \
  -e 'as\s+unknown\s+as' \
  -e '\.backup(\.|$)' \
  -e '\bTODO\b|\bFIXME\b' \
  src 2>/dev/null || true)

if [[ -n "$MATCHES" ]]; then
  report "Banned patterns detected:\n$MATCHES"
fi

exit $status

