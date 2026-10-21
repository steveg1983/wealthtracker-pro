-- account_balances_for_user — the register's balance formula for a server that
-- holds no user JWT.
--
-- WHY. `account_balances()` (20260829…) takes its identity from the JWT via
-- `requesting_user_id()`, which is right for the browser and useless for the
-- Claude connector: it runs under the service role on behalf of a user it
-- verified through Clerk's OAuth server, and the service role has no
-- `auth.uid()`. The connector's first answer to the owner (21 Oct 2026) summed
-- `transactions` through PostgREST instead — and PostgREST caps a plain
-- select at 1,000 rows, so an account with 1,859 rows read −438,191.80 where
-- the app shows 0.00. One aggregate in the database, scoped by the caller's
-- argument exactly as `delete_transaction_atomic` and its siblings are, is
-- the only honest shape.
--
-- SAME FORMULA, ONE PLACE EACH. The body below is `account_balances()`'s body
-- with the user as a parameter. If the formula ever changes, both change.
--
-- WHO MAY CALL IT. Nobody but the service role: a function that takes the
-- user as an argument is a function any signed-in user could aim at any
-- other user, so it is revoked from PUBLIC, anon and authenticated.

CREATE OR REPLACE FUNCTION public.account_balances_for_user(p_user_id uuid)
RETURNS TABLE (account_id uuid, balance numeric, txn_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    COALESCE(a.initial_balance, 0) + COALESCE(SUM(t.amount), 0),
    COUNT(t.id)
  FROM public.accounts a
  LEFT JOIN public.transactions t
         ON t.account_id = a.id
        AND t.user_id = a.user_id
  WHERE a.user_id = p_user_id
  GROUP BY a.id, a.initial_balance
$$;

REVOKE ALL ON FUNCTION public.account_balances_for_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.account_balances_for_user(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.account_balances_for_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.account_balances_for_user(uuid) TO service_role;

COMMENT ON FUNCTION public.account_balances_for_user(uuid) IS
  'Per-account balance (initial_balance + sum of transaction amounts) and transaction count for ONE user named by argument — the server-side twin of account_balances() for callers that hold no JWT (the Claude connector). Service role only.';
