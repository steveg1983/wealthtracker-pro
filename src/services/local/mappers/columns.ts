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
 * Transactions, split lines, accounts, categories — and, since slice 22,
 * budgets and goals. Dismissals are the last one still read-only: their write
 * verbs are slice 23, and a one-directional mapping has nothing to disagree
 * with, so they stay written out in `rows.ts` where they can be read beside the
 * cloud twin they have to agree with. Each entity joins this table in the commit
 * that gives it a writer, and the promise has now been kept three times running:
 * `toCategory`, `toBudget` and `toGoal` each moved out of hand-written property
 * access and into `fieldsOf` in the same commit as their own create payload.
 *
 * ── WHAT A ROW HERE CANNOT SAY, AND WHERE THAT LIVES INSTEAD ────────────────
 *
 * One column, one field. That is the whole shape of the table, and two of this
 * slice's mappings do not fit it:
 *
 *   `Goal.progress` and `Goal.currentAmount` are ONE column, and `goalToDb`
 *   gives `progress` precedence over `currentAmount`;
 *   `Goal.isActive` and `Goal.achieved` are both derived from `status`, and the
 *   write direction has to fold three app fields back into one.
 *
 * Neither is a correspondence, so neither is here: they are ASSEMBLY, and
 * `writes.ts` owns them beside the account create's `openingBalance || balance
 * || 0`, which folds two app fields into one column for exactly the same reason.
 * The read direction's half lives in `rows.ts`. What this table holds for a goal
 * is the fifteen columns whose name and conversion really are one thing in both
 * directions.
 *
 * ACCOUNTS ARE THE ONE ENTRY HERE WHOSE READ DOES NOT COME BACK THROUGH IT, and
 * that is a stronger arrangement rather than a hole in the rule. `rows.ts`'s
 * `toAccount` is `mapAccountFromDb` — *the* cloud translation, the one that
 * exists because there used to be two of them — so the read direction is not
 * "another interpretation of this table", it is literally the same function the
 * signed-in boot uses. What this table owns for an account is therefore the
 * WRITE: the wire key, and the conversion. Its correspondence is checked against
 * `accountMapping.ts`'s own `ACCOUNT_FIELD_TO_COLUMN`, which is the map the read
 * side is built from, and any disagreement shows up immediately as a field that
 * goes out under one name and comes back missing.
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
 * The database's word for a current account (`accounts_type_check`, migration
 * 20260720120000). The app says 'current' everywhere else, which is why
 * `accountMapping.ts` states the same constant for the cloud's two directions
 * and why the `accountType` kind below states it for these.
 */
const DB_CURRENT_ACCOUNT_TYPE = 'checking';

/**
 * How one value crosses. The same word governs both directions, which is what
 * makes "read as a day, written as a day" a property of the table rather than
 * of two functions that happen to agree today.
 */
export type Kind =
  | 'text'
  | 'money'
  | 'day'
  /**
   * A calendar day the APP keeps as a string rather than as a Date —
   * `Budget.startDate` and `Budget.endDate`.
   *
   * The same column and the same WRITE as `day`, and the opposite READ: a day
   * has no time and no zone, so a type that says `string` is a type that has
   * already answered the question, and re-deriving it through a Date could only
   * lose. Written out as its own kind rather than left to each mapper, because
   * "which of these two a column is" is exactly the sort of thing two mappers
   * come to disagree about — which is what this whole table exists to prevent.
   *
   * The account rows above keep `day` for the three columns that are strings in
   * `Account` too (`bankBalanceDate` and the two reconciled dates), and the
   * distinction costs nothing there: an account is read back through
   * `mapAccountFromDb` rather than through this table, so only the WRITE side is
   * ever used and the two kinds encode identically.
   */
  | 'dayText'
  | 'instant'
  | 'flag'
  | 'whole'
  | 'tags'
  /**
   * An account's type, which the app and the column spell differently: the app
   * says 'current' everywhere and `accounts_type_check` allows 'checking'.
   *
   * The rename is the CLIENT's in both editions — `accountService.ts:225` does
   * it before its insert, `accountMapping.ts`'s `accountTypeToDb` does it for an
   * update — so the crate stores what it is given and the CHECK judges it. A
   * verb that renamed it would be a second opinion about what a payload means.
   */
  | 'accountType';

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

/**
 * An account, column by column, for the WRITE direction.
 *
 * Every row is checked against `accountMapping.ts`'s `ACCOUNT_FIELD_TO_COLUMN`,
 * with `_minor` dropped: the crate's payload keys are the CLOUD's column names
 * because a verb's arguments are the cloud write's arguments, and `balance_minor`
 * is a storage detail on one engine that no wire should carry.
 *
 * `balance` IS here, and it is the one column no write can set. It is in the
 * table so that a caller which sends it — and `AccountUpdate` is a
 * `Partial<Account>`, so one will — reaches the verb's named refusal
 * (`account_balance_is_derived`) instead of an `unknown_field` about a key that
 * looks misspelled. The create's own key list leaves it out, which is a
 * different mechanism for the same rule: see `writes.ts`.
 */
export const ACCOUNT_COLUMNS: readonly Column[] = [
  { key: 'id', field: 'id', kind: 'text' },
  { key: 'name', field: 'name', kind: 'text' },
  { key: 'type', field: 'type', kind: 'accountType' },
  { key: 'currency', field: 'currency', kind: 'text' },
  { key: 'balance', field: 'balance', kind: 'money' },
  { key: 'initial_balance', field: 'openingBalance', kind: 'money' },
  { key: 'is_active', field: 'isActive', kind: 'flag' },
  { key: 'institution', field: 'institution', kind: 'text' },
  { key: 'sort_code', field: 'sortCode', kind: 'text' },
  { key: 'account_number', field: 'accountNumber', kind: 'text' },
  { key: 'opening_balance_date', field: 'openingBalanceDate', kind: 'day' },
  { key: 'archive_through_date', field: 'archiveThroughDate', kind: 'day' },
  { key: 'notes', field: 'notes', kind: 'text' },
  { key: 'low_balance_alert_enabled', field: 'lowBalanceAlertEnabled', kind: 'flag' },
  { key: 'low_balance_threshold', field: 'lowBalanceThreshold', kind: 'money' },
  { key: 'bank_balance', field: 'bankBalance', kind: 'money' },
  // A STRING in the app's own type, and deliberately: the column is a calendar
  // day, and wrapping one in a Date invents a midnight that has to belong to
  // some zone. `asDay` passes a string through untouched for that reason.
  { key: 'bank_balance_date', field: 'bankBalanceDate', kind: 'day' },
  { key: 'last_reconciled_date', field: 'lastReconciledDate', kind: 'day' },
  { key: 'last_reconciled_balance', field: 'lastReconciledBalance', kind: 'money' },
  { key: 'parent_account_id', field: 'parentAccountId', kind: 'text' }
];

/**
 * A category, column by column.
 *
 * Thirteen of the sixteen the table has. The three that are not here are the
 * three no direction wants: `user_id` is the port's own (`#ask` adds it and no
 * method below could send another), and `created_at`/`updated_at` are stamped by
 * the file's clock inside the write's transaction — a caller's copy of a
 * timestamp is what it last read, not an instruction, which is the same rule
 * `writes.ts` states for an account's three.
 *
 * `type` and `level` are plain text and NOT an enumerated kind, because the
 * app's words and the column's words are the same words here. An account needed
 * `accountType` for the one place they differ ('current' against 'checking');
 * a category's `income | expense | both` and `type | sub | detail` are spelled
 * identically on both sides of the wire, and the CHECK is what judges an unknown
 * one — on both engines, with the same message.
 *
 * `is_transfer_category` is writable, which looks alarming beside C-3 and is
 * right: a RESTORE brings a backup's own To/From rows and has to be able to say
 * so. What stops an ordinary category acquiring one is the file, through
 * `categories_account_only_for_transfer` — a CHECK the cloud has never had.
 */
