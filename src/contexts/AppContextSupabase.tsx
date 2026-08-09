/* eslint-disable react-refresh/only-export-components */
/**
 * AppContext with Supabase Integration
 * This version uses the DataService layer to work with either Supabase or localStorage
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { DataService } from '../services/api/dataService';
// The boot's ledger reads go through the seam. `dataPort` IS the DataService
// above, typed as the interface — no wrapper, no second copy, no extra bytes —
// so this import is a statement about WHICH DOOR the boot uses, not about which
// engine answers. That is what lets a local implementation be dropped in.
import { dataPort } from '../services/port';
import * as SimpleAccountService from '../services/api/simpleAccountService';
import AutoSyncService from '../services/autoSyncService';
import { transactionCache } from '../services/transactionCache';
import { userIdService } from '../services/userIdService';
import { isSupabaseConfigured } from '../services/api/supabaseClient';
import { PlanningService } from '../services/api/planningService';
import { goalAchievementService } from '../services/goalAchievementService';
import { getDefaultCategories } from '../data/defaultCategories';
// formatCurrency import removed - not used in this context
import {
  toDecimalTransaction,
  toDecimalAccount,
  toDecimalGoal
} from '../utils/decimal-converters';
import { toDecimal, type DecimalInstance } from '../utils/decimal';
import { normalizeTransactionDates } from '../utils/dateBoundary';
import { initializeDemoData } from '../utils/demoData';
import {
  buildTestDataset,
  planTestDataCategories,
  type TestDataPhase,
  type TestDataProgress,
  type TestDataSeedResult
} from '../utils/testDataset';
import type { ServerAccountBalance } from '../utils/accountBalances';
import type { DecimalTransaction, DecimalAccount, DecimalGoal } from '../types/decimal-types';
import type {
  Account,
  AccountUpdate,
  Transaction,
  TransactionSplit,
  TransactionSplitInput,
  SplitWriteResult,
  Category,
  CategoryMergeResult,
  Budget,
  DismissalKind,
  Goal,
  RecurringTransaction,
  SuggestionDismissal,
  AppState
} from '../types';
import { createScopedLogger } from '../loggers/scopedLogger';
import { planCategoryTreeImport, planCategoryPrune, type CategoryTreeGroup } from '../utils/categoryTreeImport';
import { preferences as preferencesService } from '../services/preferencesService';

export interface Tag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppContextType extends AppState {
  // Account operations
  addAccount: (account: Omit<Account, 'id'> & { initialBalance?: number }) => Promise<Account>;
  updateAccount: (id: string, updates: AccountUpdate) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  // Transaction operations — async so callers can surface save failures.
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  
  // Budget operations — async so callers can surface persistence failures
  addBudget: (budget: Omit<Budget, 'id' | 'spent'>) => Promise<void>;
  updateBudget: (id: string, updates: Partial<Budget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;

  // Goal operations — async so callers can surface persistence failures
  addGoal: (goal: Omit<Goal, 'id' | 'progress'>) => Promise<void>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  contributeToGoal: (id: string, amount: number) => Promise<void>;
  
  // Category operations — async so callers can surface persistence failures
  /** Returns the created category so callers can use its real id immediately. */
  addCategory: (category: Omit<Category, 'id'>) => Promise<Category>;
  /**
   * Merge a Money-style category tree; skips same-named entries. With
   * pruneOthers, unused non-system categories outside the tree are removed
   * afterwards (categories still referenced by transactions are kept).
   */
  importCategoryTree: (
    tree: CategoryTreeGroup[],
    options?: { pruneOthers?: boolean }
  ) => Promise<{ created: number; skipped: number; pruned: number; keptForTransactions: number }>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  /**
   * Join two categories: every reference (transactions, split lines, budgets,
   * recurring templates) moves from `sourceId` to `targetId` and the source is
   * removed — all in ONE server-side transaction, so it either happens or it
   * does not. Balance-neutral. Returns what actually moved, as the database
   * counted it.
   */
  mergeCategories: (sourceId: string, targetId: string) => Promise<CategoryMergeResult>;
  getSubCategories: (parentId: string) => Category[];
  getDetailCategories: (parentId: string) => Category[];
  
  // Tag operations
  addTag: (tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  getTagUsageCount: (tagName: string) => number;
  getAllUsedTags: () => string[];
  
  // Other operations
  importData: (data: Partial<AppState>) => void;
  exportData: () => string;
  resetLoadedData: () => Promise<void>;
  getDecimalTransactions: () => DecimalTransaction[];
  getDecimalAccounts: () => DecimalAccount[];
  getDecimalGoals: () => DecimalGoal[];
  
  // Sync status
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;
  isUsingSupabase: boolean;
  /**
   * Re-pull ONLY accounts + transactions from Supabase (e.g. after a bank sync).
   * Deliberately narrow — budgets/goals load from PlanningService, so a whole-app
   * refresh would blank them for cloud users.
   */
  refreshAccountsAndTransactions: () => Promise<void>;
  /**
   * Re-pull categories (e.g. after closing/reopening an account, whose DB
   * trigger flips the linked transfer category's active flag server-side).
   * Never throws — a failed refresh just leaves the current snapshot.
   */
  refreshCategories: () => Promise<void>;
  /**
   * Bulk-set the reconciliation cleared flag on transactions in one round trip.
   * Balance-neutral (is_cleared never affects account balances).
   */
  setTransactionsCleared: (ids: string[], cleared: boolean) => Promise<void>;
  /**
   * Apply a category to the listed transactions that are still uncategorized
   * (payee-memory propagation). Fill-blanks only — never overwrites an explicit
   * category, enforced server-side. Returns the number actually updated.
   */
  applyCategoryToUncategorized: (ids: string[], category: string) => Promise<number>;
  /**
   * Agree with the app's suggested category on the named rows, without changing
   * it. Balance-neutral — one boolean per row. Returns how many actually
   * flipped (a row someone else already confirmed does not count twice).
   */
  confirmTransactionCategories: (ids: string[]) => Promise<number>;
  /**
   * Rewrite the payee (description) on the named transactions — the Payee
   * cleanup screen's one write.
   *
   * Every row goes through the SAME audited dataPort.updateTransaction the
   * edit modal uses, so each rename lands in financial_audit_log with its
   * before and after. What differs is only the orchestration: the writes are
   * awaited in small batches (never fired and forgotten), and React state is
   * touched ONCE at the end — a per-row state update would re-map a 50k-row
   * array and re-render the app for every transaction renamed.
   *
   * Resolves with the number of rows actually rewritten. A row that fails is
   * counted out rather than aborting the batch, so a single bad id cannot
   * strand the rest half-renamed with nothing to show for it.
   */
  renameTransactionDescriptions: (
    ids: string[],
    description: string,
    onProgress?: (done: number) => void
  ) => Promise<number>;
  /** Soft-archive an account's reconciled transactions on/before the cutoff. */
  archiveTransactionsBefore: (accountId: string, cutoff: Date) => Promise<number>;
  /** Bring an account's archived transactions back into the live register. */
  unarchiveAccount: (accountId: string) => Promise<number>;
  /**
   * Every split line of the user's transactions, loaded at boot and kept in
   * step by setTransactionSplits. Category-aggregation surfaces expand split
   * parents into these via expandSplitTransactions.
   */
  transactionSplits: TransactionSplit[];
  /**
   * Per-account balance computed by the store itself (opening balance + Σ
   * amount) in one round trip, loaded alongside the ~52-page transaction fetch.
   * Balance surfaces read it ONLY while `transactions` is still empty, so the
   * first paint shows real money instead of zeros; empty map when the store
   * cannot answer, in which case nothing changes.
   *
   * Read-only on purpose: they are a stand-in for the seconds a long history is
   * in flight, and nothing above this seam may edit them.
   */
  serverBalances: ReadonlyMap<string, ServerAccountBalance>;
  /** Splits for one transaction, in display order (empty when not split). */
  getTransactionSplits: (transactionId: string) => Promise<TransactionSplit[]>;
  /**
   * Replace a transaction's splits atomically (empty array un-splits it).
   * Split lines must sum EXACTLY to expectedAmount — enforced server-side,
   * which also syncs the transaction amount and account balance when the sum
   * changes them.
   *
   * A line may declare a `transferAccountId`, making it one LEG of a transfer:
   * the counterpart transaction is created in that account and linked to the
   * exact line, in the same server-side transaction, and comes back in
   * `counterparts`. An already-linked leg may only move position or memo —
   * changing its amount, target or category, or dropping it, is refused,
   * because the row on the other side is pinned to it.
   */
  setTransactionSplits: (
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: number | null
  ) => Promise<SplitWriteResult>;
  /**
   * Join two existing rows (in different accounts, exactly opposite amounts)
   * into a linked transfer pair — both become type 'transfer' carrying the
   * other account's To/From category. Balance-neutral; atomic server-side.
   */
  linkTransferPair: (idA: string, idB: string) => Promise<{ a: Transaction; b: Transaction }>;
  /**
   * Join one LINE of a split to an existing row as the two halves of a
   * transfer — the line-level counterpart of linkTransferPair, for the case
   * where the movement is only part of the transaction it sits in (£35,000
   * arrives, £30,000 of it settles a loan). The amounts must be exactly
   * opposite between the LINE and the row, never the split parent, whose total
   * legitimately differs. Balance-neutral; atomic server-side.
   */
  linkSplitLineTransfer: (
    splitId: string,
    transactionId: string
  ) => Promise<{ split: TransactionSplit; transaction: Transaction }>;
  /**
   * Break linked transfer pairs (the un-doing of linkTransferPair): clears the
   * link on the named rows so they can be re-paired or re-filed. Balance-neutral.
   * The rows keep their transfer type and category until something re-files
   * them — leaving that to the caller, which knows what the row should become.
   */
  unlinkTransfers: (ids: string[]) => Promise<number>;
  /**
   * Soft-archive (or restore) ONE transaction — hidden from the live register,
   * never deleted, still counted in every balance and report.
   */
  setTransactionArchived: (id: string, archived: boolean) => Promise<void>;
  /**
   * Re-pair a counterpart onto the row that really matches it: the wrong
   * pairing is broken, the row it displaces is filed under the given Account
   * Adjustment category, and the right pair is linked — all in ONE server-side
   * transaction, so it either happens or it does not. Balance-neutral.
   */
  repairClaimedTransfer: (
    strandedId: string,
    counterpartId: string,
    partnerId: string,
    adjustmentCategoryId: string
  ) => Promise<void>;
  /**
   * Money-style "create the other side": insert the counterpart in the target
   * account and convert the source into a linked transfer, atomically. Moves
   * the target account's balance by the counterpart amount.
   */
  createTransferCounterpart: (
    id: string,
    targetAccountId: string
  ) => Promise<{ source: Transaction; counterpart: Transaction }>;
  /**
   * Suggestions the user has told the sweeps to stop offering. Loaded on demand
   * (nothing outside the sweeps needs them, and the boot is already the slowest
   * thing in the app), so a surface that filters by these must wait for
   * `suggestionDismissalsStatus` to leave 'loading' before it renders a list.
   */
  suggestionDismissals: SuggestionDismissal[];
  /**
   * 'idle' before the first load, 'error' when the list could not be read — in
   * which case the surfaces show everything and say so, rather than pretending
   * the filter ran.
   */
  suggestionDismissalsStatus: 'idle' | 'loading' | 'ready' | 'error';
  /** Re-read the dismissals (called when a sweep opens). Never throws. */
  refreshSuggestionDismissals: () => Promise<void>;
  /**
   * Record a refusal so the suggestion is never offered again. Throws if it
   * could not be saved — a dismissal that silently fails is the bug this exists
   * to fix.
   */
  dismissSuggestion: (
    kind: DismissalKind,
    subjectKey: string,
    subjectIds: string[]
  ) => Promise<void>;
  /** Undo a refusal: the suggestion comes back from the next scan. */
  restoreSuggestion: (kind: DismissalKind, subjectKey: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const appLogger = createScopedLogger('AppContext');

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  // Every split line of the user's transactions, loaded once at boot and kept
  // in step by setTransactionSplits/deleteTransaction. Category-aggregation
  // surfaces (counters, budgets, analytics, exports) expand split parents
  // into these lines via expandSplitTransactions.
  const [transactionSplits, setTransactionSplitsState] = useState<TransactionSplit[]>([]);
  const [serverBalances, setServerBalances] =
    useState<ReadonlyMap<string, ServerAccountBalance>>(new Map());
  // Refusals the sweeps must honour. Loaded when a sweep opens, not at boot:
  // nothing else reads them, and the boot is already the slowest thing here.
  const [suggestionDismissals, setSuggestionDismissals] = useState<SuggestionDismissal[]>([]);
  const [suggestionDismissalsStatus, setSuggestionDismissalsStatus] =
    useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const [isLoading, setIsLoading] = useState(true);
  // Read-only on purpose: the whole-app refresh that used to flip this was
  // unreachable and has been removed. The flag stays on the context surface
  // (consumers still type against it) and is honestly always false.
  const [isSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isUsingSupabase, setIsUsingSupabase] = useState(false);
  
  // Refs to prevent duplicate updates and manage debouncing
  const lastUpdateRef = useRef<{ type: string; timestamp: number } | null>(null);
  const updateDebounceRef = useRef<NodeJS.Timeout | null>(null);
  // Suppress real-time reloads shortly after a local write to prevent overwriting optimistic updates
  const recentLocalUpdateRef = useRef<number>(0);

  // Initialize data service and load data
  useEffect(() => {
    if (!isLoaded) return;

    // The realtime channels are opened deep inside an ASYNC boot, but React
    // only accepts a cleanup returned SYNCHRONOUSLY from the effect body. That
    // cleanup used to be returned from inside initializeData — into a promise
    // nobody read — so React was handed nothing at all, and every user change
    // and every unmount left the previous login's account and transaction
    // subscriptions open on the channel.
    //
    // The handles are collected in the effect's own scope instead, and the
    // cleanup at the bottom closes over them. `cancelled` covers the race in
    // both directions: a cleanup that fires while the boot is still in flight
    // has no handle to call yet, so anything registered after that point is
    // torn down the moment it arrives.
    let cancelled = false;
    const teardowns: Array<() => void> = [];
    const registerTeardown = (teardown: () => void): void => {
      if (cancelled) {
        teardown();
        return;
      }
      teardowns.push(teardown);
    };

    const initializeData = async () => {
      setIsLoading(true);
      setSyncError(null);

      // Boot phase timings — one summary line at the end so a slow load can
      // be attributed (auth? accounts? categories? transactions?) from the
      // console of ANY environment, production included.
      const bootStart = performance.now();
      const phases: Record<string, number> = {};
      let phaseStart = bootStart;
      const markPhase = (name: string): void => {
        phases[name] = Math.round(performance.now() - phaseStart);
        phaseStart = performance.now();
      };
      // The balances round trip runs ALONGSIDE the phases below rather than
      // between two of them, so it times itself instead of going through
      // markPhase (which measures gaps in the sequential timeline).
      let serverBalancesLoaded: Promise<void> | null = null;

      try {
        appLogger.info('Initializing app context', { userId: user?.id });

        // Demo mode seeds its sample data into the same storage every read
        // below goes through, and it is awaited HERE rather than fired from
        // App's effect: the two used to race, and when the load won, demo mode
        // came up empty and stayed empty. A no-op outside demo mode.
        await initializeDemoData();

        // Initialize DataService with user info
        if (user) {
          appLogger.info('User found, initializing services');
          
          // Initialize userIdService first - this is now the single source of truth
          const databaseId = await userIdService.ensureUserExists(
            user.id,
            user.emailAddresses[0]?.emailAddress || '',
            user.firstName || undefined,
            user.lastName || undefined
          );
          markPhase('auth');
          if (databaseId) {
            appLogger.info('Database user ID resolved', { databaseId });

            // Bind the preferences document to this login. Deliberately NOT
            // awaited: it is one small read that nothing on the critical path
            // depends on, every surface already has this browser's copy to
            // start from, and the service notifies its subscribers when the
            // account's own settings land a moment later. Awaiting it would put
            // a round trip in front of the first account query for no gain, and
            // a slow or missing preferences table would delay the ledger.
            void preferencesService.attach(databaseId);

            // Initialize AutoSync with the database ID ready
            await AutoSyncService.initialize(user.id);
            
            await dataPort.initialize(
              user.id,
              user.emailAddresses[0]?.emailAddress || '',
              user.firstName || undefined,
              user.lastName || undefined
            );
            appLogger.info('Loading application data');
            markPhase('services');

            // Through the seam, in the position the direct call held. The
            // database id resolved above is the one the port reads back for
            // itself (ensureUserExists sets it), so this asks the same
            // question of the same table through the same row mapper — and it
            // stops the boot naming a service, which is the point.
            const accounts = await dataPort.getAccounts();
            appLogger.info('Accounts loaded', { count: accounts.length });
            setAccounts(accounts);
            markPhase('accounts');

            // One round trip for every account's balance, started here and
            // deliberately NOT awaited: the paged transaction load must not
            // wait on it. Those pages are ~77% of the boot, and until they
            // land every client-side balance is zero — these figures let the
            // dashboard paint real money in the meantime.
            const balancesStart = performance.now();
            serverBalancesLoaded = dataPort.getAccountBalances().then(balances => {
              phases.balances = Math.round(performance.now() - balancesStart);
              setServerBalances(balances);
            });
          } else {
            appLogger.warn('Failed to resolve database user ID - no data will be loaded');
            setAccounts([]);
          }
        } else {
          // No user logged in
          appLogger.info('No user logged in');
          setAccounts([]);
          // Signed out (this effect re-runs when Clerk's user goes away, however
          // the sign-out was triggered): the cached history belongs to whoever
          // was signed in and must not survive on a shared browser.
          void transactionCache.clear();
          // Stop writing this browser's copy up to a login that is no longer
          // here. The mirror stays: it is what the next signed-out session
          // reads, and it belongs to the browser rather than to the account.
          preferencesService.detach();
        }
        
        // Categories first, and that is a CONSTRAINT rather than a preference:
        // this line may not move below the transaction read. The reason it may
        // not — the one-time id migration and the remap that comes with it —
        // now lives on the seam, where every implementation can be held to it,
        // rather than here where only this call site could read it. See
        // DataPortLifecycle.prepareCategories.
        const loadedCategories = await dataPort.prepareCategories();
        setCategories(loadedCategories);
        markPhase('categories');

        // Now load transactions, budgets, and goals (post-remap views).
        const boot = await dataPort.loadBootTransactions();
        setTransactions(boot.transactions);
        markPhase('transactions');

        // Split lines ride along with transactions; a failure here must not
        // block the app (split parents then pass through aggregation whole).
        // The catch stays where it is rather than moving onto the seam: unlike
        // the boot's transactions, this read has no "empty is an honest answer"
        // story to tell, and the refresh sites below share the same handling.
        try {
          setTransactionSplitsState(await dataPort.getAllTransactionSplits());
        } catch (splitError) {
          appLogger.error('Failed to load transaction splits', splitError);
          setTransactionSplitsState([]);
        }
        markPhase('splits');

        // Without an authenticated user (demo / local-only mode) the account
        // read above returns nothing — it needs a database user id. Ask the
        // seam for the storage-backed accounts instead, so demo mode shows
        // accounts everywhere (accounts page, dashboard distribution,
        // add-transaction modal).
        //
        // Guarded rather than unconditional, and that is the point of this
        // step: the boot used to read the account list a SECOND time on every
        // load — signed-in ones included, where the answer was thrown away
        // unread. A signed-in boot never evaluates the await below, so its
        // sequence of awaits is exactly what it was.
        if (!user) {
          const localAccounts = await dataPort.getAccounts();
          if (localAccounts.length > 0) {
            setAccounts(localAccounts);
          }
        }

        // Still ONE Promise.all: two independent reads that have no reason to
        // queue behind each other, and turning them into two awaits would add a
        // round trip to every signed-in boot for nothing.
        //
        // The database id no longer travels from here — the seam resolves its
        // own owner, which is what stops a caller passing a null one and being
        // served the browser's budgets in a signed-in session with no error to
        // show for it.
        const [loadedBudgets, loadedGoals] = await Promise.all([
          dataPort.getBudgets(),
          dataPort.getGoals()
        ]);
        setBudgets(loadedBudgets);
        setGoals(loadedGoals);
        markPhase('planning');

        setIsUsingSupabase(DataService.isUsingSupabase());
        setLastSyncTime(new Date());
        // Settled long ago in practice (it started before the slowest phase) —
        // awaited only so the summary line below can report its timing.
        await serverBalancesLoaded;
        // The numbers live IN the message so any console shows the breakdown
        // without expanding an object — and via console.info directly, because
        // the scoped logger's console bridge is DEV-ONLY and this one line is
        // exactly what a production slowness report needs.
        // The transaction figure must stay honest about WHERE the rows came
        // from: a 200ms boot that hydrated a stale snapshot and a 200ms boot
        // that fetched nothing because nothing changed look identical
        // otherwise, and the next slowness report would start from a lie.
        // The reason is no longer optional-then-defaulted: the seam promises
        // stats on every answer and a stated reason whenever it did not serve a
        // snapshot, so the old `?? 'no cache'` had become a branch that could
        // not be taken. Both SENTENCES are unchanged.
        const txnStats = boot.stats;
        const txnSummary = txnStats.fullFetchReason === null
          ? `${txnStats.total.toLocaleString()} transactions ` +
            `(${txnStats.cached.toLocaleString()} from cache + ${txnStats.fetched.toLocaleString()} delta)`
          : `${boot.transactions.length.toLocaleString()} transactions ` +
            `(full fetch — ${txnStats.fullFetchReason})`;
        console.info(
          `Boot data load: ${Math.round(performance.now() - bootStart)}ms total — ` +
          Object.entries(phases).map(([name, ms]) => `${name} ${ms}ms`).join(' · ') +
          ` (${txnSummary})`
        );

        // Subscribe to real-time updates if using Supabase
        if (DataService.isUsingSupabase() && user) {
          // Helper function to debounce updates
          const debouncedUpdate = (updateType: string, updateFn: () => Promise<void>) => {
            // Check if this is a duplicate update (within 1 second)
            const now = Date.now();
            if (lastUpdateRef.current && 
                lastUpdateRef.current.type === updateType && 
                now - lastUpdateRef.current.timestamp < 1000) {
              appLogger.debug('Skipping duplicate real-time update', { updateType });
              return;
            }
            
            // Clear any pending debounced update
            if (updateDebounceRef.current) {
              clearTimeout(updateDebounceRef.current);
            }
            
            // Set a new debounced update
            updateDebounceRef.current = setTimeout(async () => {
              lastUpdateRef.current = { type: updateType, timestamp: now };
              await updateFn();
            }, 200); // 200ms debounce
          };
          
          // ONE subscribe call and ONE handle: both channels — accounts and
          // transactions — now come through the same door.
          //
          // The account channel used to be opened through a second service, and
          // that service's version of the same subscription differed in ways
          // that are declared here rather than discovered later:
          //
          //  · the channel is named `accounts:<id>`, not `accounts-<id>`;
          //  · nothing logs the subscribe status any more. The retired call
          //    passed a status callback that logged every transition and every
          //    subscribe error; this one passes none, so a channel that fails to
          //    join now does so silently. That is the one thing this change
          //    costs, and it is a declared cost rather than an oversight;
          //  · the await disappears. The retired call was async because it
          //    resolved the login's database id itself before opening anything;
          //    the seam uses the id the boot already resolved, so the channel
          //    opens synchronously and there is no window between asking for it
          //    and holding its handle;
          //  · its "no database user for this Clerk id" warning goes with it —
          //    behind this gate an id is resolved by definition;
          //  · one registerTeardown instead of two, because there is one handle.
          //
          // What does NOT change: both callbacks below, the debounce above, and
          // the recent-local-write suppression are the code that was already
          // here, in the order it was already in.
          const unsubscribeData = dataPort.subscribeToUpdates({
            onAccountUpdate: async (payload) => {
              const realtimePayload = payload as { eventType: string; new?: { is_active?: boolean } };
              appLogger.debug('Real-time account update received', realtimePayload);
              appLogger.debug('Real-time account update type', { eventType: realtimePayload.eventType });

              // Handle different event types
              if (realtimePayload.eventType === 'UPDATE' && realtimePayload.new && !realtimePayload.new.is_active) {
                appLogger.debug('Real-time account marked inactive');
              }
              
              // Skip real-time reload if we just made a local update (prevents overwriting optimistic state)
              if (Date.now() - recentLocalUpdateRef.current < 2000) {
                appLogger.debug('Skipping real-time account reload (recent local update)');
                return;
              }

              debouncedUpdate('account', async () => {
                appLogger.debug('Reloading accounts after real-time update');
                // Reload accounts when any change happens — through the seam.
                //
                // The same question, asked the same way: the port's cloud branch
                // runs the same SELECT on `accounts` (user_id, is_active, ordered
                // by created_at) through the same mapAccountFromDb, and falls back
                // to the same stored list under the same storage key. What changes
                // is WHOSE id it asks about.
                //
                // The retired call carried this login's Clerk id and re-resolved
                // it to a database id on every event; the port reads the id the
                // boot already resolved. Behind the gate this whole block sits
                // behind — `isUsingSupabase()` is exactly "a database id is
                // resolved AND Supabase is configured" — that id is warm, so on
                // the path that matters the two agree.
                //
                // Where they stop agreeing is a DECLARED IMPROVEMENT rather than
                // a preserved behaviour: if the id cache is cleared between the
                // event and this reload (sign-out, or a switch of login), the old
                // call would re-resolve the CAPTURED Clerk id and paint the
                // previous login's accounts onto whatever is on screen now. The
                // port has no captured id to re-resolve — it answers [] while a
                // session is still connecting, and never reaches for another
                // login's rows.
                const updatedAccounts = await dataPort.getAccounts();
                appLogger.debug('Accounts reloaded', { count: updatedAccounts.length });
                setAccounts(updatedAccounts);
                setLastSyncTime(new Date());

                // Also refresh transactions to update account balances
                const updatedTransactions = await dataPort.getTransactions();
                setTransactions(updatedTransactions);

                // Splits ride along — without this, a split edited on another
                // device leaves this device's category views stale.
                try {
                  setTransactionSplitsState(await dataPort.getAllTransactionSplits());
                } catch (splitError) {
                  appLogger.error('Failed to refresh transaction splits', splitError);
                }
              });
            },
            onTransactionUpdate: async (payload) => {
              appLogger.debug('Transaction update received', payload);
              
              debouncedUpdate('transaction', async () => {
                // Reload transactions when any change happens
                const updatedTransactions = await dataPort.getTransactions();
                setTransactions(updatedTransactions);

                // Splits ride along — without this, a split edited on another
                // device leaves this device's category views stale.
                try {
                  setTransactionSplitsState(await dataPort.getAllTransactionSplits());
                } catch (splitError) {
                  appLogger.error('Failed to refresh transaction splits', splitError);
                }

                // Also refresh accounts to update balances
                const updatedAccounts = await dataPort.getAccounts();
                setAccounts(updatedAccounts);
                setLastSyncTime(new Date());
              });
            }
          });

          // Handed to the effect rather than returned from here: this function
          // is async, so a returned cleanup only ever reaches a promise. The
          // race it guards is still real even though this handle now arrives
          // synchronously — everything ABOVE it is awaited, so a cleanup can
          // still fire while the boot is in flight, and a handle that lands
          // afterwards is closed on arrival instead of being stored.
          registerTeardown(unsubscribeData);
        }
      } catch (error) {
        appLogger.error('Failed to initialize data', error);
        appLogger.error('Initialization details', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        setSyncError('Failed to load data. Using offline mode.');
      } finally {
        setIsLoading(false);
      }
    };

    void initializeData();

    return () => {
      cancelled = true;
      // Previously unreachable along with the unsubscribes: a pending debounced
      // reload would otherwise fire into a provider that has moved on.
      if (updateDebounceRef.current) {
        clearTimeout(updateDebounceRef.current);
        updateDebounceRef.current = null;
      }
      // Drained rather than iterated in place, so a handle is invoked exactly
      // once whichever side of the race it arrived on.
      const pending = teardowns.splice(0, teardowns.length);
      for (const teardown of pending) {
        teardown();
      }
    };
  }, [user, isLoaded]);

  const refreshCategories = useCallback(async () => {
    try {
      const loaded = await PlanningService.ensureCategories(
        userIdService.getCurrentDatabaseUserId()
      );
      setCategories(loaded);
    } catch (error) {
      appLogger.error('Failed to refresh categories', error);
    }
  }, []);

  // Narrow refresh for the bank-sync path: only accounts + transactions come from
  // Supabase here (getAccounts/getTransactions route to the cloud services), so we
  // never touch budgets/goals/categories which load from a different source.
  const refreshAccountsAndTransactions = useCallback(async () => {
    try {
      const [updatedAccounts, updatedTransactions] = await Promise.all([
        dataPort.getAccounts(),
        dataPort.getTransactions()
      ]);
      setAccounts(updatedAccounts);
      setTransactions(updatedTransactions);
      setLastSyncTime(new Date());
      setSyncError(null);
    } catch (error) {
      appLogger.error('Failed to refresh accounts and transactions', error);
      setSyncError('Failed to refresh account data');
    }
  }, []);

  // Account operations
  const addAccount = useCallback(async (account: Omit<Account, 'id'> & { initialBalance?: number }) => {
    try {
      appLogger.info('Adding account', account);

      const accountToCreate = {
        ...account,
        balance: account.initialBalance || account.balance || 0,
        initialBalance: account.initialBalance || account.balance || 0,
        isActive: account.isActive !== undefined ? account.isActive : true
      };

      // Create in the database directly and wait for the response.
      //
      // Without a Clerk user this used to throw "User not authenticated" and
      // stop there, which made adding an account impossible in demo/local mode
      // — SimpleAccountService needs a Clerk id to resolve a database user and
      // has no local branch at all. DataService is the same service layer every
      // other write in this context already relies on for that case
      // (updateAccount, deleteAccount and addTransaction all go through it),
      // and it writes to the storage the local reads come from. It also carries
      // the guard that matters: a signed-in session whose database id has not
      // resolved yet is refused rather than quietly diverted into browser
      // storage.
      const newAccount = user?.id
        ? await SimpleAccountService.createAccount(user.id, accountToCreate)
        : await dataPort.createAccount(accountToCreate);
      appLogger.info('Account created', newAccount);

      // Add to state
      setAccounts(prev => [...prev, newAccount]);
      
      // Don't queue for sync - it's already in the database!
      // AutoSyncService is for offline-created items only
      
      return newAccount;
    } catch (error) {
      appLogger.error('Failed to add account', error);
      throw error;
    }
  }, [user]);

  const updateAccount = useCallback(async (id: string, updates: AccountUpdate) => {
    try {
      recentLocalUpdateRef.current = Date.now();
      const updatedAccount = await dataPort.updateAccount(id, updates);
      setAccounts(prev => prev.map(a => a.id === id ? updatedAccount : a));
    } catch (error) {
      appLogger.error('Failed to update account', error);
      throw error;
    }
  }, []);

  const deleteAccount = useCallback(async (id: string) => {
    try {
      await dataPort.deleteAccount(id);
      setAccounts(prev => prev.filter(a => a.id !== id));
      // Also remove related transactions
      setTransactions(prev => prev.filter(t => t.accountId !== id));
    } catch (error) {
      appLogger.error('Failed to delete account', error);
      throw error;
    }
  }, []);

  // Transaction operations
  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>) => {
    try {
      const newTransaction = await dataPort.createTransaction(transaction);
      setTransactions(prev => [...prev, newTransaction]);
      
      // Update account balance locally for immediate UI feedback.
      // Decimal arithmetic — float math is banned on money values. The DB
      // balance is adjusted atomically inside create_transaction_atomic.
      setAccounts(prev => prev.map(acc => {
        if (acc.id === transaction.accountId) {
          return {
            ...acc,
            balance: toDecimal(acc.balance || 0).plus(toDecimal(transaction.amount)).toNumber()
          };
        }
        return acc;
      }));
    } catch (error) {
      appLogger.error('Failed to add transaction', error);
      throw error;
    }
  }, []);

  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>) => {
    try {
      const oldTransaction = transactions.find(t => t.id === id);
      const updatedTransaction = await dataPort.updateTransaction(id, updates);
      setTransactions(prev => prev.map(t => t.id === id ? updatedTransaction : t));
      
      // Update account balance if amount changed (Decimal arithmetic; the DB
      // balance is adjusted atomically inside update_transaction_atomic).
      if (oldTransaction && updates.amount !== undefined && updates.amount !== oldTransaction.amount) {
        const difference = toDecimal(updates.amount).minus(toDecimal(oldTransaction.amount));
        setAccounts(prev => prev.map(acc => {
          if (acc.id === oldTransaction.accountId) {
            return {
              ...acc,
              balance: toDecimal(acc.balance || 0).plus(difference).toNumber()
            };
          }
          return acc;
        }));
      }
    } catch (error) {
      appLogger.error('Failed to update transaction', error);
      throw error;
    }
  }, [transactions]);

  const setTransactionsCleared = useCallback(async (ids: string[], cleared: boolean) => {
    if (ids.length === 0) {
      return;
    }
    try {
      await dataPort.setTransactionsCleared(ids, cleared);
      const idSet = new Set(ids);
      setTransactions(prev => prev.map(t => (idSet.has(t.id) ? { ...t, cleared } : t)));
    } catch (error) {
      appLogger.error('Failed to set cleared status', error);
      throw error;
    }
  }, []);

  // Soft-archive: hide an account's reconciled transactions on/before the
  // cutoff. Balance-neutral — we only flip the `archived` flag and record the
  // cutoff; every account balance and report stays exact.
  const archiveTransactionsBefore = useCallback(async (accountId: string, cutoff: Date) => {
    try {
      const count = await dataPort.archiveTransactionsBefore(accountId, cutoff);
      setTransactions(prev => prev.map(t =>
        t.accountId === accountId && !t.archived && t.cleared === true && new Date(t.date) <= cutoff
          ? { ...t, archived: true } : t
      ));
      setAccounts(prev => prev.map(a => (a.id === accountId ? { ...a, archiveThroughDate: cutoff } : a)));
      return count;
    } catch (error) {
      appLogger.error('Failed to archive transactions', error);
      throw error;
    }
  }, []);

  const unarchiveAccount = useCallback(async (accountId: string) => {
    try {
      const count = await dataPort.unarchiveAccount(accountId);
      setTransactions(prev => prev.map(t => (t.accountId === accountId && t.archived ? { ...t, archived: false } : t)));
      setAccounts(prev => prev.map(a => (a.id === accountId ? { ...a, archiveThroughDate: null } : a)));
      return count;
    } catch (error) {
      appLogger.error('Failed to unarchive account', error);
      throw error;
    }
  }, []);

  const applyCategoryToUncategorized = useCallback(async (ids: string[], category: string) => {
    if (ids.length === 0) {
      return 0;
    }
    try {
      const count = await dataPort.applyCategoryToUncategorized(ids, category);
      const idSet = new Set(ids);
      // Mirror the server's fill-blanks semantics locally: only blank,
      // NON-SPLIT rows flip (a split parent's blank category means "split").
      // categoryConfirmed comes along because this is the user's own filing —
      // the same reasoning as the server side (see the RPC and dataService).
      setTransactions(prev => prev.map(t =>
        idSet.has(t.id) && !t.isSplit && (!t.category || t.category.trim() === '')
          ? { ...t, category, categoryConfirmed: true }
          : t
      ));
      return count;
    } catch (error) {
      appLogger.error('Failed to apply category', error);
      throw error;
    }
  }, []);

  /**
   * "Yes, that guess was right." Writes one boolean per row and nothing else,
   * so a confirm can never move a balance or a category. Local state mirrors
   * the server's own rule — only rows that were actually suggested flip.
   */
  const confirmTransactionCategories = useCallback(async (ids: string[]): Promise<number> => {
    if (ids.length === 0) {
      return 0;
    }
    try {
      const count = await dataPort.confirmTransactionCategories(ids);
      const idSet = new Set(ids);
      setTransactions(prev => prev.map(t =>
        idSet.has(t.id) && t.categoryConfirmed === false ? { ...t, categoryConfirmed: true } : t
      ));
      return count;
    } catch (error) {
      appLogger.error('Failed to confirm categories', error);
      throw error;
    }
  }, []);

  const renameTransactionDescriptions = useCallback(async (
    ids: string[],
    description: string,
    onProgress?: (done: number) => void
  ): Promise<number> => {
    const newDescription = description.trim();
    if (ids.length === 0 || newDescription === '') {
      return 0;
    }

    // In the cloud each write is an independent RPC, so a handful in flight
    // keeps a few thousand renames tolerable without opening a few thousand
    // sockets. In local/demo mode every write re-reads and re-persists the
    // WHOLE browser-local collection, so two in flight is a lost-update race —
    // there the writes go strictly one at a time.
    const isCloudSession = Boolean(userIdService.getCurrentDatabaseUserId()) && isSupabaseConfigured();
    const BATCH_SIZE = isCloudSession ? 8 : 1;
    const renamed = new Set<string>();
    let failures = 0;

    for (let start = 0; start < ids.length; start += BATCH_SIZE) {
      const batch = ids.slice(start, start + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(id => dataPort.updateTransaction(id, { description: newDescription }))
      );
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          renamed.add(batch[index]);
        } else {
          failures++;
          appLogger.error('Failed to rename payee on transaction', result.reason);
        }
      });
      onProgress?.(Math.min(start + batch.length, ids.length));
    }

    if (renamed.size > 0) {
      setTransactions(prev => prev.map(t =>
        renamed.has(t.id) ? { ...t, description: newDescription } : t
      ));
    }

    // Every single write failed: the caller asked for a rename and got none,
    // so it must be able to say so rather than report "0 renamed" as success.
    if (renamed.size === 0 && failures > 0) {
      throw new Error('No payees could be renamed. Please try again.');
    }

    return renamed.size;
  }, []);

  const getTransactionSplits = useCallback(async (transactionId: string) => {
    try {
      return await dataPort.getTransactionSplits(transactionId);
    } catch (error) {
      appLogger.error('Failed to load transaction splits', error);
      throw error;
    }
  }, []);

  const setTransactionSplits = useCallback(async (
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: number | null
  ) => {
    try {
      const oldTransaction = transactions.find(t => t.id === transactionId);
      const result = await dataPort.setTransactionSplits(transactionId, splits, expectedAmount);

      // Keep the aggregation-facing splits state in step. Re-read the rows
      // (rather than synthesising them) so ids match the server's; a failed
      // re-read only staleness-es this transaction's lines until next load.
      try {
        const freshSplits = result.isSplit ? await dataPort.getTransactionSplits(transactionId) : [];
        setTransactionSplitsState(prev => [
          ...prev.filter(s => s.transactionId !== transactionId),
          ...freshSplits,
        ]);
      } catch (splitReadError) {
        appLogger.error('Failed to refresh splits after save', splitReadError);
      }

      // Mirror the atomic server change locally: the flag, the blanked
      // category while split, and the amount the splits sum to. A line that
      // became a transfer leg also put a REAL row in another account — those
      // come back from the database, so they are added as written rather than
      // synthesised here.
      setTransactions(prev => [
        ...prev.map(t =>
          t.id === transactionId
            ? {
                ...t,
                isSplit: result.isSplit,
                amount: result.amount,
                ...(result.isSplit ? { category: '' } : {}),
              }
            : t
        ),
        ...result.counterparts,
      ]);

      // Balances follow the money (Decimal arithmetic; the DB moved them
      // atomically inside the split RPC): the parent's account by whatever the
      // new total changed, each counterpart's account by the row now sitting
      // in it.
      const deltas = new Map<string, DecimalInstance>();
      const owe = (accountId: string, amount: DecimalInstance): void => {
        deltas.set(accountId, (deltas.get(accountId) ?? toDecimal(0)).plus(amount));
      };
      if (oldTransaction && result.amount !== oldTransaction.amount) {
        owe(oldTransaction.accountId, toDecimal(result.amount).minus(toDecimal(oldTransaction.amount)));
      }
      for (const counterpart of result.counterparts) {
        owe(counterpart.accountId, toDecimal(counterpart.amount));
      }
      if (deltas.size > 0) {
        setAccounts(prev => prev.map(acc => {
          const delta = deltas.get(acc.id);
          return delta
            ? { ...acc, balance: toDecimal(acc.balance || 0).plus(delta).toNumber() }
            : acc;
        }));
      }

      return result;
    } catch (error) {
      appLogger.error('Failed to set transaction splits', error);
      throw error;
    }
  }, [transactions]);

  const linkTransferPair = useCallback(async (idA: string, idB: string) => {
    try {
      const result = await dataPort.linkTransferPair(idA, idB);
      // Balance-neutral: both rows existed with these amounts already.
      setTransactions(prev => prev.map(t =>
        t.id === result.a.id ? result.a : t.id === result.b.id ? result.b : t
      ));
      return result;
    } catch (error) {
      appLogger.error('Failed to link transfer pair', error);
      throw error;
    }
  }, []);

  const linkSplitLineTransfer = useCallback(async (splitId: string, transactionId: string) => {
    try {
      const result = await dataPort.linkSplitLineTransfer(splitId, transactionId);
      // State comes from what the database wrote: linking re-types and
      // re-categorises the row over there, and pins it to the exact line.
      // Balance-neutral — both sides existed with these amounts already.
      setTransactions(prev => prev.map(t => (t.id === result.transaction.id ? result.transaction : t)));
      setTransactionSplitsState(prev => prev.map(s => (s.id === result.split.id ? result.split : s)));
      return result;
    } catch (error) {
      appLogger.error('Failed to link split line transfer', error);
      throw error;
    }
  }, []);

  const unlinkTransfers = useCallback(async (ids: string[]) => {
    try {
      const count = await dataPort.unlinkTransfers(ids);
      // Balance-neutral: only the link goes. The type/category the rows carry
      // stay as they are until the caller re-files them, exactly as the
      // database left them.
      const idSet = new Set(ids);
      setTransactions(prev => prev.map(t => {
        if (!idSet.has(t.id) || t.linkedTransferSplitId || !t.linkedTransferId) return t;
        const { linkedTransferId: _cleared, ...rest } = t;
        return rest;
      }));
      return count;
    } catch (error) {
      appLogger.error('Failed to unlink transfers', error);
      throw error;
    }
  }, []);

  const setTransactionArchived = useCallback(async (id: string, archived: boolean) => {
    try {
      await dataPort.setTransactionArchived(id, archived);
      setTransactions(prev => prev.map(t => (t.id === id ? { ...t, archived } : t)));
    } catch (error) {
      appLogger.error('Failed to archive transaction', error);
      throw error;
    }
  }, []);

  const repairClaimedTransfer = useCallback(async (
    strandedId: string,
    counterpartId: string,
    partnerId: string,
    adjustmentCategoryId: string
  ) => {
    try {
      const result = await dataPort.repairClaimedTransfer(
        strandedId, counterpartId, partnerId, adjustmentCategoryId
      );
      // State comes from the rows the database actually wrote — the repair
      // re-types and re-categorises all three, and guessing at that here is how
      // a register ends up disagreeing with the ledger. Balance-neutral, so no
      // account touched.
      const written = new Map([
        [result.stranded.id, result.stranded],
        [result.counterpart.id, result.counterpart],
        [result.partner.id, result.partner],
      ]);
      setTransactions(prev => prev.map(t => written.get(t.id) ?? t));
    } catch (error) {
      appLogger.error('Failed to repair claimed transfer', error);
      throw error;
    }
  }, []);

  const createTransferCounterpart = useCallback(async (id: string, targetAccountId: string) => {
    try {
      const result = await dataPort.createTransferCounterpart(id, targetAccountId);
      setTransactions(prev => [
        ...prev.map(t => (t.id === result.source.id ? result.source : t)),
        result.counterpart,
      ]);
      // The DB moved the target account's balance atomically; mirror locally
      // (Decimal arithmetic, same as the other write paths).
      setAccounts(prev => prev.map(acc =>
        acc.id === targetAccountId
          ? { ...acc, balance: toDecimal(acc.balance || 0).plus(toDecimal(result.counterpart.amount)).toNumber() }
          : acc
      ));
      return result;
    } catch (error) {
      appLogger.error('Failed to create transfer counterpart', error);
      throw error;
    }
  }, []);

  const refreshSuggestionDismissals = useCallback(async () => {
    setSuggestionDismissalsStatus('loading');
    try {
      setSuggestionDismissals(await dataPort.getSuggestionDismissals());
      setSuggestionDismissalsStatus('ready');
    } catch (error) {
      // Never thrown on: a sweep that cannot read the dismissals still has to
      // open. It shows everything and says the filter did not run — which is
      // the safe direction to fail in, since a dismissal can only hide.
      appLogger.error('Failed to load suggestion dismissals', error);
      setSuggestionDismissals([]);
      setSuggestionDismissalsStatus('error');
    }
  }, []);

  const dismissSuggestion = useCallback(async (
    kind: DismissalKind,
    subjectKey: string,
    subjectIds: string[]
  ) => {
    try {
      const dismissal = await dataPort.dismissSuggestion(kind, subjectKey, subjectIds);
      // Keyed by (kind, subjectKey), exactly as the table's unique constraint
      // is, so a repeat refusal replaces rather than duplicates.
      setSuggestionDismissals(prev => [
        dismissal,
        ...prev.filter(d => !(d.kind === kind && d.subjectKey === subjectKey)),
      ]);
    } catch (error) {
      appLogger.error('Failed to dismiss suggestion', error);
      throw error;
    }
  }, []);

  const restoreSuggestion = useCallback(async (kind: DismissalKind, subjectKey: string) => {
    try {
      await dataPort.restoreSuggestion(kind, subjectKey);
      setSuggestionDismissals(prev =>
        prev.filter(d => !(d.kind === kind && d.subjectKey === subjectKey))
      );
    } catch (error) {
      appLogger.error('Failed to restore dismissed suggestion', error);
      throw error;
    }
  }, []);

  const deleteTransaction = useCallback(async (id: string) => {
    try {
      const transaction = transactions.find(t => t.id === id);
      await dataPort.deleteTransaction(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      // Its split lines cascade away in the DB (FK); mirror locally.
      setTransactionSplitsState(prev => prev.filter(s => s.transactionId !== id));
      // So do any dismissals that named it (trg_prune_suggestion_dismissals):
      // the suggestion can never be offered again, so the refusal is spent.
      setSuggestionDismissals(prev => prev.filter(d => !d.subjectIds.includes(id)));

      // Update account balance (Decimal arithmetic; the DB balance is reversed
      // atomically inside delete_transaction_atomic).
      if (transaction) {
        setAccounts(prev => prev.map(acc => {
          if (acc.id === transaction.accountId) {
            return {
              ...acc,
              balance: toDecimal(acc.balance || 0).minus(toDecimal(transaction.amount)).toNumber()
            };
          }
          return acc;
        }));
      }
    } catch (error) {
      appLogger.error('Failed to delete transaction', error);
      throw error;
    }
  }, [transactions]);

  // Budget operations — persisted through the seam, which resolves the owner
  // itself (the id used to be resolved here and handed over; a null one wrote
  // browser storage under a signed-in session, and the budget was gone at the
  // next boot).
  const addBudget = useCallback(async (budget: Omit<Budget, 'id' | 'spent'>) => {
    try {
      const created = await dataPort.createBudget(budget);
      setBudgets(prev => [...prev, created]);
    } catch (error) {
      appLogger.error('Failed to add budget', error);
      throw error;
    }
  }, []);

  const updateBudget = useCallback(async (id: string, updates: Partial<Budget>) => {
    try {
      const updated = await dataPort.updateBudget(id, updates);
      setBudgets(prev => prev.map(b => b.id === id ? updated : b));
    } catch (error) {
      appLogger.error('Failed to update budget', error);
      throw error;
    }
  }, []);

  const deleteBudget = useCallback(async (id: string) => {
    try {
      await dataPort.deleteBudget(id);
      setBudgets(prev => prev.filter(b => b.id !== id));
    } catch (error) {
      appLogger.error('Failed to delete budget', error);
      throw error;
    }
  }, []);

  // Goal operations — persisted through the seam, which resolves the owner
  // itself, for the reason written over the budget operations above.
  const addGoal = useCallback(async (goal: Omit<Goal, 'id' | 'progress'>) => {
    try {
      const created = await dataPort.createGoal(goal);
      setGoals(prev => [...prev, created]);
    } catch (error) {
      appLogger.error('Failed to add goal', error);
      throw error;
    }
  }, []);

  const updateGoal = useCallback(async (id: string, updates: Partial<Goal>) => {
    try {
      const updated = await dataPort.updateGoal(id, updates);
      setGoals(prev => prev.map(g => g.id === id ? updated : g));
    } catch (error) {
      appLogger.error('Failed to update goal', error);
      throw error;
    }
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    try {
      await dataPort.deleteGoal(id);
      setGoals(prev => prev.filter(g => g.id !== id));
      // The goal is gone, so its trophy and its "already celebrated" flag go
      // with it — otherwise the achievement history keeps listing a goal that
      // no longer exists.
      goalAchievementService.forgetGoal(id);
    } catch (error) {
      appLogger.error('Failed to delete goal', error);
      throw error;
    }
  }, []);

  const contributeToGoal = useCallback(async (id: string, amount: number) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    const newProgress = toDecimal(goal.progress || 0)
      .plus(toDecimal(amount))
      .toNumber();
    const cappedProgress = Math.min(newProgress, goal.targetAmount);
    try {
      const updated = await dataPort.updateGoal(
        id,
        { progress: cappedProgress, currentAmount: cappedProgress }
      );
      setGoals(prev => prev.map(g => g.id === id ? updated : g));
    } catch (error) {
      appLogger.error('Failed to contribute to goal', error);
      throw error;
    }
  }, [goals]);

  // Category operations — persisted via PlanningService (Supabase when
  // signed in, encrypted localStorage otherwise).
  const addCategory = useCallback(async (category: Omit<Category, 'id'>) => {
    try {
      const created = await PlanningService.createCategory(
        userIdService.getCurrentDatabaseUserId(),
        category
      );
      setCategories(prev => [...prev, created]);
      return created;
    } catch (error) {
      appLogger.error('Failed to add category', error);
      throw error;
    }
  }, []);

  // Import a Money-style two-level tree (sub → detail), merging idempotently:
  // same-named categories are skipped, so re-running or overlapping the default
  // set never duplicates. Two phases because details need their sub's id.
  const importCategoryTree = useCallback(async (
    tree: CategoryTreeGroup[],
    options?: { pruneOthers?: boolean }
  ) => {
    const userId = userIdService.getCurrentDatabaseUserId();
    const plan = planCategoryTreeImport(categories, tree);

    const createdSubs = await PlanningService.createCategories(userId, plan.subsToCreate);
    // Commit phase 1 to state immediately: if the details insert below fails,
    // a retry re-plans against state that INCLUDES these subs and skips them —
    // otherwise the re-insert would hit the (user_id, name, parent_id) unique
    // constraint and every retry would fail until a page reload.
    if (createdSubs.length > 0) {
      setCategories(prev => [...prev, ...createdSubs]);
    }

    // Resolve each detail's parent among existing + freshly created subs.
    // IMPORTANT: index by the ANCHOR the sub lives under (same predicate the
    // planner matches with), not by the sub's own `type` — a sub that ended up
    // typed 'both' would otherwise be matched by the planner but missing here.
    const typeAnchorIds = new Map<'income' | 'expense', string | undefined>([
      ['income', categories.find(c => c.level === 'type' && c.type === 'income')?.id],
      ['expense', categories.find(c => c.level === 'type' && c.type === 'expense')?.id],
    ]);
    const subIdByKey = new Map<string, string>();
    const keyOf = (type: 'income' | 'expense', name: string) => `${type}:${name.trim().toLowerCase()}`;
    for (const sub of [...categories, ...createdSubs]) {
      if (sub.level !== 'sub') continue;
      if (sub.parentId === typeAnchorIds.get('income')) {
        subIdByKey.set(keyOf('income', sub.name), sub.id);
      } else if (sub.parentId === typeAnchorIds.get('expense')) {
        subIdByKey.set(keyOf('expense', sub.name), sub.id);
      }
    }

    const detailRows: Array<Omit<Category, 'id'>> = [];
    for (const detail of plan.detailsToCreate) {
      const parentId = subIdByKey.get(keyOf(detail.type, detail.subName));
      if (!parentId) {
        throw new Error(`Import failed: parent category "${detail.subName}" was not created.`);
      }
      detailRows.push({ ...detail.category, parentId });
    }
    const createdDetails = await PlanningService.createCategories(userId, detailRows);
    if (createdDetails.length > 0) {
      setCategories(prev => [...prev, ...createdDetails]);
    }

    // Optional replace semantics: remove unused categories OUTSIDE the tree so
    // the user's list becomes the imported set. Anything a transaction still
    // references is kept (never orphan a transaction's category).
    let pruned = 0;
    let keptForTransactions = 0;
    if (options?.pruneOthers) {
      const merged = [...categories, ...createdSubs, ...createdDetails];
      // "In use" covers every reference kind: transactions, budgets (keyed by
      // categoryId), and recurring transaction templates.
      const usedCategoryIds = new Set(
        [
          ...transactions.map(t => t.category),
          ...budgets.map(b => b.categoryId),
          ...recurringTransactions.map(r => r.category),
        ].filter((c): c is string => !!c && c.trim() !== '')
      );
      const prunePlan = planCategoryPrune(merged, tree, usedCategoryIds);
      const idsToDelete = [...prunePlan.detailIdsToDelete, ...prunePlan.subIdsToDelete];
      if (idsToDelete.length > 0) {
        // The RPC re-verifies references server-side and may delete FEWER rows
        // than planned (a stale snapshot can never destroy referenced data) —
        // so re-read the authoritative category set instead of trusting the plan.
        pruned = await PlanningService.deleteUnusedCategories(userId, idsToDelete);
        const authoritative = await PlanningService.ensureCategories(userId);
        setCategories(authoritative);
      }
      keptForTransactions = prunePlan.keptForTransactionsCount;
    }

    return {
      created: createdSubs.length + createdDetails.length,
      skipped: plan.skippedCount,
      pruned,
      keptForTransactions,
    };
  }, [categories, transactions, budgets, recurringTransactions]);

  const updateCategory = useCallback(async (id: string, updates: Partial<Category>) => {
    try {
      const updated = await PlanningService.updateCategory(
        userIdService.getCurrentDatabaseUserId(),
        id,
        updates
      );
      setCategories(prev => prev.map(c => c.id === id ? updated : c));
    } catch (error) {
      appLogger.error('Failed to update category', error);
      throw error;
    }
  }, []);

  const mergeCategories = useCallback(async (sourceId: string, targetId: string) => {
    try {
      const result = await dataPort.mergeCategories(sourceId, targetId);

      // Mirror exactly what the merge moved. Balance-neutral throughout: not
      // one amount, sign or account changes, so no account is touched.
      setTransactions(prev => prev.map(t =>
        t.category === sourceId ? { ...t, category: targetId } : t
      ));
      setTransactionSplitsState(prev => prev.map(s =>
        s.category === sourceId ? { ...s, category: targetId } : s
      ));
      setBudgets(prev => prev.map(b =>
        b.categoryId === sourceId ? { ...b, categoryId: targetId } : b
      ));
      setRecurringTransactions(prev => prev.map(r =>
        r.category === sourceId ? { ...r, category: targetId } : r
      ));
      setCategories(prev => prev.filter(c => c.id !== sourceId));

      // Import rules are the one place a category id is stored in THIS browser
      // rather than the database, so they cannot join the merge's transaction —
      // they follow it immediately instead. Loaded on demand so the rules
      // engine stays out of the boot bundle. A failure here costs a stale rule,
      // never the merge: the history is already joined and correct.
      try {
        const { importRulesService } = await import('../services/importRulesService');
        importRulesService.remapCategory(sourceId, targetId);
      } catch (rulesError) {
        appLogger.error('Failed to re-point import rules after a category merge', rulesError);
      }

      return result;
    } catch (error) {
      appLogger.error('Failed to merge categories', error);
      throw error;
    }
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    try {
      await PlanningService.deleteCategory(userIdService.getCurrentDatabaseUserId(), id);
      // Children go with the parent (cloud FK is ON DELETE CASCADE; mirror it)
      setCategories(prev => prev.filter(c => c.id !== id && c.parentId !== id));
    } catch (error) {
      appLogger.error('Failed to delete category', error);
      throw error;
    }
  }, []);

  const getSubCategories = useCallback((parentId: string) => {
    return categories.filter(c => c.parentId === parentId);
  }, [categories]);

  const getDetailCategories = useCallback((parentId: string) => {
    return categories.filter(c => c.parentId === parentId);
  }, [categories]);

  // Tag operations
  const addTag = useCallback((tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTag: Tag = {
      ...tag,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setTags(prev => [...prev, newTag]);
  }, []);

  const updateTag = useCallback((id: string, updates: Partial<Tag>) => {
    setTags(prev => prev.map(t => 
      t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t
    ));
  }, []);

  const deleteTag = useCallback((id: string) => {
    setTags(prev => prev.filter(t => t.id !== id));
  }, []);

  const getTagUsageCount = useCallback((tagName: string) => {
    return transactions.filter(t => t.tags?.includes(tagName) ?? false).length;
  }, [transactions]);

  const getAllUsedTags = useCallback(() => {
    const tagSet = new Set<string>();
    transactions.forEach(t => {
      if (t.tags) {
        t.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet);
  }, [transactions]);

  // Import/Export operations
  const importData = useCallback((data: Partial<AppState>) => {
    if (data.accounts) setAccounts(data.accounts);
    // A restored backup arrives via JSON.parse, so every `date` is the string
    // it was serialised to — the last way rows can enter state still stringly.
    if (data.transactions) setTransactions(normalizeTransactionDates(data.transactions));
    if (data.budgets) setBudgets(data.budgets);
    if (data.goals) setGoals(data.goals);
    if (data.categories) setCategories(data.categories);
    if (data.tags) setTags(data.tags);
    if (data.recurringTransactions) setRecurringTransactions(data.recurringTransactions);
  }, []);

  const exportData = useCallback((): string => {
    const data = {
      accounts,
      transactions,
      budgets,
      goals,
      categories,
      tags,
      recurringTransactions,
      isLoading: false,
      isSyncing: false,
      isUsingSupabase: true
    };
    return JSON.stringify(data, null, 2);
  }, [accounts, transactions, budgets, goals, categories, tags, recurringTransactions]);

  const getDecimalTransactions = useCallback((): DecimalTransaction[] => {
    // Convert all transactions to decimal format for precise calculations
    return transactions.map(toDecimalTransaction);
  }, [transactions]);

  const getDecimalAccounts = useCallback((): DecimalAccount[] => {
    // Convert all accounts to decimal format for precise calculations
    return accounts.map(toDecimalAccount);
  }, [accounts]);

  const getDecimalGoals = useCallback((): DecimalGoal[] => {
    // Convert all goals to decimal format for precise calculations
    return goals.map(toDecimalGoal);
  }, [goals]);

  /**
   * Forget what this session has loaded: the React state and the local
   * transaction cache. Named for what it does — it deletes NOTHING from
   * Supabase or from persisted local storage, so on its own the next load
   * brings everything straight back. The delete has to happen in the store
   * first; this then stops the stale snapshot outliving it.
   */
  const resetLoadedData = useCallback(async () => {
    // The local snapshot describes a history that is about to stop existing —
    // drop it here rather than making the next boot discover the mismatch and
    // pay for a full refetch to find out.
    await transactionCache.clear();
    setAccounts([]);
    setTransactions([]);
    setBudgets([]);
    setGoals([]);
    setCategories(getDefaultCategories());
    setTags([]);
    setRecurringTransactions([]);
  }, []);

  /**
   * Create the sample dataset in this login.
   *
   * Every row goes through the ordinary context operation for its kind —
   * addCategory, addAccount, addTransaction, addBudget, addGoal — so a seeded
   * account is written, audited and balanced exactly like one the user typed
   * in, and it works the same in a cloud login as in demo mode because those
   * operations already know which store they are talking to. Nothing here
   * writes to localStorage on its own; that was the bug the demo seed had.
   *
   * The writes are awaited one at a time rather than fired off in parallel.
   * They are not independent: a transaction needs its account's id and its
   * category's id to exist first, and each transaction's balance adjustment is
   * a read-modify-write on the same account row. Firing N of those at once is
   * how balances drift.
   *
   * ADDS, never replaces: there is no delete or overwrite in this function. A
   * category the login already has is reused by name, not duplicated; accounts
   * and transactions are always new rows alongside whatever is there.
   */
  const loadTestData = useCallback(async (
    onProgress?: (progress: TestDataProgress) => void
  ): Promise<TestDataSeedResult> => {
    const dataset = buildTestDataset();
    const report = (phase: TestDataPhase, fraction: number, message: string): void => {
      onProgress?.({ phase, fraction, message });
    };

    // 1. Categories. A transaction filed under a category id this login does
    // not have is invisible in every category view, so the ids are resolved
    // against the login's OWN categories first and anything missing is created
    // before a single transaction is written. A freshly cleared login can be
    // missing even the type-level anchors; the plan creates those too.
    report('categories', 0, 'Checking categories…');
    const plan = planTestDataCategories(dataset.categories, categories);
    const categoryIdByName = new Map<string, string>(plan.resolved);
    for (const [index, planned] of plan.toCreate.entries()) {
      const parentId = planned.parentKey
        ? categoryIdByName.get(planned.parentKey)
        : planned.category.parentId;
      const created = await addCategory({ ...planned.category, parentId });
      categoryIdByName.set(planned.key, created.id);
      report('categories', 0.1 * ((index + 1) / plan.toCreate.length),
        `Adding categories… ${index + 1} of ${plan.toCreate.length}`);
    }

    // 2. Accounts, each opened at the balance that makes its closing balance
    // come out right once step 3 has run (see buildTestDataset).
    const accountIdByKey = new Map<string, string>();
    for (const [index, account] of dataset.accounts.entries()) {
      report('accounts', 0.1 + 0.1 * (index / dataset.accounts.length),
        `Creating accounts… ${index + 1} of ${dataset.accounts.length}`);
      const created = await addAccount({
        name: account.name,
        type: account.type,
        balance: account.openingBalance,
        initialBalance: account.openingBalance,
        openingBalance: account.openingBalance,
        currency: account.currency,
        institution: account.institution,
        accountNumber: account.accountNumber,
        isActive: true,
        lastUpdated: new Date()
      });
      accountIdByKey.set(account.key, created.id);
    }

    // 3. Transactions. Each one moves its account's balance through the same
    // atomic path a hand-typed transaction takes.
    let transactionsCreated = 0;
    for (const [index, transaction] of dataset.transactions.entries()) {
      const accountId = accountIdByKey.get(transaction.accountKey);
      const category = categoryIdByName.get(transaction.categoryName.toLowerCase());
      if (!accountId || !category) {
        // Unreachable given steps 1 and 2, and left as a throw rather than a
        // skip: a silently short seed is the failure this whole feature exists
        // to stop repeating.
        throw new Error(`Sample transaction "${transaction.description}" has no account or category to file under`);
      }
      await addTransaction({
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        category,
        accountId,
        type: transaction.type,
        tags: transaction.tags,
        notes: transaction.notes
      });
      transactionsCreated += 1;
      report('transactions', 0.2 + 0.6 * ((index + 1) / dataset.transactions.length),
        `Adding transactions… ${index + 1} of ${dataset.transactions.length}`);
    }

    // 4. Budgets, filed against the same resolved category ids.
    let budgetsCreated = 0;
    for (const [index, budget] of dataset.budgets.entries()) {
      const categoryId = categoryIdByName.get(budget.categoryName.toLowerCase());
      if (!categoryId) {
        throw new Error(`Sample budget "${budget.name}" has no category to file under`);
      }
      await addBudget({
        name: budget.name,
        categoryId,
        amount: budget.amount,
        period: budget.period,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      budgetsCreated += 1;
      report('budgets', 0.8 + 0.05 * ((index + 1) / dataset.budgets.length),
        `Adding budgets… ${index + 1} of ${dataset.budgets.length}`);
    }

    // 5. Goals. `category` here is a label the user typed, not a reference.
    let goalsCreated = 0;
    for (const [index, goal] of dataset.goals.entries()) {
      await addGoal({
        name: goal.name,
        type: goal.type,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        targetDate: goal.targetDate,
        category: goal.category,
        priority: goal.priority,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      goalsCreated += 1;
      report('goals', 0.85 + 0.05 * ((index + 1) / dataset.goals.length),
        `Adding goals… ${index + 1} of ${dataset.goals.length}`);
    }

    // 6. Re-read what was actually stored. The optimistic updates each
    // operation made are correct, but re-reading is what proves it: the
    // balances now on screen are the ones the database computed, not the ones
    // this function predicted.
    report('refreshing', 0.9, 'Reloading your data…');
    await refreshAccountsAndTransactions();
    if (plan.toCreate.length > 0) {
      await refreshCategories();
    }
    const planningUserId = userIdService.getCurrentDatabaseUserId();
    const [reloadedBudgets, reloadedGoals] = await Promise.all([
      PlanningService.getBudgets(planningUserId),
      PlanningService.getGoals(planningUserId)
    ]);
    setBudgets(reloadedBudgets);
    setGoals(reloadedGoals);
    report('refreshing', 1, 'Done.');

    const result: TestDataSeedResult = {
      categoriesCreated: plan.toCreate.length,
      accounts: accountIdByKey.size,
      transactions: transactionsCreated,
      budgets: budgetsCreated,
      goals: goalsCreated
    };
    appLogger.info('Test data loaded', result);
    return result;
  }, [categories, addCategory, addAccount, addTransaction, addBudget, addGoal,
    refreshAccountsAndTransactions, refreshCategories]);

  const value: AppContextType = {
    // State
    accounts,
    transactions,
    budgets,
    goals,
    categories,
    tags,
    recurringTransactions,
    
    // Account operations
    addAccount,
    updateAccount,
    deleteAccount,
    
    // Transaction operations
    addTransaction,
    updateTransaction,
    deleteTransaction,
    setTransactionsCleared,
    applyCategoryToUncategorized,
    confirmTransactionCategories,
    renameTransactionDescriptions,
    archiveTransactionsBefore,
    unarchiveAccount,
    transactionSplits,
    serverBalances,
    getTransactionSplits,
    setTransactionSplits,
    linkTransferPair,
    linkSplitLineTransfer,
    unlinkTransfers,
    setTransactionArchived,
    repairClaimedTransfer,
    createTransferCounterpart,

    // Sweep suggestions the user has refused for good
    suggestionDismissals,
    suggestionDismissalsStatus,
    refreshSuggestionDismissals,
    dismissSuggestion,
    restoreSuggestion,

    // Budget operations
    addBudget,
    updateBudget,
    deleteBudget,
    
    // Goal operations
    addGoal,
    updateGoal,
    deleteGoal,
    contributeToGoal,
    
    // Category operations
    addCategory,
    importCategoryTree,
    updateCategory,
    deleteCategory,
    mergeCategories,
    getSubCategories,
    getDetailCategories,
    
    // Tag operations
    addTag,
    updateTag,
    deleteTag,
    getTagUsageCount,
    getAllUsedTags,
    
    // Other operations
    importData,
    exportData,
    resetLoadedData,
    getDecimalTransactions,
    getDecimalAccounts,
    getDecimalGoals,
    
    // Sync status
    isLoading,
    isSyncing,
    lastSyncTime,
    syncError,
    isUsingSupabase,
    refreshAccountsAndTransactions,
    refreshCategories,
    loadTestData
  };

  // The value object is always defined, no need to check

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    appLogger.error('useApp called outside of AppProvider');
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
