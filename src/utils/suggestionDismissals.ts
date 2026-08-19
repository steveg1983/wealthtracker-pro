import type {
  DismissalKind,
  PayeeDismissalKind,
  SuggestionDismissal,
  Transaction,
} from '../types';
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

/* ── Payee cleanup: a refusal about TEXT, not about rows ──────────────────── */

/**
 * Payee cleanup is the one surface whose suggestions are not made of rows.
 * It reads every payee TEXT in the register, guesses which of them are one
 * merchant wearing different transaction references, and offers the guess as a
 * shortcut. So the thing a user refuses there is a piece of text — "DIRECT
 * DEBIT is not one shop" — and it has to stay refused when the rows behind it
 * are gone and the same wording arrives again on a fresh import. Keying such a
 * dismissal by transaction ids would make it expire the moment the register
 * changed, which is the opposite of what "don't bring this to me again" means.
 *
 * That leaves text in a column the restore path treats as ids, so the format
 * has to make a payee name impossible to mistake for one. remapBackupIds
 * (services/backupService) splits subject_key on '|' and, for each segment,
 * looks the value up in the file's id map, flags anything uuid-shaped that
 * resolves to nothing, and RE-SORTS the segments that carried a bare id. Two
 * properties defeat all three of those:
 *
 *  1. every segment carries a role prefix, so none is ever treated as a bare
 *     id and the order is never rearranged;
 *  2. the value after that prefix always contains a further ':' (the role tag
 *     inside it), and a uuid can contain no colon — so the value can never be
 *     uuid-shaped and can never equal a key in the id map, whatever the user's
 *     bank happened to call the payee. Even a payee text that is literally one
 *     of the file's own transaction ids travels through a restore untouched.
 *
 * The text itself is percent-encoded, which removes both '|' and ':' from it.
 * Without that a payee containing a pipe — banks do emit them — would forge an
 * extra segment and a second payee could collide with the first.
 */
const PAYEE_NAMESPACE = 'payee-cleanup';

type PayeeRole = 'merchant' | 'payee';

const payeeSegment = (role: PayeeRole, text: string): string =>
  `${PAYEE_NAMESPACE}:${role}:${encodeURIComponent(text)}`;

/**
 * A whole suggested merchant, refused.
 *
 * Keyed by the merchant TOKEN alone, deliberately, and not by the set of payees
 * currently under it: that set grows with every import, and a key built from it
 * would change the moment one new reference arrived — putting the suggestion
 * straight back in front of a user who had already said no to it. The judgment
 * being recorded is about the grouping ("these are not one shop"), and a new
 * reference for the same grouping does not change it. Undo is one click, so the
 * user who does want it back can have it back.
 */
export function payeeMerchantDismissalKey(merchantKey: string): string {
  return payeeSegment('merchant', merchantKey);
}

/**
 * One payee kept out of a suggested merchant it otherwise matches.
 *
 * Scoped to the merchant as well as the payee, because the statement is a
 * relational one — "this line does not belong with those" — and it should not
 * silently carry over to a differently-drawn group. The merchant leads so the
 * two halves read in the order they are spoken.
 */
export function payeeLineDismissalKey(merchantKey: string, description: string): string {
  return `${payeeSegment('merchant', merchantKey)}${SEPARATOR}${payeeSegment('payee', description)}`;
}

/**
 * A payee the screen must stop showing AT ALL — the widest of the three
 * refusals, and the only one that changes what the list contains rather than
 * what is suggested about it.
 *
 * Keyed by the payee text ALONE, with no merchant beside it, because that is
 * exactly the scope of the statement: "never bring this wording to me again on
 * this page", whatever grouping some later scan draws around it. A key scoped
 * to a merchant would leak the refusal back the moment the guess changed — a
 * new reference arrives, the merchant token shifts, and a payee the user
 * struck off is on screen again.
 *
 * One segment, role-prefixed and percent-encoded like the other two, so the
 * restore path's id remapping cannot touch it (see the note above). It cannot
 * collide with a merchant refusal — different role — nor with a line refusal,
 * which always carries two segments.
 */
export function payeeHiddenDismissalKey(description: string): string {
  return payeeSegment('payee', description);
}

