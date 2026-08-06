import type { DismissalKind, SuggestionDismissal, Transaction } from '../types';
import type { StrandedFinding } from './strandedTransfers';
import type { SplitLegSuggestion, TransferPairSuggestion } from './transferSweep';

/**
 * The identity of a refused suggestion.
 *
 * A sweep re-runs from scratch every time it opens, and it is free to reach the
 * same two rows from either end: whichever it happens to call "this one" is an
 * accident of iteration order, not a fact about the money. So a dismissal is
 * keyed by CONTENT, canonically — the ids it is made of, sorted, joined. That
 * single property is what makes "leave it" stick across a re-scan, and it is
 * exactly what the old session-local key (`${kind}|${row.id}`, built in
 * whatever order the classifier emitted) did not have.
 *
 * `kind` is part of the identity, carried by the table's unique constraint
 * rather than by the key text: the same two rows can be a transfer pair to one
 * scan and a duplicate to another, and those offers have opposite consequences
 * — linking two rows changes their filing, deleting one destroys it. Refusing
 * one must never suppress the other.
 *
 * The ids are sorted with the default comparator (UTF-16 code unit order), NOT
 * localeCompare: this string is persisted and compared byte-for-byte, so it
 * must not depend on the browser's locale.
 */

const SEPARATOR = '|';

/** Order-independent identity for a set of rows. */
export function canonicalSubjectKey(ids: string[]): string {
  return [...ids].sort().join(SEPARATOR);
}

/** Two whole rows the sweep would link as a transfer pair. */
export function pairDismissalKey(pair: TransferPairSuggestion): string {
  return canonicalSubjectKey([pair.outgoing.id, pair.incoming.id]);
}

export function pairDismissalSubjectIds(pair: TransferPairSuggestion): string[] {
  return [pair.outgoing.id, pair.incoming.id];
}

/**
 * One LINE of a split and the row that is its other side.
 *
 * Deliberately NOT sorted: the two halves are not interchangeable — one is a
 * split line id, the other a transaction id — so the role tags fix the order
 * instead. A split line's id changes when the whole line set is rewritten
 * (set_transaction_splits replaces rather than edits), so re-editing a split
 * legitimately produces a new offer with a new key. That is correct: the line
 * the user refused no longer exists.
 */
export function legDismissalKey(leg: SplitLegSuggestion): string {
  return `split:${leg.split.id}${SEPARATOR}txn:${leg.candidate.id}`;
}

/**
 * The TRANSACTIONS a line match is about — the split's parent and the row over
 * there. The line's own id lives in the key, so every id stored against a
 * dismissal resolves in exactly one table.
 */
export function legDismissalSubjectIds(leg: SplitLegSuggestion): string[] {
  return [leg.parent.id, leg.candidate.id];
}

/**
 * A stranded finding: the row, plus every row that makes the case for it.
 *
 * The finding kind leads the key because one row can be stranded in more than
 * one way over its lifetime, and each way is a different offer with a different
 * consequence (archive a copy / re-pair and displace / link two rows / file as
 * an adjustment). Refusing "archive this copy" must not silently suppress
 * "nothing anywhere is the other side of this".
 */
export function strandedDismissalKey(finding: StrandedFinding): string {
  return `${finding.kind}${SEPARATOR}${canonicalSubjectKey(strandedDismissalSubjectIds(finding))}`;
}

export function strandedDismissalSubjectIds(finding: StrandedFinding): string[] {
  switch (finding.kind) {
    case 'duplicate':
      return [finding.row.id, finding.duplicateOf.id];
    case 'claimed':
      return [finding.row.id, finding.counterpart.id, finding.currentPartner.id];
    case 'categorised':
      return [finding.row.id, finding.counterpart.id];
    case 'one-sided':
      return [finding.row.id];
  }
}

/**
 * Two rows in ONE account that look like the same movement recorded twice.
 * Symmetric by nature — either could be the copy the user deletes — so this is
 * the case the canonical sort matters most for.
 */
export function duplicateDismissalKey(a: Transaction, b: Transaction): string {
  return canonicalSubjectKey([a.id, b.id]);
}

export function duplicateDismissalSubjectIds(a: Transaction, b: Transaction): string[] {
  return [a.id, b.id];
}

/** The keys the user has refused, for one kind — the filter every surface applies. */
export function dismissedKeys(
  dismissals: SuggestionDismissal[],
  kind: DismissalKind
): Set<string> {
  const keys = new Set<string>();
  for (const dismissal of dismissals) {
    if (dismissal.kind === kind) keys.add(dismissal.subjectKey);
  }
  return keys;
}
