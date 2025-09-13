#!/usr/bin/env bash
set -euo pipefail

# Guardrail: Ensure Docker builder installs dev dependencies for Vite build.
# Behavior: warns by default; set GUARDRAILS_ENFORCE=true to fail.

ENFORCE=${GUARDRAILS_ENFORCE:-false}
status=0
warn() { echo "⚠️  Guardrail Warning: $*"; }
fail() { echo "❌ Guardrail Failure: $*"; status=1; }
report() { if [[ "$ENFORCE" == "true" ]]; then fail "$1"; else warn "$1"; fi }

if [[ -f Dockerfile ]]; then
  if grep -n "npm ci --only=production" Dockerfile >/dev/null 2>&1; then
    report "Dockerfile uses 'npm ci --only=production' in builder stage; Vite build typically requires devDependencies. Consider full 'npm ci' in builder."
  fi
fi

exit $status

