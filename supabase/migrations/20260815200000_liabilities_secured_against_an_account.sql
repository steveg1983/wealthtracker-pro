-- ============================================================================
-- Secured liabilities — say WHAT a debt is held against, without moving it.
--
-- A mortgage is held against a property. A loan is held against an investment
-- portfolio. Today the app can record both accounts and cannot record the
-- relationship, so the two numbers sit in different sections of the Accounts
-- page with nothing joining them and the owner has to hold the pairing in his
-- head.
--
-- ─ WHY THIS IS NOT parent_account_id ────────────────────────────────────────
--
-- 20260722090000 added `parent_account_id` for the Microsoft Money investment
-- cash pairing, and that column means something this one must NOT mean:
-- "belongs inside, and COUNTS TOWARD". A cash sleeve genuinely is part of its
-- portfolio, so it moves into the parent's card and into the parent's total.
--
-- A secured liability is the opposite on both points:
--
--   · it does NOT move. A mortgage stays in Liabilities where the owner
--     expects to find his debts; being secured against a house does not stop
--     it being a debt.
--   · it does NOT count. Adding it to the property's total would silently
--     restate the value of the house as its equity, which is a different
--     number that nobody asked for.
--
-- Two behaviours that opposite could be squeezed into one column by branching
-- on account type at every read. They are not, because every one of those
-- branches would be a place to forget: the nesting utilities, the band totals,
-- the portfolio summary and the backup remap all consume `parent_account_id`
-- and all of them are RIGHT to nest and count. A separate column is a separate
-- meaning, and the code that ignores it does so by construction rather than by
-- remembering to check.
--
-- ─ WHAT READS IT ────────────────────────────────────────────────────────────
--
-- Display, and one opt-in total. The Accounts page prints the liability under
-- the account it is secured against, marked as information only. The
-- Investments page offers a NET position — portfolio value less the
-- liabilities secured against those portfolios — with GROSS remaining the
-- default, because gross is what the page has always shown and a total that
-- changes meaning without being asked is worse than one that is merely
-- incomplete.
--
-- Net worth is untouched in both cases: it already counts the asset and the
-- debt separately and correctly, and always did.
--
-- ON DELETE SET NULL, as with the pairing above: if the property is deleted
-- the mortgage becomes an ordinary unsecured liability rather than blocking
-- the delete or vanishing with it.
-- ============================================================================

BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS secured_against_account_id uuid
    REFERENCES public.accounts(id) ON DELETE SET NULL;

-- An account cannot be secured against itself.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_secured_against_not_self'
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_secured_against_not_self
      CHECK (secured_against_account_id IS NULL OR secured_against_account_id <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_accounts_secured_against_account_id
  ON public.accounts (secured_against_account_id)
  WHERE secured_against_account_id IS NOT NULL;

COMMENT ON COLUMN public.accounts.secured_against_account_id IS
  'The account this liability is held against (mortgage → property, loan → '
  'portfolio). DISPLAY AND OPT-IN TOTALS ONLY: unlike parent_account_id the '
  'row does not move section and is never added to the target''s total.';

COMMIT;
