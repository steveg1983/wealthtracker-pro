/**
 * Collapsing the `wealthtracker_*` storage generation — ONCE per device, before
 * anything reads storage.
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * The 2026 rename. Every `wealthtracker_*` key the browser holds is copied to
 * its `${KEY_PREFIX}_*` name (see `brand.ts` for why the prefix is not the new
 * brand either). Two stores, because the data is split across them:
 *
 *   IndexedDB `secureData` — the money. Accounts, transactions, splits,
 *     budgets, goals, categories, tags, recurring, reports, dismissals,
 *     preferences. AES-encrypted envelopes keyed by `STORAGE_KEYS` values.
 *   localStorage — the same names from the pre-IndexedDB era (the adapter
 *     still falls back to them), plus the keys four services write there
 *     directly: import rules, the document fallback, the error log, and
 *     userService's offline preferences/settings.
 *
 * ── THE FOUR PROPERTIES, AND WHY EACH ONE ────────────────────────────────────
 *
 *   COPY, NEVER MOVE. The old keys stay. Rolling back to a build that reads
 *     the old names is then a deploy, not a data recovery. The old copies are
 *     deleted in a later release, behind a second watermark, once the new
 *     names have been read in anger.
 *   ENVELOPES VERBATIM. An encrypted record is copied as stored — not
 *     decrypted and re-encrypted. The ciphertext is already valid under
 *     `wt_enc_key`, which is NOT renamed; re-encrypting would add a failure
 *     mode that copying does not have.
 *   NEVER CLOBBER. A destination that already holds a value is left alone, so
 *     a re-run after a crash cannot overwrite newer data with older.
 *   WATERMARK LAST. `STORAGE_GENERATION_KEY` is written only after the record
 *     pass completes. A tab that dies halfway simply redoes the pass; and if
 *     IndexedDB cannot be opened at all (private browsing on some engines) the
 *     watermark is withheld so the next boot tries again rather than marking
 *     records migrated that were never touched.
 *
 * It is `async` because IndexedDB is, and `main.tsx` AWAITS it before the
 * first render. A fire-and-forget call would race the first service to read
 * storage, which is exactly the bug class this module exists to prevent.
 *
 * ── WHAT IT DOES NOT TOUCH ────────────────────────────────────────────────────
 *
 * `money_management_*` (a wire format shared with the cloud preferences
 * document and every backup file) and `wt_*` (brand-free, and home to the
 * encryption key). `brand.ts` has the reasoning. The IndexedDB database NAME
 * (`WealthTrackerDB`) is also untouched: a different name is a different,
 * empty database, and the records inside this one are what carried the brand.
 */

import { storageKey } from '../brand';
import { indexedDBService } from '../services/indexedDBService';
import { createScopedLogger } from '../loggers/scopedLogger';

const logger = createScopedLogger('StorageMigration');

/** Bumped when a later pass (e.g. deleting the old copies) is added. */
export const STORAGE_GENERATION = 1;

/** localStorage. Holds the highest generation this device has completed. */
export const STORAGE_GENERATION_KEY = storageKey('storage_generation');

/** The IndexedDB object store `encryptedStorageService` writes to. */
const SECURE_STORE = 'secureData';

/**
 * Records in IndexedDB `secureData`, old name → new. The same names are also
 * copied in localStorage, where the adapter's pre-IndexedDB fallback may still
 * find them. Must agree with `STORAGE_KEYS` in `encryptedStorageService.ts`;
 * the test for this module asserts that it does.
 */
export const RECORD_MOVES: ReadonlyArray<readonly [from: string, to: string]> = [
  ['wealthtracker_accounts', storageKey('accounts')],
  ['wealthtracker_transactions', storageKey('transactions')],
  ['wealthtracker_transaction_splits', storageKey('transaction_splits')],
  ['wealthtracker_suggestion_dismissals', storageKey('suggestion_dismissals')],
  ['wealthtracker_budgets', storageKey('budgets')],
  ['wealthtracker_goals', storageKey('goals')],
  ['wealthtracker_custom_reports', storageKey('custom_reports')],
  ['wealthtracker_tags', storageKey('tags')],
  ['wealthtracker_recurring', storageKey('recurring')],
  ['wealthtracker_categories', storageKey('categories')],
  ['wealthtracker_preferences', storageKey('preferences')],
];

