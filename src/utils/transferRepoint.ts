import type { Category, Transaction } from '../types';

/**
 * Re-pointing a transfer: what the two rows must look like afterwards.
 *
 * ─ THE MODEL, STATED ONCE ──────────────────────────────────────────────────
 * A linked transfer is two rows and FOUR facts, and every one of them names the
 * OTHER side:
 *
 *   source.transferAccountId  = the counterpart's account
 *   source.category           = "To/From <the counterpart's account>"
 *   counterpart.transferAccountId = the source's account
 *   counterpart.category          = "To/From <the source's account>"
 *
 * That crossover is easy to get backwards, and getting it backwards produces a
 * row filed under its OWN account's transfer category — the exact shape
 * `isSelfTransferCategory` exists to refuse, and the shape a swept account's
 * direct debits arrived in when the importer's categoriser had no such guard.
 * So the rule is written down here, once, and every writer reads it from here:
 * link_transfer_pair and repoint_transfer in SQL, DataService's local mirror in
 * TypeScript, and the tests that hold all three to it.
 *
 * ─ WHY THE COUNTERPART'S CATEGORY IS NOT "UNCHANGED" ───────────────────────
 * It is tempting to think a re-point only touches the row being edited: the
 * counterpart merely moves house, and its category names the source's account,
 * which did not change. That is true of the common case and false in general —
 * the full editor can move the row's OWN account in the same save. Then the
 * counterpart is still filed under "To/From <the account the source used to be
 * in>", pointing at an account this transfer no longer has anything to do with,
 * and nothing on either screen says so.
 *
 * Deriving BOTH categories from the pairing as it will be, rather than patching
 * the one that visibly changed, makes that class of bug unrepresentable.
 */
export interface TransferPairFiling {
  /** Where the counterpart sits afterwards. */
  counterpartAccountId: string;
  /** The edited row's To/From category — it names the counterpart's account. */
  sourceCategory: string;
  /** The counterpart's To/From category — it names the edited row's account. */
  counterpartCategory: string;
}

/**
 * The account-managed "To/From <account>" category, if the account has one.
 *
 * ─ WHY IT LIVES HERE AND NOT WITH THE MATCHER ──────────────────────────────
 * It used to live in transferMatch.ts, beside findTransferCandidates. That was
 * fine while only the transfer SWEEP asked the question, and stopped being fine
 * the moment the browser-storage write path did: transferMatch pulls in
 * duplicateScan for its description similarity scoring, so importing it from a
 * module the main bundle needs dragged the whole fuzzy matcher into the entry
 * chunk — code the entry chunk never runs. transferMatch re-exports this, so
 * every existing caller is unchanged and there is still exactly one definition.
 */
export function transferCategoryFor(
  categories: readonly Category[],
  accountId: string
): Category | undefined {
  return categories.find(c => c.isTransferCategory === true && c.accountId === accountId);
}

/**
 * The account-managed "To/From <account>" category ID, or the legacy sentinel.
 *
 * The sentinels are the same fallback `transfer_category_for` uses in SQL and
 * `localTransferCategoryFrom` uses in the browser store: an account without a
 * managed transfer category (which the lifecycle triggers should make
 * impossible) must not block a link.
 */
export function transferCategoryIdFor(
  categories: readonly Category[],
  accountId: string,
  amount: number
): string {
  return transferCategoryFor(categories, accountId)?.id
    ?? (amount < 0 ? 'transfer-out' : 'transfer-in');
}

/**
 * What the pair must look like once this transfer faces `targetAccountId`.
 *
 * Pure, and deliberately says nothing about HOW the counterpart gets there —
 * moved, replaced after a release, or replaced after a delete. All three end in
 * the same filing, which is why they share one planner.
 *
 * Amounts are read only to pick a sentinel when an account has no managed
 * transfer category; no arithmetic is done on them here, so there is no money
 * for a float to spoil.
 */
export function planTransferRepoint(
  source: Pick<Transaction, 'accountId' | 'amount'>,
  counterpart: Pick<Transaction, 'amount'>,
  targetAccountId: string,
  categories: readonly Category[]
): TransferPairFiling {
  return {
    counterpartAccountId: targetAccountId,
    sourceCategory: transferCategoryIdFor(categories, targetAccountId, source.amount),
    counterpartCategory: transferCategoryIdFor(categories, source.accountId, counterpart.amount),
  };
}

/**
 * Is this pair already filed the way `planTransferRepoint` says it should be?
 *
 * Used to decide whether a save has anything to send at all: a transfer whose
 * target is unchanged AND whose two categories already agree with the pairing
 * needs no re-point, and sending one would be a write, an audit entry and a
 * round trip for nothing.
 */
export function transferPairIsFiledCorrectly(
  source: Pick<Transaction, 'accountId' | 'amount' | 'category' | 'transferAccountId'>,
  counterpart: Pick<Transaction, 'accountId' | 'amount' | 'category' | 'transferAccountId'>,
  targetAccountId: string,
  categories: readonly Category[]
): boolean {
  const wanted = planTransferRepoint(source, counterpart, targetAccountId, categories);
  return (
    counterpart.accountId === wanted.counterpartAccountId &&
    source.transferAccountId === wanted.counterpartAccountId &&
    source.category === wanted.sourceCategory &&
    counterpart.transferAccountId === source.accountId &&
    counterpart.category === wanted.counterpartCategory
  );
}