export const CATEGORY_COLUMNS: readonly Column[] = [
  { key: 'id', field: 'id', kind: 'text' },
  { key: 'name', field: 'name', kind: 'text' },
  { key: 'type', field: 'type', kind: 'text' },
  { key: 'level', field: 'level', kind: 'text' },
  { key: 'parent_id', field: 'parentId', kind: 'text' },
  { key: 'account_id', field: 'accountId', kind: 'text' },
  { key: 'color', field: 'color', kind: 'text' },
  { key: 'icon', field: 'icon', kind: 'text' },
  { key: 'is_system', field: 'isSystem', kind: 'flag' },
  { key: 'is_transfer_category', field: 'isTransferCategory', kind: 'flag' },
  { key: 'is_revaluation_category', field: 'isRevaluationCategory', kind: 'flag' },
  { key: 'is_unassigned_bucket', field: 'isUnassignedBucket', kind: 'flag' },
  { key: 'is_active', field: 'isActive', kind: 'flag' }
];

/**
 * A budget, column by column.
 *
 * Twelve of the eighteen the table has, and the six absences are each a
 * decision. `user_id` is the port's own (`#ask` adds it and no method below
 * could send another) and `created_at`/`updated_at` are stamped by the file's
 * clock inside the write's transaction — the same rule the category table
 * states. `category_id` is the uuid twin the app never writes: `budgetFromDb`
 * reads the TEXT `category` column and says why, and `budgetToDb` has no line
 * for the other one at all, so a port that sent it would write a column the
 * cloud's own writer leaves to `merge_categories`. `spent` and `id` are the two
 * that differ by DIRECTION rather than by existence, and `writes.ts` handles
 * them in its key lists.
 *
 * `alertThreshold` is the one row here that is not money and is shaped like it:
 * a two-place decimal, crossing as text in both directions, because the column
 * is `numeric(5,2)` in the cloud and an INTEGER count of hundredths of a percent
 * in a file. Reading it with the money reader is what keeps a `/ 100` off this
 * side of the boundary — the shape R-7's grep exists to catch, whether or not
 * the quantity is money. `rows.ts` says the same thing from the other end.
 */