/** What a payee-cleanup dismissal was about, as the user would recognise it. */
export interface PayeeDismissalSubject {
  /**
   * The suggested merchant — or null when the refusal names a payee alone,
   * which is what hiding a payee from the screen does.
   */
  merchant: string | null;
  /** The payee text, or null when the whole suggested merchant was refused. */
  payee: string | null;
}

/**
 * True for the kinds Payee cleanup owns, so a screen can narrow a mixed list of
 * dismissals without listing the kinds at each call site — and so that adding a
 * fourth one day is a compile error here rather than a payee refusal that
 * quietly stops being displayed.
 *
 * A switch rather than an array lookup: the compiler checks it, no cast is
 * needed to compare a wider union against a narrower one, and an unhandled kind
 * cannot slip through as `false`.
 */
export function isPayeeDismissalKind(kind: DismissalKind): kind is PayeeDismissalKind {
  switch (kind) {
    case 'payee-merchant':
    case 'payee-line':
    case 'payee-hidden':
      return true;
    case 'transfer-pair':
    case 'transfer-leg':
    case 'stranded':
    case 'duplicate':
    case 'recurring-confirmed':
    case 'recurring-not':
    case 'forecast-excluded':
      return false;
  }
}

/* ── Recurring detections: an answer about a PATTERN, not about rows ──────── */

/**
 * The identity of a recurring detection, as an answer is stored against it.
 *
 * Two segments:
 *
 *   account:<id>|recurring:<direction>:<percent-encoded payee key>
 *
 * The ACCOUNT segment is a role-prefixed row id, exactly the shape
 * remapDismissalKey (services/backup/format) is built to handle: the value
 * after the single role prefix is the bare uuid, so a restore into a new
 * login rewrites it in place — and the detection, re-derived from the
 * restored rows, computes the same key and finds its answer waiting. A bare
 * unprefixed id would ALSO remap, but would join the re-sorted positions;
 * the prefix keeps the segments in their spoken order.
 *
 * The PATTERN segment follows the payee-cleanup convention for the same
 * reason it exists there: the value after `recurring:` always contains a
 * further ':' (the direction), so it can never look uuid-shaped and no
 * remapper can touch the payee text — even a payee whose bank wording IS a
 * uuid. Percent-encoding removes '|' and ':' from the text itself.
 *
 * Keyed by the normalised payee, not the raw description, because the raw
 * form changes reference numbers between statements while the pattern does
 * not — an answer must survive the next import, or the question comes back.
 */
export function recurringAnswerKey(
  accountId: string,
  direction: 'in' | 'out',
  payeeKey: string
): string {
  return `account:${accountId}${SEPARATOR}recurring:${direction}:${encodeURIComponent(payeeKey)}`;
}

/**
 * Read a payee-cleanup key back into the text it was built from, for the
 * "Dismissed suggestions" list. Returns null for anything that is not one of
 * these keys, so a caller can never describe a transfer dismissal as a payee.
 *
 * A key that will not decode is shown raw rather than dropped: an entry the
 * user cannot read is still an entry they must be able to undo.
 */
export function readPayeeDismissalKey(subjectKey: string): PayeeDismissalSubject | null {
  const segments = subjectKey.split(SEPARATOR);
  if (segments.length < 1 || segments.length > 2) return null;

  const merchant = readPayeeSegment(segments[0], 'merchant');
  if (merchant === null) {
    // One PAYEE segment on its own is the third refusal: a payee hidden from
    // the screen, which names no merchant because it belongs to none.
    if (segments.length !== 1) return null;
    const hidden = readPayeeSegment(segments[0], 'payee');
    return hidden === null ? null : { merchant: null, payee: hidden };
  }
  if (segments.length === 1) return { merchant, payee: null };

  const payee = readPayeeSegment(segments[1], 'payee');
  if (payee === null) return null;
  return { merchant, payee };
}

function readPayeeSegment(segment: string, role: PayeeRole): string | null {
  const prefix = `${PAYEE_NAMESPACE}:${role}:`;
  if (!segment.startsWith(prefix)) return null;
  const encoded = segment.slice(prefix.length);
  try {
    return decodeURIComponent(encoded);
  } catch {
    // Malformed percent-escapes (a hand-edited row, say). The key still
    // filters correctly — it is only ever compared as text — so show what is
    // there rather than hiding the undo.
    return encoded;
  }
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
