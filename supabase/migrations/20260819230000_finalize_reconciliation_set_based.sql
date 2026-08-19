-- ============================================================================
-- finalize_reconciliation, SET-BASED — the freeze the owner pressed through
-- ============================================================================
--
-- MEASURED INCIDENT (19 Aug 2026): finalizing a first-ever reconciliation over
-- 7,199 marked rows froze the screen. The owner pressed Complete "10-20
-- times"; every press fired another RPC, each queueing behind the first one's
-- `SELECT ... FOR UPDATE` on the account row, until the first finally
-- committed and the rest found nothing left to convert.
--
-- THE COST WAS THE LOOP. 20260810200000's finalize_reconciliation walked the
-- marked rows one at a time: one UPDATE statement per row, then one
-- write_financial_audit call per row — and each of those audit calls resolves
-- the caller's identity again (a GUC read plus a users lookup) before its
-- INSERT. 7,199 rows meant ~14,400 statements and 7,199 identity resolutions
-- inside one transaction. This migration replaces the loop with ONE update
-- and ONE audit insert, keeping every property the loop had:
--
--   * the SAME rows convert (identical predicate, is_cleared AND
--     is_reconciled IS NOT DISTINCT FROM false — NULL rows are pre-split
--     history and stay untouched);
--   * the SAME audit fidelity: one financial_audit_log row PER TRANSACTION,
--     carrying the full before and after row images, exactly as the loop
--     wrote them — nothing is summarised away;
--   * the SAME account stamp and account audit row;
--   * the SAME return shape, and all of it still one database transaction.
--
-- write_financial_audit stays the sole PER-ROW write path into
-- financial_audit_log; this adds its batch sibling, write_financial_audit_
-- batch, with the identity block copied verbatim — checked ONCE for the
-- batch, which is precisely the saving: the caller's identity does not
-- change between row 1 and row 7,199.
--
-- The sweep trigger (trg_sweep_reconciled_into_archive) is untouched and
-- still fires per updated row; it is a BEFORE trigger, so the after-images
-- audited here include any archive flag it sets — as they did under the loop.
-- ============================================================================

-- ── Guards: refuse to run against a database this was not written for ──────
DO $$
BEGIN
  -- 1. The function being replaced exists with the expected signature.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'finalize_reconciliation'
       AND pg_get_function_identity_arguments(p.oid) = 'p_user_id uuid, p_account_id uuid, p_ending_balance numeric, p_reconciled_on date'
  ) THEN
    RAISE EXCEPTION 'finalize_reconciliation(uuid, uuid, numeric, date) not found — apply 20260810200000 first';
  END IF;

  -- 2. The definition being replaced is the one this file was written
  --    against (the per-row loop). If it has since changed, STOP and
  --    reconcile this rewrite with the newer definition by hand.
  IF (
    SELECT pg_get_functiondef(p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'finalize_reconciliation'
       AND pg_get_function_identity_arguments(p.oid) = 'p_user_id uuid, p_account_id uuid, p_ending_balance numeric, p_reconciled_on date'
  ) NOT LIKE '%FOR v_old IN%' THEN
    RAISE EXCEPTION 'finalize_reconciliation is not 20260810200000''s per-row loop — this rewrite was authored against that definition; reconcile by hand';
  END IF;

  -- 3. The audit function whose identity block is copied here exists.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'write_financial_audit'
       AND pg_get_function_identity_arguments(p.oid) = 'p_user_id uuid, p_entity text, p_entity_id uuid, p_action text, p_before jsonb, p_after jsonb'
  ) THEN
    RAISE EXCEPTION 'write_financial_audit(uuid, text, uuid, text, jsonb, jsonb) not found — apply 20260725120000 first';
  END IF;

  -- 4. The audit table carries exactly the columns the batch insert names.
  IF (
    SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'financial_audit_log'
       AND column_name IN ('user_id','actor_clerk_id','entity','entity_id','action','before_data','after_data')
  ) <> 7 THEN
    RAISE EXCEPTION 'financial_audit_log does not carry the seven columns this batch insert names';
  END IF;
END $$;

BEGIN;

-- ── The batch sibling of write_financial_audit ──────────────────────────────
-- IDENTITY BLOCK COPIED VERBATIM from 20260725120000's write_financial_audit
-- — the whole point of the batch is that it runs once instead of once per
-- row, so it must be the SAME check or the batch would be the weaker door.
CREATE OR REPLACE FUNCTION public.write_financial_audit_batch(
  p_user_id uuid,
  p_entries jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Cheap: a GUC read, no table access. Deliberately resolved before the
  -- users lookup so bulk service-role imports never pay for one.
  v_clerk text := public.requesting_clerk_id();
  v_role  text;
  v_user  uuid;
BEGIN
  IF v_clerk IS NOT NULL THEN
    v_user := public.requesting_user_id();
    IF v_user IS NULL OR p_user_id IS DISTINCT FROM v_user THEN
      RAISE EXCEPTION 'audit_identity_mismatch'
        USING ERRCODE = '42501',
              HINT = 'A financial audit row may only be written for the user in the caller''s own session token.';
    END IF;
  ELSE
    v_role := COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      NULLIF(current_setting('role', true), 'none')
    );
    IF v_role IS NOT NULL AND v_role <> 'service_role' THEN
      RAISE EXCEPTION 'audit_identity_required'
        USING ERRCODE = '42501',
              HINT = 'Only an end-user session or the service role may write financial audit rows.';
    END IF;
    v_user := p_user_id;
  END IF;

  INSERT INTO public.financial_audit_log
    (user_id, actor_clerk_id, entity, entity_id, action, before_data, after_data)
  SELECT v_user, v_clerk, e.entity, e.entity_id, e.action, e.before_data, e.after_data
    FROM jsonb_to_recordset(COALESCE(p_entries, '[]'::jsonb))
      AS e(entity text, entity_id uuid, action text, before_data jsonb, after_data jsonb);
