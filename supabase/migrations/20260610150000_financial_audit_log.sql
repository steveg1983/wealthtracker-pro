-- ============================================================================
-- FINANCIAL AUDIT LOG
-- ============================================================================
-- Server-side audit trail for financial operations — a known compliance gap.
-- Written from INSIDE the atomic transaction RPCs, so the audit row commits
-- in the same database transaction as the operation it records: an operation
-- cannot succeed without its audit entry, and vice versa.
--
-- Extends the pattern proven by banking_dead_letter_admin_audit. The
-- client-side localStorage "audit log" (securityService) is NOT a compliance
-- artifact — this table is.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  actor_clerk_id text,                -- NULL when via service role (API acts for the user)
  entity        text NOT NULL,        -- 'transaction' | 'account' | ...
  entity_id     uuid NOT NULL,
  action        text NOT NULL,        -- 'create' | 'update' | 'delete'
  before_data   jsonb,                -- NULL on create
  after_data    jsonb,                -- NULL on delete
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_audit_log_action_check
    CHECK (action IN ('create', 'update', 'delete'))
);

CREATE INDEX IF NOT EXISTS idx_financial_audit_log_user_created
  ON public.financial_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_audit_log_entity
  ON public.financial_audit_log (entity, entity_id);

-- RLS: users may READ their own audit history; nothing client-side may write
-- or modify it. Inserts happen only inside the SECURITY-DEFINER audit helper.
ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financial_audit_log_select_own ON public.financial_audit_log;
CREATE POLICY financial_audit_log_select_own ON public.financial_audit_log
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id());
-- No INSERT/UPDATE/DELETE policies: immutable from the client's perspective.

-- Writer helper. SECURITY DEFINER so the insert succeeds even though callers
-- have no INSERT policy on the table — the ONLY write path is via the RPCs.
CREATE OR REPLACE FUNCTION public.write_financial_audit(
  p_user_id uuid,
  p_entity text,
  p_entity_id uuid,
  p_action text,
  p_before jsonb,
  p_after jsonb
) RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.financial_audit_log
    (user_id, actor_clerk_id, entity, entity_id, action, before_data, after_data)
  VALUES
    (p_user_id, public.requesting_clerk_id(), p_entity, p_entity_id, p_action, p_before, p_after);
$$;

REVOKE ALL ON FUNCTION public.write_financial_audit(uuid, text, uuid, text, jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.write_financial_audit(uuid, text, uuid, text, jsonb, jsonb) TO authenticated, service_role;

-- ── Re-create the atomic RPCs with audit writes ─────────────────────────────

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

  PERFORM public.write_financial_audit(
    v_tx.user_id, 'transaction', v_tx.id, 'create', NULL, to_jsonb(v_tx)
  );

  RETURN v_tx;
END;
$$;

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

  PERFORM public.write_financial_audit(
    v_old.user_id, 'transaction', v_old.id, 'delete', to_jsonb(v_old), NULL
  );

  RETURN v_old;
END;
$$;

COMMIT;
