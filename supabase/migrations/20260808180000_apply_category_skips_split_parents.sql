-- ============================================================================
-- apply_category_to_uncategorized skips split parents again — the SAME rebase
-- mistake as 20260808150000, in a different function, found the same way
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). ONE existing function is redefined. No new
-- column, no new index, no backfill, no grant change, no policy change, and not
-- one existing row is read or written by applying this.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- Three definitions of this function exist. The live one is the third, and it
-- was written from the FIRST.
--
--   20260708100000_payee_memory_autocategorize.sql:200-235
--       The original. Fills every named row that is still blank, one audit entry
--       each. Its header states the reason the guard below matters, before that
--       guard existed (:190-196): "the fill-blanks guard is enforced HERE, not
--       just in the client: the client computes its target list from a snapshot
--       that can be stale (backgrounded tab, second device), and without the
--       guard a race could silently overwrite a category the user set
--       elsewhere — the one thing this feature promises never to do."
--
--   20260713100000_transaction_splits.sql:275-312
--       Adds `AND NOT is_split` to the cursor, and says why at :268-273:
--       "A split parent's category is blank BY DESIGN — without this guard the
--       fan-out would treat it as uncategorised and stamp a single category
--       onto it (the trigger above would reject the write mid-loop and fail the
--       whole propagation). Recreated from 20260708100000; the only change is
--       the `AND NOT is_split` condition."
--
--   20260808100000_category_provenance.sql:387-424
--       The live one. It says of itself (:378-379): "Identical to
--       20260708100000_payee_memory_autocategorize.sql except that the rows it
--       fills are marked CONFIRMED." That sentence is TRUE, and it is the
--       defect: 20260708100000 had not been the live definition for nearly a
--       month — 20260713100000 had. Rebasing onto the older text did not add
--       `category_confirmed` to the live function; it REPLACED the live
--       function with an older one that happened to have `category_confirmed`
--       bolted on. `AND NOT is_split` was in the difference, and it went with
--       the bathwater.
--
-- MEASURED on the reference cluster (scripts/local-db/up.sh), 2026-08-08, with
-- one split parent and two ordinary blank rows:
--
--   ids = [a blank row, THE SPLIT PARENT, another blank row]
--     -> ERROR: split_category_locked: this transaction is split — its
--        categorisation lives in its split lines
--     -> both blank rows UNFILLED, financial_audit_log EMPTY, count returned
--        to nobody because the call raised
--   ids = [the split parent] alone
--     -> the same refusal
--   ids = [the two blank rows], no parent   (the control)
--     -> 2, both filled, both marked confirmed
--
-- So it is not one row skipped. It is a bulk action that files NOTHING and
-- reports a raw internal code to a user who asked to categorise a payee. The
-- trigger doing the refusing is protect_split_transaction_fields
-- (20260713100000:67-105), which is correct and is not being changed here: a
-- split parent's category genuinely must stay blank. What is missing is the
-- function's own agreement not to try.
--
-- ── HOW BAD, HONESTLY ───────────────────────────────────────────────────────
-- Not a bug on the happy path, and this file does not pretend otherwise. Every
-- client caller filters split parents out before calling: src/utils/
-- payeeGroups.ts:96 (`if (t.isSplit) continue`), the local-mode mirror in
-- src/contexts/AppContextSupabase.tsx:836, and the uncategorised drill, which
-- is the split-EXPANDED view where a parent has been replaced by its lines.
--
-- What is gone is the defence in depth, and the case it defends is named in the
-- ORIGINAL function's own header, quoted above: a list computed from a stale
-- snapshot. A row that becomes a split on one device while another device's
-- list is still in memory is exactly that case, and the result today is that
-- the whole bulk action fails and files nothing. The guard turns that into one
-- row quietly skipped and the rest filed, which is what the user asked for.
--
-- ── THE PATTERN, AND WHY THE GUARDS BELOW ARE NOT CEREMONY ──────────────────
-- This is the SECOND live regression of this exact shape found in three days,
-- and the first one is the precedent this file is written to:
--
--   20260808150000_create_honours_is_cleared.sql — create_transaction_atomic
--       lost `is_cleared` because 20260808090000 declared itself "identical to
--       the definition in 20260610150000 ... except for the statement_sequence
--       column" when 20260610150000 had not been live for a month.
--
--   THIS FILE — apply_category_to_uncategorized lost `AND NOT is_split` because
--       20260808100000 declared itself "identical to 20260708100000 ... except
--       that the rows it fills are marked CONFIRMED" when 20260708100000 had
--       not been live for nearly a month.
--
-- Same sentence, same shape, same month, two different functions. Both were
-- found by porting the function to another engine and having to trace which
-- definition was live rather than reading the newest file. Neither was found by
-- a test, because a full CREATE OR REPLACE that drops a line does not fail: it
-- succeeds, and the loss is invisible until somebody notices behaviour that
-- stopped happening.
--
-- 20260808140000_file_import_idempotency.sql introduced the fingerprint-guard
-- pattern for a sibling function as a precaution, reasoning: "This function has
-- been redefined three times in three days. A full CREATE OR REPLACE that is
-- one release out of date silently DELETES a column from the insert list, and
-- the failure is invisible until someone notices a register that has stopped
-- recording something." Two files have now had that come true. The guards below
-- are that pattern applied to the function it happened to a second time: they
-- check, BY NAME, that the body on disk is the one this file was derived from,
-- and refuse rather than replace anything else.
--
-- ── WHAT DOES NOT CHANGE ────────────────────────────────────────────────────
-- * **Every row already in the table.** This migration writes no data. Rows
--   filed while the guard was missing were filed correctly — the guard only
--   ever SKIPS rows, so nothing it would have skipped was written; the calls
--   that hit a split parent raised and rolled back entire. There is therefore
--   nothing to backfill and nothing to undo, which is the one respect in which
--   this regression is kinder than the is_cleared one.
-- * **`category_confirmed = true` on the rows it fills.** That is the whole
--   point of 20260808100000 and the reasoning is unchanged and quoted at the
--   body below: filing a payee IS the decision, so the rows it fills are
--   vouched for and not handed back as a list to re-check.
-- * **Everything the function will accept.** `p_category` is still written
--   verbatim with no validation: a category id nobody has, a To/From category,
--   an empty string and SQL NULL are all stored, and the row is still marked
--   confirmed even when what was filed is nothing. All measured, all
--   deliberate, none of it this file's subject. Widening validation here would
--   be a second change wearing one migration's clothes.
-- * **Which rows count as blank.** `category IS NULL OR btrim(category) = ''`,
--   unchanged — three shapes of blank, all three filled.
-- * **The signature, SECURITY INVOKER, the pinned search_path, the
--   write_financial_audit call per row, the RETURNING contract and the
--   grants.** CREATE OR REPLACE keeps the existing ACL, so
--   20260725120000:322's grant to authenticated and service_role stands
--   untouched.
-- * **protect_split_transaction_fields.** Not redefined. The trigger is right;
--   it is the caller that was wrong to walk into it.
--
-- ── BALANCE REASONING ───────────────────────────────────────────────────────
-- Balance-neutral, and structurally so: the function writes `category`,
-- `category_confirmed` and `updated_at` and nothing else, and this file changes
-- only which rows it walks. No amount, sign, account_id or date is read or
-- written anywhere below, and there is no balance statement in the function to
-- change. The ledger invariant `balance = initial_balance + Σ(amount)` cannot be
-- moved by this migration; verification 5 proves that rather than asserting it.
--
-- The change is in the SAFE direction for the same reason: the guard can only
-- cause FEWER rows to be walked, and a row not walked is a row not written.
--
-- ── BLAST RADIUS ────────────────────────────────────────────────────────────
-- One spec flips from measuring the regression to measuring the repair:
--   scripts/local-sqlite/verb-specs/apply-a-split-parent-costs-the-whole-call
--     .spec.mjs
-- and the Rust port it is differential against
-- (crates/wealth-core/src/verbs/apply_category_to_uncategorized.rs) flips with
-- it, exactly as create_transaction did when 20260808150000 landed. The port
-- reproduced this regression deliberately, on the rule that a local edition
-- refusing what the cloud accepts is a bug in the port; that argument expires
-- the moment the cloud is repaired, and it expires here.
--
-- Nothing in src/ or api/ changes. Every client caller already filters split
-- parents out, so no caller can tell the difference except the one that was
-- passing a stale list — which is the caller this exists for.
--
-- ── ON RE-RUNNING THIS FILE ─────────────────────────────────────────────────
-- Guard 3 refuses a second run by fingerprint: if the live body already carries
-- `NOT is_split` there is nothing to repair, and pressing on could only
-- overwrite something newer with this. That is the same shape 20260808150000
-- uses and it is what makes a replay of the whole directory safe.
--
-- MEASURED against scripts/local-db/up.sh, which replays the whole directory up
-- to three times and reports what never applied: this file is NOT in that list,
-- and it is worth saying why rather than leaving it looking lucky. Filename
-- order puts 20260808100000 before this one, so every pass first restores the
-- body WITHOUT the guard and then this file finds its own precondition true
-- again and re-applies. Guard 3 therefore never fires during a replay, and the
-- cluster ends every pass with the guard present — VERIFIED after a full
-- rebuild on 2026-08-08:
--     skips_split_parents = t, keeps_category_provenance = t
--
-- 20260808170000_rows_cannot_name_a_foreign_account.sql:256-269 describes the
-- opposite case and names it plainly: it has no such accident available to it,
-- because nothing later undoes its DDL, so it IS listed as unapplied on passes
-- 2 and 3. Both are the guards doing their job; the difference is only whether
-- something else happens to reset the precondition first. Neither should be
-- weakened to make a tool's output tidier.
-- ============================================================================

