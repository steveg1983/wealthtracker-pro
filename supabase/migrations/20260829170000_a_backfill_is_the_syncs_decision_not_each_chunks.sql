-- ============================================================================
-- A BACKFILL IS THE SYNC'S DECISION, NOT EACH CHUNK'S
-- ============================================================================
--
-- ── THE BUG ─────────────────────────────────────────────────────────────────
-- `api/banking/sync-transactions.ts` splits an import into calls of 200 rows.
-- `import_bank_transactions_atomic` decides backfill-vs-incremental by asking
-- the table — "does this account hold any feed row yet?" — once per CALL.
-- Those two facts compose into a drift on any FIRST sync larger than one
-- chunk: chunk 1 correctly rebases (`initial_balance -= sum`, displayed
-- balance untouched, because the provider's snapshot already embodies the
-- history), then chunk 1's own rows make the account "already fed", so chunks
-- 2..n take the incremental arm (`balance += sum`) — for history that the
-- snapshot ALSO embodies. The displayed balance ends wrong by the sum of every
-- chunk after the first. B-1 (`balance = initial_balance + Σ(amount)`) holds
-- throughout, which is what made this silent: the arithmetic is
-- self-consistent, and only a comparison against the bank's own figure shows
-- the drift.
--
-- ── THE FIX ─────────────────────────────────────────────────────────────────
-- The only place that sees the whole sync is the caller. The handler now asks
-- the table's question ONCE per account, before any chunk is sent, and stamps
-- every row it submits with the verdict as a `backfill` boolean. This
-- function honours a stamp over its own per-call look at the table, refuses a
-- stamp that is not a boolean (`backfill_stamp_not_boolean` — a jsonb null
-- would cast to SQL NULL and fall silently into the incremental arm), and
-- refuses a stamp that contradicts the arm already chosen for that account in
-- this call (`backfill_stamp_conflict` — a batch split across both arms is
-- the bug itself, surfacing loudly instead of landing quietly). Unstamped
-- rows behave exactly as before: the table decides, once per call per
-- account. The differential lane pins both readings — see
-- scripts/local-sqlite/verb-specs/feed-a-caller-stamp-outranks-the-accounts-own-history.spec.mjs
-- and its two siblings — and the Rust port learns the field in the same
-- commit, because a stamped payload a local ledger refused by name would be a
-- divergence nobody declared.
--
-- ── WHAT THIS RESTATES, AND FROM WHERE ──────────────────────────────────────
-- The function body below is the 20260829120000 text — extracted verbatim
-- from that file (lines 298-479), patched ONLY inside the backfill decision
-- block, with the diff printed and reviewed before this file was written. Per
-- the rule this repo paid for twice in one week: never retype a financial
-- function, and patch the LATEST definition, found by searching every
-- migration — `src/test/feedImportLatestDefinition.test.ts` resolves the
-- winner the way Postgres does and now also pins the stamp semantics added
-- here.
--
-- No data repair rides along. The damage this bug causes is a balance drift
-- on large first syncs, which cannot be reconstructed from the rows alone
-- (chunk boundaries are not recorded); detecting any historical drift is a
-- read-only comparison against provider snapshots, done outside a migration.

