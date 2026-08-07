-- ============================================================================
-- Record WHEN a bank balance was true, so an old statement cannot overwrite a
-- newer figure
-- ============================================================================
-- IMPORTANT: apply with `npm run db:migrate` (see supabase/migrations/README.md
-- rule 1 — never the SQL editor). One nullable column is added and nothing else
-- changes: no data is written, no function is redefined, no grant is altered.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────
-- accounts.bank_balance is the reconciliation reference — what the bank says
-- the account holds, which the app compares its own cleared ledger against.
-- Until now only the bank feed ever set it, so anyone importing a statement by
-- hand met "Bank Balance N/A" and "Difference N/A", and finalising a
-- reconciliation proved nothing. A manually imported statement states its own
-- closing balance, and is about to start populating this field.
--
-- That immediately raises the question this column answers: statements are
-- imported out of order. Someone catching up on a year of paperwork will open
-- March before they open November. The March figure is not wrong — it is just
-- old — and writing it over November's would show a reconciliation difference
-- of eight months' spending, which is a worse lie than no figure at all.
--
-- bank_balance alone cannot tell the two apart, because it carries no date.
-- updated_at cannot stand in for one: it moves whenever ANY column on the row
-- changes — a rename, a threshold, an archive cutoff — so it dates the row,
-- not the balance. Hence a column that dates only the balance.
--
-- A DATE, not a timestamp, because that is what the fact is: a statement's
-- closing balance belongs to a calendar day, not to an instant in some
-- timezone. Comparing two of them is then exact in every zone.
--
-- ── WHAT DOES NOT CHANGE ────────────────────────────────────────────────────
-- Every existing row. The column is nullable and is NOT backfilled, because
-- there is no honest value to backfill it with: nothing recorded when the
-- balances already in the table were reported, and inventing a date (from
-- updated_at, say) would be a guess that the staleness check would then treat
-- as a fact and use to REFUSE a genuinely newer statement. NULL means exactly
-- what it should mean here — "we do not know when this figure was true" — and
-- the importer treats an undatable balance as safe to replace. The first bank
-- sync or statement import after this migration dates it properly.
--
-- No constraint ties the two columns together. A CHECK requiring the date
-- whenever bank_balance is present would reject every legacy row on its next
-- unrelated update, and there is nothing to gain: the readers already handle
-- a missing date, and a date with no balance is harmless.
--
-- ── BALANCE REASONING ───────────────────────────────────────────────────────
-- Balance-neutral, and structurally so. This adds a column that describes
-- bank_balance and touches no amount at all. Nothing here reads or writes
-- accounts.balance, accounts.initial_balance or transactions.amount, so the
-- ledger invariant (balance = initial_balance + Σ transactions) is untouched
-- and every reported figure is identical before and after.
--
-- The reason that matters beyond this file: bank_balance is a REFERENCE the
-- app compares against and never adds to. That is the whole safety argument
-- for letting a file write it — the worst a wrong bank_balance can do is show
-- a visible Difference on the reconciliation screen, whereas a wrong `balance`
-- would silently change what the user believes they have. Writers of this
-- column must set bank_balance (and now bank_balance_date) and NOTHING else;
-- see api/banking/sync-accounts.ts, which has kept that rule since audit
-- finding #12.
-- ============================================================================

BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS bank_balance_date DATE;

COMMENT ON COLUMN public.accounts.bank_balance_date IS
  'The calendar day accounts.bank_balance is true for: a bank feed''s sync day, or an imported statement''s closing date (OFX <LEDGERBAL><DTASOF>). NULL means the date was never recorded, which importers treat as safe to replace. Not updated_at — that moves on any change to the row.';

COMMIT;

-- ==== VERIFICATION — read this output after applying ====

-- 1. The column exists, is a DATE, and is nullable.
-- Expected: one row — bank_balance_date | date | YES | (no default)
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'accounts'
   AND column_name = 'bank_balance_date';

-- 2. Nothing was backfilled: every account that had a bank balance still has
--    exactly the same one, and none of them has acquired a date.
-- Expected: dated_balances = 0, and with_bank_balance unchanged from before.
SELECT count(*) FILTER (WHERE bank_balance IS NOT NULL) AS with_bank_balance,
       count(*) FILTER (WHERE bank_balance_date IS NOT NULL) AS dated_balances
  FROM public.accounts;

-- 3. The ledger is untouched — no account's balance drifted from
--    initial_balance + Σ its transactions.
-- Expected: 0 rows.
SELECT a.id, a.name, a.balance, a.initial_balance, COALESCE(t.total, 0) AS txn_total
  FROM public.accounts a
  LEFT JOIN (
    SELECT account_id, sum(amount) AS total
      FROM public.transactions
     GROUP BY account_id
  ) t ON t.account_id = a.id
 WHERE a.balance IS DISTINCT FROM (COALESCE(a.initial_balance, 0) + COALESCE(t.total, 0));