BEGIN;

-- ── Guards: refuse anything but the exact state this body was derived from ──
-- The body below is 20260808100000_category_provenance.sql:391-424 with one
-- line reinstated. If the live function is not that body, replacing it
-- wholesale is how a line gets deleted — which is the entire subject of this
-- file. So the state is checked, by name, before anything is replaced.
DO $$
DECLARE
  v_oid oid;
  v_src text;
BEGIN
  -- By SIGNATURE, not by name. `to_regprocedure` resolves the exact argument
  -- types and returns NULL rather than raising when nothing matches, which is
  -- what makes it usable as a guard; matching on proname alone would silently
  -- fingerprint an overload if one ever appeared.
  v_oid := to_regprocedure('public.apply_category_to_uncategorized(uuid[], text, uuid)');
  IF v_oid IS NOT NULL THEN
    v_src := pg_get_functiondef(v_oid);
  END IF;

  -- Guard 1: it is there at all.
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'payee_fanout_missing: expected apply_category_to_uncategorized(uuid[], text, uuid) to exist before changing which rows it walks — apply 20260708100000_payee_memory_autocategorize.sql first'
      USING ERRCODE = 'P0002';
  END IF;

  -- Guard 2: the RIGHT BASE. `category_confirmed` arrived in the live
  -- definition at 20260808100000, and the body below carries it. Absent means
  -- the live function predates that migration, so this body is NEWER than the
  -- live one in a second respect and applying it would be a THIRD wrong-base
  -- rebase — the exact mistake this file exists to repair, committed by the
  -- repair. Refuse instead.
  IF position('category_confirmed' IN v_src) = 0 THEN
    RAISE EXCEPTION 'payee_fanout_missing_category_provenance: apply_category_to_uncategorized does not carry category_confirmed — apply 20260808100000_category_provenance.sql first. Applying this body now would be the same wrong-base rebase that lost the split guard.'
      USING ERRCODE = 'P0001',
            HINT = 'Two migrations in three days have lost a line by rebasing onto a superseded definition (20260808150000 documents the first). This guard is what stops the third.';
  END IF;

  -- Guard 3: NOT ALREADY DONE. Reaching here on a re-run would mean the live
  -- function already skips split parents, so there is nothing to repair.
  IF position('NOT is_split' IN v_src) > 0 THEN
    RAISE EXCEPTION 'payee_fanout_already_skips_split_parents: apply_category_to_uncategorized already carries the split guard — this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001',
            HINT = 'Verification 1 at the foot of this file shows the current state. If the body needs changing again, write a new migration for it.';
  END IF;

  -- Guard 4: the column the reinstated line reads must exist. Cheap, and the
  -- alternative is a body that fails at CALL time — a plpgsql body is not
  -- parsed until it is invoked, so a missing column here would not surface
  -- until the next time somebody categorised a payee.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'transactions'
       AND column_name = 'is_split'
  ) THEN
    RAISE EXCEPTION 'split_column_missing: transactions.is_split does not exist — apply 20260713100000_transaction_splits.sql first. The cursor below reads that column and would fail on the first call, not now.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ── apply_category_to_uncategorized: skip what is split ─────────────────────
