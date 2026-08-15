-- ============================================================================
-- One debt, several accounts.
--
-- 20260815200000 gave a liability a single `secured_against_account_id`, on the
-- assumption that a debt is held against one thing. The owner's own case says
-- otherwise: a loan drawn against TWO investment portfolios, which he wants
-- labelled against both without tying the two portfolios to each other.
--
-- Singular → plural, in one step, because the column is days old.
--
-- ─ WHY AN ARRAY AND NOT A JOIN TABLE ────────────────────────────────────────
--
-- A join table is the textbook answer for many-to-many and is the wrong trade
-- here. This relationship is DISPLAY-ONLY — it moves nothing between sections
-- and adds to no total — and it is tiny: a debt is held against one or two
-- things, not fifty.
--
-- Against that, a new table is a new entity in every layer this app carries:
-- the cloud read path, the local SQLite engine, the backup's entity list, its
-- id remap, and the restore's ordering. Each is a place to forget, and the
-- singular column has already proved the point — it shipped with its WRITE
-- mapping missing and broke saving an account entirely.
--
-- An array reuses machinery that already exists and is already tested:
-- `tags` and `suggestion_dismissals.subject_ids` are both text arrays, and the
-- local mapper has a `strings` kind for exactly this.
--
-- ─ WHAT IS GIVEN UP, AND WHY IT IS AFFORDABLE ───────────────────────────────
--
-- Referential integrity. A uuid[] cannot carry a foreign key, so deleting a
-- property leaves its id sitting in some loan's array, where ON DELETE SET
-- NULL used to clean up after itself.
--
-- That is survivable HERE and would not be elsewhere: every reader of this
-- column already resolves ids against the accounts it holds and skips what it
-- cannot find, because it had to — an account may also be closed, or filtered
-- out of the current view, and neither of those is a deletion. A dangling id
-- is therefore invisible rather than wrong. It costs a row in the array that
-- nothing renders.
--
-- The alternative — correctness by constraint — costs a table in five layers
-- to tidy up a value that displays as nothing either way.
-- ============================================================================

BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS secured_against_account_ids uuid[] NOT NULL DEFAULT '{}';

-- Carry over anything already linked through the singular column. Runs before
-- the DROP below and in the same transaction, so no link can be lost between
-- the two — including on a database where 20260815200000 was applied and used.
UPDATE public.accounts
   SET secured_against_account_ids = ARRAY[secured_against_account_id]
 WHERE secured_against_account_id IS NOT NULL
   AND cardinality(secured_against_account_ids) = 0;

ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS secured_against_account_id;

-- GIN, because every question asked of this column is "which rows contain this
-- account id" — the Accounts page keying liabilities by what they are secured
-- against, and the Investments page asking which debts touch a portfolio.
CREATE INDEX IF NOT EXISTS idx_accounts_secured_against_account_ids
  ON public.accounts USING GIN (secured_against_account_ids);

COMMENT ON COLUMN public.accounts.secured_against_account_ids IS
  'The accounts this liability is held against (mortgage → property, loan → '
  'one or more portfolios). DISPLAY AND OPT-IN TOTALS ONLY: unlike '
  'parent_account_id the row does not move section and is never added to a '
  'target''s total. No FK — readers resolve against loaded accounts and skip '
  'what they cannot find, which they must do for closed accounts anyway.';

COMMIT;
