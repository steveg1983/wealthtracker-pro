/**
 * The one piece of reconciliation logic that is shared rather than derived.
 *
 * Counting and summarising used to live here too, and were deleted with no
 * caller between them: hooks/useReconciliation does both against `Decimal`,
 * where this module's summary added money with a float `reduce` — two answers
 * to the same question, one of them wrong by a penny at a time.
 */

/**
 * Derive a reconciliation adjustment's direction and signed amount from the
 * remaining difference (bank − cleared). Bank higher than cleared → missing
 * income (+); bank lower → missing expense (−). The direction always comes
 * from the difference, never from the sign the user typed.
 */
export function deriveAdjustment(
  difference: number,
  enteredAmount: number | null
): { type: 'income' | 'expense'; signedAmount: number | null } {
  const type: 'income' | 'expense' = difference > 0 ? 'income' : 'expense';
  if (enteredAmount == null) {
    return { type, signedAmount: null };
  }
  const absAmount = Math.abs(enteredAmount);
  return { type, signedAmount: type === 'income' ? absAmount : -absAmount };
}
