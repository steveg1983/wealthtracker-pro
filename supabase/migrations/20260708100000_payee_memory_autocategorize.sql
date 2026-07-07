-- Payee-memory auto-categorization (the Microsoft Money model).
--
-- IMPORTANT: Run this SQL in the Supabase SQL Editor to apply to production DB.
-- Safe to apply before the matching code deploys: the import change only
-- pre-fills a column old clients already read, and the new RPC is unused
-- until the client ships.
--
-- 1. import_bank_transactions_atomic: newly imported bank transactions inherit
--    the category of the most recent categorized transaction in the SAME
--    account with the SAME normalized description ("payee memory" — Money
--    pre-filled downloaded transactions from payee history the same way).
--    Recreated from 20260707120000 (is_cleared=true + audit); the only changes
--    are the category lookup and its supporting index.
-- 2. NEW apply_category_to_uncategorized: bulk-categorize a list of ids in one
--    round trip (used when categorizing one transaction propagates to
--    same-payee uncategorized ones), audit-logging each change. Fill-blanks
--    only — rows that already carry a category are never touched, enforced
--    server-side so stale client snapshots cannot overwrite explicit choices.

BEGIN;

-- Fast lookup for "latest categorized transaction with this description in
-- this account". Partial: only categorized rows participate.
CREATE INDEX IF NOT EXISTS idx_transactions_account_desc_categorized
  ON public.transactions (account_id, upper(btrim(description)), date DESC)
  WHERE category IS NOT NULL AND btrim(category) <> '';

-- ── BANK IMPORT (from 20260707120000; + payee-memory category prefill) ──────
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
  v_category text;
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

    -- Payee memory: inherit the category of the most recent categorized
    -- transaction in this account with the same normalized description AND
    -- the same direction (an expense never inherits an income category).
    -- Transfer rows and the transfer system categories are excluded — a
    -- reclassified standing order must not stamp 'transfer-out' onto next
    -- month's plain import. The handler's 'Bank transaction' fallback for
    -- description-less rows is a sentinel, not a payee — matching on it
    -- would fuse unrelated merchants into one mega-payee, so it never
    -- participates. Rows inserted earlier in this same batch participate,
    -- so a categorized payee cascades through the whole import.
    v_category := NULLIF(btrim(COALESCE(r->>'category', '')), '');
    IF v_category IS NULL
       AND upper(btrim(COALESCE(r->>'description', ''))) <> 'BANK TRANSACTION' THEN
      SELECT t.category INTO v_category
        FROM public.transactions t
       WHERE t.account_id = v_acct
         AND upper(btrim(t.description)) = upper(btrim(r->>'description'))
         AND t.type = r->>'type'
         AND t.type <> 'transfer'
         AND t.category IS NOT NULL AND btrim(t.category) <> ''
         AND t.category NOT IN ('transfer-in', 'transfer-out')
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT 1;
    END IF;

    v_tx := NULL;
    INSERT INTO public.transactions (
      user_id, account_id, connection_id, external_transaction_id,
      external_provider, description, amount, type, date, metadata,
      is_cleared, category
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
      true,
      v_category
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

-- ── BULK CATEGORIZE UNCATEGORIZED (new) ─────────────────────────────────────
-- Applies a category to the listed transactions that are STILL uncategorized,
-- in one statement. The fill-blanks guard is enforced HERE, not just in the
-- client: the client computes its target list from a snapshot that can be
-- stale (backgrounded tab, second device), and without the guard a race could
-- silently overwrite a category the user set elsewhere — the one thing this
-- feature promises never to do. SECURITY INVOKER, so RLS scopes authenticated
-- callers to their own rows; p_user_id is the usual defence-in-depth guard.
-- Category is balance-neutral, so no balance arithmetic is involved.
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
     FOR UPDATE
  LOOP
    UPDATE public.transactions
       SET category = p_category,
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

-- ── Grants ──────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.apply_category_to_uncategorized(uuid[], text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_category_to_uncategorized(uuid[], text, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.import_bank_transactions_atomic(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_bank_transactions_atomic(uuid, jsonb) TO service_role;

COMMIT;
