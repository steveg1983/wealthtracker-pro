-- Fix expense transaction amounts that were stored as positive due to Math.abs() bug.
-- TrueLayer sends negative amounts for expenses, but normalizeAmount() stripped the sign.
-- This migration negates all expense amounts that are currently positive.

UPDATE transactions
SET amount = -ABS(amount)
WHERE type = 'expense'
  AND amount > 0;
