-- Add reconciliation columns for Microsoft Money-style reconciliation system
-- Generated: 2026-03-10
--
-- IMPORTANT: Run this SQL in the Supabase SQL Editor to apply to production DB.
--
-- Changes:
--   transactions: add is_cleared BOOLEAN (reconciliation status per transaction)
--   accounts: add bank_balance NUMERIC(20,2) (bank's reported balance, reconciliation target)
--   accounts: add last_reconciled_date DATE (when account was last reconciled)
--   Index on (account_id, is_cleared) for efficient uncleared queries

-- Reconciliation status on transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_cleared BOOLEAN NOT NULL DEFAULT FALSE;

-- Bank balance and reconciliation date on accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS bank_balance NUMERIC(20,2);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_reconciled_date DATE;

-- Index for efficient uncleared queries (partial index on uncleared only)
CREATE INDEX IF NOT EXISTS idx_transactions_account_cleared
  ON transactions(account_id, is_cleared) WHERE is_cleared = FALSE;
