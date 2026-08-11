/**
 * The columns, declared ONCE and read in both directions.
 *
 * ── WHY A TABLE AND NOT TWO FUNCTIONS ───────────────────────────────────────
 *
 * Until this slice the mappers only went one way: a crate answer became an app
 * object and nothing ever went back. A second direction is where a translation
 * layer earns its worst bug, and the bug has a shape — one side learns a
 * column, or renames one, or converts it a shade differently, and the other
 * does not. The value then crosses out under one name and back under another,
 * and the only evidence is a field that quietly stops changing.
 *
 * `localCore.fixtureFile.ts` had already met this and answered it, in its own
 * words: *"two independent CONVERSIONS would not be [worth having]. If the
 * writer decided that £70.10 is 7010 and the reader decided it is 7010 by its
 * own route, a shared mistake in the two routes would still cancel out and a
 * real disagreement between them would look like a fixture bug."* So it
 * declared its columns once and made the writer and the reader two
 * interpretations of that list. This file is the same discipline on the port's
 * side of the boundary, and it is the reason a field cannot round-trip
 * differently from the way it crosses: there is one row per column, carrying
 * the wire key, the app field and the kind, and BOTH directions read it.
 *
 * What is deliberately NOT shared is ASSEMBLY — which fields a verb sends,
 * which are required, what a missing value defaults to. Those genuinely differ
 * per direction and per verb (`create_transaction` takes a whole draft,
 * `update_transaction` takes a patch, an import row takes thirteen keys), and
 * pretending otherwise would make the table a place to hide a decision.
 * `rows.ts` holds the read assembly, `writes.ts` the write assembly, and this
 * file holds nothing but the correspondence.
 *
 * ── ONLY THE ENTITIES THAT REALLY GO BOTH WAYS ──────────────────────────────
 *
 * Transactions and split lines, and no more. Accounts, categories, budgets,
 * goals and dismissals are read-only at this slice — their write verbs are
 * slices 20 to 23 — and a one-directional mapping has nothing to disagree
 * with, so the five of them stay written out in `rows.ts` where they can be
 * read beside the cloud twin each one has to agree with. Each joins this table
 * in the commit that gives it a writer.
 *
 * ── MONEY CROSSES AS THE NUMBER'S OWN DECIMAL TEXT ──────────────────────────
 *
 * On the way out, `amount` becomes `String(amount)` — NOT `toFixed(2)`, and
 * emphatically not `amount * 100`. Both of those look tidier and both destroy
 * the property M-1 exists for.
 *
 * `toFixed(2)` ROUNDS. The seam declares that the local core REFUSES an amount
 * below a penny (`SUB_PENNY_AMOUNT`), and the crate does refuse one — but only
 * if it is ever shown one. A port that rounded −0.125 to "-0.13" on the way in
 * would turn a refusal into a silent invention of half a penny, and the engine
 * would look like the cloud while behaving like neither.
 *
 * `* 100` is worse and is banned outright under this directory: it is float
 * arithmetic on money (30.6 * 100 is 3059.9999999999995), and the rounding that
 * hides it is the thing being hidden. There is no `* 100` and no `/ 100` here
 * to find — the same greppable rule `values.ts` states for the other direction.
 *
 * So the number's own decimal spelling goes over the wire and the crate judges
 * it: "0.2", "-70.1", "0" and "30.6" are all accepted and stored to the penny,
 * and "0.30000000000000004" — which is what a float sum of 0.1 and 0.2 actually
 * is — is refused by name. That is the correct answer to a figure the app
 * should never have arrived at.
 */

import { day, flag, instant, money, strings, text, whole } from './values';

/**
 * How one value crosses. The same word governs both directions, which is what
 * makes "read as a day, written as a day" a property of the table rather than
 * of two functions that happen to agree today.
 */
export type Kind = 'text' | 'money' | 'day' | 'instant' | 'flag' | 'whole' | 'tags';

export interface Column {
  /** The key on the wire, the same in both directions. */
  readonly key: string;
  /** The field the app spells it with. */
  readonly field: string;
  readonly kind: Kind;
}

/**
 * A transaction, column by column.
 *
 * `type` is the wire key, NOT `kind`. That distinction cost a slice: the crate's
 * Rust field is called `kind` because `type` is a reserved word there, and every
 * one of its row structs carries `#[serde(rename = "type")]` to put it back —
 * so the JSON a verb answers with, and the JSON a verb accepts, both say `type`.
 * Reading `kind` off an answer therefore found nothing at all, and because
 * `oneOf` is total, every transaction read from a file came back typed
 * 'expense', every category 'expense', and every account 'other'. Nothing threw;
 * the reads simply reported the wrong word. Now there is one row per column and
 * both directions use it, so the name can only be wrong in one place, where the
 * contract suite's transfer rules see it immediately.
 */
