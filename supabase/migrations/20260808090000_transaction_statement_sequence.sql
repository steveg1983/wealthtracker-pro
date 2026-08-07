-- ============================================================================
-- statement_sequence — keep the bank's own order within a day
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). One new nullable column, and two existing
-- functions redefined to carry it. No data is written, nothing is backfilled,
-- no grants change.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- transactions.date is a DATE. Transactions sharing a day therefore carry no
-- order at all, and the account register has to invent one to run a balance
-- down the page.
--
-- What it invented was income → transfer → expense, on the theory that a day's
-- pay must land before the payments it funds. A real current account disproves
-- it. The account runs an automated two-way sweep with a linked savings
-- account: ordinary transactions happen through the day, then ONE sweep in the
-- evening returns the balance to exactly zero. The shape of such a day, in the
-- bank's own order (figures illustrative):
--
--     DIRECT DEBIT                            -12.75    balance   -12.75
--     STANDING ORDER OUT                     -300.00    balance  -312.75
--     TWO WAY SWEEP IN                       +312.75    balance     0.00
--
-- Two things no type rule can express. The credit comes LAST, after the debits.
-- And the standing order and the sweep are BOTH transfers, with a real order
-- between them. The invented order put the sweep in the middle and showed
-- intermediate balances the account never held — arithmetically self-consistent,
-- and a description of a day that did not happen. On a screen whose whole
-- purpose is agreeing with a bank statement line by line, that is a real
-- shortfall.
--
-- "Transfers last" would be the same mistake in a new coat: a transfer can
-- equally fund a day's spending at its start. There is no rule to be had. The
-- bank knows the order and states it, and OFX lists <STMTTRN> in it — the
-- importer simply threw it away.
--
-- ── WHY NOTHING EXISTING WILL DO ────────────────────────────────────────────
--   * created_at — defaults to now(), which is TRANSACTION start time.
--     import_transactions_atomic writes a whole file inside ONE transaction, so
--     every row of an imported statement shares a created_at; and the OFX modal
--     fires its per-row writes without awaiting them, so even one-at-a-time
--     arrival is a race. Reliable for hand entry, useless within a file.
--   * external_transaction_id — the bank FEED's opaque provider id
--     (TrueLayer/Plaid), never written by file imports, and not an order.
--   * import_source / import_source_id — MS Money re-import provenance.
--   * OFX FITID — reaches free-text `notes` only, and is an opaque id anyway.
--   * id — a random uuid.
--
-- ── WHAT DOES NOT CHANGE ────────────────────────────────────────────────────
-- Every row already in the table. The column is nullable and deliberately NOT
-- backfilled: there is no honest sequence to invent for history, and writing a
-- guess is the exact failure this migration exists to end. NULL means "unknown"
-- and the register treats it as such — see compareChronological in
-- src/utils/transactionSort.ts, where unknown sorts LAST within its day so an
-- imported statement's own run stays contiguous and the day still closes on the
-- account's true balance.
--
-- Also unchanged: both functions keep their signatures, their SECURITY INVOKER,
-- their pinned search_path, their audit writes and their grants. A caller that
-- sends no statement_sequence behaves exactly as before, which is what makes
-- this safe to apply ahead of any application deploy.
--
-- ── BALANCE REASONING ───────────────────────────────────────────────────────
-- Balance-neutral. statement_sequence is a presentation ordinal: no amount,
-- sign, account_id or date is read or written by anything here, and the balance
-- statements inside both functions are byte-for-byte the ones already in place
-- (create_transaction_atomic: balance = balance + v_tx.amount;
-- import_transactions_atomic: one balance = balance + v_sum for the batch). The
-- invariant balance = initial_balance + Σ(amount) is untouched, and the
-- register's running balance still sums the same rows — only the order it walks
-- them in can change, which moves intermediate figures towards the statement
-- and cannot move the total.
--
-- ── ORDINAL, NOT A TIMESTAMP ────────────────────────────────────────────────
-- A statement gives sequence, not clock time. Storing a fabricated time would
-- be the same class of lie as the type order this replaces, and would then be
-- indistinguishable from a real one.
-- ============================================================================

BEGIN;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS statement_sequence integer;

COMMENT ON COLUMN public.transactions.statement_sequence IS
  'Position of this row within the statement/file it was imported from, giving the bank''s own order among transactions that share a date. NULL = unknown (hand-entered, or imported before this column existed); the register sorts unknown last within its day. An ordinal, not a time.';

-- The register reads one account in date order and breaks ties on this, so the
-- index matches that access path exactly. NULLS LAST mirrors the comparator: a
-- row that knows its place sorts ahead of one that does not.
CREATE INDEX IF NOT EXISTS idx_transactions_statement_order
  ON public.transactions (account_id, date, statement_sequence NULLS LAST);

