-- Reconciliation: carry is_cleared through the atomic transaction RPCs.
--
-- IMPORTANT: Run this SQL in the Supabase SQL Editor to apply to production DB.
--
-- Why: the atomic RPCs replaced direct table updates (20260610140000), but the
-- current definitions (audit-logging versions from 20260610150000, user-scope
-- update from 20260612110000) never handled the is_cleared column added in
-- 20260310. Result: the reconciliation page's cleared checkbox silently did
-- nothing (the RPC "succeeded" without touching is_cleared), and adjustment
-- transactions created as cleared landed uncleared, so a reconciliation
-- difference could never reach zero.
--
-- These definitions are copied from the LATEST live versions — including the
-- write_financial_audit calls added in 20260610150000 — with is_cleared added.
-- Do NOT base future recreations on 20260610140000; that version predates the
-- audit trail.
--
-- Changes:
--   1. update_transaction_atomic: honour p->>'is_cleared' (keeps user scope + audit)
--   2. create_transaction_atomic: insert is_cleared, default false (keeps audit)
--   3. NEW set_transactions_cleared: bulk set is_cleared for a list of ids in
--      one round trip ("mark all as cleared"), audit-logging each real change.
--      is_cleared never affects account balances, so no balance arithmetic.

BEGIN;

-- ── UPDATE (from 20260612110000: user scope + audit; + is_cleared) ──────────
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
    is_cleared          = COALESCE((p->>'is_cleared')::boolean, is_cleared),
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

  PERFORM public.write_financial_audit(
    v_new.user_id, 'transaction', v_new.id, 'update', to_jsonb(v_old), to_jsonb(v_new)
  );

  RETURN v_new;
END;
$$;

-- ── CREATE (from 20260610150000: audit; + is_cleared) ───────────────────────
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
    COALESCE((p->>'is_cleared')::boolean, false),
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

-- ── BULK CLEAR (new) ────────────────────────────────────────────────────────
-- Marks a set of transactions cleared/uncleared in one round trip. SECURITY
-- INVOKER, so RLS scopes authenticated callers to their own rows; p_user_id is
-- the same defence-in-depth guard the other RPCs take for service-role callers.
-- Rows already in the requested state are skipped (no write, no audit noise).
-- Each real change gets its own financial_audit_log entry, consistent with the
-- per-transaction audit trail of the other RPCs.
CREATE OR REPLACE FUNCTION public.set_transactions_cleared(
  p_ids uuid[],
  p_cleared boolean,
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
       AND is_cleared IS DISTINCT FROM p_cleared
     FOR UPDATE
  LOOP
    UPDATE public.transactions
       SET is_cleared = p_cleared,
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

-- ── BANK IMPORT (from 20260613090000; + is_cleared = true) ──────────────────
-- Bank-imported transactions ARE the bank statement — they arrive settled, so
-- they land cleared (Microsoft Money's "E — electronically cleared" state).
-- Without this, every sync re-opens a reconciliation difference equal to the
-- imported sum, inviting bogus adjustment transactions. Manual entries still
-- start uncleared. Only change vs 20260613090000: is_cleared true on INSERT.
CREATE OR REPLACE FUNCTION public.import_bank_transactions_atomic(
  p_user_id uuid,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  v_tx public.transactions;
  v_acct uuid;
  v_acct_key text;
  v_is_backfill boolean;
  v_backfills jsonb := '{}'::jsonb;   -- account_id -> backfill? (decided BEFORE its first insert)
  v_sums jsonb := '{}'::jsonb;        -- account_id -> Σ(inserted amounts)
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_sum numeric;
  v_before public.accounts;
  v_after public.accounts;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a jsonb array' USING ERRCODE = '22023';
  END IF;

  FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF (r->>'user_id')::uuid IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'row user_id does not match p_user_id' USING ERRCODE = '28000';
    END IF;

    v_acct := (r->>'account_id')::uuid;
    v_acct_key := v_acct::text;

    -- Backfill detection MUST precede the account's first insert of this call:
    -- "no previously imported bank transaction exists for this account".
    IF NOT v_backfills ? v_acct_key THEN
      SELECT NOT EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.account_id = v_acct
          AND t.external_transaction_id IS NOT NULL
      ) INTO v_is_backfill;
      v_backfills := v_backfills || jsonb_build_object(v_acct_key, v_is_backfill);
    END IF;

    -- Account-scoped dedupe (handler pre-filters per connection; this also
    -- catches re-imports after a reconnect under a new connection_id).
    IF EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.account_id = v_acct
        AND t.external_transaction_id = r->>'external_transaction_id'
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_tx := NULL;
    INSERT INTO public.transactions (
      user_id, account_id, connection_id, external_transaction_id,
      external_provider, description, amount, type, date, metadata, is_cleared
    )
    VALUES (
      p_user_id,
      v_acct,
      NULLIF(r->>'connection_id', '')::uuid,
      r->>'external_transaction_id',
      r->>'external_provider',
      r->>'description',
      (r->>'amount')::numeric,
      r->>'type',
      (r->>'date')::date,
      COALESCE(r->'metadata', 'null'::jsonb),
      true
    )
    ON CONFLICT (connection_id, external_transaction_id)
      WHERE external_transaction_id IS NOT NULL
      DO NOTHING
    RETURNING * INTO v_tx;

    IF v_tx.id IS NULL THEN
      v_skipped := v_skipped + 1;  -- lost a concurrent race; row already exists
      CONTINUE;
    END IF;

    PERFORM public.write_financial_audit(
      p_user_id, 'transaction', v_tx.id, 'create', NULL, to_jsonb(v_tx)
    );

    v_sums := jsonb_set(
      v_sums,
      ARRAY[v_acct_key],
      to_jsonb(COALESCE((v_sums->>v_acct_key)::numeric, 0) + v_tx.amount)
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  -- Apply the per-account balance effect, audited, inside the same transaction.
  FOR v_acct_key, v_sum IN
    SELECT key, value::numeric FROM jsonb_each_text(v_sums)
  LOOP
    SELECT * INTO v_before
      FROM public.accounts
     WHERE id = v_acct_key::uuid AND user_id = p_user_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001';
    END IF;

    IF (v_backfills->>v_acct_key)::boolean THEN
      -- Backfill: history already embodied in the snapshot balance.
      UPDATE public.accounts
         SET initial_balance = COALESCE(initial_balance, 0) - v_sum,
             updated_at = now()
       WHERE id = v_acct_key::uuid AND user_id = p_user_id
       RETURNING * INTO v_after;
    ELSE
      -- Incremental: new money movement adjusts the ledger balance.
      UPDATE public.accounts
         SET balance = balance + v_sum,
             updated_at = now()
       WHERE id = v_acct_key::uuid AND user_id = p_user_id
       RETURNING * INTO v_after;
    END IF;

    PERFORM public.write_financial_audit(
      p_user_id, 'account', v_acct_key::uuid, 'update',
      to_jsonb(v_before), to_jsonb(v_after)
    );
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped);
END;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.set_transactions_cleared(uuid[], boolean, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_transactions_cleared(uuid[], boolean, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.import_bank_transactions_atomic(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_bank_transactions_atomic(uuid, jsonb) TO service_role;

COMMIT;
