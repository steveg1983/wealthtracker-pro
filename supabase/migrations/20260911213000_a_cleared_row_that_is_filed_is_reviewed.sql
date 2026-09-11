-- ============================================================================
-- 20260911213000_a_cleared_row_that_is_filed_is_reviewed.sql
--
-- MARKING A FILED ROW CLEARED ENDS ITS REVIEW.
--
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ── THE RULING (the owner, 11 Sep 2026) ─────────────────────────────────────
--
-- His partner's register showed 35 transfers in To Review — linked, filed,
-- and just that evening ticked off against her statement — and the tick had
-- not counted. Asked whether marking a row cleared should end its review:
--
--   "only if it has a category for expense or income, or has been assigned a
--    transfer account. Basically, if it does not have a category or transfer
--    then it has to be reviewed."
--
-- Which is Money's own convention read one step further: a row stays bold
-- until you have done something about it, and matching it to a statement IS
-- doing something about it — unless the thing left undone is the filing,
-- which no tick answers.
--
-- ── WHAT CHANGES ────────────────────────────────────────────────────────────
--
-- set_transactions_cleared gains one column in its UPDATE: when the call is
-- MARKING (p_cleared = true) and the row is FILED — a transfer (filed by
-- being one), a split parent (files through its lines), or a row with a
-- non-blank category — needs_review becomes false. Unmarking leaves the flag
-- alone: taking a tick back says nothing about whether the row was looked at.
-- An unfiled row keeps its flag AND is held in To Review by the register's
-- unfiled arm regardless (utils/transactionReview.ts), so the two agree.
--
-- The filed test is the register's own `isUnfiled`, inverted, written in SQL
-- — the same three-shape blank test (`NULL`, `''`, spaces) the provenance
-- verbs use, because a port that tested only one shape would pass on a
-- fixture that has only one.
--
-- Everything else about the verb is unchanged: the C/R CASE of
-- 20260810200000, one write per row, one audit entry per row, no balance
-- arithmetic, `is_cleared IS DISTINCT FROM p_cleared` deciding which rows are
-- touched at all. The crate's verb changes in the same commit and the parity
-- specs (scripts/local-sqlite/verb-specs/cleared-marking-*) hold the two
-- engines to one answer.
-- ============================================================================

-- ── Guard 1: the verb this redefines is the one expected ────────────────────
DO $$
DECLARE
  v_body text;
BEGIN
  IF to_regprocedure('public.set_transactions_cleared(uuid[], boolean, uuid)') IS NULL THEN
    RAISE EXCEPTION 'wrong_base_missing_set_transactions_cleared: the marking verb does not exist in this signature; apply 20260707120000 and 20260810200000 first.'
      USING ERRCODE = 'P0001';
  END IF;
  SELECT pg_get_functiondef(to_regprocedure('public.set_transactions_cleared(uuid[], boolean, uuid)')) INTO v_body;
  IF position('COALESCE(is_reconciled, is_cleared)' IN v_body) = 0 THEN
    RAISE EXCEPTION 'set_transactions_cleared_unrecognised: the body does not carry the 20260810200000 C/R CASE this file rewrites around — re-read it before applying.'
      USING ERRCODE = 'P0001';
  END IF;
  -- Guard 2: refuse a double-run, by name.
  IF position('needs_review' IN v_body) > 0 THEN
    RAISE EXCEPTION 'marking_already_ends_review: set_transactions_cleared already writes needs_review — this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_transactions_cleared(
  p_ids uuid[],
  p_cleared boolean,
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
  v_filed boolean;
BEGIN
  FOR v_old IN
    SELECT * FROM public.transactions
     WHERE id = ANY(p_ids)
       AND (p_user_id IS NULL OR user_id = p_user_id)
       AND is_cleared IS DISTINCT FROM p_cleared
     FOR UPDATE
  LOOP
    -- The register's isUnfiled, inverted: a transfer is filed by being one, a
    -- split parent files through its lines, and anything else needs a
    -- category that is not one of the three shapes of blank.
    v_filed := v_old.type = 'transfer'
            OR v_old.is_split
            OR NULLIF(btrim(v_old.category), '') IS NOT NULL;

    UPDATE public.transactions
       SET is_cleared = p_cleared,
           is_reconciled = CASE
             WHEN p_cleared THEN COALESCE(is_reconciled, is_cleared)
             ELSE false
           END,
           -- Marking a filed row is doing something about it; unmarking says
           -- nothing either way, and an unfiled row still has its filing to do.
           needs_review = CASE
             WHEN p_cleared AND v_filed THEN false
             ELSE needs_review
           END,
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

-- House grants, re-asserted (CREATE OR REPLACE keeps them; measured below
-- rather than assumed — 20260725120000's rule).
REVOKE ALL ON FUNCTION public.set_transactions_cleared(uuid[], boolean, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_transactions_cleared(uuid[], boolean, uuid) TO authenticated, service_role;

-- ── Measured, not assumed ───────────────────────────────────────────────────
DO $$
DECLARE
  v_body text;
BEGIN
  SELECT pg_get_functiondef(to_regprocedure('public.set_transactions_cleared(uuid[], boolean, uuid)')) INTO v_body;
  IF position('WHEN p_cleared AND v_filed THEN false' IN v_body) = 0 THEN
    RAISE EXCEPTION 'set_transactions_cleared does not end review on a filed row — the body above is not the one installed';
  END IF;
  IF position('COALESCE(is_reconciled, is_cleared)' IN v_body) = 0 THEN
    RAISE EXCEPTION 'set_transactions_cleared lost the C/R CASE — the body above is not the one installed';
  END IF;
  IF has_function_privilege('anon', 'public.set_transactions_cleared(uuid[], boolean, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute set_transactions_cleared; the REVOKE above did not take';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.set_transactions_cleared(uuid[], boolean, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot execute set_transactions_cleared; the GRANT above did not take';
  END IF;
END
$$;

-- ============================================================================
-- VERIFICATION — read this output after applying
-- ============================================================================
-- Expected: one row, ends_review = true, keeps_cr_case = true.
SELECT
  position('WHEN p_cleared AND v_filed THEN false' IN pg_get_functiondef(to_regprocedure('public.set_transactions_cleared(uuid[], boolean, uuid)'))) > 0 AS ends_review,
  position('COALESCE(is_reconciled, is_cleared)' IN pg_get_functiondef(to_regprocedure('public.set_transactions_cleared(uuid[], boolean, uuid)'))) > 0 AS keeps_cr_case;
