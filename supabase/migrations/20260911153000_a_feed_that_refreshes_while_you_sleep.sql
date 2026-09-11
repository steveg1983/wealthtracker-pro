-- ============================================================================
-- 20260911153000_a_feed_that_refreshes_while_you_sleep.sql
--
-- THE CLOUD REFRESH: WHICH CONNECTIONS ARE DUE, DECIDED IN ONE PLACE.
--
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ── WHY (the owner, 11 Sep 2026) ─────────────────────────────────────────────
--
-- Bank feeds only ever refreshed from a browser: useAutoBankSync runs while a
-- page is open, and vercel.json had crons for Stripe, retention and quotes and
-- none for banking. A person who did not open the app for a month got a month
-- with no syncs — and past ninety days the consent lapses outright. He asked
-- for feeds that "keep updating even if a user doesn't open their app", chosen
-- per user in Settings, and for that to be the thing that makes a phone
-- notification about new transactions possible.
--
-- The choice already has a home: `bankAutoSync.prefs.v1` in the preferences
-- document (utils/bankAutoSync.ts), which gains the mode 'cloud'. This file
-- gives the SERVER a way to read that same value — one stored choice, two
-- readers, no second switch to fall out of step — and to answer the cron's
-- only question: which connections are due right now?
--
-- ── WHY A COLUMN AS WELL AS A FUNCTION ──────────────────────────────────────
--
-- `last_sync` moves only on SUCCESS (api/_lib/banking-sync.ts is explicit that
-- a run of failures must show as a date going stale). Scheduling off it alone
-- would retry a failing connection on every hourly run — twenty-four
-- unattended accesses a day against a bank that is refusing. PSD2's RTS
-- (Art. 36(5)(b)) allows FOUR a day without the customer present. So every
-- unattended ATTEMPT is stamped in `cloud_refresh_attempted_at` before the
-- bank is spoken to, and "due" is measured from the later of the two dates.
-- A connection that fails is not asked again for the cron's full interval.
--
-- The attended syncs — the button, the refresh-on-open — do not stamp it and
-- do not need to: a person pressing refresh is present, which is the case the
-- four-a-day cap does not cover.
--
-- ── WHY THE PREFERENCE IS PARSED IN SQL ─────────────────────────────────────
--
-- The document stores each value as the exact STRING the client wrote, so the
-- mode sits two levels down: `prefs -> 'values' ->> 'bankAutoSync.prefs.v1'`
-- is a text value holding JSON. The dotted key is what makes this a function
-- rather than a PostgREST filter — PostgREST reads `a.b` in a filter column as
-- a path — and the CASE below is what keeps a garbage value from raising:
-- `pg_input_is_valid` is asked FIRST, in a form the planner cannot reorder
-- (a WHERE with both would be free to try the cast first). A document that
-- does not parse is a user in no mode, not a cron that stops for everyone.
--
-- ── WHAT DOES NOT CHANGE ────────────────────────────────────────────────────
--
--  * No policy is touched. The function is SECURITY INVOKER and executable by
--    service_role alone; the cron runs as service_role, which bypasses RLS on
--    every table it reads. anon and authenticated cannot call it — a signed-in
--    user has no business listing other people's connections, and this is the
--    kind of function that would list them.
--  * No existing function is redefined. The sync itself is unchanged: the cron
--    runs the same cores the button runs (api/_lib/sync-*-core.ts).
--  * Nothing here reads or writes an amount.
-- ============================================================================

-- ── Guard 1: this is the database this migration was written against ───────
DO $$
BEGIN
  IF to_regclass('public.user_preferences') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_user_preferences: public.user_preferences does not exist, so there is no document to read the cloud choice from.'
      USING ERRCODE = 'P0001',
            HINT = 'Apply 20260809160000 first, in order, with `npm run db:migrate`.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'bank_connections' AND column_name = 'needs_reauth'
  ) THEN
    RAISE EXCEPTION 'wrong_base_missing_needs_reauth: bank_connections.needs_reauth does not exist; the due-list below excludes on it.'
      USING ERRCODE = 'P0001';
  END IF;

  -- pg_input_is_valid arrived in PostgreSQL 16. Supabase is on 17 (measured
  -- 11 Sep 2026); the local harness uses postgresql@17.
  IF current_setting('server_version_num')::integer < 160000 THEN
    RAISE EXCEPTION 'postgres_too_old: cloud_refresh_due_connections needs pg_input_is_valid (PostgreSQL 16+), this server is %', current_setting('server_version');
  END IF;
