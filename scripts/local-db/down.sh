#!/bin/bash
# shellcheck source=scripts/local-db/pgbin.sh
. "$(cd "$(dirname "$0")" && pwd)/pgbin.sh"
D=${WT_PGDATA:-/tmp/wtpg}
pg_ctl -D "$D" stop >/dev/null 2>&1
rm -rf "$D"
echo "local db removed"
