
import { supabase, isSupabaseConfigured, handleSupabaseError } from './supabaseClient';
import type { Transaction, TransactionSplit, TransactionSplitInput } from '../../types';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
import { transactionCache, newestUpdatedAt, type TransactionSnapshot } from '../transactionCache';
import { toDecimal } from '../../utils/decimal';
import { normalizeTransactionDates, toDateMs, toDateValue } from '../../utils/dateBoundary';
import type { ServerAccountBalance } from '../../utils/accountBalances';

type StorageAdapterLike = Pick<typeof storageAdapter, 'get' | 'set'>;
type TransactionCacheLike = {
  read(userId: string, columns: string): Promise<TransactionSnapshot | null>;
  write(userId: string, columns: string, rows: Transaction[]): Promise<void>;
  clear(): Promise<void>;
};
type SupabaseClientLike = typeof supabase;
type SupabaseConfiguredChecker = () => boolean;
type Logger = Pick<Console, 'error'>;
type UuidGenerator = () => string;
type DateProvider = () => Date;
type FetchLike = typeof fetch;
type AuthTokenProvider = () => Promise<string | null>;

export interface TransactionServiceOptions {
  supabaseClient?: SupabaseClientLike;
  isSupabaseConfigured?: SupabaseConfiguredChecker;
  storageAdapter?: StorageAdapterLike;
  logger?: Logger;
  now?: DateProvider;
  uuid?: UuidGenerator;
  fetchImpl?: FetchLike;
  authTokenProvider?: AuthTokenProvider;
  transactionCache?: TransactionCacheLike;
}

/**
 * How the boot got its transactions — reported on the boot-timing console line
 * so a slow (or a wrongly-fast) load can still be diagnosed from a screenshot
 * of a production console.
 */
export interface TransactionLoadStats {
  /** Rows served from the local snapshot; 0 when everything came over the wire. */
  cached: number;
  /** Rows this load pulled over the network. */
  fetched: number;
  /** Rows handed to the app. */
  total: number;
  /** Why the snapshot was not used, or null when it was. */
  fullFetchReason: string | null;
}

export interface TransactionLoadResult {
  transactions: Transaction[];
  stats: TransactionLoadStats;
}

/**
 * Supabase caps responses at 1000 rows (a hard server-side max-rows, not a
 * client default — asking for a larger range still returns only 1000).
 */
const PAGE_SIZE = 1000;
/**
 * The transfer is bandwidth-bound, so raising this buys nothing (measured).
 */
const PAGE_CONCURRENCY = 6;

/**
 * How far BEFORE the stored high-water mark the delta query reaches back.
 *
 * WHY: updated_at is stamped by a BEFORE UPDATE trigger with NOW(), which in
 * Postgres is the writing transaction's START time. A transaction that began
 * before our last snapshot but committed after it therefore lands with a
 * timestamp we have already read past, and a strict `> highWaterMark` delta
 * would never see it. Re-reading the last few minutes costs a handful of rows
 * and closes that window; anything longer-running than this is a bulk import,
 * whose INSERTs the row-count check below catches regardless.
 */
const DELTA_OVERLAP_MS = 10 * 60 * 1000;

/** The oldest updated_at the delta query must ask for. */
export function deltaFloor(highWaterMark: string): string {
  const ms = Date.parse(highWaterMark);
  if (!Number.isFinite(ms)) return highWaterMark;
  return new Date(ms - DELTA_OVERLAP_MS).toISOString();
}

/**
 * A transaction's date as a comparable instant.
 *
 * Compared as a NUMBER, not as text: every row reaching this point has been
 * through the date boundary (mapFromDbFields for a fetched row, the snapshot
 * normalisation for a cached one), so the old lexicographic string compare
 * would now be sorting `toISOString()` output — correct, but only by accident
 * and only while every row carries the same string format. An unusable date
 * sorts oldest rather than poisoning the comparator with NaN.
 */
function sortableTime(transaction: Transaction): number {
  const ms = toDateMs(transaction.date);
  return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
}

/**
 * Fold freshly-changed rows into a cached snapshot, restoring the server's
 * ordering (date DESC, id DESC — the same tiebreak the paged fetch uses, so
 * cached and freshly-fetched sets are indistinguishable to every consumer).
 *
 * A delta row REPLACES the cached row with the same id; ids the cache has never
 * seen are additions. Deletions cannot appear here — they are handled by the
 * row-count check in loadTransactionsForBoot.
 */
export function mergeTransactionDelta(cached: Transaction[], delta: Transaction[]): Transaction[] {
  const byId = new Map<string, Transaction>();
  for (const row of cached) byId.set(row.id, row);
  for (const row of delta) byId.set(row.id, row);

  return Array.from(byId.values()).sort((a, b) => {
    const timeA = sortableTime(a);
    const timeB = sortableTime(b);
    if (timeA !== timeB) return timeB - timeA;
    if (a.id === b.id) return 0;
    return a.id < b.id ? 1 : -1;
  });
}

/** Map camelCase Transaction fields to snake_case DB columns */
const CAMEL_TO_DB: Record<string, string> = {
  accountId: 'account_id',
  cleared: 'is_cleared',
  isRecurring: 'is_recurring',
  categoryId: 'category_id',
  transferAccountId: 'transfer_account_id',
  bankReference: 'bank_reference',
  isImported: 'is_imported',
  categoryConfirmed: 'category_confirmed',
  isSplit: 'is_split',
  goalId: 'goal_id',
  accountName: 'account_name',
  categoryName: 'category_name',
  statementSequence: 'statement_sequence',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  recurringTransactionId: 'recurring_transaction_id',
  linkedTransferId: 'linked_transfer_id',
  linkedTransferSplitId: 'linked_transfer_split_id',
  archived: 'archived',
  plaidTransactionId: 'plaid_transaction_id',
  paymentChannel: 'payment_channel',
  addedBy: 'added_by',
};

/** Reverse map: snake_case DB columns → camelCase Transaction fields */
const DB_TO_CAMEL: Record<string, string> = Object.fromEntries(
  Object.entries(CAMEL_TO_DB).map(([camel, db]) => [db, camel])
);

/**
 * The columns the boot load actually needs — NOT `select('*')`.
 *
 * Every row PostgREST returns carries a key for EVERY column even when null, so
 * the wide table (32 columns) makes the boot payload ~46 MB across 51k rows and
 * that transfer is bandwidth-bound — measured ~38% of the whole boot. The
 * columns omitted below are never read off the in-memory transactions: the
 * jsonb `metadata`, `merchant_name`, `location_*`, `plaid_*`, `payment_channel`
 * and `external_*` have no consumer, and the MS-Money re-import provenance
 * (`import_source`/`import_source_id`) is re-queried straight from the database
 * by the importer (msMoneyImport.ts) rather than taken from this array. Dropping
 * them (plus the redundant `user_id` we already filter on) takes the payload to
 * ~29 MB — a proportional ~38% cut to the transactions phase — while keeping
 * every field the register, edit modal, sort, export, tag counts and reports
 * read, including the user-visible `notes` and `tags`.
 *
 * Anything new the UI needs off a transaction MUST be added here or it will be
 * silently undefined in state.
 *
 * A string LITERAL (`as const`), not a joined/concatenated string: supabase-js
 * parses the select list at the type level, and only a literal engages that
 * parser — a widened `string` (which `+` concatenation or `[].join` produces)
 * degrades the result to an untyped error type.
 */
const BOOT_TRANSACTION_COLUMNS = 'id,account_id,amount,archived,category,category_confirmed,category_id,created_at,date,description,is_cleared,is_recurring,is_split,linked_transfer_id,linked_transfer_split_id,notes,statement_sequence,tags,type,updated_at,transfer_account_id' as const;

/**
 * The same list without `category_confirmed`, for a database that has not had
 * 20260808100000_category_provenance.sql applied yet.
 *
 * WHY THESE FALLBACKS EXIST. The list above is an EXPLICIT select, and PostgREST
 * fails the whole query on an unknown column — so shipping a column in it before
 * the migration lands would not degrade a feature, it would stop the app loading
 * a single transaction. The owner applies migrations himself, so "deploy after
 * the migration" is an ordering this code cannot enforce and must not depend on.
 * Falling back makes the deploy safe in either order, and each feature lights up
 * by itself the moment its migration is applied — no second release to remember.
 */
