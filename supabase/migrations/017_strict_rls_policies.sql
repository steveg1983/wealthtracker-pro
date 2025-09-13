-- 017_strict_rls_policies.sql
-- Enforce strict RLS using Clerk->Supabase JWT claims
-- Assumes JWT contains a claim: clerk_id (string)
-- Policies allow access if:
--  - auth.role() = 'service_role' (server-side), OR
--  - The row belongs to the user whose clerk_id matches auth.jwt()->>'clerk_id'

-- Helper predicate: row belongs to current clerk user
-- We inline the predicate in each policy to avoid cross-dependencies.

-- Ensure RLS is enabled on all target tables
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recurring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tags ENABLE ROW LEVEL SECURITY;

-- USERS
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

CREATE POLICY "select_own_users"
  ON public.users FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    clerk_id = (auth.jwt() ->> 'clerk_id')
  );

CREATE POLICY "update_own_users"
  ON public.users FOR UPDATE
  USING (
    auth.role() = 'service_role' OR
    clerk_id = (auth.jwt() ->> 'clerk_id')
  );

CREATE POLICY "insert_own_users"
  ON public.users FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    clerk_id = (auth.jwt() ->> 'clerk_id')
  );

-- ACCOUNTS
DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can create own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;

CREATE POLICY "select_own_accounts"
  ON public.accounts FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = accounts.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

CREATE POLICY "insert_own_accounts"
  ON public.accounts FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = accounts.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

CREATE POLICY "update_own_accounts"
  ON public.accounts FOR UPDATE
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = accounts.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

CREATE POLICY "delete_own_accounts"
  ON public.accounts FOR DELETE
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = accounts.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

-- TRANSACTIONS
DROP POLICY IF EXISTS "select_transactions_all" ON public.transactions;
DROP POLICY IF EXISTS "insert_transactions_all" ON public.transactions;
DROP POLICY IF EXISTS "update_transactions_all" ON public.transactions;
DROP POLICY IF EXISTS "delete_transactions_all" ON public.transactions;

CREATE POLICY "select_own_transactions"
  ON public.transactions FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = transactions.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

CREATE POLICY "insert_own_transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = transactions.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

CREATE POLICY "update_own_transactions"
  ON public.transactions FOR UPDATE
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = transactions.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

CREATE POLICY "delete_own_transactions"
  ON public.transactions FOR DELETE
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = transactions.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

-- BUDGETS
DROP POLICY IF EXISTS "select_budgets_all" ON public.budgets;
DROP POLICY IF EXISTS "insert_budgets_all" ON public.budgets;
DROP POLICY IF EXISTS "update_budgets_all" ON public.budgets;
DROP POLICY IF EXISTS "delete_budgets_all" ON public.budgets;

CREATE POLICY "select_own_budgets"
  ON public.budgets FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = budgets.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

CREATE POLICY "insert_own_budgets"
  ON public.budgets FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = budgets.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

CREATE POLICY "update_own_budgets"
  ON public.budgets FOR UPDATE
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = budgets.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

CREATE POLICY "delete_own_budgets"
  ON public.budgets FOR DELETE
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = budgets.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

-- GOALS
DROP POLICY IF EXISTS "select_goals_all" ON public.goals;
DROP POLICY IF EXISTS "insert_goals_all" ON public.goals;
DROP POLICY IF EXISTS "update_goals_all" ON public.goals;
DROP POLICY IF EXISTS "delete_goals_all" ON public.goals;

CREATE POLICY "select_own_goals"
  ON public.goals FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = goals.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

CREATE POLICY "insert_own_goals"
  ON public.goals FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = goals.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

CREATE POLICY "update_own_goals"
  ON public.goals FOR UPDATE
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = goals.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

CREATE POLICY "delete_own_goals"
  ON public.goals FOR DELETE
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = goals.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

-- CATEGORIES
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can create own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;

CREATE POLICY "select_own_categories"
  ON public.categories FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = categories.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

CREATE POLICY "insert_own_categories"
  ON public.categories FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = categories.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

CREATE POLICY "update_own_categories"
  ON public.categories FOR UPDATE
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = categories.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

CREATE POLICY "delete_own_categories"
  ON public.categories FOR DELETE
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = categories.user_id
        AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
    )
  );

-- RECURRING TEMPLATES (if present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='recurring_templates') THEN
    DROP POLICY IF EXISTS "select_recurring_all" ON public.recurring_templates;
    DROP POLICY IF EXISTS "insert_recurring_all" ON public.recurring_templates;
    DROP POLICY IF EXISTS "update_recurring_all" ON public.recurring_templates;
    DROP POLICY IF EXISTS "delete_recurring_all" ON public.recurring_templates;

    CREATE POLICY "select_own_recurring"
      ON public.recurring_templates FOR SELECT
      USING (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = recurring_templates.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );

    CREATE POLICY "insert_own_recurring"
      ON public.recurring_templates FOR INSERT
      WITH CHECK (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = recurring_templates.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );

    CREATE POLICY "update_own_recurring"
      ON public.recurring_templates FOR UPDATE
      USING (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = recurring_templates.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );

    CREATE POLICY "delete_own_recurring"
      ON public.recurring_templates FOR DELETE
      USING (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = recurring_templates.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );
  END IF;
END$$;

