-- ============================================================================
-- Split-line transfer legs (the Microsoft Money model)
--
-- A transfer can be recorded as one LINE inside a split transaction: the line
-- carries the leg (other account + counterpart transaction), and the
-- counterpart transaction points back at the split parent plus the exact line.
--
--   transaction_splits.transfer_account_id  → the account on the other side
--   transaction_splits.linked_transfer_id   → the counterpart transaction
--   transactions.linked_transfer_split_id   → the exact line that is the
--                                             opposite leg (its
--                                             linked_transfer_id then points
--                                             at the split PARENT)
--
-- Invariants:
--   - Amounts are exactly opposite between the LINE and the counterpart
--     (not the parent, whose total includes the other lines).
--   - Deleting either side unlinks the other (SET NULL), never cascades.
--   - set_transaction_splits refuses to edit/un-split a split containing a
--     linked leg line — replacing the lines would strand the counterpart.
--     (Mirrors the client-side guard in dataService.)
-- ============================================================================

BEGIN;

-- The MS Money importer files accounts as 'asset' / 'liability' — the app's
-- Accounts page has always had sections for both, but the original CHECK
-- predates them ('assets' was a legacy spelling no app code writes). Extend
-- rather than remap so the page sections match the stored type verbatim.
-- ('current' is still stored as 'checking' — accountService translates.)
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_type_check CHECK (
  type = ANY (ARRAY[
    'checking'::text, 'savings'::text, 'credit'::text, 'cash'::text,
    'investment'::text, 'loan'::text, 'assets'::text, 'other'::text,
    'asset'::text, 'liability'::text, 'mortgage'::text
  ])
);

ALTER TABLE public.transaction_splits
  ADD COLUMN IF NOT EXISTS transfer_account_id uuid
    REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_transfer_id uuid
    REFERENCES public.transactions(id) ON DELETE SET NULL;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS linked_transfer_split_id uuid
    REFERENCES public.transaction_splits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_splits_linked_transfer
  ON public.transaction_splits (linked_transfer_id)
  WHERE linked_transfer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_linked_transfer_split
  ON public.transactions (linked_transfer_split_id)
  WHERE linked_transfer_split_id IS NOT NULL;

