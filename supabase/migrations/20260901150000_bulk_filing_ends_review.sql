-- ============================================================================
-- 20260901150000_bulk_filing_ends_review.sql
--
-- FILING A PAYEE ENDS ITS ROWS' REVIEW — the owner's ruling of 1 Sep 2026,
-- and the backfill for every row the old semantics stranded.
--
-- ── THE TWO PRINCIPLES THAT COLLIDED ────────────────────────────────────────
-- apply_category_to_uncategorized set `category` and `category_confirmed` and
-- deliberately left `needs_review` alone. The argument was recorded on the
-- local edition's port of this very function: a bulk filing is "a decision
-- about a CATEGORY taken from a list of payees, where the rows' dates,
-- amounts and accounts were never on screen, so one run of the bulk tool must
-- not mark a whole imported statement as dealt with."
--
-- confirm_transaction_categories (20260810090000) records the opposite
-- principle: "answering the question a row was asking IS reviewing that row,
-- and leaving it bold afterwards would be the register nagging about work
-- already done."
--
-- ── THE MEASUREMENT THAT FORCED A RULING ────────────────────────────────────
-- A live household ledger, 1 Sep 2026: filing by payee brought "needs a
-- category" down from about two thousand to under eight hundred, while the
-- accounts page's "to review" stayed at 1,833 — the flag survived on over a
-- thousand rows the user had filed, and the only offered way to lower it was
-- one row at a time. A counter that cannot move under the user's deliberate
-- bulk action is a counter that stops meaning anything; the review flag's own
-- charter (utils/transactionReview.ts) is Money's "WHICH OF THESE HAVE I
-- DEALT WITH?", and a payee the user filed is dealt with. Vouching for
-- amounts has its own machinery — clearing and reconciliation.
--
-- The owner ruled: clear it. Auto-applied import RULES are untouched — a
-- machine filing is not a human seeing, and the rules path does not come
-- through this function.
--
-- ── WHAT CHANGES ────────────────────────────────────────────────────────────
-- 1. The function body gains ONE line: `needs_review = false` in the SET,
--    beside `category_confirmed = true`. Everything else — the fill-blanks
--    WHERE clause, the split-parent skip 20260808180000 restored, the
--    per-row audit, SECURITY INVOKER, the pinned search_path, the grants —
--    is byte-for-byte the live body that migration installed.
-- 2. A backfill clears the stranded rows: `needs_review = true` on a row that
--    is FILED (non-blank category) and CONFIRMED (`category_confirmed`).
--    `category_confirmed` is only ever set by the user's own filing (this
--    function, the editors, the confirm flow — 20260808100000 lists them),
--    so every row the backfill touches is one a human already dealt with.
--    Rows filed but never confirmed (an import's own guess) keep their flag,
--    exactly as they keep it going forward.
--
-- The backfill writes no per-row audit entries: `needs_review` is workflow
-- state, not a financial value — no amount, sign, account or date moves —
-- and a thousand-row audit burst saying "a flag changed" would bury the
-- entries that matter. The function's own per-row audit is unchanged.
--
-- ── BALANCE REASONING ───────────────────────────────────────────────────────
-- Balance-neutral, structurally: the function writes `category`,
-- `category_confirmed`, `needs_review` and `updated_at`; the backfill writes
-- `needs_review` alone. No amount, sign, account_id or date is read or
-- written anywhere below. The ledger invariant
-- `balance = initial_balance + Σ(amount)` cannot be moved by this migration.
--
-- ── BLAST RADIUS ────────────────────────────────────────────────────────────
-- * crates/wealth-core/src/verbs/apply_category_to_uncategorized.rs flips in
--   the same commit — both engines change together, so the differential lane
--   measures agreement, not a divergence. Its test
--   `filing_a_payee_in_bulk_leaves_every_review_alone` becomes
--   `filing_a_payee_in_bulk_ends_the_reviews_it_files_and_no_other`.
-- * AppContextSupabase's local mirror adds `needsReview: false` to the same
--   rows it already flips, so the count falls without a refetch.
-- * The "To Review" predicate (utils/transactionReview.ts) is UNCHANGED —
--   this migration changes what the flag says, not what the count reads.
--
-- ── ON RE-RUNNING THIS FILE ─────────────────────────────────────────────────
-- Guard 3 refuses a second run by fingerprint (`needs_review` in the live
-- body). On a full-directory replay (scripts/local-db/up.sh), filename order
-- restores the body WITHOUT the fingerprint before this file runs again, so
-- the precondition is true on every pass — the same replay shape
-- 20260808180000 documents at length. The backfill is idempotent by its own
-- WHERE clause.
-- ============================================================================

BEGIN;

-- ── Guards: refuse anything but the exact state this body was derived from ──
DO $$
DECLARE
  v_oid oid;
  v_src text;
BEGIN
  v_oid := to_regprocedure('public.apply_category_to_uncategorized(uuid[], text, uuid)');
  IF v_oid IS NOT NULL THEN
    v_src := pg_get_functiondef(v_oid);
  END IF;

  -- Guard 1: it is there at all.
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'payee_fanout_missing: expected apply_category_to_uncategorized(uuid[], text, uuid) to exist before changing what it writes — apply 20260708100000_payee_memory_autocategorize.sql first'
      USING ERRCODE = 'P0002';
  END IF;

  -- Guard 2: the RIGHT BASE. The body below is 20260808180000's body plus one
  -- line, so the live function must carry BOTH of that file's fingerprints —
  -- `category_confirmed` (20260808100000) and `NOT is_split` (restored by
  -- 20260808180000). Anything else and replacing it wholesale is the
  -- wrong-base rebase that has already eaten two lines in this repository's
  -- history (20260808150000 and 20260808180000 each document one).
  IF position('category_confirmed' IN v_src) = 0
     OR position('NOT is_split' IN v_src) = 0 THEN
    RAISE EXCEPTION 'payee_fanout_wrong_base: apply_category_to_uncategorized does not carry both category_confirmed and the split guard — apply 20260808100000 and 20260808180000 first. Applying this body over an older one would drop their lines.'
      USING ERRCODE = 'P0001',
            HINT = 'Two migrations have lost a line by rebasing onto a superseded definition. This guard is what stops the next one.';
  END IF;

  -- Guard 3: NOT ALREADY DONE.
  IF position('needs_review' IN v_src) > 0 THEN
    RAISE EXCEPTION 'payee_fanout_already_ends_review: apply_category_to_uncategorized already clears needs_review — this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001',
            HINT = 'Verification 1 at the foot of this file shows the current state. If the body needs changing again, write a new migration for it.';
  END IF;

  -- Guard 4: the column the new line writes must exist — a plpgsql body is
  -- not parsed until it is invoked, so a missing column would surface at the
  -- next filing, not now.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'transactions'
       AND column_name = 'needs_review'
  ) THEN
    RAISE EXCEPTION 'needs_review_column_missing: transactions.needs_review does not exist — apply the migration that added the review flag first.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ── apply_category_to_uncategorized: filing ends the review ─────────────────
