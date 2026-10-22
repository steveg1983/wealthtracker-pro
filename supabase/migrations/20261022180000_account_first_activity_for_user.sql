-- account_first_activity_for_user — each account's earliest transaction day,
-- for a server that holds no user JWT.
--
-- WHY. The net-worth-over-time series dates every opening balance by the
-- rule in utils/openingDates.ts: an explicit date, clamped to the account's
-- first transaction; else the first transaction; else the "(Cash)" sibling's
-- first transaction; else the start of time. The browser knows each account's
-- first transaction because it holds every row. The Claude connector does
-- not, and must not page fifty thousand rows through PostgREST to learn one
-- date per account — so it asks for the minimum here, in one aggregate, and
-- walks the series backwards from account_balances_for_user's figures over
-- the rows in the window alone (api/_lib/mcp/netWorthSeries.ts).
--
-- WHO MAY CALL IT. Nobody but the service role, for the reason
-- account_balances_for_user (20261022090000) gives: a function that takes
-- the user as an argument is a function any signed-in user could aim at any
-- other user.
--
-- BALANCE REASONING. Reads one column, writes nothing.

CREATE OR REPLACE FUNCTION public.account_first_activity_for_user(p_user_id uuid)
RETURNS TABLE (account_id uuid, first_date date)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.account_id, MIN(t.date)
  FROM public.transactions t
  WHERE t.user_id = p_user_id
  GROUP BY t.account_id
$$;

REVOKE ALL ON FUNCTION public.account_first_activity_for_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.account_first_activity_for_user(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.account_first_activity_for_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.account_first_activity_for_user(uuid) TO service_role;

COMMENT ON FUNCTION public.account_first_activity_for_user(uuid) IS
  'Each account''s earliest transaction date for ONE user named by argument — what the opening-balance date rule needs, for callers that hold no JWT (the Claude connector''s net-worth series). Service role only.';
