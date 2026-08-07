-- ============================================================================
-- A bank feed row arrives unreconciled, like every other import
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). One existing function is redefined and
-- nothing else changes: no columns, no data, no grants. Rows already in the
-- table keep whatever is_cleared they were given.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- import_bank_transactions_atomic inserted every feed row with is_cleared =
-- true. The OFX file importer did the same, with a comment explaining the
-- reasoning: "OFX transactions are already cleared".
--
-- That reasoning conflates two different facts. The bank having PROCESSED a
-- payment is not the same as the user having CHECKED it against their
-- statement — and only the second is what is_cleared means in this app. It is
-- the flag reconciliation reads, and finalising a reconciliation is what proves
-- the account agrees with the bank.
--
-- So a feed that pre-clears its own rows removes the one step that would catch
-- what a feed cannot: a payment the bank has not sent yet, one the user does
-- not recognise, or a balance that does not add up. The reconciliation screen
-- had nothing left to do, which is why nobody noticed it was doing nothing.
--
-- Every other importer already got this right — QIF respects the file's own
-- flag and defaults false, CSV writes false, and the Money importer reads
-- Money's clearedStatus. The feed and OFX were the two outliers; OFX is fixed
-- in the same change.
--
-- ── WHAT DOES NOT CHANGE ────────────────────────────────────────────────────
-- Existing rows. This alters what NEW feed rows are given, not history — a
-- backfill would mark thousands of already-reconciled transactions as needing
-- attention, which is a worse lie than the one being fixed.
--
-- ── BALANCE REASONING ───────────────────────────────────────────────────────
-- Balance-neutral. is_cleared is a review flag; no amount, sign or account_id
-- is touched, and accounts.balance is written by the same statement it always
-- was. The only trigger keyed on this column is trg_sweep_reconciled_into_
-- archive, which fires on UPDATE OF is_cleared, not INSERT — so nothing sweeps
-- on the way in either before or after this change.
-- ============================================================================

BEGIN;

-- The function is reproduced from 20260722140000_payee_memory_most_common.sql
-- with one value changed, on the line marked below. Everything else — the
-- dedupe, the payee-memory categorisation, the balance effect, the audit write
-- and the ON CONFLICT race handling — is byte-identical to what is live.
DO $$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_src
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'import_bank_transactions_atomic';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'import_bank_transactions_atomic_missing: expected the feed importer to exist before changing what it writes'
      USING ERRCODE = 'P0002';
  END IF;

  -- Guard against a silent no-op: if the literal we are replacing is not there
  -- in the shape we expect, the function has been rewritten since and blindly
  -- swapping text could corrupt it. Fail loudly instead.
  IF position(E'      COALESCE(r->\'metadata\', \'null\'::jsonb),\n      true,' IN v_src) = 0 THEN
    RAISE EXCEPTION 'feed_cleared_literal_not_found: import_bank_transactions_atomic no longer inserts is_cleared the way this migration expects — review it by hand rather than letting this rewrite it'
      USING ERRCODE = 'P0001';
  END IF;

  v_src := replace(
    v_src,
    E'      COALESCE(r->\'metadata\', \'null\'::jsonb),\n      true,',
    E'      COALESCE(r->\'metadata\', \'null\'::jsonb),\n      false,  -- is_cleared: the user reconciles, the feed does not'
  );

  EXECUTE v_src;
END;
$$;

COMMIT;

-- ==== VERIFICATION — read this output after applying ====

-- 1. The function now inserts false, and says why.
-- Expected: inserts_false = true, inserts_true = false
SELECT position('false,  -- is_cleared' IN pg_get_functiondef(p.oid)) > 0 AS inserts_false,
       position(E'\'null\'::jsonb),\n      true,' IN pg_get_functiondef(p.oid)) > 0 AS inserts_true
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'import_bank_transactions_atomic';

-- 2. Everything else about it is unchanged — still INVOKER, still search_path
--    pinned, still granted to the same roles and NOT to anon.
-- Expected: prosecdef = false, proconfig = {search_path=public}
SELECT p.proname, p.prosecdef, p.proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'import_bank_transactions_atomic';

-- Expected: authenticated and service_role only; no anon, no PUBLIC ('-')
SELECT a.grantee::regrole::text AS grantee, a.privilege_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 CROSS JOIN LATERAL aclexplode(p.proacl) AS a
 WHERE n.nspname = 'public' AND p.proname = 'import_bank_transactions_atomic'
 ORDER BY grantee;

-- 3. History is untouched — this changes what arrives next, not what arrived.
--    Expected: whatever it was before; recorded here so the number is on file.
SELECT count(*) FILTER (WHERE is_cleared) AS cleared_rows,
       count(*) FILTER (WHERE NOT is_cleared) AS uncleared_rows
  FROM public.transactions
 WHERE external_transaction_id IS NOT NULL;
