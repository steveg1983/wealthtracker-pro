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
import { isReconciled } from './transactionReconciliation';
import { formatDate } from './dateFormatter';
import { formatCount } from './localeFormat';

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

/**
 * A transaction is eligible to archive when it is RECONCILED and on/before the
 * cutoff.
 *
 * Reconciled, not merely marked: the archive hides settled history, and a
 * working tick is not settled. Mirrors archive_transactions_before, which now
 * reads the same committed flag.
 */
export function isArchivable(txn: Transaction, cutoff: Date): boolean {
  return isReconciled(txn) && new Date(txn.date) <= cutoff;
}

/**
 * What a cutoff would DO to one account, in the only numbers that answer the
 * question a user actually asks: how much disappears, and how much is left.
 * A bare "Archive 1,204" says how big the action is but not what you are left
 * looking at, which is the thing worth knowing before you press it.
 */
export interface ArchiveImpact {
  /** Rows this cutoff would newly hide from the live register. */
  willHide: number;
  /** Rows still in the live register afterwards (already-archived ones are not counted — they are gone from it already). */
  remainingVisible: number;
  /** Rows an earlier archive run already hid. */
  alreadyHidden: number;
}

export const EMPTY_ARCHIVE_IMPACT: ArchiveImpact = { willHide: 0, remainingVisible: 0, alreadyHidden: 0 };

/** "1,204 transactions" / "1 transaction" — the count and its noun, together. */
export function countWithNoun(n: number, noun = 'transaction'): string {
  return `${formatCount(n)} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * What pressing Archive would do, said as a consequence rather than a count:
 * how much disappears from the register AND how much is left in it. The house
 * rule — a number on its own tells you the size of the action, not what you
 * are left looking at.
 *
 * It lives here rather than in the component because it is the sentence the
 * user decides on, so it is worth testing directly.
 */
export function describeArchiveConsequence(impact: ArchiveImpact, cutoff: Date | null): string {
  if (!cutoff) return 'No cutoff chosen — nothing would be hidden.';
  // The verb has to agree with the count as well as the noun, or a register
  // with one row left reads "1 transaction stay visible".
  const stay = impact.remainingVisible === 1 ? 'stays' : 'stay';
  if (impact.willHide === 0) {
    if (impact.remainingVisible === 0) return 'Nothing left to hide in this account.';
    // "all 1 transaction" is clumsy; at one row the count says "all" by itself.
    const all = impact.remainingVisible === 1 ? '' : 'all ';
    return `Nothing reconciled on or before that date — ${all}${countWithNoun(impact.remainingVisible)} ${stay} visible.`;
  }
  return `Hides ${countWithNoun(impact.willHide)} dated on or before ${formatDate(cutoff)}; ${countWithNoun(impact.remainingVisible)} ${stay} visible.`;
}

/**
 * The impact of a (possibly different) cutoff on each of several accounts, in
 * ONE pass over the transactions. Per-account cutoffs differ once a user
 * overrides the global choice for a single account, and a full-book scan per
 * account row is quadratic on a register of any size — with ~25 accounts and
 * tens of thousands of rows that is millions of date parses on every keystroke
 * in the date picker.
 *
 * Every account in `cutoffs` gets an entry, so a caller can read a row's
 * figures without a fallback. A null cutoff means "archive nothing", which is
 * how "Keep all" and a not-yet-chosen custom date both behave.
 */
export function archiveImpactByAccount(
  transactions: Transaction[],
  cutoffs: ReadonlyMap<string, Date | null>
): Map<string, ArchiveImpact> {
  const impacts = new Map<string, ArchiveImpact>();
  cutoffs.forEach((_cutoff, accountId) => {
    impacts.set(accountId, { ...EMPTY_ARCHIVE_IMPACT });
  });
  for (const txn of transactions) {
    const impact = impacts.get(txn.accountId);
    if (!impact) continue;
    if (txn.archived) {
      impact.alreadyHidden++;
      continue;
    }
    const cutoff = cutoffs.get(txn.accountId) ?? null;
    if (cutoff && isArchivable(txn, cutoff)) impact.willHide++;
    else impact.remainingVisible++;
  }
  return impacts;
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

/**
 * One account's own cutoff, chosen instead of the global one. The
 * acknowledgement is part of the value rather than a separate flag because an
 * override that the user has not consciously agreed to is exactly the bug this
 * guards against: a date typed while exploring must not quietly change what
 * pressing Archive does.
 */
export interface AccountArchiveOverride {
  /** YYYY-MM-DD — the DatePicker's format, and the one `resolveCutoff` reads. */
  date: string;
  /** The user ticked "this account ignores the global setting". */
  acknowledged: boolean;
}

/** Pending per-account overrides, keyed by account id. */
export type AccountArchiveOverrides = Record<string, AccountArchiveOverride>;

/** Where a half-set override waits — see `parseAccountArchiveOverrides`. */
export const ARCHIVE_OVERRIDES_STORAGE_KEY = 'archiveManager.overrides.v1';

/** An override only takes effect once it has BOTH a date and the acknowledgement. */
export function isOverrideActive(
  override: AccountArchiveOverride | undefined
): override is AccountArchiveOverride {
  return override !== undefined && override.date !== '' && override.acknowledged;
}

/** The cutoff an account will actually archive to, and which choice supplied it. */
export interface ResolvedAccountCutoff {
  cutoff: Date | null;
  source: 'global' | 'override';
}

/**
 * A single cutoff per account: its own if it has an acknowledged one, the
 * global choice otherwise. Never a range — "hide everything dated on or before
 * this day" is the whole of the semantics, here and in the RPC.
 */
export function resolveAccountCutoff(
  globalCutoff: Date | null,
  override: AccountArchiveOverride | undefined
): ResolvedAccountCutoff {
  if (isOverrideActive(override)) {
    return { cutoff: resolveCutoff('custom', override!.date), source: 'override' };
  }
  return { cutoff: globalCutoff, source: 'global' };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Read stored overrides. They are persisted because setting one is a two-trip
 * job: the row links through to the account's own history so you can see how
 * far back it goes, and coming back must not have forgotten the date you had
 * already typed. Anything malformed is dropped rather than trusted — a corrupt
 * value must never make Archive act on a date nobody chose.
 */
export function parseAccountArchiveOverrides(stored: string | null): AccountArchiveOverrides {
  if (stored === null) return {};
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!isRecord(parsed)) return {};
    const overrides: AccountArchiveOverrides = {};
    Object.entries(parsed).forEach(([accountId, value]) => {
      if (!isRecord(value)) return;
      if (typeof value.date !== 'string' || typeof value.acknowledged !== 'boolean') return;
      overrides[accountId] = { date: value.date, acknowledged: value.acknowledged };
    });
    return overrides;
  } catch {
    return {};
  }
}

/** The stored form. */
export function serializeAccountArchiveOverrides(overrides: AccountArchiveOverrides): string {
  return JSON.stringify(overrides);
}
