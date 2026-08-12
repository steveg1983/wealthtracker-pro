#!/bin/bash
# Throwaway local Postgres with the full migration history applied.
set -u

# shellcheck source=scripts/local-db/pgbin.sh
. "$(cd "$(dirname "$0")" && pwd)/pgbin.sh"

# It REFUSES rather than continuing without initdb: the failure from carrying on
# is "command not found" three lines into a cluster that half exists, which
# reads like a broken script rather than a missing dependency.
if ! command -v initdb >/dev/null 2>&1; then
  echo "no PostgreSQL server binaries found (initdb)." >&2
  echo "  macOS:         brew install postgresql@17" >&2
  echo "  Debian/Ubuntu: apt-get install postgresql  (lands in /usr/lib/postgresql/<major>/bin)" >&2
  echo "  or set WT_PGBIN to the directory holding initdb/pg_ctl." >&2
  exit 1
fi

D=${WT_PGDATA:-/tmp/wtpg}
PORT=${WT_PGPORT:-55432}
MIG="$(cd "$(dirname "$0")/../../supabase/migrations" && pwd)"
run() { psql -h "$D" -p "$PORT" -U postgres -d postgres -q "$@"; }

if [ ! -d "$D/base" ]; then
  rm -rf "$D"; mkdir -p "$D"
  initdb -D "$D" -U postgres --auth=trust >/dev/null || { echo "initdb failed"; exit 1; }
fi
pg_ctl -D "$D" -o "-p $PORT -k $D" -l "$D/server.log" status >/dev/null 2>&1 \
  || pg_ctl -D "$D" -o "-p $PORT -k $D" -l "$D/server.log" start >/dev/null || { tail -5 "$D/server.log"; exit 1; }
sleep 3

run -c "ALTER DATABASE postgres SET search_path = public, extensions;" >/dev/null 2>&1
run -c "DROP SCHEMA IF EXISTS public CASCADE;" >/dev/null 2>&1
run >/dev/null 2>&1 <<'SQL'
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto  SCHEMA extensions;
-- Supabase stand-ins. Identity comes from request.jwt.claims, as it does in prod.
CREATE OR REPLACE FUNCTION auth.uid()  RETURNS uuid LANGUAGE sql STABLE AS $f$ SELECT NULL::uuid $f$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $f$ SELECT current_setting('request.jwt.claim.role', true) $f$;
CREATE OR REPLACE FUNCTION auth.jwt()  RETURNS jsonb LANGUAGE sql STABLE AS $f$ SELECT coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb $f$;
SQL

cd "$MIG" || exit 1
BASE=20251030003814__initial-schema.sql
run -v ON_ERROR_STOP=1 -f "$BASE" >/tmp/wt-base.log 2>&1 || { echo "baseline FAILED"; tail -5 /tmp/wt-base.log; exit 1; }

# Three passes: filename order is not dependency order (the baseline dump sorts
# after files it already contains), so a migration can fail on pass 1 for want
# of something a later file creates, and succeed on pass 2.
#
# A MIGRATION THAT HAS ALREADY SUCCEEDED IS NEVER RE-RUN. It used to be, and the
# count this script printed was therefore the LAST pass's failures — which is
# every non-idempotent migration in the history, each failing with "already
# exists" on work it had itself done a pass earlier. A fresh cluster reported
# "unapplied: 7" while holding all seven, three of them the local edition's own
# (`rows_cannot_name_a_foreign_account`, `preferences_that_travel`,
# `repoint_transfer`). Anyone reading that line had to go and check the catalog
# by hand to find out whether it mattered, which is the same as not printing it.
# Now "unapplied" means unapplied.
applied=""
for pass in 1 2 3; do
  fail=0; fails=""
  for f in $(ls *.sql | sort); do
    [[ "$f" == "$BASE" ]] && continue
    [[ "${f:0:14}" < "20251030003814" ]] && continue
    case " $applied " in *" $f "*) continue ;; esac
    if run -v ON_ERROR_STOP=1 -f "$f" >/tmp/wt-mig.log 2>&1; then
      applied="$applied $f"
    else
      fail=$((fail+1)); fails="$fails $f"
    fi
  done
  [ "$fail" -eq 0 ] && break
done
echo "local db ready on port $PORT (unapplied: ${fail:-0})"
[ "${fail:-0}" -gt 0 ] && echo "  not applied:$fails" | tr ' ' '\n' | grep -v '^$'

# Exit 0 even with unapplied files, on purpose. Four of them cannot apply here
# by design (two early subscription files, two RLS files needing Supabase-managed
# roles) and none of them touches a table under test. The GATE is not this
# script — it is the specs: if a migration that matters is missing, a spec in
# scripts/local-sqlite goes red and names the constraint it wanted.
exit 0
