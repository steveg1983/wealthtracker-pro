#!/usr/bin/env bash
set -euo pipefail

# Guardrail: Ensure Playwright baseURL port matches Vite dev server port.
# Behavior: warns by default; set GUARDRAILS_ENFORCE=true to fail.

ENFORCE=${GUARDRAILS_ENFORCE:-false}
status=0
warn() { echo "⚠️  Guardrail Warning: $*"; }
fail() { echo "❌ Guardrail Failure: $*"; status=1; }
report() { if [[ "$ENFORCE" == "true" ]]; then fail "$1"; else warn "$1"; fi }

VITE_PORT=""
PW_PORT=""

if [[ -f vite.config.ts ]]; then
  VITE_PORT=$(grep -Eo "port:\s*[0-9]+" vite.config.ts | head -1 | sed -E 's/[^0-9]*([0-9]+)/\1/')
fi

if [[ -f playwright.config.ts ]]; then
  PW_PORT=$(grep -Eo "http://localhost:[0-9]+" playwright.config.ts | head -1 | sed -E 's/.*://')
fi

if [[ -n "$VITE_PORT" && -n "$PW_PORT" && "$VITE_PORT" != "$PW_PORT" ]]; then
  report "Playwright baseURL port ($PW_PORT) does not match Vite server port ($VITE_PORT)."
fi

exit $status
