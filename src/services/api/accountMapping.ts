/**
 * The ONE translation between an `accounts` row and the app's `Account`.
 *
 * It exists because there used to be two of them, each complete in the fields
 * the other forgot, and the app alternated between them within a single
 * session: the boot load went through simpleAccountService's mapper, and every
 * import, sync, realtime refresh and settings save came back through
 * accountService's. Neither was wrong on its own; together they made three
 * bugs that no amount of reading either file would explain.
 *
 *  1. The dashboard's low-balance alert never fired on a fresh boot. It reads
 *     `lowBalanceAlertEnabled`, which the boot mapper did not map.
 *  2. Worse: Account Settings turned the alert OFF when the user saved
 *     something else. The modal seeds its toggle from that same unmapped field
 *     (undefined → false) and writes the seeded value straight back, so a
 *     rename cost the user their alert.
 *  3. After any refresh, OFX statement matching went blind: the refresh mapper
 *     carried the row's `sort_code`/`account_number` but never produced the
 *     camelCase `sortCode`/`accountNumber` that findAccountByOfxIdentifiers
 *     reads, so a file that used to match its own account stopped matching.
 *
 * So the rule this module enforces is not "share some code": it is that an
 * account has ONE shape however it was loaded. Every field either mapper knew
 * about is here, checked against the columns the migrations actually create.
 *
 * Two things the schema says that the old mappers did not:
 *  • there is no `accounts.credit_limit` column — nothing has ever created one
 *    (see the note on CREDIT_LIMIT below);
 *  • there is no `accounts.last_updated` column either. The app's `lastUpdated`
 *    is `updated_at`, which is what localBackupService already says out loud.
 */

import type { Account, AccountUpdate } from '../../types';
import type { AccountType } from '../../types/accountType';

/**
 * The database spells a current account 'checking' (the accounts_type_check
 * constraint, migration 20260720120000). The app says 'current' everywhere
 * else, so the swap happens here and nowhere else.
 */
const DB_CURRENT_ACCOUNT_TYPE = 'checking';

/**
 * Every value `Account['type']` may hold, as a lookup so the check is a runtime
 * fact rather than an assertion. Written as a Record keyed by the union so that
 * adding a type to AccountType fails to compile until it is listed here.
 */
const ACCOUNT_TYPES: Record<AccountType, true> = {
  current: true,
  checking: true,
  savings: true,
  credit: true,
  cash: true,
  loan: true,
  mortgage: true,
  investment: true,
  asset: true,
  assets: true,
  liability: true,
  other: true
};

const isAccountType = (value: unknown): value is AccountType =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(ACCOUNT_TYPES, value);

/**
 * A stored `type` as the app understands it.
 *
 * Every value the accounts_type_check constraint allows is a value the app
 * knows, so a real row always survives this verbatim (bar the checking→current
 * rename). The fallback is for a row with no type at all, and it is 'other'
 * because that is already where the Accounts page files a type it has no
 * section for (sectionTypeForAccount in utils/accountGrouping) — an account is
 * never allowed to vanish just because its type was unreadable.
 */
export const accountTypeFromDb = (value: unknown): AccountType => {
  if (value === DB_CURRENT_ACCOUNT_TYPE) return 'current';
  return isAccountType(value) ? value : 'other';
};

/** The same rename on the way back down. */
export const accountTypeToDb = (value: unknown): unknown =>
  value === 'current' ? DB_CURRENT_ACCOUNT_TYPE : value;

/** A column value that should be text, and nothing pretending to be. */
const text = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

/**
 * A numeric column as a number.
 *
 * PostgREST sends `numeric` as a JSON number, but a driver or a fixture may
 * hand over the string form ('150.00'), so both are accepted. This is a read
 * of a stored figure, not arithmetic: money is added, subtracted and compared
 * in Decimal (see utils/decimal), never here.
 */
const numeric = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const flag = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

/** A timestamp/date column as a Date, and nothing that would be Invalid Date. */
const timestamp = (value: unknown): Date | undefined => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
};

/**
 * `Account.creditLimit` has no column and never has had one: no migration
 * creates `accounts.credit_limit`, and the local-edition mirror
 * (scripts/local-sqlite/schema.sql) does not have it either. The dashboard
 * reads it for credit utilisation, so it is mapped in both directions and will
 * work the day the column exists; until then it can only ever arrive from
 * local/demo storage, which is a fact about the schema, not a mapping bug.
 */
const CREDIT_LIMIT_COLUMN = 'credit_limit';

