-- ============================================================================
-- create_transaction_atomic honours is_cleared again — a rebase onto the wrong
-- base deleted it, and nothing anywhere said so
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). ONE existing function is redefined. No new
-- column, no new index, no backfill, no grant change, and not one existing row
-- is read or written by applying this.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- Three migrations tell this story between them, and the third one inherited a
-- defect the second one introduced while explaining, in a comment, exactly why
-- it could not have.
--
--   20260707120000_reconciliation_cleared_rpcs.sql:117-151
--       Adds `is_cleared` to create_transaction_atomic's column list, with
--       COALESCE(...,false). It exists BECAUSE of an incident (:5-11): "the
--       reconciliation page's cleared checkbox silently did nothing (the RPC
--       'succeeded' without touching is_cleared) ... so a reconciliation
--       difference could never reach zero." Its own header ends with the
--       instruction that would have prevented what happened next:
--       "These definitions are copied from the LATEST live versions."
--
--   20260808090000_transaction_statement_sequence.sql:96-98
--       "Identical to the definition in 20260610150000_financial_audit_log.sql
--       except for the statement_sequence column."  That is a true sentence and
--       the wrong base. 20260610150000 had not been the live definition for a
--       month — 20260707120000 had. Rebasing onto the older text did not add
--       statement_sequence to the live function; it REPLACED the live function
--       with an older one that happened to have statement_sequence bolted on.
--       `is_cleared` was in the difference between the two, and it went out
--       with the bathwater. Compare :107-133 against 20260707120000:125-151:
--       one column, silently absent.
--
--   20260808100000_category_provenance.sql:114-176
--       "Identical to 20260808090000 ... except for the category_confirmed
--       column." True, faithful, and it inherited the loss.
--
-- MEASURED on the reference cluster (scripts/local-db/up.sh), 2026-08-08:
-- calling the live RPC with `"is_cleared": true` returns a row with
-- is_cleared = f. The column defaults FALSE (20260310000200:13), so there is no
-- cast error, no constraint, no warning — the key is read by nobody and the row
-- lands unreconciled. A silent drop is the only failure mode this class of
-- mistake has.
--
-- ── WHY THIS FILE ARGUES FOR THE GUARDS BELOW ───────────────────────────────
-- 20260808140000_file_import_idempotency.sql introduced the fingerprint-guard
-- pattern for the sibling function, with this reasoning: "This function has been
-- redefined three times in three days. A full CREATE OR REPLACE that is one
-- release out of date silently DELETES a column from the insert list, and the
-- failure is invisible until someone notices a register that has stopped
-- recording something."
--
-- That was written as a precaution. THIS migration exists because the same
-- sentence had already come true for create_transaction_atomic and nobody had
-- noticed for a month. The guards below are therefore not ceremony: they are
-- the mechanism that would have turned 20260808090000 into a failed migration
-- instead of a lost column, applied to the function it actually happened to.
--
-- ── WHAT DOES NOT CHANGE ────────────────────────────────────────────────────
-- * **Every row already in the table.** This migration writes no data. Rows
--   created while the passthrough was missing keep is_cleared = false, which is
--   what they have said since they were written; nothing here revises history,
--   and nothing could, because the flag a caller sent was never recorded
--   anywhere to recover it from. What changes is the next row, which is where
--   the defect lives.
-- * **The import RPCs.** import_transactions_atomic and
--   import_bank_transactions_atomic are NOT touched, because they never lost
--   it: 20260808090000 rebased the importer onto 20260709120000 (its real
--   predecessor) and kept `is_cleared` at :196/:210, 20260808100000 carried it
--   at :217/:232, and 20260808140000 at :330/:345. import_bank_transactions_atomic
--   still hard-codes `true` (20260707120000:298) — a fed row IS the statement.
--   That asymmetry is the reason the defect stayed invisible: the bulk paths
--   kept working, so reconciliation kept working for everything except a row
--   created one at a time.
-- * **The signature, SECURITY INVOKER, the pinned search_path, the
--   write_financial_audit call, the RETURNING contract and the grants.** A
--   caller that sends no is_cleared behaves exactly as it does today (COALESCE
--   to false), which is what makes this safe to apply in either order relative
--   to any application deploy.
--
-- ── BALANCE REASONING ───────────────────────────────────────────────────────
-- Balance-neutral, and structurally so. `is_cleared` is a REVIEW flag: it
-- records whether a human has matched this row against a statement line. No
-- amount, sign, account_id or date is read or written by anything below, and
-- the balance statement inside the function is byte-for-byte the one already in
-- place (`balance = balance + v_tx.amount`, guarded by the same IF NOT FOUND
-- and the same refusal). The ledger invariant `balance = initial_balance +
-- Σ(amount)` cannot be moved by this migration; verification 6 proves that
-- rather than asserting it.
--
-- The one thing is_cleared DOES move is the reconciliation difference the user
-- is shown, which is the sum of the UNCLEARED rows. That figure being wrong is
-- how the 2026-07 incident was noticed, and it is what this restores.
-- ============================================================================

