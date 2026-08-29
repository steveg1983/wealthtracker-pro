/**
 * The backfill verdict, decided once for the whole sync and stamped on every
 * row it submits.
 *
 * `import_bank_transactions_atomic` keeps one invariant two ways: a FIRST
 * import's history is already embodied in the provider's snapshot balance, so
 * it rebases (`initial_balance -= sum`, displayed balance untouched); new
 * money is incremental (`balance += sum`). Left to itself the RPC decides
 * which arm from the table — "does this account hold any feed row yet?" —
 * once per CALL. The handler calls it per 200-row chunk, and those two facts
 * compose into a drift on any first sync larger than one chunk: chunk 1
 * correctly rebases, chunk 1's own rows make the account "already fed", and
 * chunks 2..n take the incremental arm for history the snapshot ALSO embodies.
 * The displayed balance ends wrong by the sum of every chunk after the first —
 * silently, because `balance = initial_balance + Σ(amount)` holds throughout.
 *
 * The handler is the only party that sees every chunk, so the question is
 * asked there, once per account, before anything is sent, and the verdict
 * rides on each row as a `backfill` boolean. The RPC honours a stamp over its
 * own look at the table, and refuses a stamp that contradicts the arm already
 * chosen (20260829170000). Stamping every row of an account identically is
 * therefore not a style choice — a mixed batch is refused whole.
 */
export function stampBackfillDecision<T extends { account_id: string }>(
  rows: readonly T[],
  accountsWithFeedHistory: ReadonlySet<string>
): Array<T & { backfill: boolean }> {
  return rows.map((row) => ({
    ...row,
    backfill: !accountsWithFeedHistory.has(row.account_id)
  }));
}