END;
$$;

COMMENT ON FUNCTION public.write_financial_audit_batch(uuid, jsonb) IS
  'write_financial_audit''s batch sibling: the same identity verification, run once for a set of rows instead of once per row. Exists for the one caller whose row count is unbounded — finalize_reconciliation — where per-row identity resolution was measured freezing a 7,199-row finalize. Entries are [{entity, entity_id, action, before_data, after_data}].';

REVOKE ALL ON FUNCTION public.write_financial_audit_batch(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.write_financial_audit_batch(uuid, jsonb) TO authenticated, service_role;

-- ── finalize_reconciliation, one UPDATE and one audit insert ────────────────
-- Everything 20260810200000's comment promised still holds: it commits the
-- account's marked-but-uncommitted rows, records the statement they were
-- settled against, is all-or-nothing, and is balance-neutral.
CREATE OR REPLACE FUNCTION public.finalize_reconciliation(
  p_user_id uuid,
  p_account_id uuid,
  p_ending_balance numeric,
  p_reconciled_on date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_before public.accounts;
  v_after public.accounts;
  v_count integer := 0;
  v_entries jsonb := '[]'::jsonb;
BEGIN
  IF p_ending_balance IS NULL THEN
    -- Not a defensive nicety: the ending balance is the whole point of
    -- finishing, and a NULL one would record "reconciled against nothing".
    RAISE EXCEPTION 'ending_balance_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before
    FROM public.accounts
   WHERE id = p_account_id AND user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0002';
  END IF;

  -- ONE statement: snapshot the before-images, convert the rows, and build
  -- the per-row audit entries from the pair. The BEFORE sweep trigger fires
  -- per updated row exactly as it did under the loop, and its effect is in
  -- the after-image because RETURNING reads the row the trigger produced.
  WITH before AS (
    SELECT * FROM public.transactions
     WHERE user_id = p_user_id
       AND account_id = p_account_id
       AND is_cleared = true
       AND is_reconciled IS NOT DISTINCT FROM false
     FOR UPDATE
  ),
  updated AS (
    UPDATE public.transactions t
       SET is_reconciled = true,
           updated_at = now()
      FROM before b
     WHERE t.id = b.id
    RETURNING t.*
  )
  SELECT count(*)::int,
         COALESCE(jsonb_agg(jsonb_build_object(
           'entity', 'transaction',
           'entity_id', u.id,
           'action', 'update',
           'before_data', to_jsonb(b),
           'after_data', to_jsonb(u)
         )), '[]'::jsonb)
    INTO v_count, v_entries
    FROM updated u
    JOIN before b ON b.id = u.id;

  IF v_count > 0 THEN
    PERFORM public.write_financial_audit_batch(p_user_id, v_entries);
  END IF;

  UPDATE public.accounts
     SET last_reconciled_date = COALESCE(p_reconciled_on, CURRENT_DATE),
         last_reconciled_balance = p_ending_balance,
         updated_at = now()
   WHERE id = p_account_id AND user_id = p_user_id
  RETURNING * INTO v_after;

  PERFORM public.write_financial_audit(
    p_user_id, 'account', p_account_id, 'update', to_jsonb(v_before), to_jsonb(v_after)
  );

  RETURN jsonb_build_object(
    'reconciled', v_count,
    'ending_balance', p_ending_balance,
    'reconciled_on', COALESCE(p_reconciled_on, CURRENT_DATE)
  );
END;
$$;

COMMENT ON FUNCTION public.finalize_reconciliation(uuid, uuid, numeric, date) IS
  'Commit an account''s marked-but-uncommitted transactions and record the statement the reconciliation was settled against, in one database transaction. Set-based since 20260819230000 (one UPDATE, one batch audit insert — a 7,199-row finalize froze under the per-row loop); converts only rows whose is_reconciled is explicitly false (NULL rows are pre-split history the archive and the counts already treat as reconciled). Balance-neutral: writes one flag per row and two records on the account, and never touches balance or initial_balance.';

REVOKE ALL ON FUNCTION public.finalize_reconciliation(uuid, uuid, numeric, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.finalize_reconciliation(uuid, uuid, numeric, date) TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- Verification — run after applying.
-- ============================================================================

-- 1. Both functions exist; finalize no longer contains the per-row loop.
-- Expected: two rows; finalize's definition contains 'jsonb_agg' and not 'FOR v_old IN'.
-- SELECT p.proname, pg_get_functiondef(p.oid) LIKE '%FOR v_old IN%' AS still_loops
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN ('finalize_reconciliation', 'write_financial_audit_batch');

-- 2. anon can execute neither.
-- Expected: zero rows.
-- SELECT p.proname
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN ('finalize_reconciliation', 'write_financial_audit_batch')
--    AND has_function_privilege('anon', p.oid, 'EXECUTE');