-- TAGS (if present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tags') THEN
    DROP POLICY IF EXISTS "select_tags_all" ON public.tags;
    DROP POLICY IF EXISTS "insert_tags_all" ON public.tags;
    DROP POLICY IF EXISTS "update_tags_all" ON public.tags;
    DROP POLICY IF EXISTS "delete_tags_all" ON public.tags;

    CREATE POLICY "select_own_tags"
      ON public.tags FOR SELECT
      USING (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = tags.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );

    CREATE POLICY "insert_own_tags"
      ON public.tags FOR INSERT
      WITH CHECK (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = tags.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );

    CREATE POLICY "update_own_tags"
      ON public.tags FOR UPDATE
      USING (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = tags.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );

    CREATE POLICY "delete_own_tags"
      ON public.tags FOR DELETE
      USING (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = tags.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );
  END IF;
END$$;

-- DASHBOARD LAYOUTS & WIDGET PREFERENCES (if present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='dashboard_layouts') THEN
    DROP POLICY IF EXISTS "Users can view own dashboard layouts" ON public.dashboard_layouts;
    DROP POLICY IF EXISTS "Users can create own dashboard layouts" ON public.dashboard_layouts;
    DROP POLICY IF EXISTS "Users can update own dashboard layouts" ON public.dashboard_layouts;
    DROP POLICY IF EXISTS "Users can delete own dashboard layouts" ON public.dashboard_layouts;

    CREATE POLICY "select_own_dashboard_layouts"
      ON public.dashboard_layouts FOR SELECT
      USING (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = dashboard_layouts.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );

    CREATE POLICY "insert_own_dashboard_layouts"
      ON public.dashboard_layouts FOR INSERT
      WITH CHECK (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = dashboard_layouts.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );

    CREATE POLICY "update_own_dashboard_layouts"
      ON public.dashboard_layouts FOR UPDATE
      USING (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = dashboard_layouts.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );

    CREATE POLICY "delete_own_dashboard_layouts"
      ON public.dashboard_layouts FOR DELETE
      USING (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = dashboard_layouts.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='widget_preferences') THEN
    DROP POLICY IF EXISTS "Users can view own widget preferences" ON public.widget_preferences;
    DROP POLICY IF EXISTS "Users can manage own widget preferences" ON public.widget_preferences;

    CREATE POLICY "select_own_widget_preferences"
      ON public.widget_preferences FOR SELECT
      USING (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = widget_preferences.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );

    CREATE POLICY "all_own_widget_preferences"
      ON public.widget_preferences FOR ALL
      USING (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = widget_preferences.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      )
      WITH CHECK (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = widget_preferences.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );
  END IF;
END$$;

-- PLAID TABLES (if present) — user‑scoped access; webhooks service-only
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='plaid_connections') THEN
    DROP POLICY IF EXISTS "Users can view own plaid connections" ON public.plaid_connections;
    DROP POLICY IF EXISTS "Users can create own plaid connections" ON public.plaid_connections;
    DROP POLICY IF EXISTS "Users can update own plaid connections" ON public.plaid_connections;
    DROP POLICY IF EXISTS "Users can delete own plaid connections" ON public.plaid_connections;

    CREATE POLICY "select_own_plaid_connections"
      ON public.plaid_connections FOR SELECT
      USING (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = plaid_connections.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );

    CREATE POLICY "insert_own_plaid_connections"
      ON public.plaid_connections FOR INSERT
      WITH CHECK (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = plaid_connections.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );

    CREATE POLICY "update_own_plaid_connections"
      ON public.plaid_connections FOR UPDATE
      USING (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = plaid_connections.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );

    CREATE POLICY "delete_own_plaid_connections"
      ON public.plaid_connections FOR DELETE
      USING (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = plaid_connections.user_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='plaid_accounts') THEN
    DROP POLICY IF EXISTS "Users can view plaid accounts" ON public.plaid_accounts;
    DROP POLICY IF EXISTS "Users can manage plaid accounts" ON public.plaid_accounts;

    CREATE POLICY "select_own_plaid_accounts"
      ON public.plaid_accounts FOR SELECT
      USING (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.plaid_connections pc
          JOIN public.users u ON u.id = pc.user_id
          WHERE pc.id = plaid_accounts.connection_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );

    CREATE POLICY "all_own_plaid_accounts"
      ON public.plaid_accounts FOR ALL
      USING (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.plaid_connections pc
          JOIN public.users u ON u.id = pc.user_id
          WHERE pc.id = plaid_accounts.connection_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      )
      WITH CHECK (
        auth.role() = 'service_role' OR
        EXISTS (
          SELECT 1 FROM public.plaid_connections pc
          JOIN public.users u ON u.id = pc.user_id
          WHERE pc.id = plaid_accounts.connection_id
            AND u.clerk_id = (auth.jwt() ->> 'clerk_id')
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='plaid_webhooks') THEN
    DROP POLICY IF EXISTS "System can manage webhooks" ON public.plaid_webhooks;
    -- Service only
    CREATE POLICY "service_only_plaid_webhooks"
      ON public.plaid_webhooks FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END$$;

-- Notes:
-- - Ensure clients use a Supabase JWT that includes the `clerk_id` claim.
-- - Server-side/service-role access remains unrestricted via auth.role() = 'service_role'.
