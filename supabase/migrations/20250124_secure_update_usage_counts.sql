DROP FUNCTION IF EXISTS public.update_usage_counts(uuid);

CREATE FUNCTION public.update_usage_counts(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
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
