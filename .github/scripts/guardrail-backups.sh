#!/usr/bin/env bash
set -euo pipefail

# Guardrail: Detect regeneration of *.logging-backup files.
# Behavior: warns by default; set GUARDRAILS_ENFORCE=true to fail.

ENFORCE=${GUARDRAILS_ENFORCE:-false}
status=0

warn() { echo "⚠️  Guardrail Warning: $*"; }
fail() { echo "❌ Guardrail Failure: $*"; status=1; }
report() { if [[ "$ENFORCE" == "true" ]]; then fail "$1"; else warn "$1"; fi }

COUNT=$(rg --files 2>/dev/null | rg -n "\\.logging-backup$" | wc -l || true)
if [[ "$COUNT" -gt 0 ]]; then
  LIST=$(rg --files 2>/dev/null | rg -n "\\.logging-backup$" | head -n 50 || true)
  report "Found $COUNT '*.logging-backup' files. First 50 shown:\n$LIST\nRun 'npm run cleanup:backups' to remove them."
fi

exit $status

