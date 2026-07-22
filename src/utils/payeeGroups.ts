import type { Category, Transaction } from '../types';
import { toDecimal } from './decimal';
import { normalizePayee, FALLBACK_BANK_DESCRIPTION } from './payeeAutoCategorize';
import { classifyFlow, buildCategoryKindLookup } from './incomeExpense';

/**
 * Group uncategorised transactions by payee so a whole merchant can be filed
 * in one decision — the fastest route out of a review band full of ordinary
 * spending (Boots ×167, Clinton Cards ×110 …), where one-at-a-time editing
 * would take thousands of clicks.
 *
 * Grouping key is payee + DIRECTION: money out to a shop and money in from
 * it (a refund) are different decisions, and the app's payee memory is
 * direction-scoped too, so the groups mirror what will be remembered.
 *
 * Each group carries a SUGGESTION taken from how the user has already filed
 * that same payee — the most COMMON existing category (ties broken by the
 * most recent), because a bulk decision covering dozens of rows should
 * follow the habit rather than the last accident.
 */

export interface PayeeGroup {
  /** Normalised payee (upper-cased, trimmed) — the memory key. */
  payee: string;
  /** The description as it reads in the register (first occurrence). */
  displayName: string;
  direction: 'income' | 'expense';
  transactionIds: string[];
  count: number;
  /** Total magnitude across the group. */
  total: number;
  earliest: Date;
  latest: Date;
  /** Accounts the group spans (names resolved by the caller). */
  accountIds: string[];
  /** The category this payee is filed under MOST often (the suggestion). */
  suggestedCategoryId?: string;
  /** How many existing rows carry that suggestion. */
  suggestionSupport?: number;
  /**
   * The category used MOST RECENTLY for this payee, when it differs from the
   * suggestion — so a deliberate recent change is one click away instead of
   * being buried under an old habit.
   */
  lastUsedCategoryId?: string;
}

export function buildPayeeGroups(
  transactions: Transaction[],
  categories: Category[]
): PayeeGroup[] {
  const kinds = buildCategoryKindLookup(categories);
  const categoryIds = new Set(categories.map(c => c.id));

  const isUncategorised = (t: Transaction): boolean =>
    !t.category || !categoryIds.has(t.category);

  // How the user already files each payee+direction (categorised rows only).
  const history = new Map<string, Map<string, { count: number; latest: number }>>();
  for (const t of transactions) {
    if (isUncategorised(t)) continue;
    if (t.type === 'transfer') continue;
    const kind = classifyFlow(t, kinds);
    if (kind !== 'income' && kind !== 'expense') continue;
    const payee = normalizePayee(t.description);
    if (!payee || payee === FALLBACK_BANK_DESCRIPTION) continue;
    const key = `${payee}|${kind}`;
    const byCategory = history.get(key) ?? new Map();
    const entry = byCategory.get(t.category) ?? { count: 0, latest: 0 };
    entry.count++;
    entry.latest = Math.max(entry.latest, new Date(t.date).getTime());
    byCategory.set(t.category, entry);
    history.set(key, byCategory);
  }

  const groups = new Map<string, PayeeGroup>();
  for (const t of transactions) {
    if (!isUncategorised(t)) continue;
    if (t.type === 'transfer' || t.linkedTransferId) continue;
    if (t.isSplit) continue;
    const payee = normalizePayee(t.description);
    if (!payee || payee === FALLBACK_BANK_DESCRIPTION) continue;

    // Direction from the money itself: an uncategorised row has no category
    // to classify by, so the sign IS the only signal — and it is exactly what
    // payee memory will key on when it remembers this decision.
    const direction: 'income' | 'expense' = t.amount >= 0 ? 'income' : 'expense';
    const key = `${payee}|${direction}`;
    const date = new Date(t.date);

    const existing = groups.get(key);
    if (existing) {
      existing.transactionIds.push(t.id);
      existing.count++;
      existing.total = toDecimal(existing.total).plus(toDecimal(Math.abs(t.amount))).toNumber();
      if (date < existing.earliest) existing.earliest = date;
      if (date > existing.latest) existing.latest = date;
      if (!existing.accountIds.includes(t.accountId)) existing.accountIds.push(t.accountId);
      continue;
    }

    const byCategory = history.get(key);
    let suggestedCategoryId: string | undefined;
    let suggestionSupport: number | undefined;
    let lastUsedCategoryId: string | undefined;
    if (byCategory && byCategory.size > 0) {
      const entries = [...byCategory.entries()];
      const [bestId, best] = [...entries].sort(
        (a, b) => b[1].count - a[1].count || b[1].latest - a[1].latest
      )[0];
      suggestedCategoryId = bestId;
      suggestionSupport = best.count;
      const [recentId] = [...entries].sort((a, b) => b[1].latest - a[1].latest)[0];
      if (recentId !== bestId) lastUsedCategoryId = recentId;
    }

    groups.set(key, {
      payee,
      displayName: t.description.trim(),
      direction,
      transactionIds: [t.id],
      count: 1,
      total: Math.abs(t.amount),
      earliest: date,
      latest: date,
      accountIds: [t.accountId],
      suggestedCategoryId,
      suggestionSupport,
      lastUsedCategoryId,
    });
  }

  // Biggest wins first: most rows, then largest value.
  return [...groups.values()].sort((a, b) => b.count - a.count || b.total - a.total);
}
