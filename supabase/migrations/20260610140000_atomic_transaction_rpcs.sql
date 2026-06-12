-- ============================================================================
-- ATOMIC TRANSACTION RPCs
-- ============================================================================
-- Replaces the three divergent client/server balance-update code paths that
-- performed multi-statement read-modify-write balance mutations with IEEE-754
-- float arithmetic in JavaScript (transactionService.ts, dataService.ts,
-- api/data/delete-transaction.ts — the last shipped a 'partial_failure' error
-- code for the inconsistent state it knowingly allowed).
--
-- Each function runs in a single database transaction:
--   * the transaction-row mutation and the balance adjustment commit or roll
--     back together — no drift, no partial failures
--   * balance math is `balance = balance + delta` in SQL numeric — atomic
--     under concurrency (row lock), no floats, no read-modify-write race
--
-- SECURITY INVOKER: when called by `authenticated`, RLS policies scope every
-- statement to the requesting user (see 20260610130000). When called via the
-- service role from api/ handlers, the explicit p_user_id parameter scopes the
-- operation to the Clerk-verified user.
-- ============================================================================

BEGIN;

-- ── CREATE ──────────────────────────────────────────────────────────────────
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
    category, notes, tags, is_recurring, transfer_account_id,
    metadata, category_id, merchant_name, location_city,
    location_country, payment_channel
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
    NULLIF(p->>'transfer_account_id', '')::uuid,
    COALESCE(p->'metadata', '{}'::jsonb),
    NULLIF(p->>'category_id', '')::uuid,
    p->>'merchant_name',
    p->>'location_city',
    p->>'location_country',
    p->>'payment_channel'
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

  RETURN v_tx;
END;
$$;

-- ── UPDATE ──────────────────────────────────────────────────────────────────
-- Adjusts balances for amount changes AND account moves in the same database
-- transaction. Fields absent from p keep their current values.
CREATE OR REPLACE FUNCTION public.update_transaction_atomic(p_id uuid, p jsonb)
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
    -- Transaction moved between accounts: reverse from old, apply to new.
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

  RETURN v_new;
END;
$$;

-- ── DELETE ──────────────────────────────────────────────────────────────────
-- p_user_id: optional explicit scope for service-role callers (api/ handlers
-- pass the Clerk-verified user). For authenticated callers RLS already scopes.
CREATE OR REPLACE FUNCTION public.delete_transaction_atomic(
  p_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_old public.transactions;
BEGIN
  DELETE FROM public.transactions
   WHERE id = p_id
     AND (p_user_id IS NULL OR user_id = p_user_id)
  RETURNING * INTO v_old;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.accounts
     SET balance = balance - v_old.amount,
         updated_at = now()
   WHERE id = v_old.account_id
     AND user_id = v_old.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_old;
END;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.create_transaction_atomic(jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.update_transaction_atomic(uuid, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.delete_transaction_atomic(uuid, uuid) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.create_transaction_atomic(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_transaction_atomic(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_transaction_atomic(uuid, uuid) TO authenticated, service_role;

COMMIT;