export const BUDGET_COLUMNS: readonly Column[] = [
  { key: 'id', field: 'id', kind: 'text' },
  { key: 'name', field: 'name', kind: 'text' },
  { key: 'amount', field: 'amount', kind: 'money' },
  { key: 'period', field: 'period', kind: 'text' },
  // The app calls it `categoryId`; the column that holds it is `category`.
  { key: 'category', field: 'categoryId', kind: 'text' },
  // Strings in the app's own type, like an account's `bankBalanceDate`.
  { key: 'start_date', field: 'startDate', kind: 'dayText' },
  { key: 'end_date', field: 'endDate', kind: 'dayText' },
  { key: 'spent', field: 'spent', kind: 'money' },
  { key: 'rollover', field: 'rollover', kind: 'flag' },
  { key: 'rollover_amount', field: 'rolloverAmount', kind: 'money' },
  { key: 'alert_threshold', field: 'alertThreshold', kind: 'money' },
  { key: 'is_active', field: 'isActive', kind: 'flag' },
  { key: 'notes', field: 'notes', kind: 'text' }
];

/**
 * A goal, column by column — the fifteen that really are one column and one
 * field. See the header for the three that are not.
 *
 * `metadata` is a column and not a field: three app fields ride in it (`type`,
 * `linkedAccountIds`, `contributionAmount`), and both directions assemble it.
 * It is therefore absent from this table and present in both mappers, which is
 * the same arrangement `status` has.
 *
 * `completed_at` is `instant` in one direction only. The app's `Goal.completedAt`
 * is an ISO STRING rather than a Date (`types/index.ts`), and `encode`'s
 * `instant` passes a string through untouched — which is right, because the
 * value a caller holds is one this port answered with. `rows.ts` turns it back
 * into a string on the way in.
 */
export const GOAL_COLUMNS: readonly Column[] = [
  { key: 'id', field: 'id', kind: 'text' },
  { key: 'name', field: 'name', kind: 'text' },
  { key: 'description', field: 'description', kind: 'text' },
  { key: 'target_amount', field: 'targetAmount', kind: 'money' },
  { key: 'current_amount', field: 'currentAmount', kind: 'money' },
  { key: 'target_date', field: 'targetDate', kind: 'day' },
  { key: 'category', field: 'category', kind: 'text' },
  { key: 'priority', field: 'priority', kind: 'text' },
  { key: 'status', field: 'status', kind: 'text' },
  { key: 'completed_at', field: 'completedAt', kind: 'instant' },
  { key: 'account_id', field: 'accountId', kind: 'text' },
  { key: 'contribution_frequency', field: 'contributionFrequency', kind: 'text' },
  { key: 'auto_contribute', field: 'autoContribute', kind: 'flag' },
  { key: 'icon', field: 'icon', kind: 'text' },
  { key: 'color', field: 'color', kind: 'text' }
];

/** One stored value on its way IN, or `undefined` where the answer said nothing. */
const decode = (kind: Kind, value: unknown): unknown => {
  switch (kind) {
    case 'accountType':
      // The inverse of the rename below. Unused today — an account is read back
      // through `mapAccountFromDb`, which does its own — and written out rather
      // than thrown, because a kind whose two directions are not inverses is a
      // kind that will one day be used in the direction nobody implemented.
      return value === DB_CURRENT_ACCOUNT_TYPE ? 'current' : text(value);
    case 'text':
      return text(value);
    case 'money':
      return money(value);
    case 'day':
      return day(value);
    case 'dayText':
      // The stored day, verbatim. See the kind's own documentation.
      return text(value);
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
    case 'accountType':
      // `accountTypeToDb`, and nothing more: every other value the app's union
      // holds is a value `accounts_type_check` allows, so the CHECK is what
      // judges an unknown one — on both engines, with the same message.
      return value === 'current' ? DB_CURRENT_ACCOUNT_TYPE : String(value);
    case 'text':
      return typeof value === 'string' ? value : String(value);
    case 'money':
      // See the header: the number's own decimal text, never rounded and never
      // multiplied. The crate's money boundary is what judges it.
      return typeof value === 'number' ? String(value) : value;
    case 'day':
    case 'dayText':
      // ONE encoder for both, which is the point of them being one column type:
      // a string passes through and a Date names its UTC day (divergence D-8).
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
