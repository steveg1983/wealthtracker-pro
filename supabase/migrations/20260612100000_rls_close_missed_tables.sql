-- ============================================================================
-- RLS — CLOSE TABLES MISSED BY THE 2026-06-10 HARDENING MIGRATION
-- ============================================================================
-- The deep re-audit (2026-06-12) found five tables still carrying permissive
-- USING(true) policies with no TO clause, so the public anon key could
-- read/write them — the exact vuln class 20260610130000 claimed to have
-- closed. That migration's DROP-all loop enumerated 22 tables but omitted
-- these. Confirmed live: the anon key could SELECT all of them.
--
--   dashboard_layouts, widget_preferences  → user_id uuid; LIVE (the app reads
--     them, and dashboard_layouts had real rows). Give per-user policies.
--   plaid_connections, plaid_accounts, plaid_webhooks → legacy Plaid tables
--     (the app uses TrueLayer; no plaid_* refs in src/ or api/). They hold a
--     plaintext access_token column. Empty today, but anon-writable. Lock to
--     service_role only (RLS on, zero policies) without dropping the tables.
--
-- Depends on requesting_user_id() from 20260610130000.
-- ============================================================================

BEGIN;

-- ── Drop every existing policy on the five tables ───────────────────────────
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'dashboard_layouts', 'widget_preferences',
        'plaid_connections', 'plaid_accounts', 'plaid_webhooks'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ── Ensure RLS is enabled on all five ───────────────────────────────────────
ALTER TABLE public.dashboard_layouts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plaid_connections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plaid_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plaid_webhooks     ENABLE ROW LEVEL SECURITY;

-- ── Live, user-keyed tables: per-user access ────────────────────────────────
CREATE POLICY dashboard_layouts_all_own ON public.dashboard_layouts
  FOR ALL TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

CREATE POLICY widget_preferences_all_own ON public.widget_preferences
  FOR ALL TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

-- ── Legacy Plaid tables: service_role ONLY — deliberately NO policies. ───────
-- With RLS enabled and zero policies, anon and authenticated can access
-- nothing; the service role bypasses RLS. (No code references these tables.)

COMMIT;
