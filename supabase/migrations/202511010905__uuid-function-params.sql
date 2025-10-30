BEGIN;

-- Update helper functions to accept UUID arguments instead of TEXT. This keeps
-- database comparisons type-safe and satisfies `supabase db lint`.

DROP FUNCTION IF EXISTS public.get_net_worth(text);
CREATE FUNCTION public.get_net_worth(p_user_id uuid) RETURNS numeric
    LANGUAGE plpgsql
AS $$
DECLARE
  total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN type IN ('checking', 'savings', 'investment', 'cash') THEN balance
      WHEN type IN ('credit', 'loan') THEN -balance
      ELSE 0
    END
  ), 0) INTO total
  FROM accounts
  WHERE user_id = p_user_id AND is_active = true;

  RETURN total;
END;
$$;

DROP FUNCTION IF EXISTS public.get_user_subscription(text);
CREATE FUNCTION public.get_user_subscription(p_user_id uuid)
RETURNS TABLE(tier text, status text, trial_end timestamp with time zone, current_period_end timestamp with time zone)
    LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT s.tier, s.status, s.trial_end, s.current_period_end
  FROM subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;

DROP FUNCTION IF EXISTS public.has_feature_access(text, text);
CREATE FUNCTION public.has_feature_access(p_user_id uuid, p_feature text) RETURNS boolean
    LANGUAGE plpgsql
AS $$
DECLARE
  user_tier TEXT;
BEGIN
  SELECT tier INTO user_tier
  FROM subscriptions
  WHERE user_id = p_user_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF user_tier IS NULL THEN
    RETURN false;
  END IF;

  CASE p_feature
    WHEN 'advanced_budgeting' THEN RETURN user_tier IN ('premium', 'pro');
    WHEN 'smart_imports' THEN RETURN user_tier IN ('premium', 'pro');
    WHEN 'investment_tracking' THEN RETURN user_tier = 'pro';
    ELSE RETURN user_tier IN ('premium', 'pro');
  END CASE;
END;
$$;

DROP FUNCTION IF EXISTS public.update_usage_counts(text);
CREATE FUNCTION public.update_usage_counts(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO subscription_usage (
    user_id,
    accounts_count,
    transactions_count,
    budgets_count,
    goals_count,
    last_calculated
  ) VALUES (
    p_user_id,
    (SELECT COUNT(*) FROM accounts WHERE user_id = p_user_id AND is_active = true),
    (SELECT COUNT(*) FROM transactions WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM budgets WHERE user_id = p_user_id AND is_active = true),
    (SELECT COUNT(*) FROM goals WHERE user_id = p_user_id),
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

COMMIT;
