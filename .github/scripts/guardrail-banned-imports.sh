#!/usr/bin/env bash
set -euo pipefail

# Guardrail: Detect banned charting imports in source code.
# Default banned: chart.js, react-chartjs-2, plotly.js, react-plotly.js
# Behavior: warns by default; set GUARDRAILS_ENFORCE=true to fail.

ENFORCE=${GUARDRAILS_ENFORCE:-false}
status=0

warn() { echo "⚠️  Guardrail Warning: $*"; }
fail() { echo "❌ Guardrail Failure: $*"; status=1; }
report() { if [[ "$ENFORCE" == "true" ]]; then fail "$1"; else warn "$1"; fi }

shopt -s nullglob

if command -v rg >/dev/null 2>&1; then
  MATCHES=$(rg -n "from 'react-chartjs-2'|from \"react-chartjs-2\"|from 'chart\.js'|from \"chart\.js\"|from 'react-plotly\.js'|from \"react-plotly\.js\"|from 'plotly\.js'|from \"plotly\.js\"" \
    src --glob '!**/*.test.*' --glob '!**/*.spec.*' --glob '!src/test/**' --glob '!**/*.logging-backup' --glob '!**/*.backup.*' || true)
else
  MATCHES=$(grep -R -nE "from 'react-chartjs-2'|from \"react-chartjs-2\"|from 'chart\.js'|from \"chart\.js\"|from 'react-plotly\.js'|from \"react-plotly\.js\"|from 'plotly\.js'|from \"plotly\.js\"" \
    src --exclude-dir=node_modules --exclude-dir=dist --exclude='*.test.*' --exclude='*.spec.*' --exclude='*.logging-backup' --exclude='*.backup.*' || true)
fi

if [[ -n "${MATCHES}" ]]; then
  report "Disallowed charting imports detected.\n${MATCHES}"
fi

exit $status