/**
 * A stored row as the app's Account.
 *
 * Takes the whole row and reads it field by field: an earlier version spread
 * the raw row into the result, which meant the object claimed to be an Account
 * while actually carrying snake_case keys nothing was typed to read, and hid
 * every gap behind an `as unknown as Account`. Nothing is spread here, so a
 * field that is missing is missing loudly.
 */
export function mapAccountFromDb(row: Record<string, unknown>): Account {
  return {
    // id and name are NOT NULL columns; the fallbacks only keep the mapper
    // total for a row that is not one.
    id: text(row.id) ?? '',
    name: text(row.name) ?? '',
    type: accountTypeFromDb(row.type),
    balance: numeric(row.balance) ?? 0,
    // Matches the column default, and the default every create path applies.
    currency: text(row.currency) ?? 'GBP',
    institution: text(row.institution) ?? '',
    isActive: flag(row.is_active),
    // `opening_balance` is not a column; it is read only so a row from an older
    // export that used that name still opens at the right figure.
    openingBalance: numeric(row.initial_balance) ?? numeric(row.opening_balance),
    openingBalanceDate: timestamp(row.opening_balance_date),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
    // There is no `last_updated` column on accounts — the app's lastUpdated is
    // updated_at. Both timestamps default to now() on insert, so the epoch
    // fallback is unreachable for a real row; it says "never recorded" rather
    // than claiming the account was touched a moment ago.
    lastUpdated: timestamp(row.updated_at) ?? timestamp(row.created_at) ?? new Date(0),
    bankBalance: numeric(row.bank_balance) ?? null,
    // A DATE arrives as 'YYYY-MM-DD' and stays that way — see Account.
    bankBalanceDate: text(row.bank_balance_date) ?? null,
    lastReconciledDate: timestamp(row.last_reconciled_date) ?? null,
    sortCode: text(row.sort_code) ?? '',
    accountNumber: text(row.account_number) ?? '',
    creditLimit: numeric(row[CREDIT_LIMIT_COLUMN]),
    notes: text(row.notes) ?? '',
    archiveThroughDate: timestamp(row.archive_through_date) ?? null,
    parentAccountId: text(row.parent_account_id) ?? null,
    // Strictly true: a database without migration 20260709140000 has no such
    // column, and "no column" must read as off rather than as undefined, which
    // the settings modal would then show as off anyway.
    lowBalanceAlertEnabled: row.low_balance_alert_enabled === true,
    lowBalanceThreshold: numeric(row.low_balance_threshold),
    plaidAccountId: text(row.plaid_account_id),
    plaidConnectionId: text(row.plaid_connection_id)
  };
}

/** camelCase Account field → the column it is stored in. */
const ACCOUNT_FIELD_TO_COLUMN: Record<string, string> = {
  openingBalance: 'initial_balance',
  openingBalanceDate: 'opening_balance_date',
  isActive: 'is_active',
  sortCode: 'sort_code',
  accountNumber: 'account_number',
  creditLimit: CREDIT_LIMIT_COLUMN,
  bankBalance: 'bank_balance',
  bankBalanceDate: 'bank_balance_date',
  lastReconciledDate: 'last_reconciled_date',
  lowBalanceAlertEnabled: 'low_balance_alert_enabled',
  lowBalanceThreshold: 'low_balance_threshold',
  archiveThroughDate: 'archive_through_date',
  parentAccountId: 'parent_account_id',
  plaidConnectionId: 'plaid_connection_id',
  plaidAccountId: 'plaid_account_id',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  // NOT `last_updated`: no such column exists, and an update that named one
  // would be rejected whole — taking the caller's real edit down with it.
  lastUpdated: 'updated_at'
};

/**
 * Account fields that are not columns of `accounts` at all. Holdings live with
 * the investments they belong to and tags are not stored on an account, so
 * sending either would fail the whole update rather than just that field.
 */
const NOT_ACCOUNT_COLUMNS = new Set<string>(['holdings', 'tags']);

/**
 * An update as the columns it writes.
 *
 * `undefined` means "leave this alone" and is dropped; `null` means "clear the
 * stored value" and is kept — the distinction AccountUpdate exists to express
 * (a card's sort code is cleared that way).
 */
export function mapAccountToDb(updates: AccountUpdate): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  const entries: [string, unknown][] = Object.entries(updates);
  for (const [field, value] of entries) {
    if (NOT_ACCOUNT_COLUMNS.has(field)) continue;
    if (value === undefined) continue;
    columns[ACCOUNT_FIELD_TO_COLUMN[field] ?? field] =
      field === 'type' ? accountTypeToDb(value) : value;
  }
  return columns;
}
