#!/usr/bin/env bash
set -euo pipefail

# Guardrail: Check CSP safety and inline blocks
# - Flags 'unsafe-inline' / 'unsafe-eval' in vercel.json and nginx.conf
# - Detects inline <script> or <style> blocks in index.html
# Behavior: warns by default; set GUARDRAILS_ENFORCE=true to fail.

ENFORCE=${GUARDRAILS_ENFORCE:-false}
status=0

warn() { echo "⚠️  Guardrail Warning: $*"; }
fail() { echo "❌ Guardrail Failure: $*"; status=1; }
report() { if [[ "$ENFORCE" == "true" ]]; then fail "$1"; else warn "$1"; fi }

# 1) vercel.json CSP
if [[ -f "vercel.json" ]]; then
  if grep -R "Content-Security-Policy" -n vercel.json | grep -E "unsafe-inline|unsafe-eval" >/dev/null 2>&1; then
    report "CSP contains unsafe directives in vercel.json (unsafe-inline and/or unsafe-eval)."
  fi
fi

# 2) nginx.conf CSP
if [[ -f "nginx.conf" ]]; then
  if grep -R "Content-Security-Policy" -n nginx.conf | grep -E "unsafe-inline|unsafe-eval" >/dev/null 2>&1; then
    report "CSP contains unsafe directives in nginx.conf (unsafe-inline and/or unsafe-eval)."
  fi
fi

# 3) index.html inline blocks
if [[ -f "index.html" ]]; then
  # Inline <script> without src
  if grep -nE "<script(?![^>]*src=)" index.html >/dev/null 2>&1; then
    report "Inline <script> detected in index.html; prefer external file or CSP nonce/hash."
  fi
  # Inline <style>
  if grep -n "<style" index.html >/dev/null 2>&1; then
    report "Inline <style> detected in index.html; prefer external CSS or CSP hash."
  fi
fi

exit $status