BEGIN;

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
  -- Did the category below come from the ROW (the provider stated it, or the
  -- caller did) or from payee memory (the app guessed it)? Only the second is a
  -- suggestion.
  v_category_confirmed boolean;
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
    --
    -- A row may carry the caller's own verdict as `backfill` (20260829170000).
    -- The caller saw the WHOLE sync; this call sees one chunk of it. The
    -- handler splits large payloads at 200 rows per call, so a 469-row first
    -- sync arrives as three calls: the table's answer is right for the first
    -- and wrong for the other two — their rows are equally embodied in the
    -- provider's snapshot balance, but by then the account has feed history
    -- and the self-decide arm reads INCREMENTAL, drifting the balance by
    -- those chunks' sum. A stamp therefore outranks the table; the table
    -- remains the answer for any caller that does not stamp (older deploys,
    -- single-call imports, the differential specs).
    IF r ? 'backfill' AND jsonb_typeof(r->'backfill') <> 'boolean' THEN
      -- A null or string stamp is not a decision. jsonb null would cast to
      -- SQL NULL and fall silently into the incremental arm — the exact
      -- quiet wrongness this migration exists to end.
      RAISE EXCEPTION 'backfill_stamp_not_boolean' USING ERRCODE = '22023';
    END IF;
    IF NOT v_backfills ? v_acct_key THEN
      IF r ? 'backfill' THEN
        v_is_backfill := (r->>'backfill')::boolean;
      ELSE
        SELECT NOT EXISTS (
          SELECT 1 FROM public.transactions t
          WHERE t.account_id = v_acct
            AND t.external_transaction_id IS NOT NULL
        ) INTO v_is_backfill;
      END IF;
      v_backfills := v_backfills || jsonb_build_object(v_acct_key, v_is_backfill);
    ELSIF r ? 'backfill'
      AND (r->>'backfill')::boolean IS DISTINCT FROM (v_backfills->>v_acct_key)::boolean THEN
      -- Two rows of one account disagreeing about which arm the balance takes
      -- is not a tie to break — one arm has already been chosen for this call.
      -- Refuse the whole call rather than split one batch across both arms.
      RAISE EXCEPTION 'backfill_stamp_conflict' USING ERRCODE = '22023';
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
    -- A category the row arrived with is not this function's guess, so it is
    -- not marked as one. A row with NO category at the end of this block is
    -- confirmed too: a blank has nothing to vouch for, and marking blanks
    -- unconfirmed would put rows with no category into the "check these
    -- suggestions" list, where there is nothing to look at.
    v_category_confirmed := true;
    IF v_category IS NULL
       AND upper(btrim(COALESCE(r->>'description', ''))) <> 'BANK TRANSACTION' THEN
      -- Most-USED category for this payee+direction (ties → most recent),
      -- via the shared helper so the server and the in-app bulk tool agree.
      v_category := public.payee_memory_category(
        v_acct, r->>'description', r->>'type'
      );
      -- Only if the guess actually produced something. Payee memory returning
      -- nothing leaves the row blank, and a blank is not a suggestion.
      IF v_category IS NOT NULL THEN
        v_category_confirmed := false;
      END IF;
    END IF;

    v_tx := NULL;
    INSERT INTO public.transactions (
      user_id, account_id, connection_id, external_transaction_id,
      external_provider, description, amount, type, date, metadata,
      is_cleared, category, category_confirmed, tags, needs_review
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
      false,  -- is_cleared: the user reconciles, the feed does not
      v_category,
      v_category_confirmed,
      -- Tags a rule attached (20260828180000). Absent means no rule had any
      -- to give, which is the EMPTY ARRAY that migration chose rather than
      -- NULL — kept exactly as it shipped, so a fed row's tags read the same
      -- whether or not a rule touched it.
      CASE WHEN r ? 'tags' AND jsonb_typeof(r->'tags') = 'array'
           THEN ARRAY(SELECT jsonb_array_elements_text(r->'tags'))
           ELSE '{}'::text[]
      END,
      true    -- needs_review: nobody has seen this row; it did not exist until now
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

COMMENT ON FUNCTION public.import_bank_transactions_atomic(uuid, jsonb) IS
  'Atomic bank-feed import. Every row it writes arrives needs_review = true — a transaction the bank has just told us about is new work until somebody saves it, whether or not an import rule filed it, because review is about the row and not the category. Carries category and tags so a ruled row arrives categorised, and falls back to payee memory (marking that guess category_confirmed = false) when no category was stated. A row may stamp the caller''s backfill verdict as a boolean `backfill`, which outranks the per-call look at the table — the caller saw the whole sync, this call sees one chunk — and a stamp that is not boolean or contradicts the arm already chosen refuses the call. Rows, their audit entries and one balance movement per account commit together or not at all.';

COMMIT;

-- ============================================================================
-- Verification — run after applying.
-- ============================================================================

-- 1. Everything the previous definitions paid for survived the restatement,
--    and the stamp semantics arrived.
-- Expected: all nine true
SELECT position('true    -- needs_review' IN pg_get_functiondef(p.oid)) > 0        AS feed_marks_new,
       position('payee_memory_category(' IN pg_get_functiondef(p.oid)) > 0         AS feed_keeps_payee_memory,
       position('v_category_confirmed' IN pg_get_functiondef(p.oid)) > 0           AS feed_keeps_provenance,
       position('false,  -- is_cleared' IN pg_get_functiondef(p.oid)) > 0          AS feed_arrives_unreconciled,
       position('jsonb_array_elements_text(r->''tags'')' IN pg_get_functiondef(p.oid)) > 0 AS feed_keeps_tags,
       position('initial_balance = COALESCE(initial_balance, 0) - v_sum'
                IN pg_get_functiondef(p.oid)) > 0                                  AS feed_keeps_backfill_branch,
       position('r ? ''backfill''' IN pg_get_functiondef(p.oid)) > 0               AS feed_honours_stamp,
       position('backfill_stamp_conflict' IN pg_get_functiondef(p.oid)) > 0        AS feed_refuses_conflict,
       position('backfill_stamp_not_boolean' IN pg_get_functiondef(p.oid)) > 0     AS feed_refuses_non_boolean
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'import_bank_transactions_atomic';

-- 2. The audit calls and the ownership lock survived the restatement.
-- Expected: audit_writes = 2, locks_account = true, checks_ownership = true
SELECT (length(pg_get_functiondef(p.oid))
        - length(replace(pg_get_functiondef(p.oid), 'write_financial_audit', '')))
       / length('write_financial_audit')                                       AS audit_writes,
       position('FOR UPDATE' IN pg_get_functiondef(p.oid)) > 0                 AS locks_account,
       position('account_not_found_or_not_owned' IN pg_get_functiondef(p.oid)) > 0 AS checks_ownership
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'import_bank_transactions_atomic';

-- 3. Security posture unchanged.
-- Expected: prosecdef = false, proconfig = {search_path=public}
SELECT p.proname, p.prosecdef, p.proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'import_bank_transactions_atomic';

-- Expected: service_role ONLY. Never anon, never PUBLIC ('-').
SELECT a.grantee::regrole::text AS grantee, a.privilege_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace,
       aclexplode(p.proacl) a
 WHERE n.nspname = 'public' AND p.proname = 'import_bank_transactions_atomic';
