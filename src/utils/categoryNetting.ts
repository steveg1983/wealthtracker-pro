import { toDecimal } from './decimal';
import { categoryKindOf } from './incomeExpense';
import type { Transaction, Category } from '../types';

export interface CategoryNetTotal {
  /** Category id. */
  key: string;
  /** Display name (resolved from the category; ids never leak into charts). */
  name: string;
  /** Net positive spend for the category over the given transactions. */
  value: number;
}

/**
 * Expense totals per category with Microsoft Money netting semantics: a
 * transaction belongs to the EXPENSE breakdown when its CATEGORY is an
 * expense category — regardless of the transaction's own direction — and
 * amounts are netted signed. So a £100 purchase plus a £50 refund filed under
 * the same expense category shows £50, not £100 (and the refund never
 * pollutes the income side).
 *
 * Bucketing rules:
 * - category typed 'expense'   → expense breakdown (even for income rows)
 * - category typed 'income'    → income side (excluded here, even for expenses)
 * - category typed 'both' / uncategorized → falls back to the transaction type
 * - transfers are never part of spending
 *
 * Categories whose net is zero or negative (refunds ≥ spending) are omitted —
 * a pie slice cannot represent negative spend.
 */
/**
 * Which report side a transaction belongs to — decided by its CATEGORY's
 * direction when it has one (Money model), falling back to the transaction's
 * own direction for 'both'-typed and uncategorized rows.
 */
export function bucketByCategoryDirection(
  t: Transaction,
  categoryById: ReadonlyMap<string, Category>
): 'income' | 'expense' | 'transfer' | 'revaluation' | 'uncategorized' {
  if (t.type === 'transfer') return 'transfer';
  // One shared kind definition (utils/incomeExpense) — this must never drift
  // from the Dashboard/Analytics classifier. It also treats a To/From
  // transfer category as 'transfer' whatever the row's own direction says, and
  // a revaluation category as 'revaluation' — neither is spending, so both are
  // filtered out by the callers below.
  // 'uncategorized' is STRICT: no category, or a dangling id — such rows
  // never hit an income/expense report. A real direction-neutral ('both')
  // category was deliberately filed, so direction decides its side.
  const category = t.category ? categoryById.get(t.category) : undefined;
  if (!category) return 'uncategorized';
  return categoryKindOf(category) ?? t.type;
}

export function computeExpenseCategoryNetTotals(
  transactions: Transaction[],
  categories: Category[]
): CategoryNetTotal[] {
  const categoryById = new Map(categories.map(c => [c.id, c]));
  const totals = new Map<string, ReturnType<typeof toDecimal>>();

  for (const t of transactions) {
    // Only rows with a real expense category count — an uncategorised row
    // never reaches the spending breakdown (it can't: 'expense' requires the
    // category to have resolved to the expense tree).
    if (bucketByCategoryDirection(t, categoryById) !== 'expense') continue;

    const previous = totals.get(t.category) ?? toDecimal(0);
    // Signed convention: spending is negative, so negate to accumulate spend;
    // an income-row refund (+) filed under this category nets the total down.
    totals.set(t.category, previous.minus(toDecimal(t.amount)));
  }

  const entries = [...totals.entries()]
    .map(([key, total]) => ({
      key,
      name: categoryById.get(key)?.name ?? key,
      value: total.toNumber(),
    }))
    .filter(entry => entry.value > 0);

  // Money's tree repeats detail names across groups ("Cars & Bikes >
  // Insurance" and "Household > Insurance") — qualify duplicates with their
  // parent so chart slices stay distinguishable.
  const nameCounts = new Map<string, number>();
  entries.forEach(e => nameCounts.set(e.name, (nameCounts.get(e.name) ?? 0) + 1));

  return entries
    .map(entry => {
      if ((nameCounts.get(entry.name) ?? 0) > 1) {
        const category = categoryById.get(entry.key);
        const parent = category?.parentId ? categoryById.get(category.parentId) : undefined;
        if (parent) {
          return { ...entry, name: `${parent.name}: ${entry.name}` };
        }
      }
      return entry;
    })
    .sort((a, b) => b.value - a.value);
}
