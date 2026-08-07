#!/bin/bash
set -u
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
export LC_ALL=C
D=${WT_PGDATA:-/tmp/wtpg}; PORT=${WT_PGPORT:-55432}
here="$(cd "$(dirname "$0")" && pwd)"
rc=0
for t in "$here"/*.test.sql; do
  echo "── $(basename "$t")"
  psql -h "$D" -p "$PORT" -U postgres -d postgres -f "$t" 2>&1 | grep -E "^ [tf] |_match|_preserved|_restored|ERROR" || true
done
exit $rc
