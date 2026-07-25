-- ── Account adjustments are revaluations, not a second mechanism ─────────────
--
-- Correcting an account's balance to what the bank actually says moves net
-- worth without a pound being earned or spent — the SAME shape as a portfolio
-- revaluation (20260723190000), which is why it gets a second detail under the
-- existing Revaluation root rather than a parallel concept of its own. Filed
-- there, the row is ruled out of income and expenses by category semantics,
-- appears on the report's opt-in gains/losses line, and never sits in the
-- uncategorised review band asking to be classified as something it isn't.
--
-- Idempotent: a user who already has a revaluation detail named
-- 'Account Adjustment' is skipped, so re-running changes nothing.

BEGIN;

-- Users who somehow have no Revaluation root (signed up between migrations)
-- get one first — the same block as 20260723190000, so this migration stands
-- on its own rather than assuming that one ran.
INSERT INTO public.categories (user_id, name, type, level, parent_id, is_system, is_revaluation_category)
SELECT u.id, 'Revaluation', 'both', 'type', NULL, true, true
  FROM public.users u
 WHERE NOT EXISTS (
   SELECT 1 FROM public.categories c
    WHERE c.user_id = u.id AND c.is_revaluation_category AND c.level = 'type'
 );

INSERT INTO public.categories (user_id, name, type, level, parent_id, is_system, is_revaluation_category)
SELECT root.user_id, 'Account Adjustment', 'both', 'detail', root.id, true, true
  FROM public.categories root
 WHERE root.is_revaluation_category AND root.level = 'type'
   AND NOT EXISTS (
     SELECT 1 FROM public.categories c
      WHERE c.user_id = root.user_id
        AND c.is_revaluation_category
        AND c.level = 'detail'
        AND c.name = 'Account Adjustment'
   );

COMMIT;
