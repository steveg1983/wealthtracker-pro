#!/bin/bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
D=${WT_PGDATA:-/tmp/wtpg}
pg_ctl -D "$D" stop >/dev/null 2>&1
rm -rf "$D"
echo "local db removed"