BEGIN;

-- ── Guards: refuse anything but the exact state this body was derived from ──
-- The body below is 20260808100000_category_provenance.sql:119-176 with one
-- line reinstated. If the live function is not that body, replacing it wholesale
-- is how a column gets deleted — which is the entire subject of this file. So
-- the state is checked, by name, before anything is replaced.
DO $$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_src
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'create_transaction_atomic';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'transaction_creator_missing: expected create_transaction_atomic to exist before changing what it writes'
      USING ERRCODE = 'P0002';
  END IF;

  -- Fingerprint 1: the column being reinstated must exist. Cheap, and the
  -- alternative is a body that fails at call time — a plpgsql body is not
  -- parsed until it is invoked, so a missing column here would not surface
  -- until the next hand-entered transaction.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'transactions'
       AND column_name = 'is_cleared'
  ) THEN
    RAISE EXCEPTION 'reconciliation_column_missing: transactions.is_cleared does not exist — apply 20260310000200_add_reconciliation_columns.sql first. The body below writes that column and would fail on the first call, not now.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Fingerprint 2: the bank's own within-day order (20260808090000). Absent
  -- means the live function predates that migration, so this body is NEWER than
  -- the live one in a second respect and applying it would be a second
  -- wrong-base rebase — the exact mistake this file exists to repair.
  IF position('statement_sequence' IN v_src) = 0 THEN
    RAISE EXCEPTION 'transaction_creator_missing_statement_sequence: create_transaction_atomic does not carry statement_sequence — apply 20260808090000_transaction_statement_sequence.sql first. Applying this body now would be the same wrong-base rebase that lost is_cleared.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Fingerprint 3: the suggested-category flag (20260808100000). Same reasoning
  -- exactly. Losing it would put the register back to being unable to tell a
  -- category the app guessed from one the user chose.
  IF position('category_confirmed' IN v_src) = 0 THEN
    RAISE EXCEPTION 'transaction_creator_missing_category_confirmed: create_transaction_atomic does not carry category_confirmed — apply 20260808100000_category_provenance.sql first. Applying this body now would drop the flag that tells a guessed category from a chosen one.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Fingerprint 4: not already done. Reaching here on a re-run means the live
  -- function already honours the flag, so there is nothing to repair and
  -- pressing on could only overwrite something newer with this.
  IF position('is_cleared' IN v_src) > 0 THEN
    RAISE EXCEPTION 'transaction_creator_already_honours_is_cleared: create_transaction_atomic already carries is_cleared — this migration has already been applied and must not run twice.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ── create_transaction_atomic: carry the reconciliation flag ────────────────
-- Byte-for-byte 20260808100000_category_provenance.sql:119-176 except for ONE
-- column and ONE value expression, both reinstated exactly as
-- 20260707120000_reconciliation_cleared_rpcs.sql:127 and :144 had them, in the
-- same position in the list (after is_recurring, before transfer_account_id).
-- The INSERT's other nineteen columns, the balance statement, the ownership
-- refusal and its HINT, the audit write and the RETURNING contract are
-- untouched.
CREATE OR REPLACE FUNCTION public.create_transaction_atomic(p jsonb)
RETURNS public.transactions
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tx public.transactions;
BEGIN
  INSERT INTO public.transactions (
    id, user_id, account_id, description, amount, type, date,
    category, notes, tags, is_recurring, is_cleared, transfer_account_id,
    metadata, category_id, merchant_name, location_city,
    location_country, payment_channel, statement_sequence, category_confirmed
  ) VALUES (
    COALESCE(NULLIF(p->>'id', '')::uuid, gen_random_uuid()),
    (p->>'user_id')::uuid,
    (p->>'account_id')::uuid,
    p->>'description',
    (p->>'amount')::numeric,
    p->>'type',
    (p->>'date')::date,
    p->>'category',
    p->>'notes',
    CASE WHEN p ? 'tags' AND jsonb_typeof(p->'tags') = 'array'
         THEN ARRAY(SELECT jsonb_array_elements_text(p->'tags'))
         ELSE NULL END,
    COALESCE((p->>'is_recurring')::boolean, false),
    COALESCE((p->>'is_cleared')::boolean, false),
    NULLIF(p->>'transfer_account_id', '')::uuid,
    COALESCE(p->'metadata', '{}'::jsonb),
    NULLIF(p->>'category_id', '')::uuid,
    p->>'merchant_name',
    p->>'location_city',
    p->>'location_country',
    p->>'payment_channel',
    NULLIF(p->>'statement_sequence', '')::integer,
    COALESCE((p->>'category_confirmed')::boolean, true)
  )
  RETURNING * INTO v_tx;

  UPDATE public.accounts
     SET balance = balance + v_tx.amount,
         updated_at = now()
   WHERE id = v_tx.account_id
     AND user_id = v_tx.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found_or_not_owned'
      USING ERRCODE = 'P0001',
            HINT = 'The account does not exist or does not belong to this user.';
  END IF;

  PERFORM public.write_financial_audit(
    v_tx.user_id, 'transaction', v_tx.id, 'create', NULL, to_jsonb(v_tx)
  );

  RETURN v_tx;