const BOOT_TRANSACTION_COLUMNS_NO_PROVENANCE = 'id,account_id,amount,archived,category,category_id,created_at,date,description,is_cleared,is_recurring,is_split,linked_transfer_id,linked_transfer_split_id,notes,statement_sequence,tags,type,updated_at,transfer_account_id' as const;

/**
 * Neither `category_confirmed` nor `statement_sequence` — the oldest schema this
 * build still talks to (before 20260808090000_transaction_statement_sequence).
 *
 * There is no fourth list, because there is no fourth state to be in: migrations
 * are applied in filename order, so a database holding `category_confirmed`
 * necessarily already holds the `statement_sequence` added by the migration
 * before it. The ladder therefore only ever drops columns newest-first, which is
 * also why the retry below discovers them in that order.
 */
const BOOT_TRANSACTION_COLUMNS_LEGACY = 'id,account_id,amount,archived,category,category_id,created_at,date,description,is_cleared,is_recurring,is_split,linked_transfer_id,linked_transfer_split_id,notes,tags,type,updated_at,transfer_account_id' as const;

/**
 * Postgres `undefined_column`. Matched on the CODE, never on the message: the
 * code is part of the documented wire contract and the message is English prose
 * that has changed between releases.
 */
const UNDEFINED_COLUMN = '42703';

/**
 * One PostgREST row → the camelCase shape a Transaction claims.
 *
 * This is THE network date boundary. `date` is a Postgres date column, so
 * PostgREST sends "2026-08-01" — a string, however loudly `Transaction.date`
 * says Date. Left as text it fails every `t.date >= startDate` comparison in
 * the app (a string vs a Date coerces to NaN, which is false both ways), which
 * is what reported £0 spent on every budget. Converting here covers every
 * fetch, every atomic-RPC return and every delta in one place. A row that
 * carries no `date` at all keeps none — the field is not invented.
 */
function mapFromDbFields(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[DB_TO_CAMEL[key] ?? key] = value;
  }
  if ('date' in result) {
    result.date = toDateValue(result.date);
  }
  return result;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Shape account_balances() rows into a per-account lookup.
 *
 * PostgREST renders numeric as a JSON number or a string depending on the
 * value, so every balance goes through Decimal — never parseFloat, never
 * float addition. Rows that are not a usable {account_id, balance} pair are
 * skipped rather than throwing: a malformed row must cost at most one
 * account's head start, never the whole load.
 */
export function toAccountBalanceMap(rows: unknown): Map<string, ServerAccountBalance> {
  const balances = new Map<string, ServerAccountBalance>();
  if (!Array.isArray(rows)) {
    return balances;
  }
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const id = row.account_id;
    const balance = row.balance;
    if (typeof id !== 'string' || id === '') continue;
    if (typeof balance !== 'number' && typeof balance !== 'string') continue;
    // Validity gate only — the value itself is never read as a float.
    if (!Number.isFinite(Number(balance))) continue;
    const count = Number(row.txn_count);
    balances.set(id, {
      balance: toDecimal(balance).toNumber(),
      txnCount: Number.isFinite(count) ? count : 0
    });
  }
  return balances;
}

function mapToDbFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip complex nested objects that don't map to DB columns
    if (key === 'transferMetadata' || key === 'investmentData' || key === 'location') {
      continue;
    }
    result[CAMEL_TO_DB[key] ?? key] = value;
  }
  return result;
}

class TransactionServiceImpl {
  private readonly supabaseClient: SupabaseClientLike;
  private readonly supabaseChecker: SupabaseConfiguredChecker;
  private readonly storage: StorageAdapterLike;
  private readonly logger: Logger;
  private readonly nowProvider: DateProvider;
  private readonly uuid: UuidGenerator;
  private readonly fetchImpl: FetchLike | null;
  private readonly authTokenProvider: AuthTokenProvider | null;
  private readonly cache: TransactionCacheLike;
  /**
   * Set once, on the first page that comes back 42703, when this database
   * predates 20260808090000_transaction_statement_sequence.sql. Per instance
   * rather than per call so a 50-page boot pays for the discovery once.
   */
  private statementSequenceMissing = false;
  /**
   * The same, for 20260808100000_category_provenance.sql. Dropped BEFORE
   * statement_sequence when a page comes back 42703, because it is the newer of
   * the two: PostgREST names no column in the error, so the only safe reading of
   * "some column in that list is unknown" is to give up the newest one first and
   * ask again.
   */
  private categoryConfirmedMissing = false;