-- ── set_transaction_splits: add the linked-leg guard ─────────────────────────
-- Full body from 20260713100000_transaction_splits.sql with ONE addition: the
-- "split_has_linked_transfer_line" check after the transfer check. Everything
-- else is byte-identical.
CREATE OR REPLACE FUNCTION public.set_transaction_splits(
  p_transaction_id uuid,
  p_splits jsonb,
  p_expected_amount numeric DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_old public.transactions;
  v_new public.transactions;
  v_split jsonb;
  v_category text;
  v_amount numeric(20,2);
  v_sum numeric(20,2) := 0;
  v_count integer := 0;
  v_ord integer := 0;
  v_old_splits jsonb;
  v_new_splits jsonb;
  v_acct_before public.accounts;
  v_acct_after public.accounts;
BEGIN
  IF p_splits IS NOT NULL AND jsonb_typeof(p_splits) <> 'array' THEN
    RAISE EXCEPTION 'p_splits must be a jsonb array' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old
    FROM public.transactions
   WHERE id = p_transaction_id
     AND (p_user_id IS NULL OR user_id = p_user_id)
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_old.type = 'transfer' THEN
    RAISE EXCEPTION 'transfers cannot be split' USING ERRCODE = 'P0001';
  END IF;

  -- split_has_linked_transfer_line: a line that is one leg of a linked
  -- transfer is structural — replacing or removing it would strand the
  -- counterpart transaction. Delete/unlink the transfer first.
  IF EXISTS (
    SELECT 1 FROM public.transaction_splits s
     WHERE s.transaction_id = p_transaction_id
       AND s.linked_transfer_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This split contains a linked transfer line — delete the linked transfer first, then edit the split.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.sort_order), '[]'::jsonb)
    INTO v_old_splits
    FROM public.transaction_splits s
   WHERE s.transaction_id = p_transaction_id;

  -- Let this function's own writes through the split guard (transaction-local).
  PERFORM set_config('app.split_rpc', '1', true);

  DELETE FROM public.transaction_splits WHERE transaction_id = p_transaction_id;

  -- ── Un-split ──────────────────────────────────────────────────────────────
  IF p_splits IS NULL OR jsonb_array_length(p_splits) = 0 THEN
    IF v_old.is_split THEN
      UPDATE public.transactions
         SET is_split = false, updated_at = now()
       WHERE id = p_transaction_id
      RETURNING * INTO v_new;

      PERFORM public.write_financial_audit(
        v_new.user_id, 'transaction', v_new.id, 'update',
        to_jsonb(v_old) || jsonb_build_object('splits', v_old_splits),
        to_jsonb(v_new) || jsonb_build_object('splits', '[]'::jsonb)
      );
    END IF;
    RETURN jsonb_build_object('is_split', false, 'split_count', 0, 'amount', v_old.amount);
  END IF;

  -- ── Split ─────────────────────────────────────────────────────────────────
  IF jsonb_array_length(p_splits) < 2 THEN
    RAISE EXCEPTION 'a split needs at least 2 lines' USING ERRCODE = '22023';
  END IF;

  FOR v_split IN SELECT value FROM jsonb_array_elements(p_splits) LOOP
    v_category := btrim(COALESCE(v_split->>'category', ''));
    IF v_category = '' THEN
      RAISE EXCEPTION 'every split line needs a category' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.categories c
       WHERE c.id::text = v_category
         AND c.user_id = v_old.user_id
         AND c.is_transfer_category IS NOT TRUE
    ) THEN
      RAISE EXCEPTION 'unknown or transfer category: %', v_category USING ERRCODE = '22023';
    END IF;

    v_amount := (v_split->>'amount')::numeric(20,2);
    IF v_amount IS NULL OR v_amount = 0 THEN
      RAISE EXCEPTION 'every split line needs a non-zero amount' USING ERRCODE = '22023';
    END IF;

    v_ord := v_ord + 1;
    INSERT INTO public.transaction_splits
      (transaction_id, user_id, category, amount, memo, sort_order)
    VALUES
      (p_transaction_id, v_old.user_id, v_category, v_amount,
       NULLIF(btrim(COALESCE(v_split->>'memo', '')), ''), v_ord);

    v_sum := v_sum + v_amount;
    v_count := v_count + 1;
  END LOOP;

  IF p_expected_amount IS NOT NULL AND v_sum <> p_expected_amount THEN
    RAISE EXCEPTION 'split_total_mismatch: split lines sum to % but the transaction amount is %',
      v_sum, p_expected_amount USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.transactions
     SET is_split = true,
         category = '',            -- categorisation lives in the split lines
         amount = v_sum,
         updated_at = now()
   WHERE id = p_transaction_id
  RETURNING * INTO v_new;

  IF v_new.amount <> v_old.amount THEN
    SELECT * INTO v_acct_before
      FROM public.accounts
     WHERE id = v_new.account_id AND user_id = v_new.user_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.accounts
       SET balance = balance + (v_new.amount - v_old.amount),
           updated_at = now()
     WHERE id = v_new.account_id AND user_id = v_new.user_id
    RETURNING * INTO v_acct_after;

    PERFORM public.write_financial_audit(
      v_new.user_id, 'account', v_acct_after.id, 'update',
      to_jsonb(v_acct_before), to_jsonb(v_acct_after)
    );
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.sort_order), '[]'::jsonb)
    INTO v_new_splits
    FROM public.transaction_splits s
   WHERE s.transaction_id = p_transaction_id;

  PERFORM public.write_financial_audit(
    v_new.user_id, 'transaction', v_new.id, 'update',
    to_jsonb(v_old) || jsonb_build_object('splits', v_old_splits),
    to_jsonb(v_new) || jsonb_build_object('splits', v_new_splits)
  );

  RETURN jsonb_build_object('is_split', true, 'split_count', v_count, 'amount', v_sum);
END;
$$;

COMMIT;
