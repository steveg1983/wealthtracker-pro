/**
 * "Have I imported this row before?"
 *
 * WHY this exists: both import wizards asked that question with
 *
 *     t.date === transaction.date
 *
 * where both sides are Date OBJECTS. `===` on two objects compares identity,
 * and two Dates parsed from the same file are never the same object — so the
 * test was false for every pair and duplicate detection never fired once.
 * Importing the same statement twice silently doubled the register (and every
 * balance built from it).
 *
 * Dates are compared as INSTANTS, and an unreadable date compares equal to
 * nothing: a row whose date could not be parsed is imported rather than
 * silently swallowed as a "duplicate" of another unreadable one.
 */

import { toDateMs } from './dateBoundary';
import { toDecimal } from './decimal';

/** The fields the duplicate test reads — satisfied by Transaction and by the drafts wizards build. */
export interface DedupeCandidate {
  date?: Date | string | number | null;
  amount?: number | null;
  description?: string | null;
}

/**
 * Same date (to the instant), same amount (exactly, via Decimal) and same
 * description. Anything missing an amount or a readable date is not a
 * duplicate of anything.
 */
export function isSameImportedTransaction(a: DedupeCandidate, b: DedupeCandidate): boolean {
  if (a.amount === null || a.amount === undefined) return false;
  if (b.amount === null || b.amount === undefined) return false;
  if (!toDecimal(a.amount).equals(toDecimal(b.amount))) return false;

  if ((a.description ?? '') !== (b.description ?? '')) return false;

  const aMs = toDateMs(a.date);
  const bMs = toDateMs(b.date);
  return Number.isFinite(aMs) && aMs === bMs;
}

/** Whether `candidate` matches any row already held. */
export function isDuplicateImport(
  existing: ReadonlyArray<DedupeCandidate>,
  candidate: DedupeCandidate
): boolean {
  return existing.some(row => isSameImportedTransaction(row, candidate));
}
