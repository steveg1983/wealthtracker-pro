-- Defence-in-depth IDOR guard for update_transaction_atomic.
--
-- The function is SECURITY INVOKER, so RLS already restricts the row it can
-- lock and update to the requesting user. delete_transaction_atomic additionally
-- accepts an explicit p_user_id and refuses to act on a row owned by anyone
-- else; update_transaction_atomic did not, leaving the two paths inconsistent.
-- This migration brings update in line: an optional p_user_id that, when the
-- caller supplies it, must match the row's owner or the lookup fails closed.
--
-- Adding a parameter changes the function's identity, so the old (uuid, jsonb)
-- overload is dropped first to avoid two co-existing signatures (one unscoped).

DROP FUNCTION IF EXISTS public.update_transaction_atomic(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.update_transaction_atomic(
  p_id uuid,
  p jsonb,
  p_user_id uuid DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_old public.transactions;
  v_new public.transactions;
BEGIN
  SELECT * INTO v_old
    FROM public.transactions
   WHERE id = p_id
     AND (p_user_id IS NULL OR user_id = p_user_id)
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.transactions SET
    description         = COALESCE(p->>'description', description),
    amount              = COALESCE((p->>'amount')::numeric, amount),
    type                = COALESCE(p->>'type', type),
    date                = COALESCE((p->>'date')::date, date),
    account_id          = COALESCE(NULLIF(p->>'account_id', '')::uuid, account_id),
    category            = CASE WHEN p ? 'category' THEN p->>'category' ELSE category END,
    notes               = CASE WHEN p ? 'notes' THEN p->>'notes' ELSE notes END,
    tags                = CASE WHEN p ? 'tags' AND jsonb_typeof(p->'tags') = 'array'
                               THEN ARRAY(SELECT jsonb_array_elements_text(p->'tags'))
                               ELSE tags END,
    is_recurring        = COALESCE((p->>'is_recurring')::boolean, is_recurring),
    transfer_account_id = CASE WHEN p ? 'transfer_account_id'
                               THEN NULLIF(p->>'transfer_account_id', '')::uuid
                               ELSE transfer_account_id END,
    metadata            = CASE WHEN p ? 'metadata' THEN p->'metadata' ELSE metadata END,
    category_id         = CASE WHEN p ? 'category_id'
                               THEN NULLIF(p->>'category_id', '')::uuid
                               ELSE category_id END,
    merchant_name       = CASE WHEN p ? 'merchant_name' THEN p->>'merchant_name' ELSE merchant_name END,
    updated_at          = now()
  WHERE id = p_id
  RETURNING * INTO v_new;

  IF v_old.account_id = v_new.account_id THEN
    IF v_new.amount <> v_old.amount THEN
      UPDATE public.accounts
         SET balance = balance + (v_new.amount - v_old.amount),
             updated_at = now()
       WHERE id = v_new.account_id
         AND user_id = v_new.user_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  ELSE
    UPDATE public.accounts
       SET balance = balance - v_old.amount,
           updated_at = now()
     WHERE id = v_old.account_id
       AND user_id = v_old.user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.accounts
       SET balance = balance + v_new.amount,
           updated_at = now()
     WHERE id = v_new.account_id
       AND user_id = v_new.user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM public.write_financial_audit(
    v_new.user_id, 'transaction', v_new.id, 'update', to_jsonb(v_old), to_jsonb(v_new)
  );

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_transaction_atomic(uuid, jsonb, uuid) TO authenticated, service_role;
