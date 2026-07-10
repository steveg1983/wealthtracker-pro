import type { Transaction, Category } from '../types';

export type TransactionSortField =
  | 'date' | 'description' | 'amount' | 'category' | 'tags' | 'payment' | 'deposit' | 'notes';

// Same-day ordering: income, then transfers, then expenses.
const TYPE_ORDER: Record<string, number> = { income: 0, transfer: 1, expense: 2 };

/**
 * Comparable value for a transaction under a given sort field. Payment/Deposit
 * both order by the signed amount (they're two views of the same number);
 * category/tags order by their display text.
 */
export function transactionSortValue(
  t: Transaction,
  field: TransactionSortField,
  categories: Category[]
): string | number {
  switch (field) {
    case 'amount':
    case 'payment':
    case 'deposit':
      return t.amount;
    case 'category':
      return (categories.find(c => c.id === t.category)?.name ?? '').toLowerCase();
    case 'tags':
      return (t.tags ?? []).join(', ').toLowerCase();
    case 'notes':
      return (t.notes ?? '').toLowerCase();
    case 'description':
      return t.description.toLowerCase();
    case 'date':
      return new Date(t.date).getTime();
    default:
      return '';
  }
}

/**
 * Account-register sort comparator. Every column sorts through here EXCEPT the
 * running Balance, which is never sorted — it is computed in chronological order
 * and mapped back per transaction, so it stays correct under any sort.
 *
 * Date sorts chronologically and is tie-broken by type so same-day rows keep a
 * stable order.
 */
export function compareTransactions(
  a: Transaction,
  b: Transaction,
  field: TransactionSortField,
  direction: 'asc' | 'desc',
  categories: Category[]
): number {
  if (field === 'date') {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateA !== dateB) {
      return direction === 'asc' ? dateA - dateB : dateB - dateA;
    }
    return (TYPE_ORDER[a.type] ?? 0) - (TYPE_ORDER[b.type] ?? 0);
  }

  const aValue = transactionSortValue(a, field, categories);
  const bValue = transactionSortValue(b, field, categories);
  if (aValue < bValue) return direction === 'asc' ? -1 : 1;
  if (aValue > bValue) return direction === 'asc' ? 1 : -1;

  // Equal on the chosen column: tie-break chronologically (oldest first, then
  // the same-day type order the Date sort uses). Sorting by Description
  // therefore lists a payee's rows together in date order instead of leaving
  // their relative order to chance.
  const dateA = new Date(a.date).getTime();
  const dateB = new Date(b.date).getTime();
  if (dateA !== dateB) return dateA - dateB;
  return (TYPE_ORDER[a.type] ?? 0) - (TYPE_ORDER[b.type] ?? 0);
}
