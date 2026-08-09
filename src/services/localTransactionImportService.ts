import type { Account, Transaction } from '../types';
import type { BulkImportResult } from './port/dataPort';
import { storageAdapter, STORAGE_KEYS } from './storageAdapter';
import { normalizeTransactionDates, toDateValue } from '../utils/dateBoundary';
import { toDecimal } from '../utils/decimal';
import { createScopedLogger } from '../loggers/scopedLogger';

/**
 * Bulk transaction import for local/demo mode — the DEVICE half of the seam's
 * `importTransactions`, and the no-cloud twin of transactionImportService.
 *
 * ── WHY IT EXISTS ───────────────────────────────────────────────────────────
 * Signed in, a file import goes to /api/data/import-transactions, which puts
 * the whole batch through `import_transactions_atomic`: one database
 * transaction, so the statement lands whole or not at all and the account
 * balance moves by exactly the sum of the rows that landed.
 *
 * Local mode had no equivalent. It wrote the file one `addTransaction` at a
 * time, and each of those is its own read-modify-write of two storage keys. A
 * failure on row 400 of 900 left 399 transactions in the register with an
 * account balance the user could neither explain nor undo — and no import can
 * be described as having "succeeded with 399" when nothing recorded which 399.
 *
 * ── HOW IT IS ATOMIC ────────────────────────────────────────────────────────
 * `setMany` is ONE IndexedDB readwrite transaction (see storageAdapter, which
 * deliberately drops the per-key localStorage fallback `set` has for exactly
 * this reason). Transactions and the account's balance are written in that one
 * call, so the two can never disagree: either the rows and the balance both
 * moved, or neither did and storage is byte-for-byte what it was. Same promise
 * the cloud RPC makes, made the only way the browser can make it — the same
 * pattern localBackupService and msMoneyImport already use.
 *
 * ── WHAT IT DOES NOT DO ─────────────────────────────────────────────────────
 * It does not update React state. Both paths finish the same way, by asking the
 * context to re-read accounts and transactions, so the screen shows what the
 * store actually holds rather than what the caller hoped it would.
 */

/**
 * The slice of browser storage this import writes through.
 *
 * Narrow on purpose: `get` for the two collections it must extend, `setMany`
 * for the single write that makes the extension atomic. Injectable so tests can
 * drive the failure branch without a fake IndexedDB.
 */
export interface LocalTransactionImportStore {
  get<T>(key: string): Promise<T | null>;
  setMany(entries: ReadonlyArray<{ key: string; value: unknown }>): Promise<void>;
}

export interface LocalImportOptions {
  /** Defaults to the adapter every local reader in the app reads through. */
  store?: LocalTransactionImportStore;
  /** Defaults to crypto.randomUUID. */
  uuid?: () => string;
}

const logger = createScopedLogger('LocalTransactionImportService');

const defaultUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

/**
 * Append a file's transactions to browser storage, all or nothing.
 *
 * Returns the same shape the cloud path returns so a caller can report one
 * outcome without caring which path ran. `inserted` is what LANDED: 0 or every
 * row, because one storage write cannot land in part.
 *
 * `alreadyPresent` is always 0, and that is a statement rather than a stub.
 * The cloud path can find rows the database already holds under this import's
 * own id, because a request there can be re-posted after a timeout it never saw
 * the answer to. A local write has no request, no timeout and no id to collide
 * with: nothing between the caller and IndexedDB can duplicate a call.
 */
export async function importTransactionsLocally(
  accountId: string,
  transactions: ReadonlyArray<Omit<Transaction, 'id'>>,
  options: LocalImportOptions = {}
): Promise<BulkImportResult> {
  const total = transactions.length;
  if (total === 0) {
    return { inserted: 0, alreadyPresent: 0, total: 0, complete: true };
  }

  const store = options.store ?? storageAdapter;
  const newId = options.uuid ?? defaultUuid;

  try {
    const heldTransactions = normalizeTransactionDates(
      (await store.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS)) ?? []
    );
    const heldAccounts = (await store.get<Account[]>(STORAGE_KEYS.ACCOUNTS)) ?? [];

    const destination = heldAccounts.find(account => account.id === accountId);
    if (!destination) {
      // The same refusal `import_transactions_atomic` makes with
      // account_not_found_or_not_owned. Writing the rows anyway would file a
      // statement against an account that does not exist: invisible in every
      // register, and counted in no balance.
      return {
        inserted: 0,
        alreadyPresent: 0,
        total,
        complete: false,
        error: 'The account these transactions were being imported into no longer exists.'
      };
    }

    // Decimal, never floats: this is an account's ledger balance, and adding
    // 900 statement rows as IEEE doubles drifts it by pence that then have to
    // be explained. Accumulated once for the batch, matching the RPC's single
    // `balance = balance + v_sum`.
    let delta = toDecimal(0);
    const imported: Transaction[] = transactions.map(transaction => {
      delta = delta.plus(toDecimal(transaction.amount));
      return {
        ...transaction,
        // The destination the user chose wins over whatever the parser guessed,
        // exactly as the cloud path's p_account_id does for every row.
        accountId,
        // These rows go straight back into app state via the context refresh,
        // so the date must be a real Date and not the string a file gave.
        date: toDateValue(transaction.date),
        id: newId()
      };
    });

    const nextAccounts = heldAccounts.map(account =>
      account.id === accountId
        ? { ...account, balance: toDecimal(account.balance ?? 0).plus(delta).toNumber() }
        : account
    );

    // THE atomic write. Both keys, one IndexedDB transaction: the register and
    // the balance move together or not at all.
    await store.setMany([
      { key: STORAGE_KEYS.TRANSACTIONS, value: [...heldTransactions, ...imported] },
      { key: STORAGE_KEYS.ACCOUNTS, value: nextAccounts }
    ]);

    return { inserted: total, alreadyPresent: 0, total, complete: true };
  } catch (error) {
    logger.error('Local import failed; storage left untouched', error);
    return {
      inserted: 0,
      alreadyPresent: 0,
      total,
      complete: false,
      error: error instanceof Error ? error.message : 'Import failed'
    };
  }
}
