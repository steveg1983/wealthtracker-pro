/**
 * The app's shapes on their way INTO a ledger file.
 *
 * The other half of `rows.ts`, and deliberately not its mirror image. Reading is
 * one question — the crate answers with a whole row and the app wants a whole
 * object — while writing is many: `create_transaction` takes a draft,
 * `update_transaction` takes a patch of sixteen fields, an import row takes
 * thirteen keys, and a split line takes five. Each of those is a SUBSET of the
 * same columns, and each refuses a key it has not heard of
 * (`deny_unknown_fields`), so the subsets are written out below rather than
 * inferred.
 *
 * What is NOT written out again is the correspondence itself. Every function
 * here goes through `columns.ts` — the same table `rows.ts` reads — so a field
 * cannot be written under one name and read back under another, and cannot be
 * a decimal string going out and a number coming in. That is the property
 * `localCore.fixtureFile.ts` already insists on for its own two directions, and
 * the reason it gives applies with more force here: two conversions that are
 * each wrong in the same way agree perfectly.
 *
 * ── THE TWO SHAPES OF "A KEY THE VERB HAS NOT HEARD OF" ─────────────────────
 *
 * This file makes opposite decisions for the create path and the update path,
 * and the difference is the whole of divergence D-7.
 *
 * A CREATE is FILTERED. `create_transaction_atomic` reads the keys it knows out
 * of a jsonb blob and ignores the rest, and the app's callers rely on it: the
 * seam hands over `Omit<Transaction, 'id'>`, which carries `isSplit`,
 * `archived`, `linkedTransferId` and half a dozen other fields the create verb
 * has no argument for. Sending them would make every ordinary create a refusal.
 * So the create builder sends the verb's own list and nothing else, which
 * reproduces the cloud's discard rather than inventing a stricter engine.
 *
 * An UPDATE is PASSED THROUGH WHOLE. The cloud discards an unrecognised key in
 * SILENCE, and that silence has an incident behind it — the reconciliation
 * page's cleared checkbox "succeeded" for a month without touching `is_cleared`,
 * so a difference could never reach zero. The local core refuses instead, by
 * name, which is D-7's declared row for this engine. It can only refuse what it
 * is shown, so the update builder must NOT quietly drop a field it does not
 * recognise: `archived` goes over the wire and comes back as a refusal naming
 * it, which is exactly what the contract suite asks this engine for.
 */

import type { Transaction, TransactionSplitInput } from '../../../types';
import { SPLIT_COLUMNS, TRANSACTION_COLUMNS, encode, payloadOf } from './columns';

/**
 * What `create_transaction` accepts, out of the transaction's columns.
 *
 * `id` is absent on purpose. The seam's argument is `Omit<Transaction, 'id'>`,
 * so an id arriving here is one a caller spread in from a row it was copying —
 * and a create that adopted it would either collide with that row or resurrect
 * a deleted one. The crate mints the id (B-5, client-minted where the client is
 * the file), and `create-transaction-an-empty-id-is-generated-not-stored`
 * records the same decision on the other side of the wire.
 *
 * `needs_review` is absent because the verb has no such argument: a row a person
 * typed is born reviewed, by the column's own default, and
 * `20260810090000` says at length why the create path needed no edit for it.
 */
const CREATE_KEYS: readonly string[] = [
  'account_id',
  'description',
  'amount',
  'type',
  'date',
  'category',
  'notes',
  'tags',
  'is_recurring',
  'transfer_account_id',
  'statement_sequence',
  'category_confirmed',
  'is_cleared'
];

/**
 * What one row of `import_transactions` accepts.
 *
 * Two absences carry meaning. `account_id` is not here because the account is
 * one argument for the whole call — the boundary that stops a file scattering
 * rows into accounts the caller does not own, and the reason the destination
 * the user picked beats whatever each row's parser guessed.
 *
 * `needs_review` is not here because the verb writes it as a LITERAL: every row
 * a file brings in is new work, whatever the draft says. Passing the draft's
 * value through would make the register's bold depend on each of three parsers
 * remembering a key, and a parser that forgets fails silently.
 */
const IMPORT_KEYS: readonly string[] = [
  'description',
  'amount',
  'type',
  'date',
  'category',
  'notes',
  'tags',
  'is_recurring',
  'is_cleared',
  'statement_sequence',
  'category_confirmed'
];

/**
 * What one line of `set_transaction_splits_with_legs` accepts — the five, and
 * the crate names them in the same order.
 *
 * `sort_order` is not one of them: display order IS the order of the array, and
 * the verb numbers the lines itself. A caller that sent both could contradict
 * itself, and the loser would be whichever the writer happened to read second.
 */
const SPLIT_LINE_KEYS: readonly string[] = [
  'id',
  'category',
  'amount',
  'memo',
  'transfer_account_id'
];

/** A draft as `create_transaction`'s payload. */
export const toCreatePayload = (draft: Omit<Transaction, 'id'>): Record<string, unknown> =>
  payloadOf(TRANSACTION_COLUMNS, { ...draft }, CREATE_KEYS);

/** One draft as one row of an import request. */
export const toImportRow = (draft: Omit<Transaction, 'id'>): Record<string, unknown> =>
  payloadOf(TRANSACTION_COLUMNS, { ...draft }, IMPORT_KEYS);

/** One line as the split writer reads it, in the order it was handed. */
export const toSplitLine = (line: TransactionSplitInput): Record<string, unknown> =>
  payloadOf(SPLIT_COLUMNS, { ...line }, SPLIT_LINE_KEYS);

/**
 * A partial edit as `update_transaction`'s patch.
 *
 * Every key the caller STATED, and only those: a field that is absent means
 * "leave it alone" to every one of the crate's tri-state fields, so adding one
 * here would be the port making an edit nobody asked for. A key present with
 * `undefined` is treated as absent — it is what an object spread produces for a
 * field that was never set, and JSON has no way to carry it anyway. A key
 * present with `null` is a STATEMENT and travels as one; `transfer_account_id:
 * null` is how the app un-points a stranded leg.
 *
 * A field this table does not know travels under its own name, unconverted. It
 * will be refused — that is D-7, and the header says why the refusal is the
 * point rather than a rough edge.
 */
export function toUpdatePatch(updates: Partial<Transaction>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    const column = TRANSACTION_COLUMNS.find(entry => entry.field === field);
    if (column === undefined) {
      patch[field] = value;
      continue;
    }
    patch[column.key] = encode(column.kind, value);
  }
  return patch;
}
