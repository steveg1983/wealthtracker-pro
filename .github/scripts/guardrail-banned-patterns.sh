#!/usr/bin/env bash
# Guardrail: Detect banned patterns in source code.
# Behavior: warns by default; set GUARDRAILS_ENFORCE=true to fail.

set -euo pipefail

ENFORCE=${GUARDRAILS_ENFORCE:-false}
status=0

warn() { echo "⚠️  Guardrail Warning: $*"; }
fail() { echo "❌ Guardrail Failure: $*"; status=1; }
report() { if [[ "$ENFORCE" == "true" ]]; then fail "$1"; else warn "$1"; fi }

# Search scope: src/ only (exclude tests/mocks), plus configs
MATCHES=$(rg -n --no-heading \
  -g '!**/*.test.*' -g '!**/__tests__/**' -g '!src/test/**' -g '!src/mocks/**' \
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

