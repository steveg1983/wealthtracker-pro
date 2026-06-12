-- ============================================================================
-- RESTORE ROW LEVEL SECURITY DATA ISOLATION
-- ============================================================================
-- Context: the app authenticates with Clerk, not Supabase Auth, so auth.uid()
-- was always NULL for browser requests. Earlier migrations "fixed" the
-- resulting failures by replacing per-user policies with blanket USING (true)
-- policies — which let ANY holder of the public anon key read and modify ANY
-- user's financial data. This migration removes every permissive policy and
-- restores real per-user isolation.
--
-- ⚠️  DEPLOYMENT ORDER — apply this migration ONLY AFTER:
--   1. Clerk dashboard: enable the Supabase integration for this app
--      (Configure → Integrations → Supabase), which adds the required
--      "role": "authenticated" claim to session tokens.
--   2. Supabase dashboard: Authentication → Sign In / Providers →
--      Third-Party Auth → add Clerk with your Clerk domain.
--   3. The frontend build that passes the Clerk session JWT to supabase-js
--      via the accessToken option is deployed (src/lib/supabaseToken.ts).
-- If applied before those steps, the app fails CLOSED (no data access) —
-- secure, but broken UX until the steps complete.
--
-- Identity model:
--   Clerk JWT 'sub' claim  = users.clerk_id = user_profiles.clerk_user_id
--   users.id (uuid)        = the user_id FK used by financial tables
-- ============================================================================

BEGIN;

-- ── Helper functions ────────────────────────────────────────────────────────

-- Clerk user id of the requester, from the verified JWT. NULL when anon.
CREATE OR REPLACE FUNCTION public.requesting_clerk_id()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')
$$;

-- Internal users.id (uuid) of the requester. SECURITY DEFINER so the lookup
-- works even though users itself is RLS-protected.
CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE clerk_id = public.requesting_clerk_id()
$$;

REVOKE ALL ON FUNCTION public.requesting_clerk_id() FROM public;
REVOKE ALL ON FUNCTION public.requesting_user_id() FROM public;
GRANT EXECUTE ON FUNCTION public.requesting_clerk_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.requesting_user_id() TO anon, authenticated, service_role;

-- ── Drop EVERY existing policy on the affected tables ───────────────────────
-- Done dynamically so stale/renamed policies (repo↔production drift) cannot
-- survive. The canonical set is recreated below.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'users', 'user_profiles',
        'accounts', 'transactions', 'categories',
        'budgets', 'goals', 'goal_contributions',
        'investments', 'investment_transactions',
        'recurring_transactions',
        'subscriptions', 'invoices', 'payment_methods',
        'subscription_usage', 'subscription_logs', 'subscription_events',
        'bank_connections', 'linked_accounts', 'sync_history',
        'sync_metadata', 'webhook_events'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END
$$;

-- ── Ensure RLS is enabled everywhere ────────────────────────────────────────
ALTER TABLE public.users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_contributions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_connections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linked_accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_history            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_metadata           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events          ENABLE ROW LEVEL SECURITY;

-- ── Identity tables ──────────────────────────────────────────────────────────
-- users: a signed-in user may read/update their own row, and create it on
-- first login. No client-side DELETE.
CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated
  USING (clerk_id = public.requesting_clerk_id());

CREATE POLICY users_insert_own ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (clerk_id = public.requesting_clerk_id());

CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING (clerk_id = public.requesting_clerk_id())
  WITH CHECK (clerk_id = public.requesting_clerk_id());

-- user_profiles: keyed directly by clerk_user_id.
CREATE POLICY user_profiles_select_own ON public.user_profiles
  FOR SELECT TO authenticated
  USING (clerk_user_id = public.requesting_clerk_id());

CREATE POLICY user_profiles_insert_own ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (clerk_user_id = public.requesting_clerk_id());

CREATE POLICY user_profiles_update_own ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (clerk_user_id = public.requesting_clerk_id())
  WITH CHECK (clerk_user_id = public.requesting_clerk_id());

-- ── Core financial tables (user_id uuid → users.id) ────────────────────────
-- accounts
CREATE POLICY accounts_select_own ON public.accounts
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id());
CREATE POLICY accounts_insert_own ON public.accounts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.requesting_user_id());
CREATE POLICY accounts_update_own ON public.accounts
  FOR UPDATE TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());
CREATE POLICY accounts_delete_own ON public.accounts
  FOR DELETE TO authenticated
  USING (user_id = public.requesting_user_id());

-- transactions
CREATE POLICY transactions_select_own ON public.transactions
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id());
CREATE POLICY transactions_insert_own ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.requesting_user_id());
CREATE POLICY transactions_update_own ON public.transactions
  FOR UPDATE TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());
CREATE POLICY transactions_delete_own ON public.transactions
  FOR DELETE TO authenticated
  USING (user_id = public.requesting_user_id());

-- categories (system categories are readable by everyone signed in)
CREATE POLICY categories_select_own_or_system ON public.categories
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id() OR is_system = true);
CREATE POLICY categories_insert_own ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.requesting_user_id());
CREATE POLICY categories_update_own ON public.categories
  FOR UPDATE TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());
CREATE POLICY categories_delete_own ON public.categories
  FOR DELETE TO authenticated
  USING (user_id = public.requesting_user_id());

-- budgets
CREATE POLICY budgets_all_own ON public.budgets
  FOR ALL TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

-- goals
CREATE POLICY goals_all_own ON public.goals
  FOR ALL TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

-- goal_contributions
CREATE POLICY goal_contributions_all_own ON public.goal_contributions
  FOR ALL TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

-- investments
CREATE POLICY investments_all_own ON public.investments
  FOR ALL TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

-- investment_transactions
CREATE POLICY investment_transactions_all_own ON public.investment_transactions
  FOR ALL TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

-- recurring_transactions (user_id is the Clerk id, text)
CREATE POLICY recurring_transactions_all_own ON public.recurring_transactions
  FOR ALL TO authenticated
  USING (user_id = public.requesting_clerk_id())
  WITH CHECK (user_id = public.requesting_clerk_id());

-- ── Billing tables: user may read own rows; ONLY service_role writes ───────
-- (service_role bypasses RLS, so no write policies are defined at all)
CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    user_id = public.requesting_user_id()
    OR user_id_text = public.requesting_clerk_id()
  );

CREATE POLICY invoices_select_own ON public.invoices
  FOR SELECT TO authenticated
  USING (
    user_id = public.requesting_user_id()
    OR user_id_text = public.requesting_clerk_id()
  );

CREATE POLICY payment_methods_select_own ON public.payment_methods
  FOR SELECT TO authenticated
  USING (
    user_id = public.requesting_user_id()
    OR user_id_text = public.requesting_clerk_id()
  );

CREATE POLICY subscription_usage_select_own ON public.subscription_usage
  FOR SELECT TO authenticated
  USING (
    user_id = public.requesting_user_id()
    OR user_id_text = public.requesting_clerk_id()
  );

-- subscription_logs / subscription_events: service_role only — no policies.

-- ── Banking token tables: service_role ONLY — deliberately NO policies ──────
-- bank_connections (holds encrypted access tokens), linked_accounts,
-- sync_history, sync_metadata, webhook_events: with RLS enabled and zero
-- policies, anon and authenticated roles can access nothing; service_role
-- bypasses RLS and continues to work from api/ handlers.

COMMIT;
