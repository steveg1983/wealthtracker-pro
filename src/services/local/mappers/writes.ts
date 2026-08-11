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
 *
 * THE ACCOUNT PAIR TAKES THE SAME TWO SHAPES, and for once the update's half is
 * not a divergence at all: `mapAccountToDb` sends a field it has no column for
 * under its own name, and PostgREST then refuses the whole update because there
 * is no such column. So both engines refuse an unrecognised account field, and
 * the local `deny_unknown_fields` is parity rather than strictness. What the
 * account update DOES drop is listed and argued at
 * {@link ACCOUNT_UPDATE_DROPS} — two of them are the cloud's own drop-list and
 * three are timestamps a caller has no business stating.
 *
 * THE CATEGORY PAIR IS FILTERED ON BOTH SIDES, which is neither of the two
 * shapes above and is the third thing a cloud mapper can be. `categoryToDb` is a
 * WHITELIST — eleven `if (c.k !== undefined)` lines and no else — so a key it
 * has no line for never reaches the cloud's table at all. Passing one through
 * would make the local edition refuse an edit the cloud performs, and the field
 * it would refuse on is a real one: `Category.description` exists in the app's
 * type and has a column in neither engine.
 *
 * So the rule is not "creates filter and updates do not". It is: **do what the
 * cloud's own mapper does with a key it has never heard of.** For a transaction
 * that is discard-on-create and send-on-update; for an account it is send in
 * both directions; for a category it is discard in both.
 */

import { getDefaultCategories } from '../../../data/defaultCategories';
import type {
  Account,
  AccountUpdate,
  Category,
  Transaction,
  TransactionSplitInput
} from '../../../types';
import type { Column } from './columns';
import {
  ACCOUNT_COLUMNS,
  CATEGORY_COLUMNS,
  SPLIT_COLUMNS,
  TRANSACTION_COLUMNS,
  encode,
  payloadOf
} from './columns';

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
  return whole(TRANSACTION_COLUMNS, updates as Record<string, unknown>, new Set());
}

// ── Accounts ────────────────────────────────────────────────────────────────

/**
 * What `create_account` accepts, out of the account's columns.
 *
 * `balance` is absent, and it is the most important absence in this file. The
 * seam hands over `Omit<Account, 'id'>`, which carries both `balance` and
 * `openingBalance` — and a ledger with no transactions cannot hold two different
 * figures without breaking B-1. The verb therefore takes ONE, `initial_balance`,
 * and sets the balance equal to it; which of the caller's two figures becomes
 * that one is decided in {@link toAccountCreatePayload} below, on the side that
 * has the caller's own type.
 *
 * `id` IS here, unlike the transaction create's key list, and for the opposite
 * reason to the one stated there: the seam's argument is `Omit<Account, 'id'>`
 * too, so an id can only arrive from a caller that minted one on purpose — and
 * the crate treats an absent id as "mint me one" (B-5). Nothing in the app sends
 * one today; the harness does, because two engines cannot be compared on a row
 * neither of them can name.
 */
const ACCOUNT_CREATE_KEYS: readonly string[] = [
  'id',
  'name',
  'type',
  'currency',
  'initial_balance',
  'is_active',
  'institution',
  'sort_code',
  'account_number',
  'opening_balance_date',
  'notes',
  'low_balance_alert_enabled',
  'low_balance_threshold'
];

/**
 * Fields of an `AccountUpdate` that are DROPPED rather than sent, and each one
 * is a decision.
 *
 * `holdings` and `tags` are the cloud's own drop-list (`mapAccountToDb`'s
 * `NOT_ACCOUNT_COLUMNS`): holdings live with the investments they belong to and
 * tags are not stored on an account, so sending either would fail the whole
 * update rather than just that field.
 *
 * The three timestamps are this edition's addition, and the reason is the one
 * every write verb here gives about `updated_at`: the crate stamps it from the
 * file's own clock INSIDE the write's transaction, so that the row, the To/From
 * category C-4 touches and the audit entry all carry one instant. A caller's
 * copy of a timestamp is not an instruction — it is what the caller last read —
 * and the cloud accepting one is how a stale client comes to backdate a row it
 * has just edited.
 */
const ACCOUNT_UPDATE_DROPS = new Set(['holdings', 'tags', 'createdAt', 'updatedAt', 'lastUpdated']);

/**
 * A new account as `create_account`'s payload.
 *
 * THE ONE FIGURE. `initial_balance` is `openingBalance || balance || 0`, falsy
 * -wise, which is `accountService.createAccount`'s own expression for the same
 * column (`account.openingBalance || account.balance || 0`) — so an account
 * created here opens at the figure the cloud would have called its initial
 * balance. In production the two are always the same number anyway:
 * `AppContextSupabase.addAccount` sets `balance = initialBalance || balance || 0`
 * before the seam is called. When they differ, the opening balance is the one a
 * ledger can honour, and `contract.ts`'s `ACCOUNT_BALANCE_AT_BIRTH` declares it.
 *
 * FILTERED, like the transaction create and for the same reason:
 * `Omit<Account, 'id'>` carries `plaidAccountId`, `mask`, `holdings` and half a
 * dozen others the verb has no argument for, and sending them would make every
 * ordinary create a refusal.
 */
export function toAccountCreatePayload(account: Omit<Account, 'id'>): Record<string, unknown> {
  const opening = account.openingBalance || account.balance || 0;
  return payloadOf(
    ACCOUNT_COLUMNS,
    { ...account, openingBalance: opening },
    ACCOUNT_CREATE_KEYS
  );
}