/** localStorage only — the keys services write there directly. */
export const LOCAL_ONLY_MOVES: ReadonlyArray<readonly [from: string, to: string]> = [
  ['wealthtracker_import_rules', storageKey('import_rules')],
  ['wealthtracker_documents', storageKey('documents')],
  ['wealthtracker_error_log', storageKey('error_log')],
  ['wealthtracker_settings', storageKey('settings')],
];

/** Every localStorage move: the record names (fallback copies) plus the local-only set. */
export const LOCAL_MOVES: ReadonlyArray<readonly [from: string, to: string]> = [
  ...RECORD_MOVES,
  ...LOCAL_ONLY_MOVES,
];

export interface LocalStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RecordStore {
  get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined>;
  put<T extends Record<string, unknown>>(storeName: string, data: T): Promise<void>;
}

export interface MigrationReport {
  /** True when the watermark said this generation was already done. */
  skipped: boolean;
  /** New localStorage keys written by this run. */
  localCopied: string[];
  /** New `secureData` records written by this run. */
  recordsCopied: string[];
  /** Set when the record pass could not run; the watermark is withheld. */
  recordsFailed?: string;
}

export interface MigrateStorageOptions {
  /** Defaults to `window.localStorage`; `null` means there is none. */
  local?: LocalStore | null;
  /** Defaults to the app's IndexedDB service; `null` means there is none. */
  records?: RecordStore | null;
}

const resolveLocal = (): LocalStore | null => {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    // Accessing localStorage can itself throw (blocked storage).
    return null;
  }
};

const readGeneration = (local: LocalStore | null): number => {
  try {
    const raw = local?.getItem(STORAGE_GENERATION_KEY);
    const parsed = raw === null || raw === undefined ? 0 : Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
};

/**
 * Run the migration. Safe to call on every boot: the watermark makes the
 * second and later calls a single `getItem`.
 */
export async function migrateStorage(options: MigrateStorageOptions = {}): Promise<MigrationReport> {
  const local = options.local === undefined ? resolveLocal() : options.local;
  const records = options.records === undefined ? indexedDBService : options.records;

  const report: MigrationReport = { skipped: false, localCopied: [], recordsCopied: [] };

  if (readGeneration(local) >= STORAGE_GENERATION) {
    report.skipped = true;
    return report;
  }

  // 1. localStorage. Per-key try/catch: one blocked or full store must not
  //    stop the others, and the pass is idempotent so a partial run is fine.
  if (local) {
    for (const [from, to] of LOCAL_MOVES) {
      try {
        const value = local.getItem(from);
        if (value === null || value === undefined) continue;
        if (local.getItem(to) !== null) continue; // never clobber
        local.setItem(to, value);
        report.localCopied.push(to);
      } catch (error) {
        logger.warn(`Could not copy localStorage key ${from} → ${to}`, error as Error);
      }
    }
  }

  // 2. IndexedDB records, envelopes verbatim. The whole pass is one try/catch:
  //    the common failure is "cannot open the database at all", and the right
  //    answer to that is to withhold the watermark and try again next boot.
  if (records) {
    try {
      for (const [from, to] of RECORD_MOVES) {
        const stored = await records.get<Record<string, unknown>>(SECURE_STORE, from);
        if (!stored) continue;
        if (await records.get(SECURE_STORE, to)) continue; // never clobber
        await records.put(SECURE_STORE, { ...stored, key: to });
        report.recordsCopied.push(to);
      }
    } catch (error) {
      report.recordsFailed = error instanceof Error ? error.message : String(error);
      logger.warn('Record migration did not complete; it will run again next boot', error as Error);
      return report;
    }
  }

  // 3. Watermark LAST.
  try {
    local?.setItem(STORAGE_GENERATION_KEY, String(STORAGE_GENERATION));
  } catch (error) {
    logger.warn('Could not record the storage generation; the migration will re-run (harmlessly)', error as Error);
  }

  if (report.localCopied.length > 0 || report.recordsCopied.length > 0) {
    logger.info(
      `Storage generation ${STORAGE_GENERATION}: copied ${report.localCopied.length} localStorage key(s) and ${report.recordsCopied.length} record(s)`
    );
  }
  return report;
}
