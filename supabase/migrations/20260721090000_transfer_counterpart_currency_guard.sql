-- Cross-currency guard for create_transfer_counterpart (audit 2026-07-21).
--
-- IMPORTANT: Run this SQL in the Supabase SQL Editor to apply to production DB.
-- Safe to apply any time: it only ADDS a guard to the existing RPC — every
-- same-currency call behaves exactly as before.
--
-- The RPC inserts the counterpart as -amount into the target account with NO
-- currency conversion, and adjusts the target balance by that raw magnitude.
-- For two accounts in different currencies that would move the target ledger
-- by the wrong amount entirely (a USD -$1,336.25 source would move a GBP
-- account by £1,336.25). Until real conversion is designed, refuse loudly.
-- NULL currencies are treated as unspecified and never block (legacy rows);
-- the guard fires only when BOTH currencies are set and differ. The MS Money
-- importer handles cross-currency pairs on its own path (reciprocal native
-- amounts) and does not use this RPC.

CREATE OR REPLACE FUNCTION public.create_transfer_counterpart(
  p_id uuid,
  p_target_account_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_src public.transactions;
  v_src_new public.transactions;
  v_new public.transactions;
  v_src_acct public.accounts;
  v_acct_before public.accounts;
  v_acct_after public.accounts;
BEGIN
  SELECT * INTO v_src FROM public.transactions
   WHERE id = p_id AND (p_user_id IS NULL OR user_id = p_user_id)
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_src.amount = 0 THEN
    RAISE EXCEPTION 'a zero-amount transaction cannot become a transfer' USING ERRCODE = 'P0001';
  END IF;
  IF v_src.is_split THEN
    RAISE EXCEPTION 'a split transaction cannot become a transfer — remove the split first'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_src.linked_transfer_id IS NOT NULL THEN
    RAISE EXCEPTION 'transaction is already part of a linked transfer' USING ERRCODE = 'P0001';
  END IF;
  IF v_src.account_id = p_target_account_id THEN
    RAISE EXCEPTION 'a transfer needs two different accounts' USING ERRCODE = 'P0001';
  END IF;

  -- Lock and validate the target account up front (owned by the same user).
  SELECT * INTO v_acct_before FROM public.accounts
   WHERE id = p_target_account_id AND user_id = v_src.user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001';
  END IF;

  -- Cross-currency guard: the counterpart is -amount with no conversion, so
  -- both accounts must share a currency. Only blocks when both are set.
  SELECT * INTO v_src_acct FROM public.accounts
   WHERE id = v_src.account_id AND user_id = v_src.user_id;
  IF FOUND
     AND v_src_acct.currency IS NOT NULL
     AND v_acct_before.currency IS NOT NULL
     AND v_src_acct.currency <> v_acct_before.currency THEN
    RAISE EXCEPTION 'Transfers between accounts in different currencies are not supported yet (% and %)',
      v_src_acct.currency, v_acct_before.currency
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.transactions
    (user_id, account_id, description, amount, type, date, category,
     notes, transfer_account_id, linked_transfer_id, is_cleared)
  VALUES
    (v_src.user_id, p_target_account_id, v_src.description, -v_src.amount,
     'transfer', v_src.date,
     public.transfer_category_for(v_src.user_id, v_src.account_id, -v_src.amount),
     v_src.notes, v_src.account_id, v_src.id, false)
  RETURNING * INTO v_new;

  UPDATE public.transactions
     SET type = 'transfer',
         category = public.transfer_category_for(v_src.user_id, p_target_account_id, v_src.amount),
         transfer_account_id = p_target_account_id,
         linked_transfer_id = v_new.id,
         updated_at = now()
   WHERE id = v_src.id
  RETURNING * INTO v_src_new;

  -- The new row moves the target account's ledger balance.
  UPDATE public.accounts
     SET balance = balance + v_new.amount,
         updated_at = now()
   WHERE id = p_target_account_id AND user_id = v_src.user_id
  RETURNING * INTO v_acct_after;

  PERFORM public.write_financial_audit(
    v_new.user_id, 'transaction', v_new.id, 'create', NULL, to_jsonb(v_new));
  PERFORM public.write_financial_audit(
    v_src_new.user_id, 'transaction', v_src_new.id, 'update', to_jsonb(v_src), to_jsonb(v_src_new));
  PERFORM public.write_financial_audit(
    v_src.user_id, 'account', v_acct_after.id, 'update',
    to_jsonb(v_acct_before), to_jsonb(v_acct_after));

  RETURN jsonb_build_object('source', to_jsonb(v_src_new), 'counterpart', to_jsonb(v_new));
END;
$$;

-- CREATE OR REPLACE preserves existing ACLs; restated for explicitness.
REVOKE ALL ON FUNCTION public.create_transfer_counterpart(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_transfer_counterpart(uuid, uuid, uuid) TO authenticated, service_role;
