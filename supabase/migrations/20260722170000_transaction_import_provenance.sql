-- ============================================================================
-- Import provenance for transactions — makes file imports IDEMPOTENT.
--
-- WHY
-- ---
-- The MS Money importer mints a stable per-source id for every row it emits
-- (`mny-txn-<htrn>`, straight from Money's own TRN primary key), but nothing
-- persisted it: every insert used a fresh UUID, so the database had no way to
-- know it had seen a row before. Re-running an import therefore inserted a
-- second copy of everything, and no constraint stood in the way.
--
-- WHY NOT `external_transaction_id`
-- ---------------------------------
-- That column is NOT free. It is the BANK FEED's provenance (TrueLayer /
-- open banking), and three things already depend on that meaning:
--   * `idx_transactions_connection_external` — the partial unique index on
--     (connection_id, external_transaction_id);
--   * `import_bank_transactions_atomic`'s account-scoped dedupe, which skips a
--     row when any transaction in the account already carries the same
--     external_transaction_id;
--   * the same function's BACKFILL detection, which asks "does this account
--     have ANY transaction with a non-null external_transaction_id yet?" to
--     decide whether to rebase `initial_balance` instead of `balance`.
-- Writing file-import ids into that column would corrupt all three: imported
-- history would masquerade as bank-fed rows and silently suppress the first
-- real bank sync's backfill rebase. File imports get their own columns.
--
-- WHAT
-- ----
--   import_source     — which importer wrote the row ('ms-money', …). NULL for
--                       rows the user typed in and for bank-fed rows.
--   import_source_id  — the importer's stable id for the source record
--                       (e.g. 'mny-txn-50264'). Unique per user per source.
--
-- The unique index is deliberately NOT partial: a partial index cannot be
-- inferred by `INSERT … ON CONFLICT (cols)` unless the statement repeats the
-- predicate, which PostgREST cannot express. Non-partial is safe here because
-- Postgres treats NULLs as distinct, so the millions of rows with NULL
-- provenance never collide with each other.
--
-- Applying this migration changes NO existing row. Legacy rows keep NULL
-- provenance; only newly imported rows are keyed.
-- ============================================================================

BEGIN;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS import_source text,
  ADD COLUMN IF NOT EXISTS import_source_id text;

-- Both or neither — a source id with no source is unattributable, and a source
-- with no id cannot be deduped.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.transactions'::regclass
       AND conname = 'transactions_import_provenance_complete'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_import_provenance_complete
      CHECK ((import_source IS NULL) = (import_source_id IS NULL));
  END IF;
END $$;

-- The database itself now refuses a duplicate import row.
CREATE UNIQUE INDEX IF NOT EXISTS transactions_import_source_unique
  ON public.transactions (user_id, import_source, import_source_id);

COMMENT ON COLUMN public.transactions.import_source IS
  'File-import provenance: which importer created this row (e.g. ''ms-money''). NULL for hand-entered and bank-fed rows. NOT the bank feed — that is external_provider/external_transaction_id.';
COMMENT ON COLUMN public.transactions.import_source_id IS
  'File-import provenance: the importer''s stable id for the source record (e.g. ''mny-txn-50264'', derived from Money''s TRN.htrn). Unique per (user_id, import_source) so a re-import updates/skips instead of duplicating.';

COMMIT;
