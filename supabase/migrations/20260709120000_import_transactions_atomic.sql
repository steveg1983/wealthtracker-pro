-- Bulk atomic import for manual/file imports (QIF, CSV, OFX).
--
-- WHY: file imports previously wrote one row at a time from the browser,
-- un-awaited. A large statement (e.g. an 11k-row MS Money QIF) fired thousands
-- of concurrent create_transaction_atomic RPCs, which the API rate/connection
-- limits reject en masse — most rows silently failed. Bank feeds don't hit this
-- because they insert via a single server-side bulk RPC. This gives file imports
-- the same treatment.
--
-- One call = one database transaction: every insert + the single balance effect
-- + the audit rows commit together or not at all. Columns and casts mirror
-- create_transaction_atomic exactly (note the cleared column is `is_cleared`).
--
-- Security: SERVER-ONLY (service_role). p_user_id is the boundary — the service
-- role bypasses RLS, so every row is written as p_user_id and the target account
-- is verified to belong to p_user_id (FOR UPDATE) before anything is inserted.
-- account_id is taken from p_account_id (a file import targets one account), not
-- from the rows, so a caller can't scatter rows into accounts it doesn't own.

CREATE OR REPLACE FUNCTION public.import_transactions_atomic(
  p_user_id uuid,
  p_account_id uuid,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  v_tx public.transactions;
  v_sum numeric := 0;
  v_inserted integer := 0;
  v_before public.accounts;
  v_after public.accounts;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a jsonb array' USING ERRCODE = '22023';
  END IF;

  -- Lock + ownership check up front (service role bypasses RLS, so this is the
  -- security boundary). Reused as the "before" snapshot for the balance audit.
  SELECT * INTO v_before
    FROM public.accounts
   WHERE id = p_account_id AND user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found_or_not_owned'
      USING ERRCODE = 'P0001',
            HINT = 'The account does not exist or does not belong to this user.';
  END IF;

  FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    INSERT INTO public.transactions (
      user_id, account_id, description, amount, type, date,
      category, notes, tags, is_recurring, is_cleared
    ) VALUES (
      p_user_id,
      p_account_id,
      r->>'description',
      (r->>'amount')::numeric,
      r->>'type',
      (r->>'date')::date,
      NULLIF(r->>'category', ''),
      NULLIF(r->>'notes', ''),
      CASE WHEN r ? 'tags' AND jsonb_typeof(r->'tags') = 'array'
           THEN ARRAY(SELECT jsonb_array_elements_text(r->'tags'))
           ELSE NULL END,
      COALESCE((r->>'is_recurring')::boolean, false),
      COALESCE((r->>'is_cleared')::boolean, false)
    )
    RETURNING * INTO v_tx;

    PERFORM public.write_financial_audit(
      p_user_id, 'transaction', v_tx.id, 'create', NULL, to_jsonb(v_tx)
    );

    v_sum := v_sum + v_tx.amount;
    v_inserted := v_inserted + 1;
  END LOOP;

  -- One balance effect for the whole batch, keeping the ledger invariant
  -- (balance = initial_balance + Σ amount). Audited like every other balance move.
  IF v_inserted > 0 THEN
    UPDATE public.accounts
       SET balance = balance + v_sum,
           updated_at = now()
     WHERE id = p_account_id AND user_id = p_user_id
     RETURNING * INTO v_after;

    PERFORM public.write_financial_audit(
      p_user_id, 'account', p_account_id, 'update',
      to_jsonb(v_before), to_jsonb(v_after)
    );
  END IF;

  RETURN jsonb_build_object('inserted', v_inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.import_transactions_atomic(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_transactions_atomic(uuid, uuid, jsonb) TO service_role;
