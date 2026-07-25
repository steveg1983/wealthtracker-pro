/**
 * The boot snapshot of a user's transactions, held in IndexedDB.
 *
 * WHY this exists: the app calls itself offline-first, but nothing ever wrote
 * the fetched cloud rows anywhere local — AutoSyncService read the browser-local
 * collections (which only the demo/local write paths ever fill), found zero
 * rows, logged "Local data loaded: {transactions: 0}" and moved on. So every
 * refresh re-downloaded the entire history: ~29 MB and ~5.8s of a 6.5s boot for
 * a 51k-row account. This store holds that history so the next boot can hydrate
 * from disk and ask the server only for what changed.
 *
 * WHY IndexedDB and not the existing storageAdapter: storageAdapter routes
 * anything transaction-shaped through encryptedStorageService, which
 * JSON-stringifies and then AES-encrypts the whole blob with crypto-js on the
 * main thread. At ~29 MB that costs far more than the network fetch it is meant
 * to replace — and the encryption key is stored client-side next to the data
 * anyway (encryptedStorageService says so itself), so it buys obfuscation, not
 * protection. A structured clone into IndexedDB is the same threat model at a
 * fraction of the cost.
 *
 * WHY the shared `largeData` store rather than a new one: adding an object store
 * means bumping indexedDBService's database version, and a version change blocks
 * indefinitely while another tab holds the old connection open. `largeData` has
 * existed since the store list was created and has no other writer.
 *
 * Multi-tab: the snapshot is ONE record written in ONE put, so a second tab can
 * only ever replace it wholesale with its own internally-consistent snapshot —
 * last writer wins, and neither tab can observe a half-updated set.
 */

import { indexedDBService } from './indexedDBService';
import type { Transaction } from '../types';

/**
 * Bump when the stored record's own shape changes. The column list is checked
 * separately (below), so a boot-column change does NOT need a bump here.
 */
const CACHE_SCHEMA_VERSION = 1;
const CACHE_STORE = 'largeData';
const CACHE_RECORD_KEY = 'wt-boot-transactions';

export interface TransactionSnapshot {
  /** Rows exactly as the network path returns them. */
  rows: Transaction[];
  /** ISO timestamp: the newest updated_at present in `rows`. */
  highWaterMark: string;
}

/**
 * A type alias, not an interface, so it carries an implicit index signature and
 * satisfies the store's `Record<string, unknown>` bound without a cast.
 */
type StoredSnapshot = {
  key: string;
  schemaVersion: number;
  /** Database user id — a snapshot is NEVER served to a different user. */
  userId: string;
  /**
   * The exact select list the rows were fetched with. A column added to or
   * removed from the boot query (as in d10f58fd) changes this string, which
   * invalidates the snapshot instead of hydrating rows with missing fields.
   */
  columns: string;
  savedAt: string;
  highWaterMark: string;
  rows: Transaction[];
};

/** The slice of indexedDBService this store needs — injectable for tests. */
export interface TransactionCacheStore {
  get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined>;
  put<T extends Record<string, unknown>>(storeName: string, data: T): Promise<void>;
  delete(storeName: string, key: IDBValidKey): Promise<void>;
}

type Logger = Pick<Console, 'warn'>;

export interface TransactionCacheOptions {
  store?: TransactionCacheStore;
  logger?: Logger;
  now?: () => Date;
}

/**
 * `updated_at` as a comparable ISO string. PostgREST hands it over as a string
 * and nothing in the boot path converts it, but a locally-created row can carry
 * a real Date — both are accepted, anything else is ignored rather than
 * poisoning the high-water mark.
 */
function readUpdatedAt(row: Transaction): string | null {
  const raw: unknown = row.updatedAt;
  if (typeof raw === 'string' && raw !== '') return raw;
  if (raw instanceof Date && Number.isFinite(raw.getTime())) return raw.toISOString();
  return null;
}

/** The newest updated_at across the rows, or null when none carries one. */
export function newestUpdatedAt(rows: Transaction[]): string | null {
  let newest: string | null = null;
  let newestMs = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const value = readUpdatedAt(row);
    if (value === null) continue;
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) continue;
    if (ms > newestMs) {
      newestMs = ms;
      newest = value;
    }
  }
  return newest;
}

export class TransactionCache {
  private readonly store: TransactionCacheStore;
  private readonly logger: Logger;
  private readonly now: () => Date;

  constructor(options: TransactionCacheOptions = {}) {
    this.store = options.store ?? indexedDBService;
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    this.logger = { warn: options.logger?.warn ?? (fallbackLogger?.warn?.bind(fallbackLogger) ?? (() => {})) };
    this.now = options.now ?? (() => new Date());
  }

  /**
   * The stored snapshot, or null when there isn't a usable one. Every rejection
   * path also drops the record: an unusable snapshot is dead weight (tens of
   * megabytes) and will never become usable again.
   *
   * Never throws — a cache that cannot be read is a cache miss, not a failure.
   */
  async read(userId: string, columns: string): Promise<TransactionSnapshot | null> {
    try {
      const record = await this.store.get<StoredSnapshot>(CACHE_STORE, CACHE_RECORD_KEY);
      if (!record) return null;

      const usable =
        record.schemaVersion === CACHE_SCHEMA_VERSION &&
        record.userId === userId &&
        record.columns === columns &&
        typeof record.highWaterMark === 'string' &&
        record.highWaterMark !== '' &&
        Array.isArray(record.rows) &&
        record.rows.length > 0;

      if (!usable) {
        await this.clear();
        return null;
      }

      return { rows: record.rows, highWaterMark: record.highWaterMark };
    } catch (error) {
      this.logger.warn('[TransactionCache] Unable to read the boot snapshot', error);
      return null;
    }
  }

  /**
   * Replace the snapshot. A set with no usable updated_at anywhere is NOT
   * stored: without a high-water mark there is no delta to ask for, so the next
   * boot would have to re-download everything regardless.
   *
   * Never throws — failing to cache (quota, private browsing, a missing store)
   * costs speed on the next boot and nothing else.
   */
  async write(userId: string, columns: string, rows: Transaction[]): Promise<void> {
    const highWaterMark = newestUpdatedAt(rows);
    if (highWaterMark === null) return;

    try {
      const record: StoredSnapshot = {
        key: CACHE_RECORD_KEY,
        schemaVersion: CACHE_SCHEMA_VERSION,
        userId,
        columns,
        savedAt: this.now().toISOString(),
        highWaterMark,
        rows
      };
      await this.store.put(CACHE_STORE, record);
    } catch (error) {
      this.logger.warn('[TransactionCache] Unable to store the boot snapshot', error);
      // A half-written or over-quota record must not be left behind to be
      // trusted on the next boot.
      await this.clear();
    }
  }

  /** Drop the snapshot (sign-out, user switch, unusable record). Never throws. */
  async clear(): Promise<void> {
    try {
      await this.store.delete(CACHE_STORE, CACHE_RECORD_KEY);
    } catch (error) {
      this.logger.warn('[TransactionCache] Unable to clear the boot snapshot', error);
    }
  }
}

export const transactionCache = new TransactionCache();
export default transactionCache;