END
$$;

-- ── Guard 2: refuse a double-run, by name ───────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'bank_connections' AND column_name = 'cloud_refresh_attempted_at'
  ) THEN
    RAISE EXCEPTION 'cloud_refresh_attempted_at_already_exists: this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001',
            HINT = 'If something needs changing, write a new migration for it.';
  END IF;
END
$$;

-- ── The column ──────────────────────────────────────────────────────────────
ALTER TABLE public.bank_connections
  ADD COLUMN cloud_refresh_attempted_at timestamptz;

COMMENT ON COLUMN public.bank_connections.cloud_refresh_attempted_at IS
  'When the cloud refresh cron last ATTEMPTED this connection, success or not. Stamped before the bank is spoken to, so a failing connection is not retried every run: PSD2 allows four unattended accesses a day. Attended syncs (the button, refresh-on-open) leave it alone. Compare last_sync, which moves only on success.';

-- ── The function ────────────────────────────────────────────────────────────
CREATE FUNCTION public.cloud_refresh_due_connections(
  p_not_since timestamptz,
  p_limit integer
)
RETURNS TABLE (
  connection_id uuid,
  user_id uuid,
  institution_name text,
  last_sync timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  WITH cloud_users AS (
    SELECT p.user_id
      FROM public.user_preferences p
     WHERE (
       CASE
         WHEN pg_input_is_valid(p.prefs -> 'values' ->> 'bankAutoSync.prefs.v1', 'jsonb')
         THEN (p.prefs -> 'values' ->> 'bankAutoSync.prefs.v1')::jsonb ->> 'mode'
         ELSE NULL
       END
     ) = 'cloud'
  )
  SELECT c.id, c.user_id, c.institution_name, c.last_sync
    FROM public.bank_connections c
    JOIN cloud_users u ON u.user_id = c.user_id
   WHERE c.status = 'connected'
     AND COALESCE(c.needs_reauth, false) = false
     -- Due when neither a success nor an attempt has happened since the
     -- cutoff. A connection never touched by either sorts first.
     AND COALESCE(GREATEST(c.last_sync, c.cloud_refresh_attempted_at), '-infinity'::timestamptz) <= p_not_since
   ORDER BY GREATEST(c.last_sync, c.cloud_refresh_attempted_at) ASC NULLS FIRST, c.id
   LIMIT GREATEST(p_limit, 0)
$$;

COMMENT ON FUNCTION public.cloud_refresh_due_connections(timestamptz, integer) IS
  'The cloud refresh cron''s due-list: healthy connections of users whose bankAutoSync preference is ''cloud'', neither synced nor attempted since p_not_since, oldest first. Service-role only.';

-- House grants (20260725120000's rule: REVOKE FROM public does not revoke
-- anon's own named entry — every role but the one that needs it is swept).
REVOKE ALL ON FUNCTION public.cloud_refresh_due_connections(timestamptz, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cloud_refresh_due_connections(timestamptz, integer) TO service_role;

-- ── Measured, not assumed ───────────────────────────────────────────────────
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.cloud_refresh_due_connections(timestamptz, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute cloud_refresh_due_connections; the REVOKE above did not take';
  END IF;
  IF has_function_privilege('authenticated', 'public.cloud_refresh_due_connections(timestamptz, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute cloud_refresh_due_connections; a signed-in user must not be able to list connections';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.cloud_refresh_due_connections(timestamptz, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute cloud_refresh_due_connections; the GRANT above did not take';
  END IF;
END
$$;

-- ============================================================================
-- VERIFICATION — read this output after applying
-- ============================================================================
-- 1. The column exists and is nullable (no connection has been attempted yet).
--    Expected: one row, is_nullable = YES.
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'bank_connections'
   AND column_name = 'cloud_refresh_attempted_at';

-- 2. Who may call it. Expected: the owner and service_role — `postgres,
--    service_role` — and neither anon nor authenticated (measured on the
--    local harness, 11 Sep 2026).
SELECT string_agg(DISTINCT grantee::text, ', ' ORDER BY grantee::text) AS granted_to
  FROM information_schema.routine_privileges
 WHERE specific_schema = 'public'
   AND routine_name = 'cloud_refresh_due_connections';

-- 3. Nobody is in cloud mode yet. Expected: zero rows immediately after
--    applying; afterwards, the connections the next hourly run would take.
SELECT * FROM public.cloud_refresh_due_connections(now(), 100);