/**
 * A partial edit as `update_account`'s patch.
 *
 * PASSED THROUGH WHOLE, minus {@link ACCOUNT_UPDATE_DROPS}, which is exactly
 * what `mapAccountToDb` does: *"`undefined` means 'leave this alone' and is
 * dropped; `null` means 'clear the stored value' and is kept"*, and a field it
 * has no column for travels under its own name — where PostgREST refuses the
 * whole update because there is no such column. The local twin of that refusal
 * is `deny_unknown_fields`, so the two engines agree about an unrecognised field
 * as well as about a recognised one.
 *
 * `balance` is the one field that is recognised AND refused, by name. It is in
 * the column table for that purpose alone; the verb's module documentation says
 * why the refusal is worth more than the silence.
 */
export function toAccountUpdatePatch(updates: AccountUpdate): Record<string, unknown> {
  return whole(ACCOUNT_COLUMNS, updates as Record<string, unknown>, ACCOUNT_UPDATE_DROPS);
}

// ── Categories ──────────────────────────────────────────────────────────────

/**
 * What `create_category` accepts, out of the category's columns.
 *
 * `id` is absent, for the reason the transaction create gives and the account
 * create does not: the seam's argument is `Omit<Category, 'id'>`, and the crate
 * mints one (B-5, client-minted where the client is the file). The verb DOES
 * accept an id — the differential harness sends one, because two engines cannot
 * be compared on a row neither can name — and nothing in the app has one to
 * send.
 *
 * Everything else `categoryToDb` can produce is here, including the three
 * semantic flags: a RESTORE is the caller that legitimately states
 * `isTransferCategory`, and what stops an ordinary category acquiring an
 * `accountId` is the file's own CHECK rather than an omission here.
 */
const CATEGORY_CREATE_KEYS: readonly string[] = [
  'name',
  'type',
  'level',
  'parent_id',
  'account_id',
  'color',
  'icon',
  'is_system',
  'is_transfer_category',
  'is_revaluation_category',
  'is_unassigned_bucket',
  'is_active'
];

/** The same list, plus the id — because a SEED's ids are the whole point (B-4). */
const CATEGORY_SEED_KEYS: readonly string[] = ['id', ...CATEGORY_CREATE_KEYS];

/** A new category as `create_category`'s payload. */
export const toCategoryCreatePayload = (
  category: Omit<Category, 'id'>
): Record<string, unknown> => payloadOf(CATEGORY_COLUMNS, { ...category }, CATEGORY_CREATE_KEYS);

/**
 * A partial edit as `update_category`'s patch.
 *
 * FILTERED, unlike the two update builders above it, and the header says why in
 * one line: `categoryToDb` is a whitelist. `Partial<Category>` carries
 * `description`, which has a column in neither engine and which the cloud's
 * mapper silently drops — so a port that sent it would refuse an edit the cloud
 * performs.
 *
 * A field stated as `null` still travels as `null`: `payloadOf` drops only what
 * is `undefined`, and the crate's tri-state fields read a stated null as "clear
 * this" and absence as "leave it alone". That distinction is what lets the
 * Categories page move a leaf out of a group.
 */
export const toCategoryUpdatePatch = (
  updates: Partial<Category>
): Record<string, unknown> => payloadOf(CATEGORY_COLUMNS, { ...updates }, CATEGORY_CREATE_KEYS);

/**
 * The default category tree, as `seed_categories` takes it.
 *
 * THE TREE IS THE APP'S, and it crosses the seam rather than living in the
 * crate. `src/data/defaultCategories.ts` is the one list all three engines use —
 * browser storage answers with it unwritten, the cloud migrates it into per-user
 * uuids, and a device seeds it — and a second copy in Rust would go stale the
 * first time a group was added to the starter set with nothing to catch it.
 * `migrate_categories_atomic` takes the client's list for exactly the same
 * reason, which is why the verb's payload has the same shape.
 *
 * THE IDS TRAVEL, and that is divergence B-4 in one line: `'type-income'` and
 * `'transfer-in'` are stored as themselves, because `schema.sql` puts the uuid
 * CHECK on `users.id` alone (PHASE3-PLAN D-5) and a file has no second id space
 * to remap into.
 *
 * Computed per call rather than cached: it is a pure function of a constant
 * array, it is asked once per boot at most, and a module-level constant would be
 * a copy that a test which mutates a category could reach.
 */
export const defaultCategorySeed = (): Array<Record<string, unknown>> =>
  getDefaultCategories().map(category =>
    payloadOf(CATEGORY_COLUMNS, { ...category }, CATEGORY_SEED_KEYS)
  );

/**
 * Every key a caller STATED, converted where this table knows the column and
 * carried under its own name where it does not.
 *
 * The shared shape of both update builders. A key present with `undefined` is
 * treated as absent — it is what an object spread produces for a field that was
 * never set, and JSON has no way to carry it anyway. A key present with `null`
 * is a STATEMENT and travels as one.
 */
function whole(
  columns: readonly Column[],
  updates: Record<string, unknown>,
  dropped: ReadonlySet<string>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (dropped.has(field)) continue;
    const column = columns.find(entry => entry.field === field);
    if (column === undefined) {
      patch[field] = value;
      continue;
    }
    patch[column.key] = encode(column.kind, value);
  }
  return patch;
}