export const TRANSACTION_COLUMNS: readonly Column[] = [
  { key: 'id', field: 'id', kind: 'text' },
  { key: 'account_id', field: 'accountId', kind: 'text' },
  { key: 'amount', field: 'amount', kind: 'money' },
  { key: 'date', field: 'date', kind: 'day' },
  { key: 'description', field: 'description', kind: 'text' },
  { key: 'category', field: 'category', kind: 'text' },
  { key: 'category_confirmed', field: 'categoryConfirmed', kind: 'flag' },
  { key: 'needs_review', field: 'needsReview', kind: 'flag' },
  { key: 'type', field: 'type', kind: 'text' },
  { key: 'tags', field: 'tags', kind: 'tags' },
  { key: 'notes', field: 'notes', kind: 'text' },
  { key: 'is_cleared', field: 'cleared', kind: 'flag' },
  { key: 'is_recurring', field: 'isRecurring', kind: 'flag' },
  { key: 'is_split', field: 'isSplit', kind: 'flag' },
  { key: 'archived', field: 'archived', kind: 'flag' },
  { key: 'statement_sequence', field: 'statementSequence', kind: 'whole' },
  { key: 'created_at', field: 'createdAt', kind: 'instant' },
  { key: 'updated_at', field: 'updatedAt', kind: 'instant' },
  { key: 'linked_transfer_id', field: 'linkedTransferId', kind: 'text' },
  { key: 'transfer_account_id', field: 'transferAccountId', kind: 'text' },
  { key: 'linked_transfer_split_id', field: 'linkedTransferSplitId', kind: 'text' }
];

/**
 * A split line, column by column.
 *
 * `sort_order` is read and never written: display order is the ORDER OF THE
 * ARRAY the split writer is handed, and the verb assigns the numbers itself.
 * A caller that sent both could disagree with itself, which is why the crate's
 * line payload has five keys and this is not one of them.
 */
export const SPLIT_COLUMNS: readonly Column[] = [
  { key: 'id', field: 'id', kind: 'text' },
  { key: 'transaction_id', field: 'transactionId', kind: 'text' },
  { key: 'category', field: 'category', kind: 'text' },
  { key: 'amount', field: 'amount', kind: 'money' },
  { key: 'memo', field: 'memo', kind: 'text' },
  { key: 'sort_order', field: 'sortOrder', kind: 'whole' },
  { key: 'transfer_account_id', field: 'transferAccountId', kind: 'text' },
  { key: 'linked_transfer_id', field: 'linkedTransferId', kind: 'text' }
];

/** One stored value on its way IN, or `undefined` where the answer said nothing. */
const decode = (kind: Kind, value: unknown): unknown => {
  switch (kind) {
    case 'text':
      return text(value);
    case 'money':
      return money(value);
    case 'day':
      return day(value);
    case 'instant':
      return instant(value);
    case 'flag':
      // `flag` is total — it answers false for a key that is absent. That is
      // right for a listed row, where every column is present, and it is what
      // `rows.ts` documents for the columns a WRITE verb's projection leaves
      // out. See `localDataPort.ts` on what the write projection does not carry.
      return flag(value);
    case 'whole':
      return whole(value);
    case 'tags':
      return strings(value);
  }
};

/**
 * Every column of one answer row, converted, keyed by the APP's field name.
 *
 * Assembly is the caller's: this hands over a bag of converted values and says
 * nothing about which are required or what an absent one should become.
 */
export function fieldsOf(
  columns: readonly Column[],
  row: Record<string, unknown>
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const { key, field, kind } of columns) {
    values[field] = decode(kind, row[key]);
  }
  return values;
}

/**
 * One app value on its way OUT.
 *
 * `null` survives as `null` — it is a value the crate's tri-state fields
 * distinguish from absence, and flattening it would silently turn "clear this"
 * into "leave it alone". `undefined` returns `undefined` and the caller drops
 * the key, which is how "not stated" crosses.
 */
export const encode = (kind: Kind, value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  switch (kind) {
    case 'text':
      return typeof value === 'string' ? value : String(value);
    case 'money':
      // See the header: the number's own decimal text, never rounded and never
      // multiplied. The crate's money boundary is what judges it.
      return typeof value === 'number' ? String(value) : value;
    case 'day':
      return asDay(value);
    case 'instant':
      return value instanceof Date ? value.toISOString() : value;
    case 'flag':
      return value;
    case 'whole':
      return value;
    case 'tags':
      return Array.isArray(value) ? value.filter(entry => typeof entry === 'string') : value;
  }
};

/**
 * A calendar day as the file spells it, from whatever the app is holding.
 *
 * The app's own type says `Date` and the store's says 'YYYY-MM-DD', so an
 * instant has to be named as a day, and WHICH day is divergence D-8: this
 * engine takes the UTC day, browser storage compares instants and the cloud
 * converts through UTC. West of Greenwich those can disagree for an instant
 * near midnight, which is exactly why the seam tells callers to pass a cutoff
 * whose day is unambiguous, and why `values.day` reads a day back at NOON.
 *
 * A string is passed through untouched — a caller that already holds a day has
 * already answered the question, and re-deriving it could only lose.
 */
const asDay = (value: unknown): unknown => {
  if (typeof value === 'string') return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return value;
};

/**
 * The named columns of an app value, converted, keyed by the WIRE's name.
 *
 * `keys` is the verb's own allow-list, because a verb accepts what it accepts:
 * `create_transaction` and `update_transaction` and an import row are three
 * different subsets of one table, and every one of them refuses an unknown key
 * outright (`deny_unknown_fields`). Sending a column a verb has never heard of
 * would turn a caller's harmless extra field into a refused write.
 *
 * A field the app did not state is ABSENT from the payload rather than null:
 * the crate's tri-state fields read absence as "leave it alone", and a null as
 * "the caller said null", and those are different instructions.
 */
export function payloadOf(
  columns: readonly Column[],
  value: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const column of columns) {
    if (!keys.includes(column.key)) continue;
    if (!(column.field in value)) continue;
    const encoded = encode(column.kind, value[column.field]);
    if (encoded === undefined) continue;
    payload[column.key] = encoded;
  }
  return payload;
}