-- Byte-for-byte 20260808100000_category_provenance.sql:391-424 except for ONE
-- line, reinstated exactly as 20260713100000_transaction_splits.sql:293 had it,
-- in the same position in the WHERE clause (after the blank-category test,
-- before FOR UPDATE). The loop body, the audit call, the count and the
-- `category_confirmed = true` that 20260808100000 added are untouched.
--
-- Why `category_confirmed = true` stays, in 20260808100000's own words
-- (:381-386): "Every caller of this is the user filing a payee they have just
-- chosen a category for, and payee memory spreading that choice to the
-- identical rows IS the choice — that is what 'categorise this whole merchant'
-- means. Marking those rows as suggestions would hand back, as a list to
-- re-check, the exact rows he asked to be dealt with."
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
  'Payee memory, spread across the blanks: file one category on every named transaction that is STILL uncategorised, marking each as a decision the user made, one audit entry per row. Skips split parents, whose category is blank by design — a guard 20260713100000 added, 20260808100000 dropped by rebasing onto a superseded definition, and 20260808180000 restored. Skips rows that are already filed, which is the promise the whole feature rests on. Balance-neutral.';

COMMIT;

-- ============================================================================
-- Verification — run after applying
-- ============================================================================

-- 1. The function skips split parents, and still carries what the migration
--    before it added. This is also the query that tells "applied" from "guard 3
--    fired": both look the same from the outside, and only this distinguishes
--    them.
-- Expected: both true
SELECT position('NOT is_split' IN pg_get_functiondef(p.oid)) > 0        AS skips_split_parents,
       position('category_confirmed' IN pg_get_functiondef(p.oid)) > 0  AS keeps_category_provenance
  FROM pg_proc p
 WHERE p.oid = to_regprocedure('public.apply_category_to_uncategorized(uuid[], text, uuid)');

