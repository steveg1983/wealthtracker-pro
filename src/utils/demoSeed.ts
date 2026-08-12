/**
 * Seeding the demo sample data into the BROWSER's store.
 *
 * Split out of `utils/demoData.ts` in the mount slice's second half. That file
 * is the sample finances and is now edition-blind object literals; this is the
 * one function that wrote them somewhere, and where it writes them is a browser.
 * `demoData.ts`'s header carries the measurement that asked for the split.
 *
 * There is no device half of this and there will not be one. Demo mode is
 * `?demo=true` on a hosted app — a way of showing a stranger the product without
 * giving them an account — and a program somebody installed and pointed at their
 * own file has no such question to answer. `desktop/editions/chrome.tsx` says
 * the same thing about the yellow banner, and `editions/cloud/session.ts` is the
 * only caller.
 */

import { storageAdapter, STORAGE_KEYS } from '../services/storageAdapter';
import { createScopedLogger } from '../loggers/scopedLogger';
import { isMnyLocalImportRequested } from './mnyLocalImport';
import {
  demoAccounts,
  demoBudgets,
  demoCategories,
  demoGoals,
  demoRecurringTransactions,
  generateDemoTransactions,
  isDemoMode
} from './demoData';

const demoLogger = createScopedLogger('DemoData');

/**
 * Seed the demo sample data, through the SAME storage the app reads from.
 *
 * This used to write the wealthtracker_* keys straight into localStorage and
 * then clear the `wt_migration_completed` flag, on the understanding that
 * storageAdapter would carry them into encrypted IndexedDB on its next init.
 * Nothing in the app ever calls storageAdapter.init(), so that migration never
 * ran and the flag meant nothing: the seed was only ever visible through the
 * adapter's "not in IndexedDB, so try localStorage" fallback. The moment
 * IndexedDB held any value for one of those keys — an empty array, which
 * Settings → Data Management → Clear All Data is enough to produce — the
 * fallback stopped being consulted, and demo mode was empty forever no matter
 * how many times the page was reloaded with ?demo=true.
 *
 * Going through storageAdapter puts the seed exactly where the reads look, and
 * keeps the localStorage fallback for browsers where IndexedDB is unavailable
 * (the adapter already falls back on write). AppContext awaits this before its
 * first read, so seeding and loading can no longer race.
 */
export const initializeDemoData = async (): Promise<void> => {
  if (!isDemoMode()) return;
  // The DEV-only Money import seeds the same keys from a real file and reloads
  // the page itself. Sample data would only fight it.
  if (isMnyLocalImportRequested()) return;

  localStorage.setItem('demoMode', 'true');

  // Only seed when there is nothing to show. A demo session that has been used
  // holds the visitor's own edits, and a reload must not throw those away —
  // which is also what makes the fixed account ids above worth having.
  const existingAccounts = await storageAdapter.get<unknown[]>(STORAGE_KEYS.ACCOUNTS);
  if (Array.isArray(existingAccounts) && existingAccounts.length > 0) {
    return;
  }

  await Promise.all([
    storageAdapter.set(STORAGE_KEYS.ACCOUNTS, demoAccounts),
    storageAdapter.set(STORAGE_KEYS.TRANSACTIONS, generateDemoTransactions(100)),
    storageAdapter.set(STORAGE_KEYS.BUDGETS, demoBudgets),
    storageAdapter.set(STORAGE_KEYS.GOALS, demoGoals),
    storageAdapter.set(STORAGE_KEYS.CATEGORIES, demoCategories),
    storageAdapter.set(STORAGE_KEYS.RECURRING, demoRecurringTransactions),
  ]);

  demoLogger.info('Demo mode seeded with sample data');
};
