-- ============================================================================
-- 20260911100000_a_machine_guess_stays_a_guess.sql
--
-- PAYEE MEMORY'S FAN-OUT MUST NOT END A REVIEW NOBODY DID.
--
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor).
--
-- ── WHAT HAPPENED (the owner, 11 Sep 2026) ──────────────────────────────────
--
-- Reviewing his card's feed, he confirmed the app's suggested category on ONE
-- transaction. Payee memory then spread that category to the other rows of the
-- same payee — which is fine, and is the feature — but it spread it through
-- `apply_category_to_uncategorized`, which writes `category_confirmed = true`
-- and `needs_review = false`. Every sibling row vanished from To Review
-- without his eyes ever landing on it, and he had to go hunting in the
-- register to find out what the app had done on his behalf.
--
-- His ruling: "if I confirm a category and the system wants to then auto
-- populate more transactions on the list, that is fine, but they should stay
-- on the 'review list' as I have not reviewed them yet."
--
-- ── WHY A SECOND FUNCTION AND NOT A CHANGE TO THE FIRST ─────────────────────
--
-- `apply_category_to_uncategorized` is the DELIBERATE bulk verb: Categorise by
-- payee, the report drill's fill-blanks, surfaces where the user chose the
-- population and pressed the button. For those, 20260901150000's ruling stands
-- unchanged — filing ends review, because answering the question a row was
-- asking IS reviewing it, and handing a bulk tool's own output back as a
-- review list would make it slower than filing rows one at a time.
--
-- The fan-out is the opposite case: the user acted on ONE row and the app
-- extrapolated. An extrapolation is a GUESS, and this schema already has a
-- word for a guess: `category_confirmed = false`, the shape every feed
-- suggestion arrives in (20260808100000). So the fan-out gets its own verb
-- that writes exactly that shape — category set, confirmed false, and
-- `needs_review = true` so the row stays where the reader will look, wearing
-- the same Suggested badge every other machine guess wears.
--
-- `needs_review` is SET true rather than left alone, deliberately: every row
-- this touches was blank, so it sat in To Review under the unfiled arm
-- (transactionReview.ts) — gaining a category would otherwise lift it off the
-- list at the very moment it acquires something to check.
--
-- Same skeleton as its sibling in every other respect: fill-blanks only, skip
-- split parents, row-locked cursor, one audit entry per row through the single
-- writer. Nothing here reads or writes an amount.
-- ============================================================================

-- ── Guard: the sibling this mirrors must be in the expected shape ───────────
-- If apply_category_to_uncategorized no longer ends review, the argument this
-- file rests on has changed and it should be re-read, not applied blind.
DO $$
DECLARE
  v_body text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_body
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'apply_category_to_uncategorized';
  IF v_body IS NULL THEN
    RAISE EXCEPTION 'apply_category_to_uncategorized is missing — this migration mirrors it and cannot stand alone';
  END IF;
  IF position('needs_review = false' IN v_body) = 0 THEN
    RAISE EXCEPTION 'apply_category_to_uncategorized no longer ends review — re-read 20260911100000 before applying it';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.suggest_category_to_uncategorized(
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
           -- The whole difference from apply_category_to_uncategorized:
           -- a guess, not a filing, and a row that still wants eyes.
           category_confirmed = false,
           needs_review = true,
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

-- House grants (20260725120000's rule: REVOKE FROM public does not revoke
-- anon's own named entry — both are swept, then the two real roles granted).
REVOKE ALL ON FUNCTION public.suggest_category_to_uncategorized(uuid[], text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.suggest_category_to_uncategorized(uuid[], text, uuid) TO authenticated, service_role;

-- ── Measured, not assumed ───────────────────────────────────────────────────
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.suggest_category_to_uncategorized(uuid[], text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute suggest_category_to_uncategorized; the REVOKE above did not take';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.suggest_category_to_uncategorized(uuid[], text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot execute suggest_category_to_uncategorized; the GRANT above did not take';
  END IF;
  IF position('category_confirmed = false' IN pg_get_functiondef(to_regprocedure('public.suggest_category_to_uncategorized(uuid[], text, uuid)'))) = 0 THEN
    RAISE EXCEPTION 'suggest_category_to_uncategorized does not write a guess — the body above is not the one installed';
  END IF;
END
$$;
