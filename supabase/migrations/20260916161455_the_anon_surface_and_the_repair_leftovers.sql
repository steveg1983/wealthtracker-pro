-- ============================================================================
-- ADVISOR SWEEP 2026-09-16 — repair leftovers and the anon table surface
-- ============================================================================
-- Four findings from running Supabase's security advisors against production
-- ahead of commercial hardening. Three are debris from past repairs; the
-- fourth is the table-shaped twin of 20260725120000's function finding.
--
-- ── 1. Five hand-made repair scratch tables ────────────────────────────────
-- _backfill_green_sa_2, _backfill_green_sa_20260709,
-- _category_cleanup_20260710, _category_cleanup2_20260710,
-- _orphan_repair_20260710 — undo logs written by the July 2026 category
-- repairs, created straight against production and never part of this
-- migration history (a fresh db:reset has no idea they exist). Narrow
-- (transaction id → old category) and RLS-deny-all, so nobody could read
-- them, but they are rows about real users' transactions sitting outside
-- every deletion path the app has, and the repairs they could undo settled
-- two months ago. Dropping them HERE rather than by hand puts their removal
-- on the record their creation never was.
--
-- ── 2. The dead identity shim ──────────────────────────────────────────────
-- set_current_user_id(text) set the app.current_user_id GUC that the
-- pre-Clerk policies read. 20260610130000 replaced those policies;
-- 20260725120000 locked the function to service_role and called it "a
-- standing impersonation footgun if any stale policy anywhere still reads
-- that GUC". Verified against production today: no policy anywhere mentions
-- the GUC, and nothing in src/ or api/ calls the function. This finishes the
-- thought — the footgun is removed, not locked up.
--
-- ── 3. search_path pinned on the fifteen unpinned functions ────────────────
-- Every repo-era public function the advisor flagged as lacking a
-- search_path (lint 0011), minus the one Part 2 drops. Pinned to
-- `public, pg_temp` — pg_temp is named LAST deliberately: left unlisted it
-- is implicitly searched FIRST for relations, which is the attack the lint
-- describes (a temporary table shadowing a real one underneath a privileged
-- function). requesting_user_id() already carries its pin and is left as it
-- is. All fifteen bodies were read before pinning: they resolve only public
-- tables and built-ins — nothing from the extensions schema — so dropping
-- the session default's `extensions` entry from their scope breaks nothing.
--
-- ── 4. anon loses its table grants ─────────────────────────────────────────
-- The table-shaped twin of 20260725120000 Part 3: Supabase's default
-- privileges hand every new public table SELECT/INSERT/UPDATE/DELETE for
-- `anon`, and REVOKE-from-public sweeps never touched the named grant. RLS
-- held — no policy targets anon, and the 2026-07-25 audit verified
-- behaviourally that the anon key reads nothing — but the grants kept every
-- table visible to unauthenticated GraphQL introspection (lint 0026), and
-- "reads nothing" is a property of today's policies, not a guarantee about
-- tomorrow's. After this, an unauthenticated request is refused at the
-- privilege check (SQLSTATE 42501) instead of matching no rows.
-- src/test/supabase/supabase-smoke.test.ts asserts the refusal in the same
-- commit, replacing its assertion of the old empty-set behaviour.
--
-- Safe to run twice: the DROPs are IF EXISTS, the ALTERs and REVOKEs are
-- idempotent, and the sweep loop skips what is absent.
-- ============================================================================

BEGIN;

-- ── Precondition (mirrors 20260725120000) ──────────────────────────────────
-- Everything below names the three Supabase API roles. Fail loudly and early
-- rather than half-applying against a database that does not have them.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'Supabase API roles are missing — refusing to run against a non-Supabase database';
  END IF;
END
$$;

-- ── Part 1 — the repair leftovers ──────────────────────────────────────────
DROP TABLE IF EXISTS public._backfill_green_sa_2;
DROP TABLE IF EXISTS public._backfill_green_sa_20260709;
DROP TABLE IF EXISTS public._category_cleanup_20260710;
DROP TABLE IF EXISTS public._category_cleanup2_20260710;
DROP TABLE IF EXISTS public._orphan_repair_20260710;

-- ── Part 2 — the dead shim ─────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.set_current_user_id(text);

-- ── Part 3 — pin search_path ───────────────────────────────────────────────
-- Applied only where the function is actually present, so a database that
-- has not had every migration degrades to "no change" plus a notice rather
-- than a failed migration.
DO $$
DECLARE
  e         record;
  v_missing text[] := '{}';
BEGIN
  FOR e IN
    SELECT * FROM (VALUES
      ('public.cleanup_old_notifications()'),
      ('public.create_account_from_plaid(uuid, text, text, text, numeric, text)'),
      ('public.create_transfer_category_for_account()'),
      ('public.ensure_single_default_layout()'),
      ('public.get_net_worth(uuid)'),
      ('public.get_usage_limits(text)'),
      ('public.get_user_subscription(uuid)'),
      ('public.has_feature_access(uuid, text)'),
      ('public.is_connection_healthy(uuid)'),
      ('public.protect_transfer_category()'),
      ('public.requesting_clerk_id()'),
      ('public.sync_transfer_category_for_account()'),
      ('public.sync_user_subscription()'),
      ('public.trigger_update_usage()'),
      ('public.update_updated_at_column()')
    ) AS t(sig)
  LOOP
    IF to_regprocedure(e.sig) IS NULL THEN
      v_missing := v_missing || e.sig;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', e.sig);
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE NOTICE 'search_path pin skipped, function not present: %',
      array_to_string(v_missing, ', ');
  END IF;
END
$$;

-- ── Part 4 — anon loses the tables ─────────────────────────────────────────
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- And stays without them: the same stop-the-trap move as 20260725120000
-- Part 3, for tables this time. Without it the very next CREATE TABLE
-- silently hands anon its grants back and the sweep above is a snapshot
-- rather than a fix. Unqualified on purpose — migrations here are applied
-- as postgres, so "for the current role" is the creator these defaults
-- attach to. To undo: repeat with GRANT ALL ON TABLES TO anon.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

COMMIT;

-- ============================================================================
-- VERIFICATION — every query below should return ZERO rows
-- ============================================================================
-- Tables still granting anon anything:
SELECT table_name, string_agg(privilege_type, ', ') AS anon_still_has
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND grantee = 'anon'
GROUP BY table_name
ORDER BY table_name;

-- Scratch tables that survived:
SELECT c.relname AS leftover_table
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE E'\\_%';

-- The shim, if it somehow survived:
SELECT p.proname AS leftover_shim
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'set_current_user_id';