-- Byte-for-byte 20260808180000_apply_category_skips_split_parents.sql:261-299
-- except for ONE line, `needs_review = false`, added to the SET beside
-- `category_confirmed = true`. The cursor, the loop body, the audit call and
-- the count are untouched.
CREATE OR REPLACE FUNCTION public.apply_category_to_uncategorized(
  p_ids uuid[],
  p_category text,
  p_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_old public.transactions;
  v_new public.transactions;
BEGIN
  FOR v_old IN
    SELECT * FROM public.transactions
     WHERE id = ANY(p_ids)
       AND (p_user_id IS NULL OR user_id = p_user_id)
       AND (category IS NULL OR btrim(category) = '')
       AND NOT is_split
     FOR UPDATE
  LOOP
    UPDATE public.transactions
       SET category = p_category,
           category_confirmed = true,
           needs_review = false,
           updated_at = now()
     WHERE id = v_old.id
    RETURNING * INTO v_new;

    PERFORM public.write_financial_audit(
      v_new.user_id, 'transaction', v_new.id, 'update', to_jsonb(v_old), to_jsonb(v_new)
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.apply_category_to_uncategorized(uuid[], text, uuid) IS
  'Payee memory, spread across the blanks: file one category on every named transaction that is STILL uncategorised, marking each as a decision the user made AND ending its review (owner''s ruling 1 Sep 2026: filing a payee is dealing with its rows), one audit entry per row. Skips split parents and rows already filed. Balance-neutral.';

-- ── The backfill: rows the old semantics stranded ───────────────────────────
-- Filed, confirmed by a human action, and still flagged as new work. Every
-- user, deliberately: the semantics were wrong for everyone, not one ledger.
DO $$
DECLARE
  v_cleared integer;
BEGIN
  UPDATE public.transactions
     SET needs_review = false
   WHERE needs_review = true
     AND category_confirmed = true
     AND category IS NOT NULL
     AND btrim(category) <> '';
  GET DIAGNOSTICS v_cleared = ROW_COUNT;
  RAISE NOTICE 'bulk_filing_ends_review: % stranded review flags cleared', v_cleared;
END;
$$;

COMMIT;

-- ============================================================================
-- Verification — run after applying
-- ============================================================================

-- 1. The function ends the review and still carries everything the two
--    migrations before it added. Expected: all three true.
SELECT position('needs_review' IN pg_get_functiondef(p.oid)) > 0         AS ends_review,
       position('NOT is_split' IN pg_get_functiondef(p.oid)) > 0         AS skips_split_parents,
       position('category_confirmed' IN pg_get_functiondef(p.oid)) > 0   AS keeps_category_provenance
  FROM pg_proc p
 WHERE p.oid = to_regprocedure('public.apply_category_to_uncategorized(uuid[], text, uuid)');

-- 2. No stranded rows remain. Expected: 0.
SELECT COUNT(*) AS stranded
  FROM public.transactions
 WHERE needs_review = true
   AND category_confirmed = true
   AND category IS NOT NULL
   AND btrim(category) <> '';