  constructor(options: TransactionServiceOptions = {}) {
    this.cache = options.transactionCache ?? transactionCache;
    this.supabaseClient = options.supabaseClient ?? supabase;
    this.supabaseChecker = options.isSupabaseConfigured ?? isSupabaseConfigured;
    this.storage = options.storageAdapter ?? storageAdapter;
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    const noop = () => {};
    this.logger = {
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? noop)
    };
    this.nowProvider = options.now ?? (() => new Date());
    this.uuid = options.uuid ?? (() => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    });
    this.fetchImpl = options.fetchImpl ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    this.authTokenProvider = options.authTokenProvider ?? (async () => {
      if (typeof window === 'undefined' || !window.Clerk?.session?.getToken) {
        return null;
      }
      return window.Clerk.session.getToken();
    });
  }

  private isSupabaseReady(): boolean {
    return Boolean(this.supabaseClient && this.supabaseChecker());
  }

  private getCurrentDate(): Date {
    const now = this.nowProvider();
    return new Date(now.getTime());
  }

  /**
   * Every atomic RPC takes the owner id, and most of them default it to NULL in
   * SQL. NULL there does not mean "me" — it means the statement names no owner
   * at all, so it leans on RLS alone and the defence-in-depth IDOR guard
   * silently disappears. Refuse instead: callers reach these through
   * DataService, which only takes the cloud branch once
   * getCurrentDatabaseUserId() has resolved, so a missing owner is a wiring
   * mistake and should be loud rather than quietly less safe.
   */
  private requireOwnerId(userId: string | undefined, operation: string): string {
    if (!userId) {
      throw new Error(`${operation} requires a user id when writing directly via Supabase`);
    }
    return userId;
  }

  /**
   * The local-mode/demo store. Its rows went out through JSON.stringify, so
   * every Date came back a string — the same date boundary the network path
   * has, and the reason demo mode's budgets read £0 too.
   */
  private async readStoredTransactions(): Promise<Transaction[]> {
    const stored = await this.storage.get<Transaction[]>(STORAGE_KEYS.TRANSACTIONS);
    return normalizeTransactionDates(stored || []);
  }

  private async persistTransactions(transactions: Transaction[]): Promise<void> {
    await this.storage.set(STORAGE_KEYS.TRANSACTIONS, transactions);
  }

  /**
   * PostgREST rows → Transaction[]. The cast lives in exactly ONE place so
   * every fetch path (full load, delta) converts identically: mapFromDbFields
   * renames keys but cannot prove the result satisfies Transaction, and
   * Transaction is an interface, so it has no index signature to bridge back.
   */
  private toTransactions(rows: Record<string, unknown>[]): Transaction[] {
    return rows.map(row => mapFromDbFields(row)) as unknown as Transaction[];
  }

  /**
   * One page of the boot column set, optionally restricted to rows changed at
   * or after `since`. Only BOOT_TRANSACTION_COLUMNS are selected, not '*': the
   * transfer, not the round trips, is what dominates the boot, and the wide
   * table's unused columns were ~38% of the bytes.
   */
  private async fetchTransactionPage(
    userId: string,
    from: number,
    since?: string
  ): Promise<Record<string, unknown>[]> {
    const client = this.supabaseClient!;
    const to = from + PAGE_SIZE - 1;

    // The select lists are written out in full at each branch rather than passed
    // as a parameter, because supabase-js parses the select list AT THE TYPE
    // LEVEL and only a single string literal engages that parser — a union of
    // literals degrades the whole result to an error type (the same reason the
    // constants are `as const` and never concatenated).
    if (this.statementSequenceMissing) {
      const legacyBase = client
        .from('transactions')
        .select(BOOT_TRANSACTION_COLUMNS_LEGACY)
        .eq('user_id', userId);
      const legacyScoped = since ? legacyBase.gte('updated_at', since) : legacyBase;
      const { data, error } = await legacyScoped
        .order('date', { ascending: false })
        .order('id', { ascending: false }) // stable tiebreak for paging
        .range(from, to);
      if (error) {
        this.logger.error('Error fetching transactions:', error);
        throw new Error(handleSupabaseError(error));
      }
      return (data || []) as Record<string, unknown>[];
    }

    if (this.categoryConfirmedMissing) {
      const noProvenanceBase = client
        .from('transactions')
        .select(BOOT_TRANSACTION_COLUMNS_NO_PROVENANCE)
        .eq('user_id', userId);
      const noProvenanceScoped = since ? noProvenanceBase.gte('updated_at', since) : noProvenanceBase;
      const { data, error } = await noProvenanceScoped
        .order('date', { ascending: false })
        .order('id', { ascending: false }) // stable tiebreak for paging
        .range(from, to);
      if (error) {
        // Still unknown with the newest column gone: this database predates the
        // statement-sequence migration as well. Drop that too and ask again.
        if (error.code === UNDEFINED_COLUMN) {
          this.statementSequenceMissing = true;
          return this.fetchTransactionPage(userId, from, since);
        }
        this.logger.error('Error fetching transactions:', error);
        throw new Error(handleSupabaseError(error));
      }
      return (data || []) as Record<string, unknown>[];
    }

    const base = client
      .from('transactions')
      .select(BOOT_TRANSACTION_COLUMNS)
      .eq('user_id', userId);
    const scoped = since ? base.gte('updated_at', since) : base;
    const { data, error } = await scoped
      .order('date', { ascending: false })
      .order('id', { ascending: false }) // stable tiebreak for paging
      .range(from, to);

    if (error) {
      // This database predates the statement-sequence migration. Remember it
      // (so the other 50 pages of a boot do not each pay for the discovery) and
      // fetch again without the column: a register that cannot order a day the
      // bank's way is a shortfall, no register at all is an outage.
      if (error.code === UNDEFINED_COLUMN) {
        this.statementSequenceMissing = true;
        return this.fetchTransactionPage(userId, from, since);
      }
      this.logger.error('Error fetching transactions:', error);
      throw new Error(handleSupabaseError(error));
    }
    return (data || []) as Record<string, unknown>[];
  }

  /**
   * How many transactions the server holds for this user — the same predicate
   * the full fetch uses, so it doubles as the integrity check that tells a
   * delta sync a row was deleted (see loadTransactionsForBoot).
   */
  async countTransactions(userId: string): Promise<number> {
    const client = this.supabaseClient!;
    const { count, error } = await client
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) {
      this.logger.error('Error counting transactions:', error);
      throw new Error(handleSupabaseError(error));
    }
    return count ?? 0;
  }

  /**
   * Rows changed at or after `since`. An unconditional BEFORE UPDATE trigger
   * stamps updated_at = NOW() on every write, so this cannot miss an edit — but
   * it can never report a DELETE, which is why the caller pairs it with a count.
   *
   * Paged sequentially rather than in parallel: a delta is normally a handful of
   * rows, and the count-first trick the full load uses would cost an extra round
   * trip to discover that.
   */
  async getTransactionsSince(userId: string, since: string): Promise<Transaction[]> {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const page = await this.fetchTransactionPage(userId, from, since);
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return this.toTransactions(rows);
  }

  async getTransactions(userId: string): Promise<Transaction[]> {
    if (!this.isSupabaseReady()) {
      return this.readStoredTransactions();
    }

    try {
      // A full Money-era history of 50k+ rows is 50+ pages. Pages are fetched
      // IN PARALLEL (count first, bounded concurrency); sequential paging made
      // every app load a ~50-round-trip wait.
      const count = await this.countTransactions(userId);

      const pages = Math.ceil(count / PAGE_SIZE);
      const results: Record<string, unknown>[][] = new Array<Record<string, unknown>[]>(pages);
      let nextPage = 0;
      const worker = async (): Promise<void> => {
        for (;;) {
          const i = nextPage++;
          if (i >= pages) return;
          results[i] = await this.fetchTransactionPage(userId, i * PAGE_SIZE);
        }
      };
      await Promise.all(Array.from({ length: Math.min(PAGE_CONCURRENCY, pages) }, worker));

      const rows = results.flat();
      // Rows inserted between the count and the page fetches land past the
      // last page — keep the old sequential tail walk for that (rare) case.
      if (pages > 0 && (results[pages - 1]?.length ?? 0) === PAGE_SIZE) {
        for (let from = pages * PAGE_SIZE; ; from += PAGE_SIZE) {
          const tail = await this.fetchTransactionPage(userId, from);
          rows.push(...tail);
          if (tail.length < PAGE_SIZE) break;
        }
      }

      return this.toTransactions(rows);
    } catch (error) {
      this.logger.error('TransactionService.getTransactions error:', error as Error);
      return this.readStoredTransactions();
    }
  }

  /**
   * The boot load: hydrate from the local snapshot and ask the server only for
   * what changed, falling back to the full download whenever the snapshot
   * cannot be PROVEN complete.
   *
   * The correctness rule, because this is a finance app: a stale cache is
   * allowed to cost a full refetch, but it is never allowed to serve a wrong
   * total. Transactions are hard-deleted with no tombstone, so a delta on
   * updated_at is structurally blind to deletions — the server row count is the
   * backstop. Let d = rows deleted since the snapshot and i = rows inserted:
   * the server holds N - d + i while the merge produces N + i (the deleted rows
   * are still in the cache), so the two agree if and only if d == 0. The same
   * check also catches an insert the delta somehow missed. Any disagreement
   * throws the snapshot away and downloads everything.
   */
  async loadTransactionsForBoot(userId: string): Promise<TransactionLoadResult> {
    if (!this.isSupabaseReady()) {
      const rows = await this.readStoredTransactions();
      return {
        transactions: rows,
        stats: { cached: 0, fetched: 0, total: rows.length, fullFetchReason: 'local mode' }
      };
    }

    let fullFetchReason = 'no cache';
    const snapshot = await this.cache.read(userId, BOOT_TRANSACTION_COLUMNS);

    if (snapshot) {
      try {
        // Snapshots written before the date boundary existed hold `date` as the
        // raw wire string, and any cache implementation that serialises through
        // JSON hands one back the same way. The store normalises on read; this
        // repeats it here (in place, one `instanceof` per row) so the rows that
        // reach app state are right whichever cache is plugged in — and inside
        // the try, so an unusable snapshot costs a refetch, never the boot.
        normalizeTransactionDates(snapshot.rows);

        const [delta, serverCount] = await Promise.all([
          this.getTransactionsSince(userId, deltaFloor(snapshot.highWaterMark)),
          this.countTransactions(userId)
        ]);

        // The overlap window means the delta is never empty — it always re-reads
        // the newest rows we already hold. Anything genuinely written since the
        // snapshot carries a stamp PAST the high-water mark (the trigger sets
        // updated_at = NOW() on every write, and an insert defaults to it), so
        // that comparison, not the row count, is what says "something changed".
        // When nothing has, the cached array is already in server order and is
        // handed over untouched: no merge, no re-sort, no multi-megabyte
        // re-write of a snapshot that would come out identical.
        const deltaHighWaterMark = newestUpdatedAt(delta);
        const hasNewWrites = deltaHighWaterMark !== null &&
          // Compared as instants, not as text: PostgREST's "+00:00" offset and a
          // JS Date's "Z" do not sort against each other. A timestamp that
          // cannot be parsed counts as new, so the doubt costs a merge rather
          // than a missed edit.
          !(Date.parse(deltaHighWaterMark) <= Date.parse(snapshot.highWaterMark));
        const merged = hasNewWrites
          ? mergeTransactionDelta(snapshot.rows, delta)
          : snapshot.rows;

        if (merged.length === serverCount) {
          if (hasNewWrites) {
            void this.cache.write(userId, BOOT_TRANSACTION_COLUMNS, merged);
          }
          return {
            transactions: merged,
            stats: {
              cached: snapshot.rows.length,
              fetched: delta.length,
              total: merged.length,
              fullFetchReason: null
            }
          };
        }

        fullFetchReason = `cache held ${merged.length} of ${serverCount} rows`;
      } catch (error) {
        this.logger.error('TransactionService delta load failed, refetching in full:', error as Error);
        fullFetchReason = 'delta load failed';
      }
    }

    const rows = await this.getTransactions(userId);
    // Deliberately not awaited: the snapshot write is a structured clone of the
    // whole history and the app has everything it needs without it. A failure
    // is swallowed inside the cache — an unwritable cache costs speed, nothing
    // else.
    void this.cache.write(userId, BOOT_TRANSACTION_COLUMNS, rows);
    return {
      transactions: rows,
      stats: { cached: 0, fetched: rows.length, total: rows.length, fullFetchReason }
    };
  }

  /**
   * Every account's balance from ONE round trip — Postgres sums
   * initial_balance + Σ amount, instead of the client paging 50k rows to
   * derive the same figures.
   *
   * Purely an optimisation for the seconds those pages are in flight, so it
   * never throws and never blocks: any failure (local mode, RPC missing,
   * network) returns an empty map and the app behaves exactly as it did
   * before.
   */
  async getAccountBalances(): Promise<Map<string, ServerAccountBalance>> {
    if (!this.isSupabaseReady()) {
      return new Map();
    }
    try {
      const { data, error } = await this.supabaseClient!.rpc('account_balances', {});
      if (error) {
        this.logger.error('Error loading account balances:', error);
        return new Map();
      }
      return toAccountBalanceMap(data);
    } catch (error) {
      this.logger.error('TransactionService.getAccountBalances error:', error as Error);
      return new Map();
    }
  }

  async createTransaction(
    userId: string,
    transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Transaction> {
    if (!this.isSupabaseReady()) {
      const now = this.getCurrentDate();
      // The caller's date goes through the boundary too: an importer or a form
      // may hand over "2026-08-01", and this row lands straight in app state.
      const newTransaction: Transaction = {
        ...transaction,
        date: toDateValue(transaction.date),
        id: this.uuid(),
        createdAt: now,
        updatedAt: now
      } as Transaction;

      const transactions = await this.readStoredTransactions();
      transactions.push(newTransaction);
      await this.persistTransactions(transactions);

      return newTransaction;
    }

    try {
      const client = this.supabaseClient!;
      const dbRow = mapToDbFields(transaction as unknown as Record<string, unknown>);
      dbRow.user_id = userId;

      // Atomic RPC: inserts the transaction AND adjusts the account balance in
      // one database transaction (SQL numeric math — no JS floats, no
      // read-modify-write race, no partial-failure drift).
      const { data, error } = await client.rpc('create_transaction_atomic', { p: dbRow });

      if (error) {
        this.logger.error('Error creating transaction:', error);
        throw new Error(handleSupabaseError(error));
      }

      return mapFromDbFields(data as Record<string, unknown>) as unknown as Transaction;
    } catch (error) {
      this.logger.error('TransactionService.createTransaction error:', error as Error);
      throw error;
    }
  }

  async updateTransaction(id: string, updates: Partial<Transaction>, userId?: string): Promise<Transaction> {
    if (!this.isSupabaseReady()) {
      const transactions = await this.readStoredTransactions();
      const index = transactions.findIndex(t => t.id === id);

      if (index === -1) {
        throw new Error('Transaction not found');
      }

      const oldAmount = transactions[index].amount;
      const updated: Transaction = {
        ...transactions[index],
        ...updates,
        // The local twin of update_transaction_atomic's provenance rule
        // (20260808100000): changing a category IS vouching for it. Written
        // here rather than in each editor so local mode and the cloud cannot
        // drift — an editor that forgets to say so would otherwise leave the
        // user's own choice sitting on screen accused of being a guess, but
        // only when signed out. An explicit categoryConfirmed in `updates`
        // wins, because "the user looked and let the suggestion stand" is a
        // confirmation no rule about changed values can detect.
        ...(updates.categoryConfirmed === undefined &&
            updates.category !== undefined &&
            updates.category !== transactions[index].category
          ? { categoryConfirmed: true }
          : {}),
        ...(updates.date !== undefined ? { date: toDateValue(updates.date) } : {}),
        updatedAt: this.getCurrentDate()
      } as Transaction;

      transactions[index] = updated;
      await this.persistTransactions(transactions);

      if (updates.amount !== undefined && updates.amount !== oldAmount) {
        // No account balance update in local mode; DataService handles local adjustments.
      }

      return updated;
    }

    try {
      const client = this.supabaseClient!;
      const dbUpdates = mapToDbFields(updates as unknown as Record<string, unknown>);

      // Atomic RPC: updates the row and adjusts balances (including account
      // moves) in one database transaction with SQL numeric math. RLS already
      // scopes the row; naming the owner makes it fail closed on a mis-routed
      // id, and omitting the owner would throw that guard away (see
      // requireOwnerId).
      const { data, error } = await client.rpc('update_transaction_atomic', {
        p_id: id,
        p: dbUpdates,
        p_user_id: this.requireOwnerId(userId, 'updateTransaction')
      });

      if (error) {
        this.logger.error('Error updating transaction:', error);
        throw new Error(handleSupabaseError(error));
      }

      return mapFromDbFields(data as Record<string, unknown>) as unknown as Transaction;
    } catch (error) {
      this.logger.error('TransactionService.updateTransaction error:', error as Error);
      throw error;
    }
  }

  /**
   * Bulk-set the reconciliation cleared flag on a set of transactions in one
   * round trip. is_cleared never affects account balances, so this goes through
   * a dedicated RPC rather than N update_transaction_atomic calls.
   * Returns the number of rows actually updated.
   */
  async setTransactionsCleared(ids: string[], cleared: boolean, userId?: string): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    if (!this.isSupabaseReady()) {
      const transactions = await this.readStoredTransactions();
      const idSet = new Set(ids);
      let count = 0;
      const updated = transactions.map(t => {
        if (idSet.has(t.id)) {
          count += 1;
          return { ...t, cleared, updatedAt: this.getCurrentDate() };
        }
        return t;
      });
      await this.persistTransactions(updated);
      return count;
    }

    try {
      const client = this.supabaseClient!;
      // RLS scopes the update to the requesting user; passing the owner adds
      // the same defence-in-depth IDOR guard as the other atomic RPCs.
      const { data, error } = await client.rpc('set_transactions_cleared', {
        p_ids: ids,
        p_cleared: cleared,
        p_user_id: this.requireOwnerId(userId, 'setTransactionsCleared')
      });

      if (error) {
        this.logger.error('Error setting cleared status:', error);
        throw new Error(handleSupabaseError(error));
      }

      return typeof data === 'number' ? data : ids.length;
    } catch (error) {
      this.logger.error('TransactionService.setTransactionsCleared error:', error as Error);
      throw error;
    }
  }

  /**
   * Agree with the app's suggested category on a set of rows, in one round trip.
   *
   * Balance-neutral by construction: this writes ONE boolean and never touches
   * `category` itself. Confirming is agreeing with what is already there — if
   * the user wanted a different category they would pick one, which is an
   * ordinary edit through update_transaction_atomic and confirms it in passing.
   *
   * Modelled on setTransactionsCleared for exactly the same reason: N rows of a
   * flag have no business being N calls to the balance-adjusting update RPC.
   * Returns the number of rows actually changed (already-confirmed rows are not
   * re-written and do not count).
   *
   * No fallback for a database that predates
   * 20260808100000_category_provenance.sql, and none is needed: without the
   * column every row reads as confirmed (see categoryProvenance.ts), so no
   * confirm affordance is ever shown and this is unreachable there.
   */
  async confirmTransactionCategories(ids: string[], userId?: string): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    if (!this.isSupabaseReady()) {
      const transactions = await this.readStoredTransactions();
      const idSet = new Set(ids);
      let count = 0;
      const updated = transactions.map(t => {
        if (idSet.has(t.id) && t.categoryConfirmed === false) {
          count += 1;
          return { ...t, categoryConfirmed: true, updatedAt: this.getCurrentDate() };
        }
        return t;
      });
      await this.persistTransactions(updated);
      return count;
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client.rpc('confirm_transaction_categories', {
        p_ids: ids,
        p_user_id: this.requireOwnerId(userId, 'confirmTransactionCategories')
      });

      if (error) {
        this.logger.error('Error confirming categories:', error);
        throw new Error(handleSupabaseError(error));
      }

      return typeof data === 'number' ? data : ids.length;
    } catch (error) {
      this.logger.error('TransactionService.confirmTransactionCategories error:', error as Error);
      throw error;
    }
  }

  /**
   * Apply a category to the listed transactions that are STILL uncategorized
   * (payee-memory propagation), in one round trip. Fill-blanks only — the RPC
   * enforces this server-side, so a stale client snapshot can never overwrite
   * a category the user set elsewhere. Returns the number of rows updated.
   */
  async applyCategoryToUncategorized(ids: string[], category: string, userId?: string): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    if (!this.isSupabaseReady()) {
      const transactions = await this.readStoredTransactions();
      const idSet = new Set(ids);
      let count = 0;
      const updated = transactions.map(t => {
        if (idSet.has(t.id) && (!t.category || t.category.trim() === '')) {
          count += 1;
          return { ...t, category, updatedAt: this.getCurrentDate() };
        }
        return t;
      });
      await this.persistTransactions(updated);
      return count;
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client.rpc('apply_category_to_uncategorized', {
        p_ids: ids,
        p_category: category,
        p_user_id: this.requireOwnerId(userId, 'applyCategoryToUncategorized')
      });

      if (error) {
        this.logger.error('Error applying category:', error);
        throw new Error(handleSupabaseError(error));
      }

      return typeof data === 'number' ? data : ids.length;
    } catch (error) {
      this.logger.error('TransactionService.applyCategoryToUncategorized error:', error as Error);
      throw error;
    }
  }

  /** Every split line of the user's transactions (for category aggregation). */
  /** DB split row → app TransactionSplit, including transfer-leg fields. */
  private mapSplitRow(row: Record<string, unknown>): TransactionSplit {
    return {
      id: String(row.id),
      transactionId: String(row.transaction_id),
      category: String(row.category),
      amount: Number(row.amount),
      memo: typeof row.memo === 'string' && row.memo !== '' ? row.memo : undefined,
      sortOrder: Number(row.sort_order),
      ...(row.transfer_account_id ? { transferAccountId: String(row.transfer_account_id) } : {}),
      ...(row.linked_transfer_id ? { linkedTransferId: String(row.linked_transfer_id) } : {}),
    };
  }

  async getAllTransactionSplits(userId?: string): Promise<TransactionSplit[]> {
    if (!this.isSupabaseReady()) {
      return (await this.storage.get<TransactionSplit[]>(STORAGE_KEYS.TRANSACTION_SPLITS)) ?? [];
    }

    try {
      const client = this.supabaseClient!;
      // Page like getTransactions — splits are few today, but the 1000-row
      // PostgREST cap would silently truncate a heavy splitter's data.
      // (Row mapping shared with getTransactionSplits via mapSplitRow.)
      const PAGE_SIZE = 1000;
      const rows: Record<string, unknown>[] = [];
      let from = 0;
      for (;;) {
        let query = client
          .from('transaction_splits')
          .select('*')
          .order('transaction_id', { ascending: true })
          .order('sort_order', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (userId) {
          query = query.eq('user_id', userId);
        }
        const { data, error } = await query;
        if (error) {
          this.logger.error('Error fetching transaction splits:', error);
          throw new Error(handleSupabaseError(error));
        }
        const page = (data || []) as Record<string, unknown>[];
        rows.push(...page);
        if (page.length < PAGE_SIZE) {
          break;
        }
        from += PAGE_SIZE;
      }
      return rows.map(row => this.mapSplitRow(row));
    } catch (error) {
      this.logger.error('TransactionService.getAllTransactionSplits error:', error as Error);
      throw error;
    }
  }

  /** Splits for one transaction, in display order (empty when not split). */
  async getTransactionSplits(transactionId: string): Promise<TransactionSplit[]> {
    if (!this.isSupabaseReady()) {
      const stored = (await this.storage.get<TransactionSplit[]>(STORAGE_KEYS.TRANSACTION_SPLITS)) ?? [];
      return stored
        .filter(s => s.transactionId === transactionId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client
        .from('transaction_splits')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('sort_order', { ascending: true });

      if (error) {
        this.logger.error('Error fetching transaction splits:', error);
        throw new Error(handleSupabaseError(error));
      }

      return ((data || []) as Record<string, unknown>[]).map(row => this.mapSplitRow(row));
    } catch (error) {
      this.logger.error('TransactionService.getTransactionSplits error:', error as Error);
      throw error;
    }
  }

  /**
   * Replace a transaction's splits atomically (empty array un-splits it).
   * The server RPC enforces the invariants — ≥2 lines, valid non-transfer
   * categories, non-zero amounts, and sum == expectedAmount — and syncs the
   * transaction's amount/account balance when the sum changes it.
   *
   * Cloud-only, like setTransactionSplitsWithLegs below: DataService owns the
   * local/demo mirror of these rules and only ever calls this from its own
   * cloud branch (dataService.ts, setTransactionSplits). A second local
   * implementation here was a third copy of the same invariants that nothing
   * could reach.
   */
  async setTransactionSplits(
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: number | null,
    userId?: string
  ): Promise<{ isSplit: boolean; splitCount: number; amount: number }> {
    if (!this.isSupabaseReady()) {
      throw new Error('setTransactionSplits requires the cloud connection (local mode goes through DataService)');
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client.rpc('set_transaction_splits', {
        p_transaction_id: transactionId,
        p_splits: splits,
        p_expected_amount: expectedAmount,
        p_user_id: this.requireOwnerId(userId, 'setTransactionSplits')
      });

      if (error) {
        this.logger.error('Error setting transaction splits:', error);
        throw new Error(handleSupabaseError(error));
      }

      const result = (data ?? {}) as Record<string, unknown>;
      return {
        isSplit: Boolean(result.is_split),
        splitCount: Number(result.split_count ?? 0),
        amount: Number(result.amount ?? expectedAmount ?? 0),
      };
    } catch (error) {
      this.logger.error('TransactionService.setTransactionSplits error:', error as Error);
      throw error;
    }
  }

  /**
   * Write a split whose lines may include TRANSFER LEGS — one line that is
   * itself half of a transfer with another account (the Microsoft Money
   * model).
   *
   * A separate RPC from setTransactionSplits, not a widening of it, because
   * the two have different semantics on purpose: set_transaction_splits
   * REPLACES the line set (and so must refuse any split containing a leg,
   * since it cannot tell an edited line from a deleted one), while
   * set_transaction_splits_with_legs matches incoming lines to stored ones by
   * id — which is what lets an ordinary line be re-filed while the leg beside
   * it stays exactly as it is. Leaving the old path strict means a stale
   * browser tab still fails safe.
   *
   * Line ids and transfer targets ride in the payload in the database's own
   * spelling (snake_case), so the audit entries the RPC writes read the same
   * as the columns they came from. Cloud-only — DataService owns the
   * local/demo mirror of these rules.
   *
   * Returns the counterpart rows the database created, so the caller updates
   * its state (and those accounts' balances) from what was actually written.
   */
  async setTransactionSplitsWithLegs(
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: number | null,
    userId?: string
  ): Promise<{ isSplit: boolean; splitCount: number; amount: number; counterparts: Transaction[] }> {
    if (!this.isSupabaseReady()) {
      throw new Error('setTransactionSplitsWithLegs requires the cloud connection (local mode goes through DataService)');
    }
    try {
      const payload = splits.map(split => ({
        category: split.category,
        amount: split.amount,
        ...(split.memo ? { memo: split.memo } : {}),
        ...(split.id ? { id: split.id } : {}),
        ...(split.transferAccountId ? { transfer_account_id: split.transferAccountId } : {}),
      }));
      const { data, error } = await this.supabaseClient!.rpc('set_transaction_splits_with_legs', {
        p_transaction_id: transactionId,
        p_splits: payload,
        p_expected_amount: expectedAmount,
        p_user_id: this.requireOwnerId(userId, 'setTransactionSplitsWithLegs'),
      });

      if (error) {
        this.logger.error('Error setting transaction splits with legs:', error);
        throw new Error(handleSupabaseError(error));
      }

      const result = (data ?? {}) as Record<string, unknown>;
      const rows: unknown[] = Array.isArray(result.counterparts) ? result.counterparts : [];
      return {
        isSplit: Boolean(result.is_split),
        splitCount: Number(result.split_count ?? 0),
        amount: Number(result.amount ?? expectedAmount ?? 0),
        counterparts: this.toTransactions(rows.filter(isRecord)),
      };
    } catch (error) {
      this.logger.error('TransactionService.setTransactionSplitsWithLegs error:', error as Error);
      throw error;
    }
  }

  /**
   * Join two existing rows into a linked transfer pair (both sides already
   * exist). Amount/account/link invariants are enforced by the RPC; balance-
   * neutral by construction. Cloud-only here — the local/demo path lives in
   * DataService (which owns local storage semantics).
   */
  /**
   * Soft-archive an account's reconciled transactions on/before a cutoff. The
   * RPC also stamps accounts.archive_through_date, atomically. Cloud-only —
   * DataService owns the local-mode path (it touches the accounts collection
   * too). Balance-neutral. Returns the number archived.
   */
  async archiveTransactionsBefore(accountId: string, cutoffIso: string, userId?: string): Promise<number> {
    if (!this.isSupabaseReady()) {
      throw new Error('archiveTransactionsBefore requires the cloud connection (local mode goes through DataService)');
    }
    try {
      const { data, error } = await this.supabaseClient!.rpc('archive_transactions_before', {
        p_account_id: accountId,
        p_cutoff: cutoffIso,
        p_user_id: this.requireOwnerId(userId, 'archiveTransactionsBefore'),
      });
      if (error) {
        this.logger.error('Error archiving transactions:', error);
        throw new Error(handleSupabaseError(error));
      }
      const result = (data ?? {}) as { archived?: number };
      return typeof result.archived === 'number' ? result.archived : 0;
    } catch (error) {
      this.logger.error('TransactionService.archiveTransactionsBefore error:', error as Error);
      throw error;
    }
  }

  /** Bring an account's archived transactions back into the live register. Cloud-only. */
  async unarchiveAccount(accountId: string, userId?: string): Promise<number> {
    if (!this.isSupabaseReady()) {
      throw new Error('unarchiveAccount requires the cloud connection (local mode goes through DataService)');
    }
    try {
      const { data, error } = await this.supabaseClient!.rpc('unarchive_account', {
        p_account_id: accountId,
        p_user_id: this.requireOwnerId(userId, 'unarchiveAccount'),
      });
      if (error) {
        this.logger.error('Error unarchiving account:', error);
        throw new Error(handleSupabaseError(error));
      }
      const result = (data ?? {}) as { unarchived?: number };
      return typeof result.unarchived === 'number' ? result.unarchived : 0;
    } catch (error) {
      this.logger.error('TransactionService.unarchiveAccount error:', error as Error);
      throw error;
    }
  }

  /**
   * Break linked transfer pairs: clear linked_transfer_id on the given rows.
   *
   * Goes through the clear_transfer_links RPC (migration 20260805145035), not a
   * table UPDATE: every financial write in this app writes financial_audit_log
   * in the same database transaction, and an unlink is a financial write. The
   * RPC keeps the guards the table update carried (owner scope, split-LINE legs
   * skipped, only the named rows) and adds one the client could not: a named id
   * that is not an owned row raises rather than quietly shrinking the count.
   *
   * Balance-neutral: no amount, account or sign is touched. Returns the number
   * of rows actually unlinked (rows already unlinked are not counted).
   */
  async clearTransferLinks(ids: string[], userId?: string): Promise<number> {
    if (ids.length === 0) return 0;
    if (!this.isSupabaseReady()) {
      throw new Error('clearTransferLinks requires the cloud connection (local mode goes through DataService)');
    }
    try {
      const { data, error } = await this.supabaseClient!.rpc('clear_transfer_links', {
        p_ids: ids,
        p_user_id: this.requireOwnerId(userId, 'clearTransferLinks'),
      });
      if (error) {
        this.logger.error('Error clearing transfer links:', error);
        throw new Error(handleSupabaseError(error));
      }
      if (typeof data !== 'number') {
        throw new Error('the database did not report how many rows it unlinked — refusing to assume.');
      }
      return data;
    } catch (error) {
      this.logger.error('TransactionService.clearTransferLinks error:', error as Error);
      throw error;
    }
  }

  /**
   * Soft-archive (or restore) ONE transaction — the per-row counterpart of
   * archive_transactions_before, which only works by account and cutoff.
   * Audited through the set_transactions_archived RPC for the same reason as
   * clearTransferLinks. Balance-neutral, and never a delete: the row stays,
   * counted in every balance and report, hidden only from the live register.
   *
   * A row already in the requested state is a no-op, not an error; a row that
   * is not there raises transaction_not_found from inside the RPC.
   */
  async setTransactionArchived(id: string, archived: boolean, userId?: string): Promise<void> {
    if (!this.isSupabaseReady()) {
      throw new Error('setTransactionArchived requires the cloud connection (local mode goes through DataService)');
    }
    try {
      const { error } = await this.supabaseClient!.rpc('set_transactions_archived', {
        p_ids: [id],
        p_archived: archived,
        p_user_id: this.requireOwnerId(userId, 'setTransactionArchived'),
      });
      if (error) {
        this.logger.error('Error archiving transaction:', error);
        throw new Error(handleSupabaseError(error));
      }
    } catch (error) {
      this.logger.error('TransactionService.setTransactionArchived error:', error as Error);
      throw error;
    }
  }

  /**
   * Re-pair a counterpart onto the row that really matches it — ONE call, one
   * database transaction (repair_claimed_transfer, migration 20260805145035).
   *
   * The RPC breaks the wrong pairing, files the row that displaces under the
   * caller's own Account Adjustment category, and links the right pair; it
   * validates every precondition against the rows as they are NOW, so a stale
   * list cannot re-pair something that has since moved on. Its errors are
   * surfaced verbatim — they say exactly which precondition failed, and there
   * is no half-applied state for the caller to explain away.
   */
  async repairClaimedTransfer(
    strandedId: string,
    counterpartId: string,
    partnerId: string,
    adjustmentCategoryId: string,
    userId?: string
  ): Promise<{ stranded: Transaction; counterpart: Transaction; partner: Transaction }> {
    if (!this.isSupabaseReady()) {
      throw new Error('repairClaimedTransfer requires the cloud connection (local mode goes through DataService)');
    }
    try {
      const { data, error } = await this.supabaseClient!.rpc('repair_claimed_transfer', {
        p_stranded_id: strandedId,
        p_counterpart_id: counterpartId,
        p_partner_id: partnerId,
        p_adjustment_category_id: adjustmentCategoryId,
        p_user_id: this.requireOwnerId(userId, 'repairClaimedTransfer'),
      });
      if (error) {
        this.logger.error('Error repairing claimed transfer:', error);
        throw new Error(handleSupabaseError(error));
      }
      const result = (data ?? {}) as {
        stranded?: Record<string, unknown>;
        counterpart?: Record<string, unknown>;
        partner?: Record<string, unknown>;
      };
      return {
        stranded: mapFromDbFields(result.stranded ?? {}) as unknown as Transaction,
        counterpart: mapFromDbFields(result.counterpart ?? {}) as unknown as Transaction,
        partner: mapFromDbFields(result.partner ?? {}) as unknown as Transaction,
      };
    } catch (error) {
      this.logger.error('TransactionService.repairClaimedTransfer error:', error as Error);
      throw error;
    }
  }

  async linkTransferPair(
    idA: string,
    idB: string,
    userId?: string
  ): Promise<{ a: Transaction; b: Transaction }> {
    if (!this.isSupabaseReady()) {
      throw new Error('linkTransferPair requires the cloud connection (local mode goes through DataService)');
    }
    try {
      const client = this.supabaseClient!;
      const { data, error } = await client.rpc('link_transfer_pair', {
        p_id_a: idA,
        p_id_b: idB,
        p_user_id: this.requireOwnerId(userId, 'linkTransferPair')
      });
      if (error) {
        this.logger.error('Error linking transfer pair:', error);
        throw new Error(handleSupabaseError(error));
      }
      const result = (data ?? {}) as { a?: Record<string, unknown>; b?: Record<string, unknown> };
      return {
        a: mapFromDbFields(result.a ?? {}) as unknown as Transaction,
        b: mapFromDbFields(result.b ?? {}) as unknown as Transaction,
      };
    } catch (error) {
      this.logger.error('TransactionService.linkTransferPair error:', error as Error);
      throw error;
    }
  }

  /**
   * Join an existing split LINE to an existing transaction as the two halves
   * of a transfer — the split-line counterpart of linkTransferPair, and what
   * the transfer-matching sweep applies for a line suggestion.
   *
   * The amounts must be exactly opposite between the LINE and the row, never
   * between the row and the split PARENT, whose total legitimately differs
   * (£35,000 arrives, £30,000 of it settles a loan). The RPC enforces that and
   * every other precondition against the rows as they are NOW, so a stale list
   * is refused rather than acted on; balance-neutral by construction, since no
   * amount, sign or account is written. Cloud-only here — the local/demo path
   * lives in DataService.
   *
   * Returns the line and the row the database actually wrote, so the caller
   * updates its state from them rather than guessing at the re-typing and
   * re-categorising the RPC does.
   */
  async linkSplitLineTransfer(
    splitId: string,
    transactionId: string,
    userId?: string
  ): Promise<{ split: TransactionSplit; transaction: Transaction }> {
    if (!this.isSupabaseReady()) {
      throw new Error('linkSplitLineTransfer requires the cloud connection (local mode goes through DataService)');
    }
    try {
      const { data, error } = await this.supabaseClient!.rpc('link_split_line_transfer', {
        p_split_id: splitId,
        p_transaction_id: transactionId,
        p_user_id: this.requireOwnerId(userId, 'linkSplitLineTransfer'),
      });
      if (error) {
        this.logger.error('Error linking split line transfer:', error);
        throw new Error(handleSupabaseError(error));
      }
      const result = (data ?? {}) as { split?: Record<string, unknown>; transaction?: Record<string, unknown> };
      return {
        split: this.mapSplitRow(result.split ?? {}),
        transaction: mapFromDbFields(result.transaction ?? {}) as unknown as Transaction,
      };
    } catch (error) {
      this.logger.error('TransactionService.linkSplitLineTransfer error:', error as Error);
      throw error;
    }
  }

  /**
   * Money-style "create the other side": insert the counterpart in the target
   * account and convert the source into a linked transfer, atomically (the
   * RPC also adjusts the target account's balance and audits everything).
   */
  async createTransferCounterpart(
    id: string,
    targetAccountId: string,
    userId?: string
  ): Promise<{ source: Transaction; counterpart: Transaction }> {
    if (!this.isSupabaseReady()) {
      throw new Error('createTransferCounterpart requires the cloud connection (local mode goes through DataService)');
    }
    try {
      const client = this.supabaseClient!;
      const { data, error } = await client.rpc('create_transfer_counterpart', {
        p_id: id,
        p_target_account_id: targetAccountId,
        p_user_id: this.requireOwnerId(userId, 'createTransferCounterpart')
      });
      if (error) {
        this.logger.error('Error creating transfer counterpart:', error);
        throw new Error(handleSupabaseError(error));
      }
      const result = (data ?? {}) as { source?: Record<string, unknown>; counterpart?: Record<string, unknown> };
      return {
        source: mapFromDbFields(result.source ?? {}) as unknown as Transaction,
        counterpart: mapFromDbFields(result.counterpart ?? {}) as unknown as Transaction,
      };
    } catch (error) {
      this.logger.error('TransactionService.createTransferCounterpart error:', error as Error);
      throw error;
    }
  }

  async deleteTransaction(id: string, userId?: string): Promise<void> {
    if (!this.isSupabaseReady()) {
      const transactions = await this.readStoredTransactions();
      const filtered = transactions.filter(t => t.id !== id);
      await this.persistTransactions(filtered);
      return;
    }

    try {
      const deletedViaApi = await this.deleteTransactionViaApi(id);
      if (deletedViaApi) {
        return;
      }

      const client = this.supabaseClient!;

      // Atomic RPC: deletes the row and reverses the balance in one database
      // transaction. RLS scopes the delete to the requesting user; passing the
      // owner adds a defence-in-depth IDOR guard so a mis-routed id fails closed
      // (see requireOwnerId). The API path above needs no userId: the server
      // derives it from the Clerk token.
      const { error } = await client.rpc('delete_transaction_atomic', {
        p_id: id,
        p_user_id: this.requireOwnerId(userId, 'deleteTransaction')
      });

      if (error) {
        this.logger.error('Error deleting transaction:', error);
        throw new Error(handleSupabaseError(error));
      }
    } catch (error) {
      this.logger.error('TransactionService.deleteTransaction error:', error as Error);
      throw error;
    }
  }

  private async deleteTransactionViaApi(id: string): Promise<boolean> {
    if (!this.fetchImpl || !this.authTokenProvider) {
      return false;
    }

    const token = await this.authTokenProvider();
    if (!token) {
      return false;
    }

    const response = await this.fetchImpl('/api/data/delete-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ transactionId: id })
    });

    if (response.ok) {
      return true;
    }

    let message = `Delete transaction failed: ${response.status}`;
    try {
      const payload = await response.json() as { error?: unknown };
      if (typeof payload.error === 'string' && payload.error.trim()) {
        message = payload.error;
      }
    } catch {
      // Ignore body parse errors and keep the status-based message.
    }

    throw new Error(message);
  }

  async getTransactionsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    if (!this.isSupabaseReady()) {
      const transactions = await this.readStoredTransactions();
      return transactions.filter(t => {
        const date = new Date(t.date);
        return date >= startDate && date <= endDate;
      });
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString())
        .lte('date', endDate.toISOString())
        .order('date', { ascending: false });

      if (error) {
        this.logger.error('Error fetching transactions by date range:', error);
        throw new Error(handleSupabaseError(error));
      }

      return (data || []).map(row => mapFromDbFields(row as Record<string, unknown>)) as unknown as Transaction[];
    } catch (error) {
      this.logger.error('TransactionService.getTransactionsByDateRange error:', error as Error);
      throw error;
    }
  }

  async getTransactionsByAccount(accountId: string): Promise<Transaction[]> {
    if (!this.isSupabaseReady()) {
      const transactions = await this.readStoredTransactions();
      return transactions.filter(t => t.accountId === accountId);
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client
        .from('transactions')
        .select('*')
        .eq('account_id', accountId)
        .order('date', { ascending: false });

      if (error) {
        this.logger.error('Error fetching transactions by account:', error);
        throw new Error(handleSupabaseError(error));
      }

      return (data || []).map(row => mapFromDbFields(row as Record<string, unknown>)) as unknown as Transaction[];
    } catch (error) {
      this.logger.error('TransactionService.getTransactionsByAccount error:', error as Error);
      throw error;
    }
  }

  async getTransactionsByCategory(categoryId: string): Promise<Transaction[]> {
    if (!this.isSupabaseReady()) {
      const transactions = await this.readStoredTransactions();
      return transactions.filter(t => t.category === categoryId);
    }

    try {
      const client = this.supabaseClient!;
      const { data, error } = await client
        .from('transactions')
        .select('*')
        .eq('category_id', categoryId)
        .order('date', { ascending: false });

      if (error) {
        this.logger.error('Error fetching transactions by category:', error);
        throw new Error(handleSupabaseError(error));
      }

      return (data || []).map(row => mapFromDbFields(row as Record<string, unknown>)) as unknown as Transaction[];
    } catch (error) {
      this.logger.error('TransactionService.getTransactionsByCategory error:', error as Error);
      throw error;
    }
  }

  async bulkCreateTransactions(
    userId: string,
    transactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<Transaction[]> {
    if (!this.isSupabaseReady()) {
      const stored = await this.readStoredTransactions();
      const now = this.getCurrentDate(); // Returns Date object
      const newTransactions: Transaction[] = transactions.map(transaction => ({
        ...transaction,
        date: toDateValue(transaction.date), // importers hand over wire strings
        id: this.uuid(),
        createdAt: now,    // Date object, not string
        updatedAt: now     // Date object, not string
      } as Transaction));

      stored.push(...newTransactions);  // No cast needed
      await this.persistTransactions(stored);
      return newTransactions;           // No cast needed
    }

    try {
      const client = this.supabaseClient!;
      const created: Transaction[] = [];
      const failures: string[] = [];

      // Each row goes through the atomic RPC so the insert and the balance
      // adjustment commit together. Failures are collected, not silently
      // swallowed — a partially imported batch is reported to the caller.
      for (const t of transactions) {
        const dbRow = mapToDbFields(t as unknown as Record<string, unknown>);
        dbRow.user_id = userId;

        const { data, error } = await client.rpc('create_transaction_atomic', { p: dbRow });
        if (error) {
          this.logger.error('Error creating transaction in bulk import:', error);
          failures.push(handleSupabaseError(error));
          continue;
        }
        created.push(mapFromDbFields(data as Record<string, unknown>) as unknown as Transaction);
      }

      if (failures.length > 0) {
        throw new Error(
          `Imported ${created.length} of ${transactions.length} transactions; ` +
          `${failures.length} failed. First error: ${failures[0]}`
        );
      }

      return created;
    } catch (error) {
      this.logger.error('TransactionService.bulkCreateTransactions error:', error as Error);
      throw error;
    }
  }

  subscribeToTransactions(userId: string, callback: (payload: unknown) => void): () => void {
    if (!this.isSupabaseReady()) {
      return () => {};
    }

    const client = this.supabaseClient!;
    const subscription = client
      .channel(`transactions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  // NOTE: client-side balance mutation was removed deliberately. All balance
  // adjustments happen inside the atomic Postgres RPCs
  // (create/update/delete_transaction_atomic) using SQL numeric arithmetic —
  // never JavaScript float math, never read-modify-write.
}

let defaultTransactionService = new TransactionServiceImpl();

export class TransactionService {
  static configure(options: TransactionServiceOptions = {}) {
    defaultTransactionService = new TransactionServiceImpl(options);
  }

  private static get service(): TransactionServiceImpl {
    return defaultTransactionService;
  }

  static getTransactions(userId: string): Promise<Transaction[]> {
    return this.service.getTransactions(userId);
  }

  static loadTransactionsForBoot(userId: string): Promise<TransactionLoadResult> {
    return this.service.loadTransactionsForBoot(userId);
  }

  static countTransactions(userId: string): Promise<number> {
    return this.service.countTransactions(userId);
  }

  static getTransactionsSince(userId: string, since: string): Promise<Transaction[]> {
    return this.service.getTransactionsSince(userId, since);
  }

  static getAccountBalances(): Promise<Map<string, ServerAccountBalance>> {
    return this.service.getAccountBalances();
  }

  static createTransaction(
    userId: string,
    transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Transaction> {
    return this.service.createTransaction(userId, transaction);
  }

  static updateTransaction(id: string, updates: Partial<Transaction>, userId?: string): Promise<Transaction> {
    return this.service.updateTransaction(id, updates, userId);
  }

  static deleteTransaction(id: string, userId?: string): Promise<void> {
    return this.service.deleteTransaction(id, userId);
  }

  static setTransactionsCleared(ids: string[], cleared: boolean, userId?: string): Promise<number> {
    return this.service.setTransactionsCleared(ids, cleared, userId);
  }

  static applyCategoryToUncategorized(ids: string[], category: string, userId?: string): Promise<number> {
    return this.service.applyCategoryToUncategorized(ids, category, userId);
  }

  static confirmTransactionCategories(ids: string[], userId?: string): Promise<number> {
    return this.service.confirmTransactionCategories(ids, userId);
  }

  static getAllTransactionSplits(userId?: string): Promise<TransactionSplit[]> {
    return this.service.getAllTransactionSplits(userId);
  }

  static clearTransferLinks(ids: string[], userId?: string): Promise<number> {
    return this.service.clearTransferLinks(ids, userId);
  }

  static setTransactionArchived(id: string, archived: boolean, userId?: string): Promise<void> {
    return this.service.setTransactionArchived(id, archived, userId);
  }

  static linkTransferPair(idA: string, idB: string, userId?: string): Promise<{ a: Transaction; b: Transaction }> {
    return this.service.linkTransferPair(idA, idB, userId);
  }

  static linkSplitLineTransfer(
    splitId: string,
    transactionId: string,
    userId?: string
  ): Promise<{ split: TransactionSplit; transaction: Transaction }> {
    return this.service.linkSplitLineTransfer(splitId, transactionId, userId);
  }

  static repairClaimedTransfer(
    strandedId: string,
    counterpartId: string,
    partnerId: string,
    adjustmentCategoryId: string,
    userId?: string
  ): Promise<{ stranded: Transaction; counterpart: Transaction; partner: Transaction }> {
    return this.service.repairClaimedTransfer(
      strandedId, counterpartId, partnerId, adjustmentCategoryId, userId
    );
  }

  static archiveTransactionsBefore(accountId: string, cutoffIso: string, userId?: string): Promise<number> {
    return this.service.archiveTransactionsBefore(accountId, cutoffIso, userId);
  }

  static unarchiveAccount(accountId: string, userId?: string): Promise<number> {
    return this.service.unarchiveAccount(accountId, userId);
  }

  static createTransferCounterpart(
    id: string,
    targetAccountId: string,
    userId?: string
  ): Promise<{ source: Transaction; counterpart: Transaction }> {
    return this.service.createTransferCounterpart(id, targetAccountId, userId);
  }

  static getTransactionSplits(transactionId: string): Promise<TransactionSplit[]> {
    return this.service.getTransactionSplits(transactionId);
  }

  static setTransactionSplits(
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: number | null,
    userId?: string
  ): Promise<{ isSplit: boolean; splitCount: number; amount: number }> {
    return this.service.setTransactionSplits(transactionId, splits, expectedAmount, userId);
  }

  static setTransactionSplitsWithLegs(
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: number | null,
    userId?: string
  ): Promise<{ isSplit: boolean; splitCount: number; amount: number; counterparts: Transaction[] }> {
    return this.service.setTransactionSplitsWithLegs(transactionId, splits, expectedAmount, userId);
  }

  static getTransactionsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    return this.service.getTransactionsByDateRange(userId, startDate, endDate);
  }

  static getTransactionsByAccount(accountId: string): Promise<Transaction[]> {
    return this.service.getTransactionsByAccount(accountId);
  }

  static getTransactionsByCategory(categoryId: string): Promise<Transaction[]> {
    return this.service.getTransactionsByCategory(categoryId);
  }

  static bulkCreateTransactions(
    userId: string,
    transactions: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<Transaction[]> {
    return this.service.bulkCreateTransactions(userId, transactions);
  }

  static subscribeToTransactions(userId: string, callback: (payload: unknown) => void): () => void {
    return this.service.subscribeToTransactions(userId, callback);
  }
}

export const createTransactionService = (options: TransactionServiceOptions = {}) =>
  new TransactionServiceImpl(options);