-- 2. It BEHAVES: the measurement the defect was found by, run again. A list
--    containing a split parent files the other rows and skips the parent,
--    instead of refusing the whole call. Rolled back, so it writes nothing —
--    substitute a real user id, a blank row of theirs, a split parent of theirs
--    and a category id before running.
-- Expected: filed = 1 (the blank row), and the parent's category still blank
/*
BEGIN;
SELECT public.apply_category_to_uncategorized(
         ARRAY[:'blank_row_id', :'split_parent_id']::uuid[],
         :'category_id',
         :'user_id') AS filed;
SELECT id, COALESCE(NULLIF(btrim(category), ''), '(blank)') AS category, is_split
  FROM public.transactions
 WHERE id IN (:'blank_row_id'::uuid, :'split_parent_id'::uuid)
 ORDER BY is_split;
ROLLBACK;
*/

-- 3. Security posture unchanged by the rewrite — redefining a function must not
--    quietly change what it runs as.
-- Expected: one row, prosecdef = false, proconfig = {search_path=public}
SELECT p.proname, p.prosecdef, p.proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'apply_category_to_uncategorized';

-- 4. Grants unchanged: authenticated and service_role, plus the owner. Never
--    anon, never PUBLIC ('-'). CREATE OR REPLACE preserves the ACL; this is the
--    check that it did.
SELECT a.grantee::regrole::text AS grantee, a.privilege_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 CROSS JOIN LATERAL aclexplode(p.proacl) AS a
 WHERE n.nspname = 'public' AND p.proname = 'apply_category_to_uncategorized'
 ORDER BY grantee;

-- 5. The balance invariant still holds for every account: balance must equal
--    initial_balance + Σ(amount). This migration writes no data and the
--    function it changes has no balance statement, so it cannot have moved one
--    — this proves it rather than claiming it.
-- Expected: zero rows
SELECT a.id, a.name, a.balance, a.initial_balance + COALESCE(t.total, 0) AS expected
  FROM public.accounts a
  LEFT JOIN (
    SELECT account_id, sum(amount) AS total
      FROM public.transactions
     GROUP BY account_id
  ) t ON t.account_id = a.id
 WHERE a.balance IS DISTINCT FROM a.initial_balance + COALESCE(t.total, 0);

-- 6. The split invariant the guard protects, measured rather than assumed: no
--    split parent carries a category. If this ever returns rows, the guard was
--    not the only thing missing.
-- Expected: zero rows
SELECT id, user_id, account_id, category
  FROM public.transactions
 WHERE is_split
   AND COALESCE(btrim(category), '') <> '';

-- 7. How exposed this was. Split parents are the rows the missing guard could
--    have been handed; a login with none was never at risk. Reported per login
--    rather than in total, because the answer to "did this affect me" is
--    per-login.
SELECT user_id,
       count(*) FILTER (WHERE is_split)                                          AS split_parents,
       count(*) FILTER (WHERE COALESCE(btrim(category), '') = '' AND NOT is_split) AS still_uncategorised
  FROM public.transactions
 GROUP BY user_id
 ORDER BY split_parents DESC;