-- ── create_transaction_atomic: carry the ordinal ────────────────────────────
-- Identical to the definition in 20260610150000_financial_audit_log.sql except
-- for the statement_sequence column and its cast. NULLIF so an absent or empty
-- key stays NULL rather than failing the cast.
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
    location_country, payment_channel, statement_sequence
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
    p->>'payment_channel',
    NULLIF(p->>'statement_sequence', '')::integer
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

-- ── import_transactions_atomic: carry the ordinal ───────────────────────────
-- Identical to 20260709120000_import_transactions_atomic.sql except for the
-- statement_sequence column and its cast. This is the path that matters most:
-- it is where a whole statement lands in one transaction, and therefore where
-- created_at can say nothing about order.
CREATE OR REPLACE FUNCTION public.import_transactions_atomic(
  p_user_id uuid,
  p_account_id uuid,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  v_tx public.transactions;
  v_sum numeric := 0;
  v_inserted integer := 0;
  v_before public.accounts;
  v_after public.accounts;
BEGIN
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a jsonb array' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before
    FROM public.accounts
   WHERE id = p_account_id AND user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_not_found_or_not_owned'
      USING ERRCODE = 'P0001',
            HINT = 'The account does not exist or does not belong to this user.';
  END IF;

  FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    INSERT INTO public.transactions (
      user_id, account_id, description, amount, type, date,
      category, notes, tags, is_recurring, is_cleared, statement_sequence
    ) VALUES (
      p_user_id,
      p_account_id,
      r->>'description',
      (r->>'amount')::numeric,
      r->>'type',
      (r->>'date')::date,
      NULLIF(r->>'category', ''),
      NULLIF(r->>'notes', ''),
      CASE WHEN r ? 'tags' AND jsonb_typeof(r->'tags') = 'array'
           THEN ARRAY(SELECT jsonb_array_elements_text(r->'tags'))
           ELSE NULL END,
      COALESCE((r->>'is_recurring')::boolean, false),
      COALESCE((r->>'is_cleared')::boolean, false),
      NULLIF(r->>'statement_sequence', '')::integer
    )
    RETURNING * INTO v_tx;

    PERFORM public.write_financial_audit(
      p_user_id, 'transaction', v_tx.id, 'create', NULL, to_jsonb(v_tx)
    );

    v_sum := v_sum + v_tx.amount;
    v_inserted := v_inserted + 1;
  END LOOP;

  IF v_inserted > 0 THEN
    UPDATE public.accounts
       SET balance = balance + v_sum,
           updated_at = now()
     WHERE id = p_account_id AND user_id = p_user_id
     RETURNING * INTO v_after;

    PERFORM public.write_financial_audit(
      p_user_id, 'account', p_account_id, 'update',
      to_jsonb(v_before), to_jsonb(v_after)
    );
  END IF;

  RETURN jsonb_build_object('inserted', v_inserted);
END;
$$;

COMMIT;

-- ============================================================================
-- Verification — run after applying.
-- ============================================================================

-- 1. The column exists, is nullable, and is an ordinal.
-- Expected: one row, data_type = integer, is_nullable = YES
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'transactions'
   AND column_name = 'statement_sequence';

-- 2. Nothing was backfilled — history is honestly "unknown".
-- Expected: with_sequence = 0 immediately after applying. It rises only as
-- statements are (re-)imported.
SELECT count(*) FILTER (WHERE statement_sequence IS NOT NULL) AS with_sequence,
       count(*) FILTER (WHERE statement_sequence IS NULL)     AS without_sequence
  FROM public.transactions;

-- 3. The index is there for the register's access path.
-- Expected: one row, idx_transactions_statement_order
SELECT indexname
  FROM pg_indexes
 WHERE schemaname = 'public'
   AND tablename = 'transactions'
   AND indexname = 'idx_transactions_statement_order';

-- 4. Both functions are still INVOKER with a pinned search_path — redefining
--    them must not have quietly changed their security posture.
-- Expected: two rows, prosecdef = false, proconfig = {search_path=public}
SELECT p.proname, p.prosecdef, p.proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('create_transaction_atomic', 'import_transactions_atomic')
 ORDER BY p.proname;

-- 5. Grants unchanged: authenticated and service_role only; no anon, no PUBLIC.
SELECT p.proname, a.grantee::regrole::text AS grantee, a.privilege_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 CROSS JOIN LATERAL aclexplode(p.proacl) AS a
 WHERE n.nspname = 'public'
   AND p.proname IN ('create_transaction_atomic', 'import_transactions_atomic')
 ORDER BY p.proname, grantee;

-- 6. Balance invariant still holds for every account: balance must equal
--    initial_balance + Σ(amount). This migration cannot have moved it, and this
--    is the check that proves it.
-- Expected: zero rows
SELECT a.id, a.name, a.balance, a.initial_balance + COALESCE(t.total, 0) AS expected
  FROM public.accounts a
  LEFT JOIN (
    SELECT account_id, sum(amount) AS total
      FROM public.transactions
     GROUP BY account_id
  ) t ON t.account_id = a.id
 WHERE a.balance IS DISTINCT FROM a.initial_balance + COALESCE(t.total, 0);
