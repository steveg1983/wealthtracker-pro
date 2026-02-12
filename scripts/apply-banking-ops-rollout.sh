#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "ERROR: SUPABASE_DB_URL is required." >&2
  echo "Example:" >&2
  echo "  SUPABASE_DB_URL='postgresql://postgres:<password>@<host>:5432/postgres' bash scripts/apply-banking-ops-rollout.sh" >&2
  exit 1
fi

echo "Applying Supabase migrations (including banking ops hardening)..."
npx --yes supabase db push --include-roles --include-policies --db-url "$SUPABASE_DB_URL"
echo "Migration apply completed."

if [[ "${RUN_SUPABASE_SMOKE:-false}" == "true" ]]; then
  echo "Running Supabase smoke tests..."
  npm run test:supabase-smoke
else
  echo "Skipping Supabase smoke tests (set RUN_SUPABASE_SMOKE=true to enable)."
fi

if [[ "${RUN_BANKING_API_SMOKE:-false}" == "true" ]]; then
  echo "Running banking API smoke checks..."
  npm run banking:smoke
else
  echo "Skipping banking API smoke checks (set RUN_BANKING_API_SMOKE=true to enable)."
fi
