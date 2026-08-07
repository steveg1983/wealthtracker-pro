#!/bin/bash
# Throwaway local Postgres with the full migration history applied.
set -u
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
export LC_ALL=C
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
# after files it already contains), and most migrations are idempotent.
for pass in 1 2 3; do
  fail=0; fails=""
  for f in $(ls *.sql | sort); do
    [[ "$f" == "$BASE" ]] && continue
    [[ "${f:0:14}" < "20251030003814" ]] && continue
    run -v ON_ERROR_STOP=1 -f "$f" >/tmp/wt-mig.log 2>&1 || { fail=$((fail+1)); fails="$fails $f"; }
  done
  [ "$fail" -eq 0 ] && break
done
echo "local db ready on port $PORT (unapplied: ${fail:-0})"
[ "${fail:-0}" -gt 0 ] && echo "  not applied:$fails" | tr ' ' '\n' | grep -v '^$'
exit 0
