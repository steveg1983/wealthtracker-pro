-- ============================================================================
-- Fix: update_usage_counts returned 403 when called from the app.
--
-- The function was plain (SECURITY INVOKER), so it ran under the caller's
-- RLS — and subscription_usage has no client INSERT/UPDATE policy, which is
-- correct: clients must not write usage rows directly. The refresh call from
-- the app therefore failed on every load (visible as a red 403 in the
-- production console).
--
-- Resolution: SECURITY DEFINER, with the user taken from the caller's JWT
-- (requesting_user_id()) — the p_user_id parameter is kept only for call-site
-- compatibility and is NEVER trusted, so an authenticated user can only ever
-- refresh their OWN counts.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.update_usage_counts(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
AS $$
DECLARE
  v_user uuid := public.requesting_user_id();
BEGIN
  -- Service-role calls carry no user claim; only then is the parameter used.
  IF v_user IS NULL THEN
    IF auth.role() = 'service_role' THEN
      v_user := p_user_id;
    ELSE
      RETURN; -- unauthenticated: refuse silently, counts are non-critical
    END IF;
  END IF;

  INSERT INTO subscription_usage (
    user_id,
    accounts_count,
    transactions_count,
    budgets_count,
    goals_count,
    last_calculated
  ) VALUES (
    v_user,
    (SELECT COUNT(*) FROM accounts WHERE user_id = v_user AND is_active = true),
    (SELECT COUNT(*) FROM transactions WHERE user_id = v_user),
    (SELECT COUNT(*) FROM budgets WHERE user_id = v_user AND is_active = true),
    (SELECT COUNT(*) FROM goals WHERE user_id = v_user),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    accounts_count = EXCLUDED.accounts_count,
    transactions_count = EXCLUDED.transactions_count,
    budgets_count = EXCLUDED.budgets_count,
    goals_count = EXCLUDED.goals_count,
    last_calculated = EXCLUDED.last_calculated,
    updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.update_usage_counts(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.update_usage_counts(uuid) TO authenticated, service_role;

COMMIT;
