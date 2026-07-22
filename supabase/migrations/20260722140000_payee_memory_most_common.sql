-- ============================================================================
-- Payee memory: prefer the category a payee is MOST COMMONLY filed under,
-- not merely the most recent one.
--
-- The original rule (ORDER BY date DESC LIMIT 1) is right for a payee whose
-- meaning genuinely changes, but it flip-flops on mixed payees: file one
-- Amazon order as Household : Repairs and every subsequent Amazon import
-- inherits Repairs, however many dozens of Consumables rows preceded it.
--
-- New rule: most-used category for that payee + direction wins; the most
-- recent use breaks ties. So a habit holds, a genuine change still takes
-- over once it becomes the habit, and a single accident no longer
-- redirects the future. The user's own explicit choices are still never
-- overwritten — this only ever fills a blank.
--
-- Scope note: this is the same rule the in-app bulk "Categorise by payee"
-- tool uses (utils/payeeGroups), so the server and the client agree.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.payee_memory_category(
  p_account_id uuid,
  p_description text,
  p_type text
) RETURNS text
    LANGUAGE sql
    STABLE
    SECURITY INVOKER
    SET search_path = public
AS $$
  SELECT t.category
    FROM public.transactions t
   WHERE t.account_id = p_account_id
     AND upper(btrim(t.description)) = upper(btrim(p_description))
     AND t.type = p_type
     AND t.type <> 'transfer'
     AND t.category IS NOT NULL AND btrim(t.category) <> ''
     AND t.category NOT IN ('transfer-in', 'transfer-out')
   GROUP BY t.category
   ORDER BY COUNT(*) DESC, MAX(t.date) DESC, MAX(t.created_at) DESC
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.payee_memory_category(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.payee_memory_category(uuid, text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.payee_memory_category(uuid, text, text) IS
  'Payee memory: the category most often used for this payee+direction in this account (ties → most recent). Used by bank-feed import prefill.';

-- ── Re-declare the bank import RPC to use the helper ───────────────────────
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

    -- Payee memory: inherit the category this payee is MOST OFTEN filed
    -- under in this account, for the same direction (an expense never
    -- inherits an income category). Most-recent used to win, which let a
    -- single one-off redirect every future import of that payee.
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
      -- Most-USED category for this payee+direction (ties → most recent),
      -- via the shared helper so the server and the in-app bulk tool agree.
      v_category := public.payee_memory_category(
        v_acct, r->>'description', r->>'type'
      );
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

COMMIT;
