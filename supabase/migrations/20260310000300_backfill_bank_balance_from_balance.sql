-- Backfill bank_balance from existing accounts.balance for accounts
-- that have a linked_accounts entry (i.e. connected via Open Banking).
-- This ensures bank_balance is populated even if no sync has run since
-- the bank_balance column was added.

UPDATE accounts a
SET bank_balance = a.balance
WHERE a.bank_balance IS NULL
  AND EXISTS (
    SELECT 1 FROM linked_accounts la
    WHERE la.account_id = a.id
  );
