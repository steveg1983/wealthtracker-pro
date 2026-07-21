/**
 * Soft-archive client logic — pure, so it drives both local-mode writes and
 * the register's brought-forward maths, and is fully testable.
 *
 * Archiving hides old reconciled transactions from the LIVE register without
 * deleting them or touching balances. The account balance stays
 * `initial + Σ(all)`; the register just seeds its running balance from the sum
 * of the hidden (archived) rows so the visible rows still end at the true
 * current balance. See the soft_archive migration for the server side.
 */
import type { Transaction } from '../types';
import { toDecimal } from './decimal';

export type ArchivePreset = '6m' | '12m' | '24m' | 'all' | 'custom';

export const ARCHIVE_PRESETS: { value: ArchivePreset; label: string }[] = [
  { value: '6m', label: '6 months' },
  { value: '12m', label: '12 months' },
  { value: '24m', label: '24 months' },
  { value: 'all', label: 'Keep all' },
  { value: 'custom', label: 'Custom date' },
];

const PRESET_MONTHS: Record<string, number> = { '6m': 6, '12m': 12, '24m': 24 };

/**
 * Resolve a preset (or custom date) to a cutoff: transactions on/before it are
 * eligible to archive. 'all' means "keep everything" → null (no cutoff).
 */
export function resolveCutoff(
  preset: ArchivePreset,
  customDate: string,
  now: Date = new Date()
): Date | null {
  if (preset === 'all') return null;
  if (preset === 'custom') return customDate ? new Date(customDate) : null;
  const months = PRESET_MONTHS[preset] ?? 0;
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d;
}

/** A transaction is eligible to archive when it is reconciled and on/before the cutoff. */
export function isArchivable(txn: Transaction, cutoff: Date): boolean {
  return txn.cleared === true && new Date(txn.date) <= cutoff;
}

/** How many of an account's transactions a given cutoff would archive. */
export function countArchivable(transactions: Transaction[], accountId: string, cutoff: Date): number {
  let n = 0;
  for (const t of transactions) {
    if (t.accountId === accountId && !t.archived && isArchivable(t, cutoff)) n++;
  }
  return n;
}

/**
 * The "brought forward" opening for an account's LIVE register = the account's
 * true opening balance plus the sum of its archived (hidden) transactions.
 * Decimal maths — money is never summed as float.
 */
export function broughtForwardBalance(
  transactions: Transaction[],
  accountId: string,
  openingBalance: number
): number {
  let sum = toDecimal(openingBalance);
  for (const t of transactions) {
    if (t.accountId === accountId && t.archived) sum = sum.plus(toDecimal(t.amount));
  }
  return sum.toNumber();
}

/** Whether an account has any archived transactions (for the "Show archived" affordance). */
export function hasArchived(transactions: Transaction[], accountId?: string): boolean {
  return transactions.some(t => t.archived && (accountId === undefined || t.accountId === accountId));
}
