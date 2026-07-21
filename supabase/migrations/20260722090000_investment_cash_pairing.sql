-- ============================================================================
-- Investment cash pairing — nest an investment account's cash side inside it.
--
-- The Microsoft Money model: every investment account has a linked "(Cash)"
-- account (ACCT.hacctRel) that holds the money side — transfers land there,
-- share purchases spend from it. In Money the pair displays as ONE account;
-- listing the cash side as a free-standing current account (as the first
-- import did) is wrong.
--
-- accounts.parent_account_id records the pairing: set on the CASH account,
-- pointing at its investment account. NULL = a normal top-level account.
-- The cash account remains a full, real account — its own register, its own
-- transfers, its own reconciliation — only its PLACEMENT changes: the
-- Accounts page shows it nested inside its parent, and its balance counts
-- toward the parent's section total instead of Current Accounts.
--
-- ON DELETE SET NULL: if the investment account ever goes away, the cash
-- account gracefully becomes top-level rather than blocking the delete.
-- ============================================================================

BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS parent_account_id uuid
    REFERENCES public.accounts(id) ON DELETE SET NULL;

-- An account can never be its own parent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_parent_not_self'
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_parent_not_self
      CHECK (parent_account_id IS NULL OR parent_account_id <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_accounts_parent_account_id
  ON public.accounts (parent_account_id)
  WHERE parent_account_id IS NOT NULL;

COMMIT;
