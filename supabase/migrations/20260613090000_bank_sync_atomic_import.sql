-- Bank-sync atomicity + balance authority model
-- (AUDIT_2026-06-12_DEEP_REAUDIT.md findings #2, #12, #13)
--
-- ── THE INVARIANT (documented per finding #12) ─────────────────────────────
--
--   accounts.balance       = accounts.initial_balance + Σ(transactions.amount)
--   accounts.bank_balance  = the bank's most recently reported figure
--
-- `balance` is LEDGER-AUTHORITATIVE for every account, bank-linked or not:
-- it only moves when a transaction row moves it (via an atomic, audited RPC).
-- `bank_balance` is the reconciliation reference — link/sync write the bank's
-- number HERE, never to `balance`. Divergence between the two is signal
-- (pending transactions, manual entries), not something to silently overwrite,
-- which is what sync-accounts/link-accounts previously did — discarding any
-- manual delta on every sync (the #12 dual-source-of-truth bug).
--
-- Two rebase moments keep the invariant while matching bank reality:
--
--   1. LINK SNAP (link_bank_account_snap): when an existing account is linked,
--      snap `balance` to the bank's figure and shift `initial_balance` by the
--      same delta, so the invariant holds through the snap. Audited.
--   2. BACKFILL REBASE (inside import_bank_transactions_atomic): an account's
--      FIRST imported bank transactions are history that the link-time balance
--      snapshot already embodies. Bumping `balance` for them would double-count,
--      so the backfill adjusts `initial_balance -= Σ(backfill)` instead —
--      `balance` is unchanged and the invariant holds:
--      (bank − Σh) + Σh = bank. Later incremental imports bump `balance`
--      normally. Audited.
--
-- Both functions are SERVER-ONLY (service_role): the banking API handlers are
-- the sole callers. EXECUTE is revoked from PUBLIC/anon/authenticated.

-- ── Bulk atomic import ───────────────────────────────────────────────────────
-- One call = one database transaction: inserts + balance/initial_balance
-- effects + audit rows all commit or none do (finding #2/#13).
--
-- p_user_id scopes every effect (defence in depth — rows whose user_id differs
-- are rejected). Dedupe is ACCOUNT-scoped on external_transaction_id (stronger
-- than the connection-scoped unique index: it survives disconnect/reconnect,
-- where a new connection_id would otherwise re-import the same provider
-- transactions). The partial unique index still backstops races.

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
      external_provider, description, amount, type, date, metadata
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
      COALESCE(r->'metadata', 'null'::jsonb)
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

REVOKE ALL ON FUNCTION public.import_bank_transactions_atomic(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_bank_transactions_atomic(uuid, jsonb) TO service_role;

-- ── Link-time snap ───────────────────────────────────────────────────────────
-- Snap an account to the bank's reported balance WITHOUT breaking the ledger
-- invariant: shift initial_balance by the same delta as balance. Replaces
-- link-accounts' raw `balance := bank` overwrite (finding #12). Audited.

CREATE OR REPLACE FUNCTION public.link_bank_account_snap(
  p_account_id uuid,
  p_user_id uuid,
  p_bank_balance numeric
)
RETURNS public.accounts
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_before public.accounts;
  v_after public.accounts;
BEGIN
  SELECT * INTO v_before
    FROM public.accounts
   WHERE id = p_account_id AND user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found_or_not_owned' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.accounts
     SET initial_balance = COALESCE(initial_balance, 0) + (p_bank_balance - balance),
         balance = p_bank_balance,
         bank_balance = p_bank_balance,
         updated_at = now()
   WHERE id = p_account_id AND user_id = p_user_id
   RETURNING * INTO v_after;

  PERFORM public.write_financial_audit(
    p_user_id, 'account', p_account_id, 'update',
    to_jsonb(v_before), to_jsonb(v_after)
  );

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.link_bank_account_snap(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_bank_account_snap(uuid, uuid, numeric) TO service_role;
