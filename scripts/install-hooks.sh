#!/usr/bin/env bash
set -euo pipefail

HOOK_DIR=".git/hooks"
HOOK_FILE="$HOOK_DIR/pre-commit"
PUSH_HOOK_FILE="$HOOK_DIR/pre-push"

mkdir -p "$HOOK_DIR"

cat > "$HOOK_FILE" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

# Only run updater if PROJECT_ENTERPRISE.md is staged (or the updater itself changed)
STAGED=$(git diff --cached --name-only)
if echo "$STAGED" | grep -qE '^(PROJECT_ENTERPRISE\.md|scripts/update-handoff\.mjs|package\.json)$'; then
  echo "[pre-commit] Updating handoff and context error snapshots..."
  # Ensure dependencies are installed for node to run
  if command -v node >/dev/null 2>&1; then
    npm run -s handoff:update || {
      echo "[pre-commit] Warning: handoff:update failed; continuing" >&2
    }
    # Re-add potentially modified files
    git add handoff.md PROJECT_ENTERPRISE.md || true
  else
    echo "[pre-commit] Node not found; skipping snapshot update" >&2
  fi
fi

exit 0
EOF

chmod +x "$HOOK_FILE"
echo "Installed pre-commit hook at $HOOK_FILE"

# Install pre-push hook to run quick verification
cat > "$PUSH_HOOK_FILE" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "[pre-push] Running lint, typecheck, and unit tests..."
if command -v node >/dev/null 2>&1; then
  npm run -s lint
  npx tsc --noEmit
  npm run -s test:unit
else
  echo "[pre-push] Node not found; skipping checks" >&2
fi
exit 0
EOF

chmod +x "$PUSH_HOOK_FILE"
echo "Installed pre-push hook at $PUSH_HOOK_FILE"
