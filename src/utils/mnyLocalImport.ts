import { STORAGE_KEYS } from '../services/storageAdapter';
import { createScopedLogger } from '../loggers/scopedLogger';

/**
 * DEV-ONLY local preview loader for the MS Money import.
 *
 * Purely a proving harness — NOT the shippable feature. Gated to
 * `import.meta.env.DEV`; a no-op in production builds. It reads the gitignored
 * `.mny-local/mny-local-seed.json` (produced by `scripts/mnyLocalImport.mts`,
 * served at /mny-local-seed.json by a dev-only Vite middleware — never part
 * of a build) and
 * writes it into local storage exactly the way demo mode seeds data, so the
 * whole Microsoft Money file can be browsed in a purely local WealthTracker —
 * no cloud, no live data.
 *
 * Activate with `?demo=true&mnyimport=local` on localhost:
 *   - `demo=true` rides the existing demo auth-bypass (view without signing in)
 *     and puts the app in local-storage mode.
 *   - `mnyimport=local` suppresses the demo SAMPLE data and injects the Money
 *     seed instead (see App.tsx bootstrap).
 */

const logger = createScopedLogger('MnyLocalImport');
const LOADED_FLAG = 'mny_local_seed_loaded';

export function isMnyLocalImportRequested(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('mnyimport') === 'local';
}

interface MnySeed {
  accounts: unknown[];
  categories: unknown[];
  transactions: unknown[];
  transactionSplits: unknown[];
  summary?: unknown;
}

/**
 * Write the seed into local storage once, then reload so the app reads it.
 * Idempotent within a session via a sessionStorage flag; the caller must NOT
 * also run initializeDemoData when this is active.
 */
export async function loadMnyLocalSeed(): Promise<void> {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;

  // Already injected this session — the app is about to read it; do nothing.
  if (window.sessionStorage.getItem(LOADED_FLAG) === 'true') {
    return;
  }

  try {
    const res = await fetch('/mny-local-seed.json', { cache: 'no-store' });
    if (!res.ok) {
      logger.error('Seed fetch failed', { status: res.status });
      return;
    }
    const seed = (await res.json()) as MnySeed;

    // Mirror initializeDemoData's storage contract exactly: the wealthtracker_-
    // prefixed keys, plus the transaction-splits key, then force the
    // localStorage→IndexedDB migration so the fresh seed is picked up.
    window.localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(seed.accounts));
    window.localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(seed.transactions));
    window.localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(seed.categories));
    window.localStorage.setItem(STORAGE_KEYS.TRANSACTION_SPLITS, JSON.stringify(seed.transactionSplits));
    // Empty out the other demo collections so nothing stale lingers.
    window.localStorage.setItem(STORAGE_KEYS.BUDGETS, '[]');
    window.localStorage.setItem(STORAGE_KEYS.GOALS, '[]');
    window.localStorage.setItem(STORAGE_KEYS.RECURRING, '[]');
    // demoMode flag keeps the app in local mode (the demo=true param already
    // bypassed auth); it does NOT re-seed sample data — that only runs for
    // isDemoMode() with the mnyimport param absent.
    window.localStorage.setItem('demoMode', 'true');
    window.sessionStorage.removeItem('wt_migration_completed');
    window.sessionStorage.setItem(LOADED_FLAG, 'true');

    logger.info('MS Money local seed injected', {
      accounts: seed.accounts.length,
      transactions: seed.transactions.length,
    });

    // Reload so the app reads the freshly-seeded local storage. The URL keeps
    // demo=true&mnyimport=local; on the reload the flag short-circuits this
    // function and App skips demo seeding.
    window.location.reload();
  } catch (error) {
    logger.error('Failed to load MS Money local seed', error);
  }
}
