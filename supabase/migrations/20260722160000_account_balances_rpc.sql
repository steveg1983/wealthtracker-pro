-- ============================================================================
-- account_balances() — every account's balance in ONE round trip.
--
-- The dashboard's headline figures (net worth, per-account balances, assets,
-- liabilities) are derived client-side from the FULL transaction set. A
-- Money-era history is 50k+ rows, which PostgREST hands over in ~52 pages of
-- 1,000 — measured at 2.7s of a 3.6s boot, with the user watching a skeleton
-- the whole time. Postgres can produce the same invariant
--
--     balance = accounts.initial_balance + SUM(transactions.amount)
--
-- in a single aggregate, so the app can paint real balances immediately and
-- let the page fetches stream in behind for the register and reports.
--
-- The sum deliberately spans ALL transactions, archived included: archiving is
-- a view flag (see 20260721130000_soft_archive.sql) and never moves a balance.
--
-- SECURITY DEFINER because the aggregate must see the caller's own rows
-- without RLS re-planning per page; identity comes from the verified JWT via
-- requesting_user_id(), so there is no parameter to spoof and an
-- unauthenticated caller matches nothing and gets no rows.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.account_balances()
RETURNS TABLE (account_id uuid, balance numeric, txn_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    COALESCE(a.initial_balance, 0) + COALESCE(SUM(t.amount), 0),
    COUNT(t.id)
  FROM public.accounts a
  -- LEFT JOIN so an account with no transactions still reports its opening
  -- balance instead of dropping out of the result.
  LEFT JOIN public.transactions t
         ON t.account_id = a.id
        AND t.user_id = a.user_id
  WHERE a.user_id = public.requesting_user_id()
  GROUP BY a.id, a.initial_balance
$$;

COMMENT ON FUNCTION public.account_balances() IS
  'Per-account balance (initial_balance + sum of transaction amounts) and transaction count for the calling user, in one round trip instead of the ~52 paged transaction fetches the client would otherwise need before it can show any figure. Identity is taken from the JWT, never from a parameter.';

REVOKE ALL ON FUNCTION public.account_balances() FROM public;
GRANT EXECUTE ON FUNCTION public.account_balances() TO authenticated, service_role;

COMMIT;