END;
$$;

COMMENT ON FUNCTION public.create_transaction_atomic(jsonb) IS
  'Create ONE transaction, move its account''s balance and write its audit entry, in one database transaction: all of it commits or none of it does. Carries every column a caller may state, including is_cleared — which 20260808090000 dropped by rebasing onto a superseded definition and 20260808150000 restored. Refuses account_not_found_or_not_owned when the named account does not belong to the named user.';

COMMIT;

-- ============================================================================
-- Verification — run after applying. NOTE: unapplied at the time of writing;
-- these are what to read, and what to expect, when it is.
-- ============================================================================

-- 1. The function honours the flag, and still carries everything the two
--    migrations before it added.
-- Expected: all three true
SELECT position('is_cleared' IN pg_get_functiondef(p.oid)) > 0          AS honours_is_cleared,
       position('statement_sequence' IN pg_get_functiondef(p.oid)) > 0  AS keeps_statement_order,
       position('category_confirmed' IN pg_get_functiondef(p.oid)) > 0  AS keeps_category_provenance
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'create_transaction_atomic';

-- 2. It behaves. This is the measurement the defect was found by, run the other
--    way round: a row asked to arrive reconciled arrives reconciled, and one
--    that says nothing still arrives unreconciled. Rolled back, so it writes
--    nothing — substitute a real user and account id before running.
-- Expected: cleared_when_asked = true, cleared_by_default = false
/*
BEGIN;
SELECT (public.create_transaction_atomic(jsonb_build_object(
          'user_id', :'user_id', 'account_id', :'account_id',
          'description', 'verification — asked to arrive reconciled',
          'amount', '0.00', 'type', 'expense', 'date', '2026-01-01',
          'is_cleared', true))).is_cleared AS cleared_when_asked,
       (public.create_transaction_atomic(jsonb_build_object(
          'user_id', :'user_id', 'account_id', :'account_id',
          'description', 'verification — said nothing',
          'amount', '0.00', 'type', 'expense', 'date', '2026-01-01'))).is_cleared AS cleared_by_default;
ROLLBACK;
*/

-- 3. Security posture unchanged by the rewrite — redefining a function must not
--    quietly change what it runs as.
-- Expected: one row, prosecdef = false, proconfig = {search_path=public}
SELECT p.proname, p.prosecdef, p.proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'create_transaction_atomic';

-- 4. Grants unchanged: authenticated and service_role, plus the owner. Never
--    anon, never PUBLIC ('-').
SELECT a.grantee::regrole::text AS grantee, a.privilege_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 CROSS JOIN LATERAL aclexplode(p.proacl) AS a
 WHERE n.nspname = 'public' AND p.proname = 'create_transaction_atomic'
 ORDER BY grantee;

-- 5. The other writers of this column are untouched and still carry it — the
--    check that proves this migration repaired one function without disturbing
--    the three that never broke.
-- Expected: three rows, all true
SELECT p.proname, position('is_cleared' IN pg_get_functiondef(p.oid)) > 0 AS carries_is_cleared
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('import_transactions_atomic', 'import_bank_transactions_atomic',
                     'update_transaction_atomic')
 ORDER BY p.proname;

-- 6. The balance invariant still holds for every account: balance must equal
--    initial_balance + Σ(amount). This migration writes no data and does not
--    touch the balance statement, so it cannot have moved one — this proves it.
-- Expected: zero rows
SELECT a.id, a.name, a.balance, a.initial_balance + COALESCE(t.total, 0) AS expected
  FROM public.accounts a
  LEFT JOIN (
    SELECT account_id, sum(amount) AS total
      FROM public.transactions
     GROUP BY account_id
  ) t ON t.account_id = a.id
 WHERE a.balance IS DISTINCT FROM a.initial_balance + COALESCE(t.total, 0);

-- 7. How much reconciliation history was affected. Rows created through the
--    single-row RPC while the passthrough was missing could only ever be
--    is_cleared = false; this is the shape of what is there, not a repair —
--    there is no record of what any caller asked for, so there is nothing
--    honest to backfill.
SELECT date_trunc('month', created_at) AS month,
       count(*) FILTER (WHERE is_cleared)     AS reconciled,
       count(*) FILTER (WHERE NOT is_cleared) AS unreconciled
  FROM public.transactions
 WHERE created_at >= timestamptz '2026-07-07'
 GROUP BY 1
 ORDER BY 1;
