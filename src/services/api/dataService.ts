
/**
 * Unified Data Service Layer
 * This service provides a single interface for all data operations
 * and handles the switch between Supabase (cloud) and localStorage (fallback)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { UserService } from './userService';
import { AccountService } from './accountService';
import { TransactionService, type TransactionLoadResult } from './transactionService';
import { PlanningService } from './planningService';
import { SuggestionDismissalService } from './suggestionDismissalService';
// The client itself, not only the "is it configured?" question. The chunked
// wipe and the Money migration are handed a client rather than reaching for
// one, and this module is already in this file's chunk — so naming the export
// beside the checker costs nothing and is what lets the two React pages that
// used to hold a Postgres client stop holding one.
import { isSupabaseConfigured, supabase } from './supabaseClient';
import { getSupabaseAccessToken, hasSupabaseTokenGetter } from '../../lib/supabaseToken';
import { storageAdapter, STORAGE_KEYS } from '../storageAdapter';
// The seven tables the browser's store has nowhere for, and the sentence each
// one is owed. A module of TYPES and one frozen array — see its header for why
// it is not declared here and not read out of `localBackupService`, which
// reaches the storage adapter, Decimal and fourteen row mappers.
import { BROWSER_CANNOT_KEEP } from '../backup/browserCoverage';
import { userIdService } from '../userIdService';
// This engine's own boot-snapshot cache. See `wipeAllFinancialData`.
import { transactionCache } from '../transactionCache';
import { toDecimal, type DecimalInstance } from '../../utils/decimal';
import { normalizeTransactionDates, toDateValue } from '../../utils/dateBoundary';
import {
  accountNumberForStorage,
  accountNumberUpdateForStorage,
  isCardAccountType
} from '../../utils/accountNumberInput';
import { splitDeclaresTransferLeg } from '../../utils/transactionSplits';
import { getDefaultCategories } from '../../data/defaultCategories';
import type {
  AccountBalanceSnapshot,
  BackupBundle,
  BackupRestoreOutcome,
  BootSnapshot,
  BootTransactionsResult,
  BulkImportProgress,
  BulkImportResult,
  DataPort,
  DataPortCapabilities,
  ExportProgress,
  ImportProgress,
  ImportSourceKind,
  InvestmentChanges,
  InvestmentDraft,
  InvestmentEvent,
  InvestmentEventDraft,
  InvestmentHolding,
  MsMoneyImportResult,
  QuoteWriteback,
  ReconciliationOutcome,
  RestoreProgress,
  WipeProgress
} from '../port/dataPort';
// Type-only, so the bulk importers themselves stay out of the boot chunk —
// the values are fetched on demand (see `cloudBulkImportClient`).
import type { TransactionImportService } from '../transactionImportService';
import type {
  LocalImportOptions,
  LocalTransactionImportStore
} from '../localTransactionImportService';
// Type-only for the same reason, and it matters more here: backupService
// reaches for a Supabase client in its first lines, so a static import would
// put the whole backup/restore machinery — and that client — in front of every
// user on first paint for a feature most of them press once a year.
import type * as CloudBackupService from '../backupService';
import type * as DeviceBackupService from '../localBackupService';
// Type-only for the third time, and for the strongest version of the reason:
// this module carries the whole Microsoft Money migration — the planner, the
// two-pass transfer linking, the chunked writer — and exactly the people who
// press Import once ever should be the people who download it.
import type * as MsMoneyImportService from '../import/msMoney/msMoneyImport';
import type { Account, AccountUpdate, Transaction, TransactionSplit, TransactionSplitInput, SplitWriteResult, Budget, CustomReport, ForecastAdjustment, Goal, Category, CategoryMergeResult, DismissalKind, SuggestionDismissal, TransferDisplacedDisposition, TransferDisplacedOutcome, TransferRepointResult } from '../../types';
// The crossover rule a linked pair is filed by — each side's To/From category
// names the OTHER account. Written down once so the browser-storage mirror and
// repoint_transfer cannot drift apart on the one thing that is easy to get
// backwards.
import { planTransferRepoint } from '../../utils/transferRepoint';
// The three-valued mark/commit rule, in the one module every surface reads it
// from — the browser-storage mirror of what the SQL does with is_reconciled.
import {
  isMarkedAwaitingFinalize,
  isReconciled,
  reconciledAfterMarking
} from '../../utils/transactionReconciliation';

 type Logger = Pick<Console, 'log' | 'warn' | 'error'>;
type AccountServiceLike = Pick<typeof AccountService,
  'getAccounts' | 'getClosedAccounts' | 'createAccount' | 'updateAccount' | 'deleteAccount'> & {
  subscribeToAccounts?: (userId: string, callback: (payload: unknown) => void) => () => void;
};
type TransactionServiceLike = Pick<typeof TransactionService,
  'getTransactions' | 'createTransaction' | 'updateTransaction' | 'deleteTransaction' | 'setTransactionsCleared' | 'finalizeReconciliation' | 'applyCategoryToUncategorized' | 'confirmTransactionCategories' | 'getTransactionSplits' | 'setTransactionSplits' | 'setTransactionSplitsWithLegs' | 'getAllTransactionSplits' | 'linkTransferPair' | 'linkSplitLineTransfer' | 'clearTransferLinks' | 'setTransactionArchived' | 'repairClaimedTransfer' | 'createTransferCounterpart' | 'repointTransfer' | 'archiveTransactionsBefore' | 'unarchiveAccount'> & {
  subscribeToTransactions?: (userId: string, callback: (payload: unknown) => void) => () => void;
  /**
   * Optional so an injected test double stays a partial stand-in; without it
   * the boot simply takes the uncached full-fetch path.
   */
  loadTransactionsForBoot?: (userId: string) => Promise<TransactionLoadResult>;
  /**
   * Optional for the same reason (the `loadTransactionsForBoot` precedent
   * above): a double that does not implement it leaves the seam answering
   * "I don't know" — an empty map — which is the honest answer and the one the
   * balance seeding already handles.
   */
  getAccountBalances?: () => Promise<ReadonlyMap<string, AccountBalanceSnapshot>>;
};
/**
 * The WRITES are required; the READS are optional, for the same reason
 * `loadTransactionsForBoot` above is — a partial test double that supplies no
 * cloud planning leaves the seam serving the browser-local collections, which
 * is the honest answer for a store with no cloud behind it.
 *
 * A write has no such honest fallback. "Fall back to the browser's copy"
 * describes, for a signed-in session, a budget that appears on the page and is
 * gone at the next boot, because the read beside it goes to the cloud where the
 * row never landed. So an optional write member would be a way for a double —
 * or a future refactor that forgot one — to turn that loss on silently, and
 * these stay required.
 *
 * Derived from the real service rather than re-declared, so a signature that
 * changes there cannot silently drift from what is called here.
 */
type PlanningServiceLike = Pick<typeof PlanningService,
  'mergeCategories' | 'createBudget' | 'updateBudget' | 'deleteBudget'
  | 'createGoal' | 'updateGoal' | 'deleteGoal'
  | 'createCustomReport' | 'updateCustomReport' | 'deleteCustomReport'
  | 'setForecastAdjustment' | 'clearForecastAdjustment'
  | 'createCategory' | 'createCategories' | 'updateCategory' | 'deleteCategory'
  | 'deleteUnusedCategories'> &
  Partial<Pick<typeof PlanningService, 'getBudgets' | 'getGoals' | 'getCustomReports' | 'getForecastAdjustments' | 'ensureCategories'>>;
type SuggestionDismissalServiceLike = Pick<typeof SuggestionDismissalService,
  'list' | 'dismiss' | 'restore'>;
/**
 * The holdings service, narrowed to the five entry points the seam routes to.
 *
 * Derived from the real module rather than re-declared, for the reason the
 * backup engines below are: the QUERIES stay theirs. This class decides which
 * engine answers a holding question; it does not know what `SELECTED_COLUMNS`
 * contains, and adding a column to `investments` must never mean editing this
 * file.
 */
type InvestmentServiceLike = Pick<typeof import('./investmentService').InvestmentService,
  'list' | 'create' | 'update' | 'remove' | 'applyQuotes' | 'importPriceHistory' | 'listPrices' | 'recordManualPrice' | 'importEvents' | 'listEvents' | 'listAllEvents' | 'listAllPrices' | 'recordEvent' | 'deleteEventsFor' | 'moveEventDate' | 'deleteEvent'>;
type UserIdServiceLike = Pick<typeof userIdService,
  'ensureUserExists' | 'getCurrentDatabaseUserId' | 'getCurrentUserIds'>;
/**
 * `setMany` is OPTIONAL for the same reason the reads above are: a partial
 * double stays a usable stand-in. It is the "write these keys as one unit"
 * promise, which only the bulk import needs — and an adapter that cannot make
 * that promise is told so rather than worked around (see `localImportStore`).
 */
type StorageAdapterLike = Pick<typeof storageAdapter, 'get' | 'set'> &
  Partial<Pick<typeof storageAdapter, 'setMany'>>;
/** The chunked cloud import client, narrowed to what the seam asks of it. */
type BulkImportClientLike = Pick<TransactionImportService,
  'setAuthTokenProvider' | 'importInChunks'>;
/**
 * The two backup engines, each narrowed to the three entry points the seam
 * routes to.
 *
 * Derived from the real modules rather than re-declared, so a signature that
 * changes there cannot silently drift from what is called here — and so the
 * FORMAT stays theirs. This class decides which engine answers; it does not
 * know what a bundle contains, and adding a table to a backup must never mean
 * editing this file.
 */
type CloudBackupLike = Pick<typeof CloudBackupService,
  'userFinancialDataIsEmpty' | 'collectBackupBundle' | 'restoreBackupBundle'
  | 'wipeUserFinancialData'>;
type DeviceBackupLike = Pick<typeof DeviceBackupService,
  'localFinancialDataIsEmpty' | 'collectLocalBackupBundle' | 'restoreLocalBackupBundle'
  | 'wipeLocalFinancialData'>;
/**
 * The Microsoft Money engine, narrowed to the three entry points the seam
 * routes to: the chunked wipe, the cloud writer and the device writer.
 *
 * Derived from the real module for the reason the backup engines above are —
 * the FORMAT and the write path stay theirs. This class decides which one
 * answers; it does not know what a .mny file contains, and adding a phase to
 * the import must never mean editing this file.
 */
type MsMoneyEngineLike = Pick<typeof MsMoneyImportService,
  'wipeCloudData' | 'importToCloud' | 'importToLocalStorage'>;
/** The device-side atomic import, in the shape the seam calls it. */
type LocalBulkImporter = (
  accountId: string,
  transactions: ReadonlyArray<Omit<Transaction, 'id'>>,
  options?: LocalImportOptions
) => Promise<BulkImportResult>;
/** The session token the cloud import posts with. Null when signed out. */
type AuthTokenProvider = () => Promise<string | null>;
type SupabaseChecker = () => boolean;
type CloudSessionChecker = () => boolean;
type DateProvider = () => Date;
type UuidGenerator = () => string;

/** Only what the wipe needs of the banking service, so a test can stand in. */
export interface BankingEngineLike {
  bankConnectionService: {
    refreshConnections(): Promise<Array<{ id: string }>>;
    // Spelled out structurally rather than imported, so this stays the
    // shortest description of what the wipe needs of the service. The wipe
    // reads neither field — a connection it could not remove throws out of the
    // endpoint, which is the only outcome it acts on — but the shape still has
    // to match the real method, or a stand-in would be typed against one that
    // no longer exists.
    disconnect(connectionId: string): Promise<{ removed: boolean; revokedAtProvider?: boolean }>;
  };
}

export interface DataServiceOptions {
  accountService?: AccountServiceLike;
  transactionService?: TransactionServiceLike;
  planningService?: PlanningServiceLike;
  suggestionDismissalService?: SuggestionDismissalServiceLike;
  investmentService?: InvestmentServiceLike;
  userService?: typeof UserService;
  userIdService?: UserIdServiceLike;
  storageAdapter?: StorageAdapterLike;
  logger?: Logger;
  now?: DateProvider;
  uuid?: UuidGenerator;
  isSupabaseConfigured?: SupabaseChecker;
  /** Whether a signed-in (Clerk) session exists right now. */
  hasCloudSession?: CloudSessionChecker;
  /**
   * The two bulk-import writers. Absent means "fetch the real one when an
   * import runs" rather than "do without": there is no honest fallback for a
   * write, and a bulk write is the largest one this class makes.
   */
  bulkImportService?: BulkImportClientLike;
  localBulkImport?: LocalBulkImporter;
  /**
   * The two backup engines. Absent means "fetch the real one when a backup
   * runs", exactly as the importers above: there is no honest fallback for
   * reading somebody's whole ledger out, and none at all for putting it back.
   */
  cloudBackup?: CloudBackupLike;
  deviceBackup?: DeviceBackupLike;
  /**
   * The Microsoft Money engine. Absent means "fetch the real one when a
   * migration runs", exactly as the four above — and for the sharpest version
   * of the reason: a total migration replaces every row a person has.
   */
  msMoneyEngine?: MsMoneyEngineLike;
  /**
   * The bank-connection engine the wipe revokes through. Injectable for the
   * same reason as the wipe's client: so a test can watch what a "delete
   * everything" actually disconnects, without a bank on the other end.
   */
  banking?: BankingEngineLike;
  /**
   * The authenticated Postgres client the chunked wipe and the cloud migration
   * are handed. Defaults to the app's own. Injectable so a test can watch what
   * a wipe is pointed at without a network — never so a caller can choose a
   * different login.
   */
  cloudClient?: SupabaseClient | null;
  /**
   * How the cloud import authenticates. Defaults to the registry AuthContext
   * fills with the signed-in session's Clerk getToken — the same token every
   * other cloud call on this class travels with.
   */
  authTokenProvider?: AuthTokenProvider;
}

/**
 * What a holdings write says when there is nowhere to put one.
 *
 * `pages/Investments.tsx`'s own sentence, moved rather than rewritten. It threw
 * this at every write while it was calling `InvestmentService` directly, and
 * seam rule 4 makes `error.message` the prose a user reads — so a re-route that
 * reworded it would have changed what somebody sees for a reason that had not
 * changed at all.
 */
const HOLDINGS_NEED_A_LOGIN = 'Sign in to save holdings.';

class DataServiceImpl implements DataPort {
  private readonly accountService: AccountServiceLike;
  private readonly transactionService: TransactionServiceLike;
  private readonly planningService: PlanningServiceLike;
  private readonly suggestionDismissalService: SuggestionDismissalServiceLike;
  private readonly injectedInvestmentService: InvestmentServiceLike | null;
  private readonly userService: typeof UserService;
  private readonly userIdService: UserIdServiceLike;
  private readonly storage: StorageAdapterLike;
  private readonly logger: Logger;
  private readonly nowProvider: DateProvider;
  private readonly uuid: UuidGenerator;
  private readonly supabaseChecker: SupabaseChecker;
  private readonly hasCloudSession: CloudSessionChecker;
  private readonly injectedBulkImportService: BulkImportClientLike | null;
  private readonly injectedLocalBulkImport: LocalBulkImporter | null;
  private readonly injectedCloudBackup: CloudBackupLike | null;
  private readonly injectedDeviceBackup: DeviceBackupLike | null;
  private readonly injectedMsMoneyEngine: MsMoneyEngineLike | null;
  private readonly injectedBanking: BankingEngineLike | null;
  private readonly cloudClient: SupabaseClient | null;
  private readonly authTokenProvider: AuthTokenProvider;

  constructor(options: DataServiceOptions = {}) {
    this.accountService = options.accountService ?? AccountService;
    this.transactionService = options.transactionService ?? TransactionService;
    this.planningService = options.planningService ?? PlanningService;
    this.suggestionDismissalService =
      options.suggestionDismissalService ?? SuggestionDismissalService;
    this.injectedInvestmentService = options.investmentService ?? null;
    this.userService = options.userService ?? UserService;
    this.userIdService = options.userIdService ?? userIdService;
    this.storage = options.storageAdapter ?? storageAdapter;
    const fallbackLogger = typeof console !== 'undefined' ? console : undefined;
    const noop = () => {};
    this.logger = {
      log: options.logger?.log ?? (fallbackLogger?.log?.bind(fallbackLogger) ?? noop),
      warn: options.logger?.warn ?? (fallbackLogger?.warn?.bind(fallbackLogger) ?? noop),
      error: options.logger?.error ?? (fallbackLogger?.error?.bind(fallbackLogger) ?? noop)
    };
    this.nowProvider = options.now ?? (() => new Date());
    this.uuid = options.uuid ?? (() => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    });
    this.supabaseChecker = options.isSupabaseConfigured ?? isSupabaseConfigured;
    this.hasCloudSession = options.hasCloudSession ?? hasSupabaseTokenGetter;
    this.injectedBulkImportService = options.bulkImportService ?? null;
    this.injectedLocalBulkImport = options.localBulkImport ?? null;
    this.injectedCloudBackup = options.cloudBackup ?? null;
    this.injectedDeviceBackup = options.deviceBackup ?? null;
    this.injectedMsMoneyEngine = options.msMoneyEngine ?? null;
    this.injectedBanking = options.banking ?? null;
    this.cloudClient = options.cloudClient !== undefined ? options.cloudClient : supabase;
    this.authTokenProvider = options.authTokenProvider ?? getSupabaseAccessToken;
  }

  private isSupabaseReady(): boolean {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    return Boolean(userId && this.supabaseChecker());
  }

  /**
   * A signed-in (Clerk) session exists but the database user id hasn't
   * resolved yet — still connecting, or resolution failed. In this state the
   * browser-local fallback must NOT run: it would read demo/import data (or
   * divert writes) inside a signed-in view. Reads return empty; writes refuse.
   */
  private isCloudSessionPending(): boolean {
    return this.supabaseChecker() && this.hasCloudSession() &&
      !this.userIdService.getCurrentDatabaseUserId();
  }

  private guardCloudWrite(): void {
    if (this.isCloudSessionPending()) {
      throw new Error('Still connecting to your account — please try again in a moment.');
    }
  }

  private async readCollection<T>(key: string): Promise<T[]> {
    const stored = await this.storage.get<T[]>(key);
    return stored || [];
  }

  /**
   * The browser-local transaction collection (local mode, demo data, offline
   * fallback). It is stored as JSON, so every `date` comes back as the string
   * it was serialised to — the same boundary the network path has. These rows
   * go straight into app state and into the balance/budget maths, so the type
   * is made true here rather than at each reader.
   */
  private async readLocalTransactions(): Promise<Transaction[]> {
    return normalizeTransactionDates(await this.readCollection<Transaction>(STORAGE_KEYS.TRANSACTIONS));
  }

  private async persistCollection<T>(key: string, value: T[]): Promise<void> {
    await this.storage.set(key, value);
  }

  private generateId(): string {
    return this.uuid();
  }

  async initialize(clerkId: string, email: string, firstName?: string, lastName?: string): Promise<void> {
    if (!this.supabaseChecker()) {
      return;
    }

    try {
      this.logger.log('[DataService] Initializing for Clerk ID:', clerkId);
      const databaseId = await this.userIdService.ensureUserExists(clerkId, email, firstName, lastName);
      if (databaseId) {
        this.logger.log('[DataService] User initialized with database ID:', databaseId);
      } else {
        this.logger.warn('[DataService] No database ID returned from userIdService');
      }
    } catch (error) {
      this.logger.error('[DataService] Failed to initialize user:', error as Error);
    }
  }

  /**
   * The boot's transaction read. Unlike listTransactions (used by the bank-sync
   * and real-time refreshes, which always want a straight re-pull) this goes
   * through the local snapshot + delta path, and reports which it used.
   *
   * NEVER REJECTS — the seam says so, and this is where that is made true. The
   * boot effect has ONE outer catch, and reaching it replaces the whole app
   * with "Failed to load data" for somebody whose ledger is perfectly fine. The
   * cloud path already swallows its own failures (a delta that will not load
   * costs a refetch; a refetch that will not load falls back to stored rows),
   * but the store underneath can still refuse to open, so the guarantee is
   * stated here rather than assumed. A failure costs an empty list with the
   * reason said out loud on the boot-timing line.
   */
  async loadBootTransactions(): Promise<BootTransactionsResult> {
    try {
      const userId = this.userIdService.getCurrentDatabaseUserId();
      if (!userId && this.supabaseChecker()) {
        this.logger.warn(this.hasCloudSession()
          ? '[DataService] Signed in but database user id unresolved — returning empty data (local fallback blocked)'
          : '[DataService] No database ID available, using localStorage fallback');
      }

      if (userId && this.supabaseChecker()) {
        if (this.transactionService.loadTransactionsForBoot) {
          return await this.transactionService.loadTransactionsForBoot(userId);
        }
        const rows = await this.transactionService.getTransactions(userId);
        return {
          transactions: rows,
          stats: { cached: 0, fetched: rows.length, total: rows.length, fullFetchReason: 'no cache' }
        };
      }

      const rows = this.isCloudSessionPending()
        ? []
        : await this.readLocalTransactions();
      return {
        transactions: rows,
        stats: { cached: 0, fetched: 0, total: rows.length, fullFetchReason: 'local mode' }
      };
    } catch (error) {
      this.logger.error('Error loading transactions:', error as Error);
      return {
        transactions: [],
        stats: { cached: 0, fetched: 0, total: 0, fullFetchReason: 'load failed' }
      };
    }
  }

  /**
   * Every account's balance in one round trip, computed by the store.
   *
   * NEVER REJECTS, AND NEVER GUESSES. An empty map means "I don't know", and
   * the app falls back to summing the rows itself — which is the source of
   * truth anyway. Zeros would be a guess: the seeding rule keys off the map
   * being non-empty, so a map of zeros would paint every account at £0.00 and
   * present it as real money.
   */
  async getAccountBalances(): Promise<ReadonlyMap<string, AccountBalanceSnapshot>> {
    // Same condition the transaction service applies to itself (a configured
    // client IS `isSupabaseConfigured()` — see supabaseClient.ts), so routing
    // through here asks exactly the question the direct call asked.
    if (!this.supabaseChecker() || !this.transactionService.getAccountBalances) {
      return new Map();
    }
    try {
      return await this.transactionService.getAccountBalances();
    } catch (error) {
      this.logger.error('Error loading account balances:', error as Error);
      return new Map();
    }
  }

  /**
   * The whole boot in one call — the sequence the boot effect used to hold.
   *
   * Nothing here is new work: it is the six reads the effect made, in the order
   * it made them, moved to where the ORDER can be held against every
   * implementation instead of against one call site. Three things in that order
   * are rules rather than habits, and each is stated where it happens:
   *
   *  1. the accounts read answers all three of the boot's account cases by
   *     itself — the signed-in one, the signed-in-but-unresolved one, and the
   *     demo/signed-out one — because the branch that used to choose between
   *     them is the branch already inside `listAccounts`;
   *  2. the categories are AWAITED before the transaction read, because on a
   *     first signed-in load preparing them renumbers every category and remaps
   *     every reference to it (see `prepareCategories`);
   *  3. the budgets and the goals go together in ONE `Promise.all`, because
   *     they are independent and serialising them would add a round trip to
   *     every signed-in boot in exchange for nothing.
   *
   * NEVER REJECTS — the seam says so, and this is where that is made true. This
   * call is the only thing inside the boot's one outer catch, so a rejection
   * here is a full-page "Failed to load data". A store that will not open costs
   * whatever could not be read: the snapshot carries what was gathered before
   * the failure, and the transaction stats say `load failed` out loud on the
   * boot-timing line — the same floor, and the same words, `loadBootTransactions`
   * already keeps.
   */
  async loadBoot(): Promise<BootSnapshot> {
    const phases: Record<string, number> = {};
    let phaseStart = performance.now();
    const markPhase = (name: string): void => {
      phases[name] = Math.round(performance.now() - phaseStart);
      phaseStart = performance.now();
    };

    const snapshot: BootSnapshot = {
      accounts: [],
      categories: [],
      transactions: [],
      // The shape a failed transaction read already answers with, so a snapshot
      // that never got that far says the same thing the read itself would have.
      transactionStats: { cached: 0, fetched: 0, total: 0, fullFetchReason: 'load failed' },
      splits: [],
      budgets: [],
      goals: [],
      customReports: [],
      phases
    };

    try {
      // One account read for every boot. The three cases the effect used to
      // branch on are the three branches inside this method: cloud rows for a
      // resolved login, nothing at all while a session is still connecting, and
      // the browser's own list for demo and signed-out sessions.
      snapshot.accounts = await this.listAccounts();
      markPhase('accounts');

      // Categories first, and that is a CONSTRAINT rather than a preference:
      // this line may not move below the transaction read. On a first signed-in
      // load it runs `migrate_categories_atomic` — per-user uuids for the
      // categories AND the remap of every transaction and budget that
      // referenced the old ids, in one database transaction. Rows read before
      // that lands carry ids that are about to stop existing, and nothing
      // throws when that happens: the register simply comes up with its
      // category column blank.
      snapshot.categories = await this.prepareCategories();
      markPhase('categories');

      const boot = await this.loadBootTransactions();
      snapshot.transactions = boot.transactions;
      snapshot.transactionStats = boot.stats;
      markPhase('transactions');

      // Split lines ride along with the transactions, and a failure here must
      // not cost the app its boot: split parents then pass through category
      // aggregation whole. The catch is here rather than on the seam because,
      // unlike the boot's transactions, this read has no "empty is an honest
      // answer" story to tell — the refresh paths make the same choice.
      try {
        snapshot.splits = await this.listTransactionSplits();
      } catch (splitError) {
        this.logger.error('Failed to load transaction splits', splitError as Error);
        snapshot.splits = [];
      }
      markPhase('splits');

      // ONE Promise.all: three independent reads with no reason to queue behind
      // each other. The custom reports joined the other two rather than getting
      // a crossing of their own, and that is the whole reason they are in the
      // snapshot at all — two of their readers are SYNCHRONOUS renders (see
      // BootSnapshot), so a report that arrived a round trip later than the
      // boot would be a pinned dashboard widget that draws nothing on first
      // paint and appears a moment afterwards, every load.
      const [budgets, goals, customReports] = await Promise.all([
        this.listBudgets(),
        this.listGoals(),
        this.listCustomReports()
      ]);
      snapshot.budgets = budgets;
      snapshot.goals = goals;
      snapshot.customReports = customReports;
      markPhase('planning');
    } catch (error) {
      this.logger.error('Error loading the boot snapshot:', error as Error);
    }

    return snapshot;
  }

  async listAccounts(): Promise<Account[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.accountService.getAccounts(userId);
    }
    if (this.isCloudSessionPending()) return [];
    return this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
  }

  /** Closed accounts for the Accounts page's Closed Accounts section. */
  async listClosedAccounts(): Promise<Account[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.accountService.getClosedAccounts(userId);
    }
    if (this.isCloudSessionPending()) return [];
    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    return accounts.filter(a => a.isActive === false);
  }

  async createAccount(account: Omit<Account, 'id'>): Promise<Account> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.accountService.createAccount(userId, account);
    }
    this.guardCloudWrite();

    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const newAccount: Account = {
      ...account,
      // Local mode is no safer a home for a card number than the cloud: this
      // storage is what the backup file and the JSON export are built from.
      accountNumber: accountNumberForStorage(
        account.accountNumber,
        isCardAccountType(account.type)
      ),
      id: this.generateId()
    } as Account;
    accounts.push(newAccount);
    await this.persistCollection(STORAGE_KEYS.ACCOUNTS, accounts);
    return newAccount;
  }

  async updateAccount(id: string, updates: AccountUpdate): Promise<Account> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.accountService.updateAccount(id, updates, userId);
    }
    this.guardCloudWrite();

    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const index = accounts.findIndex(account => account.id === id);
    if (index === -1) {
      throw new Error('Account not found');
    }

    accounts[index] = {
      ...accounts[index],
      ...accountNumberUpdateForStorage(updates, accounts[index].type)
    } as Account;
    await this.persistCollection(STORAGE_KEYS.ACCOUNTS, accounts);
    return accounts[index];
  }

  async closeAccount(id: string): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.accountService.deleteAccount(id, userId);
    }
    this.guardCloudWrite();

    // Local mode mirrors the cloud semantics: a SOFT close (reopenable from
    // the Closed Accounts section), never a hard delete.
    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const updated = accounts.map(account =>
      account.id === id ? { ...account, isActive: false } : account
    );
    await this.persistCollection(STORAGE_KEYS.ACCOUNTS, updated);
  }

  async listTransactions(): Promise<Transaction[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.getTransactions(userId);
    }

    if (this.isCloudSessionPending()) return [];
    return this.readLocalTransactions();
  }

  async createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.createTransaction(userId, transaction);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    // The caller's date crosses the boundary here: this row is handed straight
    // back to the context and pushed into app state.
    const newTransaction: Transaction = {
      ...transaction,
      date: toDateValue(transaction.date),
      id: this.generateId()
    } as Transaction;

    transactions.push(newTransaction);
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, transactions);
    await this.updateAccountBalance(transaction.accountId, transaction.amount);
    return newTransaction;
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.updateTransaction(id, updates, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const index = transactions.findIndex(transaction => transaction.id === id);
    if (index === -1) {
      throw new Error('Transaction not found');
    }

    const oldAmount = transactions[index].amount;
    const oldAccountId = transactions[index].accountId;

    transactions[index] = {
      ...transactions[index],
      ...updates,
      ...(updates.date !== undefined ? { date: toDateValue(updates.date) } : {})
    } as Transaction;
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, transactions);

    if (updates.amount !== undefined && updates.amount !== oldAmount) {
      // Decimal delta — raw float subtraction here drifted the local ledger
      // (e.g. -70.3 - (-70.1) = -0.19999999999999574).
      await this.updateAccountBalance(
        oldAccountId,
        toDecimal(updates.amount).minus(toDecimal(oldAmount)).toNumber()
      );
    }

    return transactions[index];
  }

  async deleteTransaction(id: string): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.deleteTransaction(id, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const transaction = transactions.find(t => t.id === id);
    if (transaction) {
      await this.updateAccountBalance(transaction.accountId, -transaction.amount);
    }
    // Mirrors transactions_linked_transfer_id_fkey, which is ON DELETE SET
    // NULL: the survivor of a deleted transfer leg must not be left pointing at
    // a row that no longer exists. It stays a transfer and keeps its To/From
    // category — an UNMATCHED leg, which is a real state with a repair flow —
    // but the LINK goes, because a dangling one is what makes every screen go
    // on treating it as half of a pair: the editor refuses to move it and the
    // register offers to jump to a transaction that is gone. The cloud gets
    // this from the foreign key; browser storage has to do it by hand, and
    // until this line it did not, so a demo/offline delete left the dangling
    // pointer there permanently.
    const filtered = transactions
      .filter(t => t.id !== id)
      .map(t => {
        if (t.linkedTransferId !== id) return t;
        const { linkedTransferId: _dangling, ...rest } = t;
        return rest;
      });
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, filtered);

    // Mirrors the trg_prune_suggestion_dismissals trigger: a suggestion about a
    // row that no longer exists can never be offered again, so its dismissal is
    // dead weight. Same behaviour in demo mode as in the cloud.
    const dismissals = await this.readLocalDismissals();
    const survivors = dismissals.filter(d => !d.subjectIds.includes(id));
    if (survivors.length !== dismissals.length) {
      await this.persistCollection(STORAGE_KEYS.SUGGESTION_DISMISSALS, survivors);
    }
  }

  /**
   * Mark rows off against a statement, or take the mark back. Balance-neutral
   * by definition, and NOT a reconciliation — see the port's own words, and
   * reconciledAfterMarking for the one rule that keeps the committed flag
   * beside it honest.
   *
   * No archive sweep here. Sweeping on a MARK is what made a row dated before
   * an account's archive cutoff vanish from the screen the moment it was
   * ticked — from a list whose whole purpose is that ticks are reversible. The
   * sweep now belongs to finalizeReconciliation, where the state really is
   * final, exactly as the cloud trigger now fires on is_reconciled.
   */
  async setTransactionsCleared(ids: string[], cleared: boolean): Promise<number> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.setTransactionsCleared(ids, cleared, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const idSet = new Set(ids);
    let count = 0;
    const updated = transactions.map(t => {
      if (idSet.has(t.id)) {
        count += 1;
        return { ...t, cleared, reconciled: reconciledAfterMarking(t, cleared) };
      }
      return t;
    });
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, updated);
    return count;
  }

  /**
   * Finish a reconciliation: commit this account's marked rows and record what
   * they were settled against. Cloud: one atomic RPC. Local: the same two
   * writes, in the same order.
   *
   * The archive sweep lives here (mirrors trg_sweep_reconciled_into_archive):
   * a row that becomes COMMITTED on or before its account's cutoff drops off
   * the live register, which is the point at which that is a kindness rather
   * than a disappearing act.
   */
  async finalizeReconciliation(
    accountId: string,
    endingBalance: number,
    reconciledOn: Date
  ): Promise<ReconciliationOutcome> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      const { reconciled } = await this.transactionService.finalizeReconciliation(
        accountId, endingBalance, reconciledOn.toISOString().slice(0, 10), userId
      );
      return { reconciled, endingBalance, reconciledOn };
    }
    this.guardCloudWrite();

    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      throw new Error('account_not_found');
    }
    const cutoff = account.archiveThroughDate ? new Date(account.archiveThroughDate) : null;

    const transactions = await this.readLocalTransactions();
    let reconciled = 0;
    const updated = transactions.map(t => {
      if (t.accountId !== accountId || !isMarkedAwaitingFinalize(t)) {
        return t;
      }
      reconciled += 1;
      const sweep = !t.archived && cutoff != null && new Date(t.date) <= cutoff;
      return { ...t, reconciled: true, ...(sweep ? { archived: true } : {}) };
    });
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, updated);

    await this.persistCollection(
      STORAGE_KEYS.ACCOUNTS,
      accounts.map(a => (
        a.id === accountId
          ? { ...a, lastReconciledDate: reconciledOn, lastReconciledBalance: endingBalance }
          : a
      ))
    );
    return { reconciled, endingBalance, reconciledOn };
  }

  /**
   * Soft-archive an account's reconciled transactions on/before the cutoff and
   * stamp the account's archive_through_date. Balance-neutral (archiving only
   * hides rows). Cloud: one atomic RPC. Local: flag the matching transactions
   * and update the account. Returns the number archived.
   */
  async archiveTransactionsBefore(accountId: string, cutoff: Date): Promise<number> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.archiveTransactionsBefore(
        accountId, cutoff.toISOString().slice(0, 10), userId
      );
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    let count = 0;
    const updated = transactions.map(t => {
      // The COMMITTED flag, not the mark: the archive hides settled history,
      // and a working tick is not settled. Mirrors the same change in
      // archive_transactions_before.
      if (t.accountId === accountId && !t.archived && isReconciled(t) && new Date(t.date) <= cutoff) {
        count += 1;
        return { ...t, archived: true };
      }
      return t;
    });
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, updated);

    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    await this.persistCollection(
      STORAGE_KEYS.ACCOUNTS,
      accounts.map(a => (a.id === accountId ? { ...a, archiveThroughDate: cutoff } : a))
    );
    return count;
  }

  /** Bring an account's archived transactions back into the live register. */
  async unarchiveAccount(accountId: string): Promise<number> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.unarchiveAccount(accountId, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    let count = 0;
    const updated = transactions.map(t => {
      if (t.accountId === accountId && t.archived) { count += 1; return { ...t, archived: false }; }
      return t;
    });
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, updated);

    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    await this.persistCollection(
      STORAGE_KEYS.ACCOUNTS,
      accounts.map(a => (a.id === accountId ? { ...a, archiveThroughDate: null } : a))
    );
    return count;
  }

  /**
   * Apply a category to the listed transactions that are still uncategorized
   * (payee-memory propagation); fill-blanks only, balance-neutral.
   */
  async applyCategoryToUncategorized(ids: string[], category: string): Promise<number> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.applyCategoryToUncategorized(ids, category, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const idSet = new Set(ids);
    let count = 0;
    const updated = transactions.map(t => {
      if (idSet.has(t.id) && (!t.category || t.category.trim() === '')) {
        count += 1;
        // CONFIRMED, not suggested: every caller of this is the user filing a
        // payee they have just chosen a category for. Payee memory spreading
        // that decision to identical rows is the decision, not a guess about
        // it — asking him to re-confirm the very rows he asked to be filed
        // would make the bulk tool slower than doing it one at a time.
        //
        // needsReview ENDS with the filing. This used to say the opposite —
        // that a payee list never showed the rows' dates and amounts — and
        // the owner reversed it on 1 Sep 2026 after a live ledger's To
        // Review count refused to move under a thousand-row filing. The
        // confirm path's principle won: answering the question a row was
        // asking IS reviewing it. All three engines say so together — the
        // RPC (20260901150000_bulk_filing_ends_review.sql), the crate's
        // verb, and this one.
        return { ...t, category, categoryConfirmed: true, needsReview: false };
      }
      return t;
    });
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, updated);
    return count;
  }

  /**
   * Agree with the suggested categories on a set of rows. Balance-neutral: one
   * boolean, never the category itself, never an amount.
   */
  async confirmTransactionCategories(ids: string[]): Promise<number> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.confirmTransactionCategories(ids, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const idSet = new Set(ids);
    let count = 0;
    const updated = transactions.map(t => {
      if (idSet.has(t.id) && t.categoryConfirmed === false) {
        count += 1;
        // …and the row stops being new work. Agreeing with the guess is the
        // one-click form of the Save that would otherwise have followed, and
        // the server RPC clears both flags in the same UPDATE.
        return { ...t, categoryConfirmed: true, needsReview: false };
      }
      return t;
    });
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, updated);
    return count;
  }

  /**
   * The chunked cloud import client, fetched the first time an import runs.
   *
   * DYNAMICALLY IMPORTED ON PURPOSE. This class is in the boot chunk — the
   * context reaches it on the first paint — while the two importers are code
   * only a person importing a file ever executes. A static import here was
   * built and measured: it puts both of them in everyone's first load and
   * takes the boot chunk from 323.8 KB gzipped to 326.1 KB, on a budget it is
   * already over. Dynamic keeps them as their own chunks — 1.9 KB and 0.7 KB
   * gzipped — fetched when Import is pressed, on a connection that has just
   * served a dialog several times their size.
   */
  private async cloudBulkImportClient(): Promise<BulkImportClientLike> {
    if (this.injectedBulkImportService) return this.injectedBulkImportService;
    const { transactionImportService } = await import('../transactionImportService');
    return transactionImportService;
  }

  /** The device-side atomic import. Loaded on demand for the reason above. */
  private async deviceBulkImporter(): Promise<LocalBulkImporter> {
    if (this.injectedLocalBulkImport) return this.injectedLocalBulkImport;
    const { importTransactionsLocally } = await import('../localTransactionImportService');
    return importTransactionsLocally;
  }

  /**
   * This implementation's own store, in the shape the device importer takes.
   *
   * The importer defaults to the app's adapter when handed nothing, and that
   * default is right in production — it IS this.storage — but wrong in a test
   * that injected one: a write meant for a double's Map would land in the real
   * encrypted store instead. So the store is passed explicitly, and an adapter
   * that cannot write several keys as one unit gets `null` rather than a
   * silent redirection (see the refusal in `importTransactions`).
   *
   * The wrappers exist because the adapter's methods use `this`; the generic
   * arrow keeps `get` generic, which a `.bind()` would not.
   */
  private localImportStore(): LocalTransactionImportStore | null {
    const storage = this.storage;
    const setMany = storage.setMany;
    if (typeof setMany !== 'function') return null;
    return {
      get: <T>(key: string): Promise<T | null> => storage.get<T>(key),
      setMany: entries => setMany.call(storage, entries)
    };
  }

  /**
   * Add a file's worth of transactions to one account.
   *
   * THE ROUTE, AND ONLY THE ROUTE. Both halves of this already existed and are
   * unchanged: the chunked poster to /api/data/import-transactions, and the
   * one-IndexedDB-transaction writer. What changed is who decides between them
   * — it was the CSV wizard and the OFX dialog, each reading `isUsingSupabase`
   * off the context and each holding its own Clerk token, and it is now this
   * one line. The predicate is `isSupabaseReady()` — the one the retired
   * `isUsingSupabase` answered with, and the one `capabilities()` reports —
   * evaluated at the moment of the write rather than at the boot that last set
   * that state.
   *
   * THE TOKEN IS THE SEAM'S OWN. The dialogs used to hand the client a
   * `() => getToken()` closure out of Clerk's React hook immediately before
   * posting; it is installed here instead, at the same moment — on the same
   * tick as the write, before the first chunk — from the registry AuthContext
   * fills with the same session's getToken. A component asking a data layer to
   * authenticate itself was the last thing keeping a token in the UI.
   *
   * NO PENDING-SESSION GUARD, DELIBERATELY. Every planning write on this class
   * refuses while a signed-in session is still resolving its database id; this
   * one keeps today's behaviour and writes the browser's store, because
   * changing it is a decision about what an import does mid-connection and
   * belongs in a change that says so rather than in a routing move.
   */
  async importTransactions(
    accountId: string,
    transactions: ReadonlyArray<Omit<Transaction, 'id'>>,
    options: {
      onProgress?: (progress: BulkImportProgress) => void;
      source?: ImportSourceKind;
    } = {}
  ): Promise<BulkImportResult> {
    if (this.isSupabaseReady()) {
      const client = await this.cloudBulkImportClient();
      client.setAuthTokenProvider(this.authTokenProvider);
      return client.importInChunks(accountId, transactions, options);
    }

    const store = this.localImportStore();
    if (!store) {
      // Unreachable in the app: the real adapter writes many keys as one unit.
      // Reachable from a test double that does not, and the honest answer
      // there is to refuse rather than write to the store the double replaced.
      return {
        inserted: 0,
        alreadyPresent: 0,
        total: transactions.length,
        complete: false,
        error: 'This device cannot store the import as one piece, so nothing was written.'
      };
    }

    const importLocally = await this.deviceBulkImporter();
    // `source` says how the rows may be keyed against ones already held, and
    // `onProgress` measures a write that commits in pieces. A single atomic
    // write has neither an id space nor a fraction, so it is handed neither —
    // the silence is declared on the seam (B-9) rather than papered over.
    return importLocally(accountId, transactions, {
      store,
      uuid: () => this.generateId()
    });
  }

  // ── Backup, emptiness and restore ─────────────────────────────────────────
  //
  // ROUTING, AND ONLY ROUTING. Both engines already existed, are already
  // covered by suites of their own, and are not touched here: backupService
  // reads whole rows out of the database and restores them chunk by chunk;
  // localBackupService reads browser storage and writes the restore back as ONE
  // IndexedDB transaction. What changed is who chooses between them. It was the
  // export page and the restore dialog, each calling `DataService.getUserIds()`
  // and branching on whether a database id came back — which is the seam's rule
  // 1 (identity is internal) being broken in the two places where getting it
  // wrong costs a person their whole ledger rather than one row.

  /** The cloud backup engine, fetched the first time a backup runs. */
  private async cloudBackupEngine(): Promise<CloudBackupLike> {
    if (this.injectedCloudBackup) return this.injectedCloudBackup;
    return import('../backupService');
  }

  /**
   * The bank-connection engine, fetched only when a wipe has connections to
   * revoke. Lazy for the same reason as the two above: nothing that merely
   * reads a ledger should pull the banking client into its graph.
   */
  private async bankingEngine(): Promise<BankingEngineLike> {
    if (this.injectedBanking) return this.injectedBanking;
    return import('../bankConnectionService');
  }

  /** The device backup engine. Loaded on demand for the same reason. */
  private async deviceBackupEngine(): Promise<DeviceBackupLike> {
    if (this.injectedDeviceBackup) return this.injectedDeviceBackup;
    return import('../localBackupService');
  }

  /**
   * This implementation's own store, in the shape the device backup takes.
   *
   * The same "several keys as one unit" slice the bulk import writes through —
   * one IndexedDB transaction is what makes a local restore all-or-nothing, and
   * it is the same promise for the same reason, so it is the same helper rather
   * than a second one free to drift from it. Passed explicitly for the reason
   * `localImportStore` sets out: the engine defaults to the app's real adapter
   * when handed nothing, which is right in production and wrong in a test that
   * injected a store.
   */
  private requireDeviceBackupStore(): LocalTransactionImportStore {
    const store = this.localImportStore();
    if (!store) {
      // Unreachable in the app: the real adapter writes many keys as one unit.
      throw new Error(
        'This device cannot write several records as one piece, so a backup cannot be put back safely here.'
      );
    }
    return store;
  }

  /**
   * A signed-in session whose database id has not resolved yet.
   *
   * Reads elsewhere on this class answer `[]` in that state and writes refuse.
   * Neither is available here: an empty BUNDLE is a file a person would keep
   * believing it held their ledger, and `true` from the emptiness check would
   * unlock the restore button over a login full of data. So both refuse, in the
   * sentence the screen used to supply for itself.
   */
  private guardBackupIdentity(refusal: string): void {
    if (this.isCloudSessionPending()) {
      throw new Error(refusal);
    }
  }

  /** True when this store holds no accounts, categories or transactions. */
  async financialDataIsEmpty(): Promise<boolean> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      const { userFinancialDataIsEmpty } = await this.cloudBackupEngine();
      return userFinancialDataIsEmpty(userId);
    }

    this.guardBackupIdentity(
      'This session has no database identity yet, so a restore cannot be scoped to your login. Reload the page and try again.'
    );
    const { localFinancialDataIsEmpty } = await this.deviceBackupEngine();
    return localFinancialDataIsEmpty({ store: this.requireDeviceBackupStore() });
  }

  /** Read every table whole and build the file the user downloads. */
  async collectBackup(options: {
    onProgress?: (progress: ExportProgress) => void;
  } = {}): Promise<BackupBundle> {
    const { databaseId, clerkId } = this.userIdService.getCurrentUserIds();
    if (databaseId && this.supabaseChecker()) {
      const { collectBackupBundle } = await this.cloudBackupEngine();
      // The Clerk id travels beside the database id because ONE of the fourteen
      // tables is keyed by it (recurring_transactions). Resolving both here is
      // the whole of what the export page used to do for itself.
      return collectBackupBundle(
        { databaseUserId: databaseId, clerkUserId: clerkId },
        { onProgress: options.onProgress }
      );
    }

    this.guardBackupIdentity(
      'This session has no database identity yet, so there is nothing to read. Reload the page and try again.'
    );
    const { collectLocalBackupBundle } = await this.deviceBackupEngine();
    return collectLocalBackupBundle({
      onProgress: options.onProgress,
      store: this.requireDeviceBackupStore()
    });
  }

  /**
   * Pour a file back into an empty store.
   *
   * ── IT DROPS THIS ENGINE'S OWN READ CACHE ─────────────────────────────────
   *
   * `wipeAllFinancialData`'s argument, word for word, one operation along:
   * `transactionCache` is the boot snapshot this engine keeps in IndexedDB, a
   * restore only ever runs into a store that was EMPTY, and a snapshot taken
   * before that emptiness describes rows the restore has just replaced. The next
   * boot would hydrate from it and merge a dead history in beside the file
   * somebody has just put back.
   *
   * That clear used to live in `RestoreBackupModal`, and moving it here is the
   * same correction the wipe's was: the cache belongs to THIS engine and to no
   * other, so a dialog that reached for it was a dialog holding a fact about one
   * implementation. It was also the last thing keeping that dialog — and
   * therefore `/enhanced-import` and `/settings/data` — out of a device window,
   * because `services/transactionCache` is one of the modules a desktop bundle
   * may not contain.
   *
   * BOTH BRANCHES, unlike the wipe's, and deliberately: the wipe clears only on
   * the cloud branch because the browser branch erases the store the browser
   * boots from anyway, whereas a restore can legitimately run in a browser that
   * WAS signed in earlier in the session and still has that login's snapshot.
   * Clearing something that is not there costs nothing; leaving it costs a
   * ledger.
   */
  async restoreBackup(
    bundle: BackupBundle,
    options: { onProgress?: (progress: RestoreProgress) => void } = {}
  ): Promise<BackupRestoreOutcome> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      const { restoreBackupBundle } = await this.cloudBackupEngine();
      const outcome = await restoreBackupBundle(bundle, userId, {
        onProgress: options.onProgress
      });
      await transactionCache.clear();
      // A login holds every table the format carries, so nothing in the file
      // was left behind. An empty list here is that statement, not a stub.
      return { ...outcome, notStoredLocally: [] };
    }

    this.guardBackupIdentity(
      'This session has no database identity yet, so a restore cannot be scoped to your login. Reload the page and try again.'
    );
    await transactionCache.clear();
    const { restoreLocalBackupBundle } = await this.deviceBackupEngine();
    return restoreLocalBackupBundle(bundle, {
      onProgress: options.onProgress,
      store: this.requireDeviceBackupStore(),
      // The id remap is the part of a restore that makes a file usable in a
      // store it did not come from, and it mints one id per row. Handing it
      // this service's own generator is what lets a test hold the whole
      // operation still — the engine's own default is crypto.randomUUID, which
      // is exactly what this resolves to in the app.
      newId: () => this.generateId()
    });
  }

  // ── Erasing it, and replacing it ──────────────────────────────────────────
  //
  // ROUTING, AND ONLY ROUTING, again. The chunked wipe and the Money migration
  // are unchanged, still covered by their own suites, and still the only code
  // that knows how either job is done. What changed is who chooses between the
  // engines: it was the Danger Zone page and the Import page, each holding a
  // Postgres client of its own and each reading `isUsingSupabase` off the
  // context to decide — a React page importing a database client to erase
  // somebody's ledger with is the seam's rule 1 broken in the two places where
  // getting it wrong costs the most.

  /** The Microsoft Money engine, fetched the first time a wipe or import runs. */
  private async msMoneyEngine(): Promise<MsMoneyEngineLike> {
    if (this.injectedMsMoneyEngine) return this.injectedMsMoneyEngine;
    return import('../import/msMoney/msMoneyImport');
  }

  /**
   * The authenticated client the cloud engines are handed.
   *
   * Unreachable in the app while `isSupabaseReady()` is true — that predicate
   * IS `supabase !== null` plus a resolved owner — so this refusal exists for
   * the one case a type cannot rule out: a test that injected `cloudClient:
   * null` and a configured checker. Refusing names the contradiction; carrying
   * on would ask an engine to erase a login through a client that is not there.
   */
  private requireCloudClient(): SupabaseClient {
    if (!this.cloudClient) {
      throw new Error(
        'There is no connection to your account right now, so nothing was changed. Reload the page and try again.'
      );
    }
    return this.cloudClient;
  }

  /**
   * The phrase both destructive engines demand before they will do anything.
   *
   * Supplied by the implementation rather than carried across the seam, because
   * the CONFIRMATION is the screen's job and it already does it: the Danger Zone
   * will not enable its button until DELETE is typed, and the restore dialog
   * will not enable its own until this exact phrase is. Neither ever wiped
   * implicitly, and neither starts now.
   *
   * Stated here as a literal, which makes it the third copy — the SQL function's
   * own check and `LOCAL_WIPE_CONFIRMATION` are the other two. That is safe
   * precisely because both of those CHECK it: a copy that drifted would refuse
   * every wipe on the first run rather than weaken one, and the contract suite
   * asks for a wipe that works.
   */
  private static readonly WIPE_CONFIRMATION = 'DELETE EVERYTHING';

  /**
   * Erase everything this store holds.
   *
   * ── WHY THE CLOUD BRANCH IS TWO CALLS ───────────────────────────────────
   *
   * Not belt and braces — they empty different things, and neither on its own
   * satisfies what the seam promises.
   *
   * The CHUNKED pass is the one with the rows in it. It deletes in pieces small
   * enough that no single statement can be cancelled by the database's own
   * timeout, which is the failure it exists because of: one `DELETE FROM
   * transactions` over 51,000 rows died half-way, after the transfer links had
   * been nulled and the splits deleted, and left a login in a state nothing in
   * the app produces. It also reports as it goes, which is what stops a wipe
   * that legitimately takes minutes from reading as one that has hung.
   *
   * The RPC is the one with the REST of the tables in it — investments, and the
   * four keyed only by the user (dismissed suggestions, dashboard layouts,
   * widget preferences, notifications). Nothing cascades those away, so the
   * chunked pass leaves them, and a backup carries every one of them. Restoring
   * a file onto the survivors collides with `widget_preferences_user_id_widget_type_key`
   * part-way through, in front of somebody who has just deliberately erased
   * their own login. That is the failure a restore must never have, so "wiped"
   * has to mean every table the file carries. It also writes the per-row audit
   * for anything still standing.
   *
   * THE ORDER IS LOAD-BEARING. Chunked first: the RPC's own deletes are one
   * statement per table, which is exactly what timed out, so by the time it runs
   * there must be nothing large left for it to do. It leaves `user_preferences`
   * alone in both directions — erasing a ledger is not a request to forget that
   * somebody prefers twelve-month charts.
   *
   * On a device it is one write, so there is no fraction to report and none is
   * invented.
   *
   * ── IT DROPS THIS ENGINE'S OWN READ CACHE ─────────────────────────────────
   *
   * `transactionCache` is the boot snapshot this engine keeps in IndexedDB so
   * that a re-boot can ask the server for a delta instead of 29 MB. After a wipe
   * it describes rows that no longer exist, and the next boot would hydrate from
   * it and merge the dead history back in front of somebody who has just
   * deliberately erased it.
   *
   * That clear used to live one layer up, in `AppContextSupabase.resetLoadedData`,
   * and it moved here in the mount slice's second half for a reason bigger than
   * tidiness: the cache belongs to THIS engine and to no other, so a state layer
   * that cleared it was a state layer naming one implementation's private store.
   * The cost was exact — a desktop bundle carried `indexedDBService` (and failed
   * the bundle grep for `indexedDB`) because the shared provider imported the
   * cloud's cache to empty it. Every caller of the wipe already called both in
   * this order, so nothing about the behaviour changed.
   */
  /**
   * Revoke every bank connection this login holds.
   *
   * Best-effort per connection and total in aggregate: each is attempted even
   * if an earlier one failed, and the whole thing reports afterwards. Silence
   * on failure is what created the original bug, so a connection that would
   * not revoke must be said out loud rather than left to resurrect the ledger.
   */
  private async disconnectAllBanks(): Promise<void> {
    const { bankConnectionService } = await this.bankingEngine();

    let connections: Array<{ id: string }>;
    try {
      connections = await bankConnectionService.refreshConnections();
    } catch {
      // No connections list means nothing to revoke that we can see. The
      // ledger is already gone; refusing the whole wipe over this would be
      // worse than saying nothing, and there is nothing useful to name.
      return;
    }

    const failed: string[] = [];
    for (const connection of connections) {
      try {
        await bankConnectionService.disconnect(connection.id);
      } catch {
        failed.push(connection.id);
      }
    }

    if (failed.length > 0) {
      throw new Error(
        `Your data was deleted, but ${failed.length === 1 ? 'one bank connection' : `${failed.length} bank connections`} could not be disconnected. ` +
        'Disconnect them on the Open Banking page, or the next sync will import those accounts again.'
      );
    }
  }

  async wipeAllFinancialData(options: {
    onProgress?: (progress: WipeProgress) => void;
  } = {}): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      const client = this.requireCloudClient();
      const { wipeCloudData } = await this.msMoneyEngine();
      await wipeCloudData(client, userId, { onProgress: options.onProgress });
      const { wipeUserFinancialData } = await this.cloudBackupEngine();
      await wipeUserFinancialData(DataServiceImpl.WIPE_CONFIRMATION, userId);

      // ── AND THE BANK CONNECTIONS, WHICH USED TO SURVIVE ──────────────────
      //
      // They were deliberately kept, and the effect was that "Delete All Data"
      // was not. The accounts DID go — but the connection outlived them, and
      // the next feed sync recreated the accounts and re-imported their
      // transactions. The owner deleted everything, watched two accounts come
      // back with 487 transactions to review, and asked the only reasonable
      // question: "surely if it is delete all data, it is delete all data?"
      //
      // A destructive action that silently under-delivers is worse than one
      // that refuses: the user believes the ledger is empty and it is not.
      //
      // Through `disconnect` rather than a SQL delete of our own, so there is
      // ONE path that removes a connection and both callers take it.
      //
      // It revokes at TrueLayer and then deletes the `bank_connections` row.
      //
      // The revocation was added afterwards, and the gap is worth remembering:
      // for a while this deleted the row and nothing else, so the app forgot
      // the bank and the bank did not forget the app — while the dialog said
      // "you would need to re-authorise", which implied the stronger thing.
      // The revocation lives in the ENDPOINT rather than here, so the
      // single-connection delete on the Open Banking page gets it too.
      //
      // A provider that refuses does not block the disconnect: the row goes
      // either way, because a connection left standing is what recreates the
      // accounts. `revokedAtProvider` on the response is how a caller tells a
      // full disconnection from a local one.
      //
      // Failures are collected and thrown at the END: one bank refusing must
      // not leave the others connected, and the wipe of the ledger above has
      // already succeeded either way.
      await this.disconnectAllBanks();

      await transactionCache.clear();
      return;
    }

    this.guardBackupIdentity(
      'This session has no database identity yet, so there is nothing here that can safely be erased. Reload the page and try again.'
    );
    const { wipeLocalFinancialData } = await this.deviceBackupEngine();
    await wipeLocalFinancialData(DataServiceImpl.WIPE_CONFIRMATION, {
      store: this.requireDeviceBackupStore()
    });
    await transactionCache.clear();
  }

  /**
   * Replace everything with a parsed Microsoft Money file.
   *
   * The wipe in front of it is the importer's own — it reports through the same
   * progress channel as the rest of the migration, and reads the surviving state
   * afterwards so that a partial wipe cannot become a double import. That is why
   * this does not call `wipeAllFinancialData` first: the migration is one
   * operation with a wipe inside it, not two operations in a row, and taking the
   * wipe out here would leave the plan built against the wrong picture.
   *
   * A PENDING SESSION IS REFUSED, and this is the one place that refusal is
   * unarguable. Before this, a signed-in session whose database id had not
   * resolved yet fell through to the browser's store — so a person's whole
   * financial history was written where their signed-in app will never read it
   * again, the page reloaded, and everything they had migrated was simply not
   * there. The screen said it worked.
   */
  async importMsMoney(
    result: MsMoneyImportResult,
    options: { onProgress?: (progress: ImportProgress) => void } = {}
  ): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    const engine = await this.msMoneyEngine();
    if (userId && this.supabaseChecker()) {
      await engine.importToCloud(
        result,
        this.requireCloudClient(),
        userId,
        // The engine's own default is crypto.randomUUID, which is what this
        // resolves to in the app; handing it this service's generator is what
        // lets a test hold a whole migration still.
        () => this.generateId(),
        { onProgress: options.onProgress }
      );
      return;
    }

    this.guardBackupIdentity(
      'This session has no database identity yet, so a migration cannot be written to your login. Reload the page and try again.'
    );
    await engine.importToLocalStorage(result, STORAGE_KEYS, {
      onProgress: options.onProgress,
      // Passed explicitly for the reason `localImportStore` sets out: the
      // engine defaults to the app's real adapter when handed nothing, which is
      // right in production and wrong in a test that injected a store.
      store: this.requireDeviceBackupStore()
    });
  }

  /** Every split line of the user's transactions (for category aggregation). */
  async listTransactionSplits(): Promise<TransactionSplit[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.getAllTransactionSplits(userId);
    }

    if (this.isCloudSessionPending()) return [];
    return this.readCollection<TransactionSplit>(STORAGE_KEYS.TRANSACTION_SPLITS);
  }

  /** Splits for one transaction, in display order (empty when not split). */
  async listTransactionSplitsFor(transactionId: string): Promise<TransactionSplit[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.getTransactionSplits(transactionId);
    }

    if (this.isCloudSessionPending()) return [];
    const stored = await this.readCollection<TransactionSplit>(STORAGE_KEYS.TRANSACTION_SPLITS);
    return stored
      .filter(s => s.transactionId === transactionId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Replace a transaction's splits atomically (empty array un-splits it).
   *
   * Two server paths, chosen by the line set itself: one that declares a
   * TRANSFER LEG goes to set_transaction_splits_with_legs, which matches lines
   * by id (so an ordinary line beside a leg can be re-filed) and creates the
   * counterpart for any line that becomes a leg; everything else takes
   * set_transaction_splits, which replaces the set exactly as it always has.
   * The local path mirrors both sets of rules in ONE implementation so
   * demo/offline behave identically.
   */
  async setTransactionSplits(
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: number | null
  ): Promise<SplitWriteResult> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      if (splitDeclaresTransferLeg(splits)) {
        return this.transactionService.setTransactionSplitsWithLegs(
          transactionId, splits, expectedAmount, userId
        );
      }
      const result = await this.transactionService.setTransactionSplits(
        transactionId, splits, expectedAmount, userId
      );
      return { ...result, counterparts: [] };
    }
    this.guardCloudWrite();
    return this.setTransactionSplitsLocally(transactionId, splits, expectedAmount);
  }

  /**
   * The local/demo half of the split write — the mirror of
   * set_transaction_splits AND set_transaction_splits_with_legs, kept in one
   * place because they differ only in what they allow, not in what they mean.
   *
   * All-or-nothing: every check runs BEFORE the first persist, so a refusal
   * leaves browser storage exactly as it was (the same stance as
   * repairClaimedTransfer and mergeCategories).
   *
   * The rule about legs, precisely: a line already linked to a counterpart may
   * change only its position and memo. Removing one, or changing its amount,
   * target or category, strands or falsifies the transaction on the other side
   * and is refused by name. Every other line in the same split is free.
   */
  private async setTransactionSplitsLocally(
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: number | null
  ): Promise<SplitWriteResult> {
    const transactions = await this.readLocalTransactions();
    const index = transactions.findIndex(t => t.id === transactionId);
    if (index === -1) {
      throw new Error('Transaction not found');
    }
    const transaction = transactions[index];
    if (transaction.type === 'transfer') {
      throw new Error('Transfers cannot be split');
    }

    const stored = await this.readCollection<TransactionSplit>(STORAGE_KEYS.TRANSACTION_SPLITS);
    const mine = stored.filter(s => s.transactionId === transactionId);
    const others = stored.filter(s => s.transactionId !== transactionId);
    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const categories = await this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
    const accountName = (id: string | undefined): string =>
      accounts.find(a => a.id === id)?.name ?? 'another account';

    const keptIds = new Set(splits.map(s => s.id).filter((id): id is string => Boolean(id)));
    if (keptIds.size !== splits.filter(s => s.id).length) {
      throw new Error('Two of these lines claim to be the same stored line — reload and look again');
    }
    // Dropping a linked leg leaves its counterpart pointing at a line that no
    // longer exists. Named before anything is written.
    for (const line of mine) {
      if (line.linkedTransferId && !keptIds.has(line.id)) {
        throw new Error(
          `The line transferring to "${accountName(line.transferAccountId)}" is one half of a transfer — the transaction on the other side would be left pointing at a line that no longer exists. Delete that transfer first, then edit the split.`
        );
      }
    }

    if (splits.length === 0) {
      await this.persistCollection(STORAGE_KEYS.TRANSACTION_SPLITS, others);
      transactions[index] = { ...transaction, isSplit: false } as Transaction;
      await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, transactions);
      return { isSplit: false, splitCount: 0, amount: transaction.amount, counterparts: [] };
    }

    if (splits.length < 2) {
      throw new Error('A split needs at least 2 lines');
    }

    let sum = toDecimal(0);
    const nextLines: TransactionSplit[] = [];
    const counterparts: Transaction[] = [];
    // account id → the delta this write owes it, applied in ONE pass at the end.
    const balanceDeltas = new Map<string, DecimalInstance>();

    for (const [i, split] of splits.entries()) {
      if (!split.category.trim()) {
        throw new Error('Every split line needs a category');
      }
      if (!split.amount) {
        throw new Error('Every split line needs a non-zero amount');
      }

      const previous = split.id ? mine.find(s => s.id === split.id) : undefined;
      if (split.id && !previous) {
        throw new Error('One of these lines is not part of this split any more — reload and look again');
      }

      const target = split.transferAccountId;
      const targetAccount = target ? accounts.find(a => a.id === target) : undefined;
      if (target) {
        if (!targetAccount) {
          throw new Error('A transfer line names an account that is not yours, or no longer exists');
        }
        if (target === transaction.accountId) {
          throw new Error('A transfer needs two different accounts');
        }
      }
      // A To/From category names an account, so it must name the same one the
      // line does. Unlike the server, a category that is simply absent from
      // local storage is not fatal — demo/offline fixtures routinely carry
      // transactions without the tree they were filed against.
      const category = categories.find(c => c.id === split.category);
      if (category?.isTransferCategory === true) {
        if (!target) {
          throw new Error('That line is filed under a To/From account category but does not say which account is on the other side');
        }
        if (category.accountId !== target) {
          throw new Error('That line is filed under one account\'s To/From category but transfers to a different account');
        }
      }

      const memo = split.memo ? { memo: split.memo } : {};
      const sortOrder = i + 1;

      if (previous?.linkedTransferId) {
        // Pinned by the row on the other side: position and memo may move,
        // nothing else may.
        if (!toDecimal(split.amount).equals(toDecimal(previous.amount))) {
          throw new Error(
            `The line transferring to "${accountName(previous.transferAccountId)}" has to stay as it is, because the transaction on the other side is for exactly that much — change the other lines, or delete that transfer first.`
          );
        }
        if (target !== previous.transferAccountId) {
          throw new Error(
            `That line is already linked to a transaction in "${accountName(previous.transferAccountId)}" — moving it would strand that row. Delete that transfer first, then edit the split.`
          );
        }
        if (split.category !== previous.category) {
          throw new Error(
            'That line is one half of a transfer — its category names the account on the other side. Delete that transfer first, then re-file it.'
          );
        }
        nextLines.push({ ...previous, ...memo, sortOrder });
      } else {
        const line: TransactionSplit = {
          id: previous?.id ?? this.generateId(),
          transactionId,
          category: split.category,
          amount: split.amount,
          ...memo,
          sortOrder,
          ...(target ? { transferAccountId: target } : {}),
        };

        // A line that BECOMES a leg gets its other side made now. A line that
        // already pointed at this account keeps whatever link state it has —
        // creating a second counterpart would invent money.
        if (target && previous?.transferAccountId !== target) {
          const sourceAccount = accounts.find(a => a.id === transaction.accountId);
          if (
            sourceAccount?.currency && targetAccount?.currency &&
            sourceAccount.currency !== targetAccount.currency
          ) {
            throw new Error(
              `Transfers between accounts in different currencies are not supported yet (${sourceAccount.currency} and ${targetAccount.currency})`
            );
          }
          // Opposite of the LINE, never of the parent — whose total includes
          // the other lines, and is supposed to differ.
          const counterpartAmount = toDecimal(split.amount).negated().toNumber();
          const counterpart: Transaction = {
            id: this.generateId(),
            date: transaction.date,
            description: transaction.description,
            amount: counterpartAmount,
            type: 'transfer',
            category: this.localTransferCategoryFrom(categories, transaction.accountId, counterpartAmount),
            accountId: target,
            notes: split.memo ?? transaction.notes,
            cleared: false,
            transferAccountId: transaction.accountId,
            linkedTransferId: transactionId,
            linkedTransferSplitId: line.id,
          };
          line.linkedTransferId = counterpart.id;
          counterparts.push(counterpart);
          balanceDeltas.set(
            target,
            (balanceDeltas.get(target) ?? toDecimal(0)).plus(toDecimal(counterpartAmount))
          );
        }

        nextLines.push(line);
      }

      sum = sum.plus(toDecimal(split.amount));
    }

    if (expectedAmount !== null && !sum.equals(toDecimal(expectedAmount))) {
      throw new Error('The split lines must sum to the transaction amount');
    }

    // ── Past every refusal: persist ───────────────────────────────────────────
    const newAmount = sum.toNumber();
    if (newAmount !== transaction.amount) {
      balanceDeltas.set(
        transaction.accountId,
        (balanceDeltas.get(transaction.accountId) ?? toDecimal(0))
          .plus(sum.minus(toDecimal(transaction.amount)))
      );
    }

    await this.persistCollection(STORAGE_KEYS.TRANSACTION_SPLITS, [...others, ...nextLines]);
    transactions[index] = { ...transaction, isSplit: true, category: '', amount: newAmount } as Transaction;
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, [...transactions, ...counterparts]);
    if (balanceDeltas.size > 0) {
      await this.persistCollection(
        STORAGE_KEYS.ACCOUNTS,
        accounts.map(account => {
          const delta = balanceDeltas.get(account.id);
          // Decimal arithmetic — IEEE-754 float math is banned on money values.
          return delta
            ? { ...account, balance: toDecimal(account.balance || 0).plus(delta).toNumber() }
            : account;
        })
      );
    }

    return { isSplit: true, splitCount: nextLines.length, amount: newAmount, counterparts };
  }

  /** The account-managed To/From category id, or the legacy sentinel. */
  private localTransferCategoryFrom(categories: Category[], accountId: string, amount: number): string {
    const transferCategory = categories.find(c => c.isTransferCategory === true && c.accountId === accountId);
    return transferCategory?.id ?? (amount < 0 ? 'transfer-out' : 'transfer-in');
  }

  /** As above, reading the category collection itself. */
  private async localTransferCategoryFor(accountId: string, amount: number): Promise<string> {
    const categories = await this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
    return this.localTransferCategoryFrom(categories, accountId, amount);
  }

  /**
   * Join two existing rows into a linked transfer pair. Mirrors the
   * link_transfer_pair RPC's invariants locally so demo/offline behave
   * identically. Balance-neutral: amounts are untouched.
   */
  async linkTransferPair(idA: string, idB: string): Promise<{ a: Transaction; b: Transaction }> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.linkTransferPair(idA, idB, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const a = transactions.find(t => t.id === idA);
    const b = transactions.find(t => t.id === idB);
    if (!a || !b) {
      throw new Error('Transaction not found');
    }
    if (a.accountId === b.accountId) {
      throw new Error('A transfer needs two different accounts');
    }
    // Refusal 5, in two versions, the third copy of one rule. Which one applies
    // turns on the two ACCOUNTS, so they are read here and not sooner: the
    // check above has just guaranteed the two ids differ.
    //
    // Across a currency boundary the sides are asked only to move OPPOSITE
    // WAYS. Two amounts in two currencies sum to zero only at a rate of exactly
    // 1, so the strict rule applied there refuses every legitimate pair — see
    // supabase/migrations/20260812100000_transfer_linking_across_currencies.sql
    // for the whole argument and the 70 importer-written pairs that made it.
    // No magnitude rule: the ratio IS the achieved rate and this layer holds no
    // opinion about FX.
    //
    // An unknown currency falls to the STRICT branch, matching the RPC and the
    // Rust core: a currency nobody can establish is not evidence of a
    // conversion.
    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const currencyA = accounts.find(account => account.id === a.accountId)?.currency;
    const currencyB = accounts.find(account => account.id === b.accountId)?.currency;
    const amountA = toDecimal(a.amount);
    const amountB = toDecimal(b.amount);
    if (currencyA && currencyB && currencyA !== currencyB) {
      // Both zero tests spelled out: there is no negation here for a zero
      // second side to fall foul of, unlike the same-currency rule below.
      if (amountA.isZero() || amountB.isZero() || amountA.isNegative() === amountB.isNegative()) {
        throw new Error('Transfer sides in different currencies must be opposite in sign and non-zero');
      }
    } else if (amountA.isZero() || !amountB.equals(amountA.negated())) {
      throw new Error('Transfer sides must have exactly opposite non-zero amounts');
    }
    if (a.isSplit || b.isSplit) {
      throw new Error('A split transaction cannot become a transfer — remove the split first');
    }
    if (a.linkedTransferId || b.linkedTransferId) {
      throw new Error('Transaction is already part of a linked transfer');
    }

    const newA: Transaction = {
      ...a,
      type: 'transfer',
      category: await this.localTransferCategoryFor(b.accountId, a.amount),
      transferAccountId: b.accountId,
      linkedTransferId: b.id,
    };
    const newB: Transaction = {
      ...b,
      type: 'transfer',
      category: await this.localTransferCategoryFor(a.accountId, b.amount),
      transferAccountId: a.accountId,
      linkedTransferId: a.id,
    };
    await this.persistCollection(
      STORAGE_KEYS.TRANSACTIONS,
      transactions.map(t => (t.id === idA ? newA : t.id === idB ? newB : t))
    );
    return { a: newA, b: newB };
  }

  /**
   * Join an existing split LINE to an existing transaction as the two halves
   * of a transfer. Mirrors the link_split_line_transfer RPC's invariants
   * locally so demo/offline behave identically.
   *
   * The amounts are compared against the LINE, never the split PARENT: the
   * parent's total includes the other lines and is SUPPOSED to differ. Like
   * the RPC, this is balance-neutral (nothing about any amount or account
   * moves) and all-or-nothing: every check runs before the first persist.
   */
  async linkSplitLineTransfer(
    splitId: string,
    transactionId: string
  ): Promise<{ split: TransactionSplit; transaction: Transaction }> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.linkSplitLineTransfer(splitId, transactionId, userId);
    }
    this.guardCloudWrite();

    const splits = await this.readCollection<TransactionSplit>(STORAGE_KEYS.TRANSACTION_SPLITS);
    const line = splits.find(s => s.id === splitId);
    if (!line) {
      throw new Error('That split line no longer exists');
    }
    const transactions = await this.readLocalTransactions();
    const parent = transactions.find(t => t.id === line.transactionId);
    if (!parent) {
      throw new Error('The split that line belongs to no longer exists');
    }
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    if (transaction.id === parent.id) {
      throw new Error('A transaction cannot be linked to itself');
    }
    if (line.linkedTransferId) {
      throw new Error('That line is already one half of a transfer — reload and look again');
    }
    if (transaction.linkedTransferId || transaction.linkedTransferSplitId) {
      throw new Error('Transaction is already part of a linked transfer');
    }
    if (transaction.isSplit) {
      throw new Error('A split transaction cannot become a transfer — remove the split first');
    }
    if (transaction.archived === true) {
      throw new Error('That row is archived — bring it back into the register before pairing it');
    }
    if (transaction.accountId === parent.accountId) {
      throw new Error('A transfer needs two different accounts');
    }
    if (line.transferAccountId && line.transferAccountId !== transaction.accountId) {
      throw new Error('That line transfers to a different account from the one that row sits in');
    }
    const lineAmount = toDecimal(line.amount);
    if (lineAmount.isZero() || !toDecimal(transaction.amount).equals(lineAmount.negated())) {
      throw new Error('Transfer sides must have exactly opposite non-zero amounts');
    }

    // ── Past every refusal: persist ───────────────────────────────────────────
    const newLine: TransactionSplit = {
      ...line,
      transferAccountId: transaction.accountId,
      linkedTransferId: transaction.id,
    };
    // The row over there files under the To/From category of the account the
    // SPLIT sits in, and points back at both the parent and the exact line.
    const newTransaction: Transaction = {
      ...transaction,
      type: 'transfer',
      category: await this.localTransferCategoryFor(parent.accountId, transaction.amount),
      transferAccountId: parent.accountId,
      linkedTransferId: parent.id,
      linkedTransferSplitId: line.id,
    };

    await this.persistCollection(
      STORAGE_KEYS.TRANSACTION_SPLITS,
      splits.map(s => (s.id === splitId ? newLine : s))
    );
    await this.persistCollection(
      STORAGE_KEYS.TRANSACTIONS,
      transactions.map(t => (t.id === transactionId ? newTransaction : t))
    );
    return { split: newLine, transaction: newTransaction };
  }

  /**
   * Break linked transfer pairs — clear linkedTransferId on the named rows.
   *
   * The un-doing of linkTransferPair, and the step a corrective re-pair needs
   * before the link RPC will accept a row. Balance-neutral: only the link is
   * removed. Rows whose opposite is a split LINE are refused by the cloud path
   * (their link also lives on the split line) and skipped locally, so the two
   * modes agree. Returns the number of rows actually unlinked.
   */
  async unlinkTransfers(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.clearTransferLinks(ids, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const idSet = new Set(ids);
    let count = 0;
    const updated = transactions.map(t => {
      if (!idSet.has(t.id) || t.linkedTransferSplitId) return t;
      if (!t.linkedTransferId) return t;
      count += 1;
      const { linkedTransferId: _removed, ...rest } = t;
      return rest;
    });
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, updated);
    return count;
  }

  /**
   * Soft-archive (or restore) one transaction. Balance-neutral and reversible —
   * the row is never deleted, just hidden from the live register.
   */
  async setTransactionArchived(id: string, archived: boolean): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.setTransactionArchived(id, archived, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    if (!transactions.some(t => t.id === id)) {
      throw new Error('Transaction not found');
    }
    await this.persistCollection(
      STORAGE_KEYS.TRANSACTIONS,
      transactions.map(t => (t.id === id ? { ...t, archived } : t))
    );
  }

  /**
   * Re-pair a counterpart onto the row that really matches it: break the wrong
   * pairing, file the row it displaces as Account Adjustment, and link the
   * right pair.
   *
   * Cloud mode is ONE call — repair_claimed_transfer does all three in a single
   * database transaction, so there is no half-repaired state to compensate for
   * and no audit gap. Local/demo mirrors the RPC's invariants and its outcome,
   * and is likewise all-or-nothing: every check runs before the single persist.
   */
  async repairClaimedTransfer(
    strandedId: string,
    counterpartId: string,
    partnerId: string,
    adjustmentCategoryId: string
  ): Promise<{ stranded: Transaction; counterpart: Transaction; partner: Transaction }> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.repairClaimedTransfer(
        strandedId, counterpartId, partnerId, adjustmentCategoryId, userId
      );
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const stranded = transactions.find(t => t.id === strandedId);
    const counterpart = transactions.find(t => t.id === counterpartId);
    const partner = transactions.find(t => t.id === partnerId);
    if (!stranded || !counterpart || !partner) {
      throw new Error('Transaction not found');
    }
    // The pairing being broken must still be the one the caller saw — mutual,
    // both ways round, so a stale list cannot unlink a pair that has moved on.
    if (counterpart.linkedTransferId !== partner.id || partner.linkedTransferId !== counterpart.id) {
      throw new Error('Those two rows are not linked to each other any more — reload and look again');
    }
    if (stranded.isSplit || counterpart.isSplit || partner.isSplit) {
      throw new Error('A split transaction cannot become a transfer — remove the split first');
    }
    if (stranded.linkedTransferSplitId || counterpart.linkedTransferSplitId || partner.linkedTransferSplitId) {
      throw new Error('One of these legs is the opposite side of a split line — edit the split to unpick it first');
    }
    if (stranded.archived || counterpart.archived || partner.archived) {
      throw new Error('One of these rows is archived — bring it back into the register before re-pairing it');
    }
    if (stranded.linkedTransferId) {
      throw new Error('Transaction is already part of a linked transfer');
    }
    if (counterpart.accountId === stranded.accountId) {
      throw new Error('A transfer needs two different accounts');
    }
    const counterpartAmount = toDecimal(counterpart.amount);
    if (counterpartAmount.isZero() || !counterpartAmount.equals(toDecimal(stranded.amount).negated())) {
      throw new Error('Transfer sides must have exactly opposite non-zero amounts');
    }

    const categories = await this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
    if (stranded.category && categories.some(c => c.id === stranded.category)) {
      throw new Error('That row has been filed under a category since this list was built — reload and look again');
    }
    const adjustment = categories.find(c => c.id === adjustmentCategoryId);
    if (!adjustment || adjustment.isTransferCategory === true || adjustment.level === 'type') {
      throw new Error(`Unknown or transfer category: ${adjustmentCategoryId}`);
    }

    // The displaced row stops being half of a transfer, so the transfer
    // scaffolding goes with the link: no partner, no target account, typed by
    // the money's own direction, filed under the adjustment.
    const { linkedTransferId: _partnerLink, transferAccountId: _partnerTarget, ...partnerRest } = partner;
    const newPartner: Transaction = {
      ...partnerRest,
      category: adjustmentCategoryId,
      type: toDecimal(partner.amount).isNegative() ? 'expense' : 'income',
    };
    const newCounterpart: Transaction = {
      ...counterpart,
      type: 'transfer',
      category: await this.localTransferCategoryFor(stranded.accountId, counterpart.amount),
      transferAccountId: stranded.accountId,
      linkedTransferId: stranded.id,
    };
    const newStranded: Transaction = {
      ...stranded,
      type: 'transfer',
      category: await this.localTransferCategoryFor(counterpart.accountId, stranded.amount),
      transferAccountId: counterpart.accountId,
      linkedTransferId: counterpart.id,
    };

    // Balance-neutral: no amount, sign or account moves, so no balance write.
    await this.persistCollection(
      STORAGE_KEYS.TRANSACTIONS,
      transactions.map(t =>
        t.id === partnerId ? newPartner
          : t.id === counterpartId ? newCounterpart
            : t.id === strandedId ? newStranded
              : t
      )
    );
    return { stranded: newStranded, counterpart: newCounterpart, partner: newPartner };
  }

  /**
   * Money-style "create the other side": insert the counterpart in the target
   * account, convert the source into a linked transfer, and move the target
   * account's balance. Mirrors the create_transfer_counterpart RPC.
   */
  async createTransferCounterpart(
    id: string,
    targetAccountId: string
  ): Promise<{ source: Transaction; counterpart: Transaction }> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.createTransferCounterpart(id, targetAccountId, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const source = transactions.find(t => t.id === id);
    if (!source) {
      throw new Error('Transaction not found');
    }
    if (toDecimal(source.amount).isZero()) {
      throw new Error('A zero-amount transaction cannot become a transfer');
    }
    if (source.isSplit) {
      throw new Error('A split transaction cannot become a transfer — remove the split first');
    }
    if (source.linkedTransferId) {
      throw new Error('Transaction is already part of a linked transfer');
    }
    if (source.accountId === targetAccountId) {
      throw new Error('A transfer needs two different accounts');
    }

    // Mirrors the RPC's cross-currency guard: the counterpart is -amount with
    // no conversion, so both accounts must share a currency (when both set).
    const allAccounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const sourceAccount = allAccounts.find(a => a.id === source.accountId);
    const targetAccount = allAccounts.find(a => a.id === targetAccountId);
    if (
      sourceAccount?.currency && targetAccount?.currency &&
      sourceAccount.currency !== targetAccount.currency
    ) {
      throw new Error(
        `Transfers between accounts in different currencies are not supported yet (${sourceAccount.currency} and ${targetAccount.currency})`
      );
    }

    const counterpartAmount = toDecimal(source.amount).negated().toNumber();
    const counterpart: Transaction = {
      id: this.generateId(),
      date: source.date,
      description: source.description,
      amount: counterpartAmount,
      type: 'transfer',
      category: await this.localTransferCategoryFor(source.accountId, counterpartAmount),
      accountId: targetAccountId,
      notes: source.notes,
      cleared: false,
      transferAccountId: source.accountId,
      linkedTransferId: source.id,
    } as Transaction;
    const newSource: Transaction = {
      ...source,
      type: 'transfer',
      category: await this.localTransferCategoryFor(targetAccountId, source.amount),
      transferAccountId: targetAccountId,
      linkedTransferId: counterpart.id,
    };

    await this.persistCollection(
      STORAGE_KEYS.TRANSACTIONS,
      [...transactions.map(t => (t.id === id ? newSource : t)), counterpart]
    );
    await this.updateAccountBalance(targetAccountId, counterpartAmount);
    return { source: newSource, counterpart };
  }

  /**
   * Point an existing linked transfer at a different account. Mirrors the
   * repoint_transfer RPC's invariants, its refusals and its outcome, so demo
   * and offline behave identically to the cloud.
   *
   * All-or-nothing like the RPC: every check runs BEFORE the first persist, and
   * the rows and the balances are written in one pass. The intermediate state
   * this avoids — a transfer whose other half has gone but whose replacement
   * has not arrived — is a stranded leg reading as a real payment in an account
   * nobody is looking at.
   *
   * Both categories come from planTransferRepoint, the one place the crossover
   * rule is written down, rather than being patched here.
   */
  async repointTransfer(
    id: string,
    targetAccountId: string,
    disposition: TransferDisplacedDisposition = 'move'
  ): Promise<TransferRepointResult> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.transactionService.repointTransfer(id, targetAccountId, disposition, userId);
    }
    this.guardCloudWrite();

    const transactions = await this.readLocalTransactions();
    const source = transactions.find(t => t.id === id);
    if (!source) {
      throw new Error('Transaction not found');
    }
    if (!source.linkedTransferId) {
      throw new Error('That transaction is not half of a linked transfer');
    }
    const displacedRow = transactions.find(t => t.id === source.linkedTransferId);
    if (!displacedRow) {
      throw new Error('Transaction not found');
    }
    // Mutual, both ways round: a stale list must not re-point a pair that has
    // moved on underneath it.
    if (displacedRow.linkedTransferId !== source.id) {
      throw new Error('Those two rows are not linked to each other any more — reload and look again');
    }
    if (source.accountId === targetAccountId) {
      throw new Error('A transfer needs two different accounts');
    }
    if (source.isSplit || displacedRow.isSplit) {
      throw new Error('A split transaction cannot become a transfer — remove the split first');
    }
    if (source.linkedTransferSplitId || displacedRow.linkedTransferSplitId) {
      throw new Error('The other half of this transfer is one line of a split — edit that split to move it');
    }
    if (source.archived || displacedRow.archived) {
      throw new Error('One of these rows is archived — bring it back into the register before moving it');
    }
    if (toDecimal(source.amount).isZero()) {
      throw new Error('A zero-amount transaction cannot be a transfer');
    }

    const allAccounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const sourceAccount = allAccounts.find(a => a.id === source.accountId);
    const targetAccount = allAccounts.find(a => a.id === targetAccountId);
    if (!targetAccount) {
      throw new Error('Account not found or not owned');
    }
    if (
      sourceAccount?.currency && targetAccount.currency &&
      sourceAccount.currency !== targetAccount.currency
    ) {
      throw new Error(
        `Transfers between accounts in different currencies are not supported yet (${sourceAccount.currency} and ${targetAccount.currency})`
      );
    }

    // ── Past every refusal: decide the two rows and the balance moves ────────
    const categories = await this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
    const fromAccountId = displacedRow.accountId;
    const balanceMoves: { accountId: string; delta: number }[] = [];
    let counterpart: Transaction;
    let displaced: TransferDisplacedOutcome;
    let nextTransactions: Transaction[];

    if (disposition === 'move') {
      const filing = planTransferRepoint(source, displacedRow, targetAccountId, categories);
      counterpart = {
        ...displacedRow,
        accountId: targetAccountId,
        type: 'transfer',
        category: filing.counterpartCategory,
        transferAccountId: source.accountId,
      };
      // Only a real change of address moves money; an unchanged target is a
      // re-file, and the same row in the same account has already been counted.
      if (fromAccountId !== targetAccountId) {
        balanceMoves.push({ accountId: fromAccountId, delta: -counterpart.amount });
        balanceMoves.push({ accountId: targetAccountId, delta: counterpart.amount });
      }
      displaced = { kind: 'moved', fromAccountId };
      nextTransactions = transactions.map(t => (t.id === counterpart.id ? counterpart : t));
    } else {
      const counterpartAmount = toDecimal(source.amount).negated().toNumber();
      counterpart = {
        id: this.generateId(),
        date: source.date,
        description: source.description,
        amount: counterpartAmount,
        type: 'transfer',
        category: await this.localTransferCategoryFor(source.accountId, counterpartAmount),
        accountId: targetAccountId,
        notes: source.notes,
        cleared: false,
        transferAccountId: source.accountId,
        linkedTransferId: source.id,
      } as Transaction;
      balanceMoves.push({ accountId: targetAccountId, delta: counterpartAmount });

      if (disposition === 'release') {
        // Everything that made it half of a transfer comes off; nothing else
        // does. No category, because the app does not know what this payment
        // was — only that it was not this transfer — and needs_review so it is
        // visible in the register of the account it stays in.
        const {
          linkedTransferId: _link, transferAccountId: _target, ...rest
        } = displacedRow;
        const released: Transaction = {
          ...rest,
          category: '',
          categoryConfirmed: true,
          needsReview: true,
          type: toDecimal(displacedRow.amount).isNegative() ? 'expense' : 'income',
        };
        displaced = { kind: 'released', transaction: released };
        nextTransactions = [
          ...transactions.map(t => (t.id === released.id ? released : t)),
          counterpart,
        ];
      } else {
        balanceMoves.push({ accountId: fromAccountId, delta: -displacedRow.amount });
        displaced = {
          kind: 'deleted',
          id: displacedRow.id,
          accountId: fromAccountId,
          amount: displacedRow.amount,
        };
        nextTransactions = [
          ...transactions.filter(t => t.id !== displacedRow.id),
          counterpart,
        ];
      }
    }

    const newSource: Transaction = {
      ...source,
      type: 'transfer',
      category: planTransferRepoint(source, counterpart, targetAccountId, categories).sourceCategory,
      transferAccountId: targetAccountId,
      linkedTransferId: counterpart.id,
    };

    await this.persistCollection(
      STORAGE_KEYS.TRANSACTIONS,
      nextTransactions.map(t => (t.id === newSource.id ? newSource : t))
    );
    for (const move of balanceMoves) {
      await this.updateAccountBalance(move.accountId, move.delta);
    }
    return { source: newSource, counterpart, displaced };
  }

  /**
   * Join two categories: every reference moves from source to target, then the
   * source goes.
   *
   * Cloud mode is ONE call — merge_categories does all of it in a single
   * database transaction, so there is no half-merged state to compensate for
   * and no audit gap. Local/demo mirrors the RPC's rules and its outcome, and
   * is likewise all-or-nothing: every validation runs BEFORE the first persist,
   * so a refusal leaves browser storage exactly as it was.
   *
   * Recurring templates have no local writer (nothing persists
   * STORAGE_KEYS.RECURRING today), so the local count for them is always 0 —
   * the cloud path moves the real ones.
   */
  async mergeCategories(sourceId: string, targetId: string): Promise<CategoryMergeResult> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.planningService.mergeCategories(userId, sourceId, targetId);
    }
    this.guardCloudWrite();

    if (!sourceId || !targetId) {
      throw new Error('A merge needs the category to merge away and the category to merge it into');
    }
    if (sourceId === targetId) {
      throw new Error('A category cannot be merged into itself');
    }

    const categories = await this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
    const source = categories.find(c => c.id === sourceId);
    const target = categories.find(c => c.id === targetId);
    if (!source || !target) {
      throw new Error('Category not found');
    }

    // The source guards, in the RPC's order and wording.
    if (source.level === 'type') {
      throw new Error(`"${source.name}" is a top-level heading, not a category things are filed under`);
    }
    if (source.isTransferCategory === true) {
      throw new Error('Transfer categories are managed automatically from their account — close the account instead');
    }
    if (source.isRevaluationCategory === true || source.isSystem === true) {
      throw new Error(`"${source.name}" is a built-in category the app files transactions under automatically, so it cannot be merged away`);
    }
    if (source.isUnassignedBucket === true) {
      throw new Error(`Rows in "${source.name}" are not categorised at all — file them from the review band rather than merging the whole bucket into a real category`);
    }
    if (categories.some(c => c.parentId === sourceId)) {
      throw new Error(`"${source.name}" has categories under it — merging a whole group is not supported yet; merge its detail categories one at a time`);
    }

    // The target guards.
    if (target.level === 'type') {
      throw new Error(`"${target.name}" is a top-level heading — nothing is filed against one`);
    }
    if (target.isTransferCategory === true) {
      throw new Error(`"${target.name}" belongs to an account's transfer bookkeeping — filing ordinary transactions there would invent transfers that never happened`);
    }
    if (target.isUnassignedBucket === true) {
      throw new Error(`"${target.name}" means "not categorised" — merging into it would un-file transactions that are already filed`);
    }
    if (target.isActive === false) {
      throw new Error(`"${target.name}" is hidden, so nothing can be filed under it — pick a category that is in use`);
    }
    if (categories.some(c => c.parentId === targetId)) {
      throw new Error(`"${target.name}" is a group, and transactions belong to a category inside it — pick one of its detail categories`);
    }

    // Direction: a 'both' target takes either, because it carries no direction
    // of its own; nothing else crosses.
    if (target.type !== 'both' && target.type !== source.type) {
      throw new Error(
        `"${source.name}" is an ${source.type} category and "${target.name}" is an ${target.type} one — merging across the two would file money on the wrong side of every report`
      );
    }

    const transactions = await this.readLocalTransactions();
    const splits = await this.readCollection<TransactionSplit>(STORAGE_KEYS.TRANSACTION_SPLITS);
    const budgets = await this.readCollection<Budget>(STORAGE_KEYS.BUDGETS);

    let movedTransactions = 0;
    const nextTransactions = transactions.map(t => {
      if (t.category !== sourceId) return t;
      movedTransactions += 1;
      return { ...t, category: targetId };
    });

    // Split lines keep their amounts and memos: two lines of one transaction
    // landing on the same target stay two lines, because adding them together
    // would destroy the user's own breakdown.
    let movedSplitLines = 0;
    const touchedParents = new Set<string>();
    const nextSplits = splits.map(s => {
      if (s.category !== sourceId) return s;
      movedSplitLines += 1;
      touchedParents.add(s.transactionId);
      return { ...s, category: targetId };
    });

    let movedBudgets = 0;
    const nextBudgets = budgets.map(b => {
      if (b.categoryId !== sourceId) return b;
      movedBudgets += 1;
      return { ...b, categoryId: targetId, updatedAt: this.nowProvider() };
    });

    // Every check has passed, so the writes go together. Categories LAST: if a
    // write fails part way, references pointing at a category that still exists
    // is a recoverable state, and the reverse is not.
    await this.persistCollection(STORAGE_KEYS.TRANSACTIONS, nextTransactions);
    await this.persistCollection(STORAGE_KEYS.TRANSACTION_SPLITS, nextSplits);
    await this.persistCollection(STORAGE_KEYS.BUDGETS, nextBudgets);
    await this.persistCollection(
      STORAGE_KEYS.CATEGORIES,
      categories.filter(c => c.id !== sourceId)
    );

    return {
      sourceId,
      targetId,
      transactions: movedTransactions,
      splitLines: movedSplitLines,
      splitTransactions: touchedParents.size,
      budgets: movedBudgets,
      recurring: 0
    };
  }

  /**
   * Suggestions the user has told the sweeps to stop offering.
   *
   * The local/demo mirror is a plain collection in browser storage, keyed the
   * same way the table is — (kind, subjectKey) — so demo mode behaves exactly
   * like the cloud: refuse a suggestion, close the sweep, re-open it, and the
   * suggestion is still gone.
   */
  async listSuggestionDismissals(): Promise<SuggestionDismissal[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.suggestionDismissalService.list(userId);
    }
    if (this.isCloudSessionPending()) return [];
    return this.readLocalDismissals();
  }

  /**
   * Record a refusal. Idempotent in both modes: refusing something already
   * refused returns the existing record, so a double-click (or a second device)
   * cannot turn a decision into an error message.
   */
  async dismissSuggestion(
    kind: DismissalKind,
    subjectKey: string,
    subjectIds: string[]
  ): Promise<SuggestionDismissal> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.suggestionDismissalService.dismiss(userId, kind, subjectKey, subjectIds);
    }
    this.guardCloudWrite();

    const stored = await this.readLocalDismissals();
    const existing = stored.find(d => d.kind === kind && d.subjectKey === subjectKey);
    if (existing) return existing;

    const dismissal: SuggestionDismissal = {
      id: this.generateId(),
      kind,
      subjectKey,
      subjectIds,
      dismissedAt: this.nowProvider(),
    };
    await this.persistCollection(STORAGE_KEYS.SUGGESTION_DISMISSALS, [...stored, dismissal]);
    return dismissal;
  }

  /** Undo a refusal: the suggestion is offered again from the next scan. */
  async restoreSuggestion(kind: DismissalKind, subjectKey: string): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.suggestionDismissalService.restore(userId, kind, subjectKey);
    }
    this.guardCloudWrite();

    const stored = await this.readLocalDismissals();
    await this.persistCollection(
      STORAGE_KEYS.SUGGESTION_DISMISSALS,
      stored.filter(d => !(d.kind === kind && d.subjectKey === subjectKey))
    );
  }

  /**
   * The browser-local dismissals. Stored as JSON, so `dismissedAt` comes back
   * as the string it was serialised to — made true here rather than at each
   * reader, the same boundary readLocalTransactions handles for dates.
   */
  private async readLocalDismissals(): Promise<SuggestionDismissal[]> {
    const stored = await this.readCollection<SuggestionDismissal>(STORAGE_KEYS.SUGGESTION_DISMISSALS);
    return stored.map(dismissal => ({
      ...dismissal,
      subjectIds: dismissal.subjectIds ?? [],
      dismissedAt: new Date(dismissal.dismissedAt),
    }));
  }

  /**
   * The owner's budgets, from whichever store actually holds them.
   *
   * PlanningService owns the cloud query and this class owns the browser-local
   * collection, so the seam's answer is one branch over the other — the shape
   * `listAccounts` above already has.
   *
   * THE ID IS RESOLVED HERE AND ONLY PASSED ON WHEN IT IS REAL.
   * `PlanningService.getBudgets(null)` does not fail and does not complain: it
   * quietly reads browser storage instead. A caller that handed it a null
   * would therefore serve a signed-in person somebody else's budgets — demo
   * data, an old import — with a well-formed list and no error anywhere to say
   * so. That is why the null is unrepresentable at this seam (rule 1: no
   * operation takes a user id) and why the call shape is pinned by a test.
   *
   * The pending gate stays on the local branch: a budget is MONEY, an amount
   * against a category, so a session still resolving its database id gets
   * nothing rather than the browser's copy. (Categories are the deliberate
   * exception — see `prepareCategories`, which explains why names are not
   * money.)
   */
  async listBudgets(): Promise<Budget[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker() && this.planningService.getBudgets) {
      return this.planningService.getBudgets(userId);
    }
    if (this.isCloudSessionPending()) return [];
    return this.readCollection<Budget>(STORAGE_KEYS.BUDGETS);
  }

  /**
   * Create a budget.
   *
   * The branch is the one `listBudgets` above uses, and for the same reason —
   * but a write is where getting the owner wrong stops being a wrong answer on
   * screen and becomes a lost budget: `PlanningService.createBudget(null, …)`
   * writes BROWSER storage and returns an ordinary Budget, so a signed-in
   * person would see their new budget appear and find it gone at the next
   * boot, when the cloud read it never reached answers instead. The id is
   * resolved here, on the same tick, and only passed on when it is real. The
   * full statement of that rule lives on `DataPortPlanningWrites.createBudget`.
   *
   * The cloud branch DELEGATES, and returns the promise unwrapped: whatever
   * sentence a failed insert produces is what the budget modal puts in front of
   * the user, and re-wrapping it here would replace it with a worse one.
   *
   * The local branch is this class's own, mirroring what PlanningService's
   * local half does field for field: a generated id, `spent` at zero (it is
   * recomputed from the ledger, never stored knowledge), and both timestamps
   * stamped now. The id comes from this class's injected generator rather than
   * a bare `crypto.randomUUID()` — the same one every other local write here
   * uses, identical in a browser, and it has a fallback where that API is
   * missing instead of throwing.
   *
   * ONE ASYMMETRY, PRESERVED DELIBERATELY: the cloud insert fills in a
   * `start_date` and a `name` when the caller left them empty. That is a
   * not-null column being satisfied, not a product decision, and the browser's
   * copy has never carried either — inventing them here would change what
   * every existing local budget looks like on the page.
   *
   * AND BETWEEN THE TWO BRANCHES, A REFUSAL RATHER THAN A ROUTE. A signed-in
   * session whose database id has not resolved yet belongs to neither: the
   * cloud branch has no owner to write under, and the local branch would put
   * this budget in the browser's copy, show it as saved, and lose it at the
   * next boot — when the cloud read beside it answers instead, from a store the
   * row never reached. Nothing throws, nothing logs, and there is no way back.
   * So the guard refuses, in the same sentence every other write on this class
   * already uses: still connecting is both true and something the person can
   * act on twenty seconds later, which silent loss never was.
   */
  async createBudget(budget: Omit<Budget, 'id' | 'spent'>): Promise<Budget> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.planningService.createBudget(userId, budget);
    }
    this.guardCloudWrite();

    const created: Budget = {
      ...budget,
      id: this.generateId(),
      spent: 0,
      createdAt: this.nowProvider(),
      updatedAt: this.nowProvider()
    };
    const budgets = await this.readCollection<Budget>(STORAGE_KEYS.BUDGETS);
    await this.persistCollection(STORAGE_KEYS.BUDGETS, [...budgets, created]);
    return created;
  }

  /**
   * Change a budget, and hand back the whole budget as it now stands — the
   * caller replaces its copy with this answer, so a partial one would blank
   * whatever it left out.
   *
   * Same branch, same owner rule and same pending-session refusal as
   * `createBudget` above. A budget that is not there is refused by name rather
   * than created, and because the lookup happens before the first write, the
   * refusal leaves the store exactly as it was.
   */
  async updateBudget(id: string, updates: Partial<Budget>): Promise<Budget> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.planningService.updateBudget(userId, id, updates);
    }
    this.guardCloudWrite();

    const budgets = await this.readCollection<Budget>(STORAGE_KEYS.BUDGETS);
    const index = budgets.findIndex(budget => budget.id === id);
    if (index === -1) throw new Error('Budget not found');

    const updated: Budget = { ...budgets[index], ...updates, updatedAt: this.nowProvider() };
    await this.persistCollection(
      STORAGE_KEYS.BUDGETS,
      budgets.map((budget, position) => (position === index ? updated : budget))
    );
    return updated;
  }

  /**
   * Remove a budget.
   *
   * Same branch, same owner rule and same pending-session refusal as the two
   * above. Deleting one that is not there is a silent no-op in both modes — a
   * double-click, or a second device that got there first, must not turn a
   * decision into an error message. A session still resolving its id is a
   * different thing entirely: the delete has not happened yet, so saying so is
   * the honest answer rather than a noise.
   */
  async deleteBudget(id: string): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.planningService.deleteBudget(userId, id);
    }
    this.guardCloudWrite();

    const budgets = await this.readCollection<Budget>(STORAGE_KEYS.BUDGETS);
    await this.persistCollection(
      STORAGE_KEYS.BUDGETS,
      budgets.filter(budget => budget.id !== id)
    );
  }

  /** The owner's goals. Same branch, same null rule, as `listBudgets` above. */
  async listGoals(): Promise<Goal[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker() && this.planningService.getGoals) {
      return this.planningService.getGoals(userId);
    }
    if (this.isCloudSessionPending()) return [];
    return this.readCollection<Goal>(STORAGE_KEYS.GOALS);
  }

  /**
   * Create a goal.
   *
   * Branch, owner rule, delegation and unwrapped promise: all exactly as
   * `createBudget` above, which is where they are argued at length. The same
   * null hazard applies — `PlanningService.createGoal(null, …)` writes browser
   * storage and hands back an ordinary Goal, so a signed-in person would watch
   * their goal appear and find the page empty at the next boot — and the same
   * defence: the id is resolved here, on the same tick, and only passed on when
   * it is real.
   *
   * THE ONE THING SPECIFIC TO A GOAL: what it starts at. `progress` is the
   * accumulated amount, so a goal created with money already put by starts at
   * that figure rather than at zero. This is a fix, not a preference — the
   * version that hard-coded zero lost the opening amount, and lost it
   * differently in each half (banked in the browser's copy, thrown away in the
   * cloud), which is precisely the kind of difference this seam exists to stop.
   *
   * The pending-session refusal argued on `createBudget` applies here word for
   * word: a session whose database id has not resolved yet reaches neither
   * branch, because the browser's copy is a place this goal would be shown as
   * saved and then lost.
   */
  async createGoal(goal: Omit<Goal, 'id' | 'progress'>): Promise<Goal> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.planningService.createGoal(userId, goal);
    }
    this.guardCloudWrite();

    const created: Goal = {
      ...goal,
      id: this.generateId(),
      progress: goal.currentAmount ?? 0,
      createdAt: this.nowProvider(),
      updatedAt: this.nowProvider()
    };
    const goals = await this.readCollection<Goal>(STORAGE_KEYS.GOALS);
    await this.persistCollection(STORAGE_KEYS.GOALS, [...goals, created]);
    return created;
  }

  /**
   * Change a goal, and hand back the whole goal as it now stands.
   *
   * Same branch, same owner rule and same pending-session refusal as
   * `createGoal` above. A goal that is not there is refused by name rather than
   * created, and because the lookup happens before the first write, the refusal
   * leaves the store exactly as it was.
   *
   * This is also how money is put towards a goal: the contribution arrives as
   * an update carrying the new `progress`, already summed and already capped
   * against the target by the caller. So this SETS the field it is given and
   * never adds to the stored one — adding here would apply the contribution
   * twice and carry the goal past the target the cap exists to hold it to.
   */
  async updateGoal(id: string, updates: Partial<Goal>): Promise<Goal> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.planningService.updateGoal(userId, id, updates);
    }
    this.guardCloudWrite();

    const goals = await this.readCollection<Goal>(STORAGE_KEYS.GOALS);
    const index = goals.findIndex(goal => goal.id === id);
    if (index === -1) throw new Error('Goal not found');

    const updated: Goal = { ...goals[index], ...updates, updatedAt: this.nowProvider() };
    await this.persistCollection(
      STORAGE_KEYS.GOALS,
      goals.map((goal, position) => (position === index ? updated : goal))
    );
    return updated;
  }

  /**
   * Remove a goal.
   *
   * Same branch, same owner rule and same pending-session refusal as the two
   * above, and the same silence when it is already gone. The goal's trophy is
   * forgotten by the caller that owns the celebration, not here — and because a
   * refused delete rejects, that caller never gets as far as forgetting it.
   */
  async deleteGoal(id: string): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.planningService.deleteGoal(userId, id);
    }
    this.guardCloudWrite();

    const goals = await this.readCollection<Goal>(STORAGE_KEYS.GOALS);
    await this.persistCollection(
      STORAGE_KEYS.GOALS,
      goals.filter(goal => goal.id !== id)
    );
  }

  // ── Custom reports ────────────────────────────────────────────────────────
  //
  // The one family here that arrived because a feature was LOSING data rather
  // than because a screen was being written. Until slice 32 a report's only home
  // was plain `localStorage['money_management_custom_reports']`, so it did not
  // sync, did not survive clearing browser data, was not in a backup, and on a
  // desktop lived in the WebView's storage rather than in the ledger file the
  // person chose. `customReportService.adoptLegacyReports` is what carries the
  // old key's contents through this branch, once per device.

  /** The owner's reports. Same branch, same null rule, as `listGoals` above. */
  async listCustomReports(): Promise<CustomReport[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker() && this.planningService.getCustomReports) {
      return this.planningService.getCustomReports(userId);
    }
    if (this.isCloudSessionPending()) return [];
    return this.readCollection<CustomReport>(STORAGE_KEYS.CUSTOM_REPORTS);
  }

  /**
   * The scenario's stated deviations. The BROWSER branch answers an empty
   * list — divergence B-12's shape, investments' precedent: browser storage
   * has never had an adjustments store, a writer or a reader, the absence is
   * declared in `backup/browserCoverage.ts`, and an empty list is the honest
   * answer where there is nowhere to keep one.
   */
  async listForecastAdjustments(): Promise<ForecastAdjustment[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker() && this.planningService.getForecastAdjustments) {
      return this.planningService.getForecastAdjustments(userId);
    }
    return [];
  }

  /**
   * State one category's scenario figure. No browser branch AT ALL — the
   * refusal is loud where the report family's browser branch is a store,
   * because a signed-out browser has nowhere the backup could carry an
   * adjustment out of (see `browserCoverage.ts`), and a write that landed
   * somewhere invisible would be the custom-reports localStorage failure
   * born again.
   */
  async setForecastAdjustment(categoryId: string, monthlyMinor: number): Promise<ForecastAdjustment> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker() && this.planningService.setForecastAdjustment) {
      return this.planningService.setForecastAdjustment(userId, categoryId, monthlyMinor);
    }
    throw new Error('Sign in to adjust the forecast — scenario adjustments are kept with your account.');
  }

  async clearForecastAdjustment(categoryId: string): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker() && this.planningService.clearForecastAdjustment) {
      return this.planningService.clearForecastAdjustment(userId, categoryId);
    }
    throw new Error('Sign in to adjust the forecast — scenario adjustments are kept with your account.');
  }

  /**
   * Save a report somebody built.
   *
   * Branch, owner rule, delegation and unwrapped promise exactly as `createGoal`
   * above, where they are argued at length — including the pending-session
   * refusal, which matters here for a reason specific to this entity: a report
   * written into the browser's copy while a sign-in is still resolving is a
   * report the adoption has ALREADY finished with, so it would sit in a store
   * nothing reads again and the person would watch it appear and then vanish at
   * the next boot with nothing on screen to say why.
   *
   * The id is minted here in the browser branch and by the database column in
   * the cloud one — divergence B-5, the same split a category has. The builder
   * used to mint it (`report-${Date.now()}`) and no longer does, because that id
   * is not a uuid and the cloud's column is.
   */
  async createCustomReport(report: Omit<CustomReport, 'id'>): Promise<CustomReport> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.planningService.createCustomReport(userId, report);
    }
    this.guardCloudWrite();

    const created: CustomReport = {
      ...report,
      id: this.generateId()
    };
    const reports = await this.readCollection<CustomReport>(STORAGE_KEYS.CUSTOM_REPORTS);
    await this.persistCollection(STORAGE_KEYS.CUSTOM_REPORTS, [...reports, created]);
    return created;
  }

  /**
   * Change a report, and hand back the whole report as it now stands.
   *
   * Same branch, same owner rule and same pending-session refusal as
   * `createCustomReport` above. A report that is not there is refused by name
   * rather than created, and because the lookup happens before the first write,
   * the refusal leaves the store exactly as it was.
   *
   * THE SPREAD IS THE REPLACE RULE. `{ ...reports[index], ...updates }` puts the
   * stated `components` array in place of the stored one wholesale, which is
   * what the seam promises and what makes deleting a component work: a merge
   * would keep the removed component alive through every save, and no screen
   * would explain why it kept coming back.
   */
  async updateCustomReport(id: string, updates: Partial<CustomReport>): Promise<CustomReport> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.planningService.updateCustomReport(userId, id, updates);
    }
    this.guardCloudWrite();

    const reports = await this.readCollection<CustomReport>(STORAGE_KEYS.CUSTOM_REPORTS);
    const index = reports.findIndex(report => report.id === id);
    if (index === -1) throw new Error('Custom report not found');

    const updated: CustomReport = { ...reports[index], ...updates, updatedAt: this.nowProvider() };
    await this.persistCollection(
      STORAGE_KEYS.CUSTOM_REPORTS,
      reports.map((report, position) => (position === index ? updated : report))
    );
    return updated;
  }

  /**
   * Remove a report.
   *
   * Same branch, same owner rule and same pending-session refusal as the two
   * above, and the same silence when it is already gone.
   */
  async deleteCustomReport(id: string): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.planningService.deleteCustomReport(userId, id);
    }
    this.guardCloudWrite();

    const reports = await this.readCollection<CustomReport>(STORAGE_KEYS.CUSTOM_REPORTS);
    await this.persistCollection(
      STORAGE_KEYS.CUSTOM_REPORTS,
      reports.filter(report => report.id !== id)
    );
  }

  // ── Holdings ──────────────────────────────────────────────────────────────
  //
  // The last region of the data layer to reach this class, and the one whose
  // BROWSER branch is an absence rather than a store.
  //
  // Every other family here has two real halves: a cloud service and a
  // collection under a storage key. There has never been a browser-local
  // holdings store — no key, no writer, no reader, and `LOCAL_BACKUP_BINDINGS`
  // has said `stored: false` about `investments` since it was written. So the
  // browser branch is declared as divergence B-12 rather than invented: the read
  // answers an EMPTY LIST (there are none, because there is nowhere to keep
  // them) and the four writes REFUSE BY NAME.
  //
  // That is exactly what a signed-out browser did before this slice, and it is
  // deliberately unchanged: `InvestmentService.list` returned `[]` with no
  // client, and `pages/Investments.tsx` threw 'Sign in to save holdings.' at
  // every write. Inventing a second holdings engine in the commit that ported
  // the first would have been a behaviour change smuggled in beside a re-route.

  /**
   * The holdings service, fetched the first time a holding question is asked.
   *
   * FETCHED RATHER THAN IMPORTED, unlike the four services beside it, and the
   * reason is MEASURED rather than stylistic. `investmentService.ts` reaches
   * `supabaseClient`, which builds `@supabase/supabase-js` — and at HEAD nothing
   * in the boot chunk did: the SDK was tree-shaken out of the entry and lived
   * only in the lazy chunks that actually talk to it. A static import here put
   * 168 KiB raw / 46 KiB gzip of Postgrest, GoTrue, Realtime and Storage into the
   * chunk that decides how long a cold start takes, for a service ONE lazy page
   * uses.
   *
   * (The other four are static and stay static: `AccountService`,
   * `TransactionService`, `PlanningService` and `SuggestionDismissalService` are
   * all on the boot path, so nothing would be saved by deferring them.)
   *
   * So this follows the arrangement the backup engines and the .mny importer
   * already have, four methods down: absent means "fetch the real one when it is
   * needed" rather than "do without", because there is no honest fallback for a
   * write.
   */
  private async investmentEngine(): Promise<InvestmentServiceLike> {
    if (this.injectedInvestmentService) return this.injectedInvestmentService;
    return (await import('./investmentService')).InvestmentService;
  }

  /**
   * The owner's holdings. Same branch and same null rule as `listGoals` above.
   *
   * B-12: the browser answers `[]`, and `capabilities().cannotKeep` is where a
   * screen finds out that the emptiness is a property of the store rather than
   * of the portfolio.
   */
  async listInvestments(): Promise<InvestmentHolding[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return (await this.investmentEngine()).list(userId);
    }
    return [];
  }

  /**
   * Record a position.
   *
   * The cloud branch delegates unchanged — including the `costBasis = quantity ×
   * averageCost` the service computes, which is why no draft anywhere carries a
   * cost of its own.
   *
   * The browser branch refuses, and the WORDS are the ones the page used to
   * throw itself. Seam rule 4 makes `.message` the sentence on the screen, so
   * moving the refusal from the page into the engine had to move the sentence
   * with it or the user would have seen a different one for the same reason.
   */
  async createInvestment(draft: InvestmentDraft): Promise<InvestmentHolding> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return (await this.investmentEngine()).create(userId, draft);
    }
    this.guardCloudWrite();
    throw new Error(HOLDINGS_NEED_A_LOGIN);
  }

  /** Change a position. Same branch, same refusal, as `createInvestment`. */
  async updateInvestment(id: string, changes: InvestmentChanges): Promise<InvestmentHolding> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return (await this.investmentEngine()).update(userId, id, changes);
    }
    this.guardCloudWrite();
    throw new Error(HOLDINGS_NEED_A_LOGIN);
  }

  /** Remove a position. Same branch, same refusal. */
  async deleteInvestment(id: string): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return (await this.investmentEngine()).remove(userId, id);
    }
    this.guardCloudWrite();
    throw new Error(HOLDINGS_NEED_A_LOGIN);
  }

  /**
   * Write fetched prices back onto this owner's rows.
   *
   * NOTHING IN, ZERO OUT, AND NO BRANCH TAKEN — checked before the owner is even
   * resolved, exactly as the service checks it before asking for a client. An
   * empty sweep is the ordinary case (every symbol failed to fetch), not a
   * caller's mistake, and it must not be the thing that raises "Sign in to fetch
   * and store prices" at somebody who is signed out and pressed nothing.
   */
  async applyInvestmentPrices(quotes: readonly QuoteWriteback[]): Promise<number> {
    if (quotes.length === 0) return 0;
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return (await this.investmentEngine()).applyQuotes(userId, quotes);
    }
    this.guardCloudWrite();
    throw new Error(HOLDINGS_NEED_A_LOGIN);
  }

  async importInvestmentPriceHistory(
    rows: readonly { symbol: string; date: string; price: string; currency: string }[]
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return (await this.investmentEngine()).importPriceHistory(userId, rows);
    }
    this.guardCloudWrite();
    throw new Error(HOLDINGS_NEED_A_LOGIN);
  }

  async listInvestmentPrices(
    symbol: string
  ): Promise<Array<{ date: string; price: string; source: 'quote' | 'manual' | 'trade' | 'import' }>> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return (await this.investmentEngine()).listPrices(userId, symbol);
    }
    return [];
  }

  async recordInvestmentPrice(
    entry: { symbol: string; date: string; price: string; currency: string }
  ): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return (await this.investmentEngine()).recordManualPrice(userId, entry);
    }
    this.guardCloudWrite();
    throw new Error(HOLDINGS_NEED_A_LOGIN);
  }

  async importInvestmentEvents(rows: readonly InvestmentEventDraft[]): Promise<number> {
    if (rows.length === 0) return 0;
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return (await this.investmentEngine()).importEvents(userId, rows);
    }
    this.guardCloudWrite();
    throw new Error(HOLDINGS_NEED_A_LOGIN);
  }

  async listInvestmentEvents(accountId: string): Promise<InvestmentEvent[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return (await this.investmentEngine()).listEvents(userId, accountId);
    }
    return [];
  }

  async listAllInvestmentEvents(): Promise<InvestmentEvent[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return (await this.investmentEngine()).listAllEvents(userId);
    }
    return [];
  }

  async recordInvestmentEvent(draft: Omit<InvestmentEventDraft, 'sourceRef'>): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return (await this.investmentEngine()).recordEvent(userId, draft);
    }
    this.guardCloudWrite();
    throw new Error(HOLDINGS_NEED_A_LOGIN);
  }

  async moveInvestmentEventDate(eventId: string, newDate: string): Promise<{ previousDate: string }> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return (await this.investmentEngine()).moveEventDate(userId, eventId, newDate);
    }
    this.guardCloudWrite();
    throw new Error(HOLDINGS_NEED_A_LOGIN);
  }

  async deleteInvestmentEvent(eventId: string): Promise<{
    date: string; kind: 'buy' | 'sell' | 'write_off'; quantity: string; amount: string; symbol: string | null;
  }> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return (await this.investmentEngine()).deleteEvent(userId, eventId);
    }
    this.guardCloudWrite();
    throw new Error(HOLDINGS_NEED_A_LOGIN);
  }

  async recordTradePrices(
    rows: readonly { symbol: string; date: string; price: string; currency: string }[]
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return (await this.investmentEngine()).importPriceHistory(userId, rows, 'trade');
    }
    this.guardCloudWrite();
    throw new Error(HOLDINGS_NEED_A_LOGIN);
  }

  async deleteInvestmentEvents(accountId: string, symbol: string): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return (await this.investmentEngine()).deleteEventsFor(userId, accountId, symbol);
    }
    // Nothing to erase where no events can exist — deleting a holding on the
    // device edition must not trip over an empty history.
  }

  async listAllInvestmentPrices(): Promise<
    Array<{ symbol: string; date: string; price: string; currency: string }>
  > {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return (await this.investmentEngine()).listAllPrices(userId);
    }
    return [];
  }

  /**
   * Create a category.
   *
   * Branch, owner rule, delegation and unwrapped promise: exactly as
   * `createBudget` above, where they are argued at length.
   * `PlanningService.createCategory(null, …)` writes the browser's copy and
   * hands back an ordinary Category, so a signed-in person would file their next
   * transactions under an id the cloud has never heard of — and find them
   * uncategorised in the morning, which is worse than the budget case rather
   * than better.
   *
   * WHY THE CLOUD BRANCH IS NOT REIMPLEMENTED HERE, for all five category
   * writes. Every one of PlanningService's cloud branches refreshes the
   * BROWSER's category cache after the row lands (a create appends, an update
   * replaces in place, a delete drops the row and its children). That cache is
   * not decoration: it is what `prepareCategories`' local branch reads, which is
   * how a signed-in person who opens the app offline still knows what their
   * categories are called. Writing a second, cache-less cloud branch here would
   * leave the two writers disagreeing about the same store, and the symptom
   * would be a category list that quietly goes stale between sessions. So the
   * cloud half stays in one place and this class delegates to it.
   *
   * The local branch is this class's own, mirroring PlanningService's local half
   * field for field: the id is the only thing added, from this class's injected
   * generator rather than a bare `crypto.randomUUID()` — the same one every
   * other local write here uses, identical in a browser, with a fallback where
   * that API is missing instead of a throw.
   *
   * The pending-session refusal argued on `createBudget` applies to all five
   * category writes, and the comment beside the guard below says why the one
   * exception on this class does not reach them.
   */
  async createCategory(category: Omit<Category, 'id'>): Promise<Category> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.planningService.createCategory(userId, category);
    }
    // THIS GUARD IS NOT THE ASYMMETRY IT LOOKS LIKE, and it is here on all five
    // category writes even though `prepareCategories` below deliberately has no
    // gate at all. Reading names and writing rows are different questions.
    //
    // What that exception says is that a category LIST is not money: serving
    // the browser's copy of the names to a session still resolving its id costs
    // nothing, because that copy is the very list the account's own was
    // migrated from, and withholding it would blank the register's category
    // column for no gain.
    //
    // A category WRITE is the opposite trade. It does not read a list that
    // already agrees with the cloud's — it MINTS AN ID, in a store the cloud
    // will never hear about. The person names "Fuel", files three transactions
    // under the id the browser's copy just gave them, and at the next boot the
    // cloud's category list answers instead: the category is not there, and
    // neither is the filing of those three rows. That is money mis-filed, by a
    // list of words. So the read stays ungated and the writes refuse, and
    // making the two "consistent" in either direction breaks one of them.
    this.guardCloudWrite();

    const created: Category = { ...category, id: this.generateId() };
    const categories = await this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
    await this.persistCollection(STORAGE_KEYS.CATEGORIES, [...categories, created]);
    return created;
  }

  /**
   * Create several categories at once — the tree import's operation.
   *
   * THE EMPTY CHECK COMES FIRST, BEFORE THE OWNER IS EVEN ASKED FOR, and that
   * order is the behaviour rather than an optimisation: an import that adds
   * detail to a tree the account already has plans no new groups at all and asks
   * anyway, because the plan is computed before it is known to be empty. Nothing
   * is written, nothing is read, and no insert with no rows is sent.
   *
   * Otherwise the same branch as `createCategory` above, the same reason the
   * cloud half is delegated rather than copied, and the same pending-session
   * refusal — which the empty check still precedes, because refusing to write
   * nothing would be an error message about a write nobody asked for.
   */
  async createCategories(newCategories: Array<Omit<Category, 'id'>>): Promise<Category[]> {
    if (newCategories.length === 0) {
      return [];
    }

    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.planningService.createCategories(userId, newCategories);
    }
    this.guardCloudWrite();

    const created: Category[] = newCategories.map(category => ({
      ...category,
      id: this.generateId()
    }));
    const categories = await this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
    await this.persistCollection(STORAGE_KEYS.CATEGORIES, [...categories, ...created]);
    return created;
  }

  /**
   * Change a category, and hand back the whole category as it now stands — the
   * caller replaces its copy with this answer, so a partial one would blank
   * whatever it left out.
   *
   * Same branch, same owner rule and same pending-session refusal as
   * `createCategory` above. A category that is not there is refused by name,
   * and because the lookup happens before the first write the refusal leaves
   * the store exactly as it was.
   *
   * No timestamp is stamped, unlike the budget and goal updates beside it: a
   * Category carries none. Inventing one here would put a field on half the
   * user's list that the other half does not have.
   */
  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.planningService.updateCategory(userId, id, updates);
    }
    this.guardCloudWrite();

    const categories = await this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
    const index = categories.findIndex(category => category.id === id);
    if (index === -1) throw new Error('Category not found');

    const updated: Category = { ...categories[index], ...updates };
    await this.persistCollection(
      STORAGE_KEYS.CATEGORIES,
      categories.map((category, position) => (position === index ? updated : category))
    );
    return updated;
  }

  /**
   * Remove a category and the categories under it.
   *
   * Same branch, same owner rule and same pending-session refusal as the writes
   * above. THE CASCADE IS THE BEHAVIOUR, not a detail of the cloud's foreign
   * key: the local branch drops children by `parentId` exactly as `ON DELETE
   * CASCADE` does server-side, so a group cannot outlive itself as a set of
   * orphans whose parent is gone.
   *
   * Deleting one that is already gone writes the list back unchanged, which is
   * the same silence the budget and goal deletes keep.
   */
  async deleteCategory(id: string): Promise<void> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.planningService.deleteCategory(userId, id);
    }
    this.guardCloudWrite();

    const categories = await this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
    await this.persistCollection(
      STORAGE_KEYS.CATEGORIES,
      categories.filter(category => category.id !== id && category.parentId !== id)
    );
  }

  /**
   * Prune a batch of categories nothing is filed against.
   *
   * Empty first, for the reason `createCategories` above gives — and the
   * pending-session refusal sits after it there for the same reason. Then the
   * same branch, and the same delegation of the cloud half — which here is
   * doing more than caching: the RPC re-judges every row against the ledger as
   * it is NOW, so a plan computed from a stale snapshot can never destroy
   * referenced data, and it may therefore delete FEWER rows than it was handed.
   *
   * THE COUNT IS WHAT ACTUALLY WENT, in both modes. Locally that is the size of
   * the list before minus the size after — which is not the same as the number
   * of ids supplied in either direction: an id naming nothing removes nothing,
   * and an id naming a parent removes its children too. The caller shows this
   * figure to the user ("pruned 40, kept 12 in use"), so returning the size of
   * the request would be a guess presented as a fact.
   */
  async deleteUnusedCategories(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker()) {
      return this.planningService.deleteUnusedCategories(userId, ids);
    }
    this.guardCloudWrite();

    const categories = await this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
    const doomed = new Set(ids);
    const remaining = categories.filter(
      category => !doomed.has(category.id) && !doomed.has(category.parentId ?? '')
    );
    await this.persistCollection(STORAGE_KEYS.CATEGORIES, remaining);
    return categories.length - remaining.length;
  }

  /**
   * What is stored, and nothing more. The boot does not use this — it uses
   * `prepareCategories` below, which is allowed to seed and to migrate. This
   * one stays local-only and gated because it answers "what is in the browser's
   * copy", which is a question the cloud has no part in.
   */
  async listCategories(): Promise<Category[]> {
    if (this.isCloudSessionPending()) return [];
    return this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
  }

  /**
   * The categories the ledger is about to be read through.
   *
   * ORDERING IS LOAD-BEARING — this must resolve before any transaction or
   * budget read. The cloud branch runs the one-time id migration
   * (`migrate_categories_atomic`: per-user uuids for the categories AND the
   * remap of every transaction and budget that referenced the old ids, in one
   * database transaction), so rows read before it lands carry ids that are
   * about to stop existing. The full rule, and why it binds implementations
   * this class knows nothing about, is on `DataPortLifecycle.prepareCategories`.
   */
  async prepareCategories(): Promise<Category[]> {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (userId && this.supabaseChecker() && this.planningService.ensureCategories) {
      return this.planningService.ensureCategories(userId);
    }

    // NO `isCloudSessionPending()` GUARD HERE. That is deliberate, it is the
    // only read on this class without one, and it must stay that way.
    //
    // The gate exists to stop a signed-in view being served another store's
    // MONEY — demo accounts, an old import's transactions, somebody else's
    // budgets. A category list is not money. It is the set of NAMES rows are
    // filed under, and this browser's copy is the very list the account's own
    // copy was migrated from, so serving it costs nothing and hides nothing.
    //
    // What it buys: a session whose database id has not resolved yet still
    // knows what its categories are called. Gate it "for consistency" and that
    // boot renders a register of blank category cells and an empty category
    // filter for however long the id takes — for the sake of withholding a list
    // of words. The retired boot called `ensureCategories(null)` at exactly
    // this point and got exactly this behaviour; keeping it is the reason this
    // routing change is invisible to the person using it.
    //
    // AND IT STOPS HERE. This exception covers this READ and nothing else: the
    // five category WRITES all refuse a pending session, and the comment beside
    // `createCategory`'s guard says why serving a name is not the same trade as
    // minting an id. The asymmetry is the point, not an oversight to tidy.
    const local = await this.readCollection<Category>(STORAGE_KEYS.CATEGORIES);
    return local.length > 0 ? local : getDefaultCategories();
  }

  private async updateAccountBalance(accountId: string, amount: number): Promise<void> {
    if (this.isSupabaseReady()) {
      // Cloud mode: balances are adjusted atomically inside the Postgres RPCs
      // (create/update/delete_transaction_atomic) — never in JS.
      return;
    }

    const accounts = await this.readCollection<Account>(STORAGE_KEYS.ACCOUNTS);
    const account = accounts.find(a => a.id === accountId);
    if (account) {
      // Decimal arithmetic — IEEE-754 float math is banned on money values.
      account.balance = toDecimal(account.balance || 0).plus(toDecimal(amount)).toNumber();
      await this.persistCollection(STORAGE_KEYS.ACCOUNTS, accounts);
    }
  }

  subscribeToUpdates(callbacks: {
    onAccountUpdate?: (payload: unknown) => void;
    onTransactionUpdate?: (payload: unknown) => void;
  }): () => void {
    const userId = this.userIdService.getCurrentDatabaseUserId();
    if (!userId || !this.supabaseChecker()) {
      return () => {};
    }

    const unsubscribers: Array<() => void> = [];

    if (callbacks.onAccountUpdate && this.accountService.subscribeToAccounts) {
      unsubscribers.push(this.accountService.subscribeToAccounts(userId, callbacks.onAccountUpdate));
    }

    if (callbacks.onTransactionUpdate && this.transactionService.subscribeToTransactions) {
      unsubscribers.push(this.transactionService.subscribeToTransactions(userId, callbacks.onTransactionUpdate));
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }

  /**
   * What this implementation can do — the answer that replaced four separate
   * readings of one boolean.
   *
   * Every field below is computed from `isSupabaseReady()` (a database id is
   * resolved AND a client is configured) or from the pending state beside it,
   * which is why one descriptor could retire `isUsingSupabase` without changing
   * a single answer: the batch size, the realtime gate, the backup target and
   * the copy on two screens were all asking that same predicate in four
   * different vocabularies. What changes is that each now says what it is FOR,
   * so an implementation that is neither Supabase nor a browser can answer them
   * independently — a device edition with a sync peer says `realtime: true`
   * without claiming to be a login.
   *
   * SYNCHRONOUS AND UNCACHED. Every caller is a render or the tick of a write,
   * and `session` in particular changes underneath them as a sign-in completes;
   * a cached descriptor would be a boot-time photograph of a value that moves.
   * Nothing here does I/O — two booleans and an in-memory id — so re-asking is
   * cheaper than remembering.
   */
  capabilities(): DataPortCapabilities {
    const ready = this.isSupabaseReady();
    return {
      edition: ready ? 'cloud' : 'device',
      // The pending state is checked FIRST because it is the one that is not
      // safe to work in: a signed-in session with no database id yet is not
      // 'anonymous' — treating it as such is exactly how a write ends up in a
      // browser store the signed-in app will never read again.
      session: this.isCloudSessionPending()
        ? 'connecting'
        : (this.userIdService.getCurrentDatabaseUserId() ? 'ready' : 'anonymous'),
      realtime: ready,
      // 8 in the cloud, where each write is an independent request; 1 on a
      // store that re-reads and re-persists a whole collection per write, where
      // two in flight is a lost-update race. Stated on the seam so the caller
      // no longer has to know which engine it is talking to in order to loop
      // safely over a few thousand rows.
      maxConcurrentWrites: ready ? 8 : 1,
      backupTarget: ready ? 'login' : 'device',
      // The one field on this descriptor that is not derived from `ready` alone
      // — it is derived from which STORE is answering, which happens to be the
      // same predicate today and is a different question. A login holds every
      // table the backup format carries, because the format was read off the
      // database; the browser's store holds seven of the fourteen. See
      // `BROWSER_CANNOT_KEEP`.
      cannotKeep: ready ? [] : BROWSER_CANNOT_KEEP
    };
  }
}

let defaultDataService = new DataServiceImpl();

export class DataService {
  static configure(options: DataServiceOptions = {}) {
    defaultDataService = new DataServiceImpl(options);
  }

  private static get service(): DataServiceImpl {
    return defaultDataService;
  }

  static initialize(clerkId: string, email: string, firstName?: string, lastName?: string): Promise<void> {
    return this.service.initialize(clerkId, email, firstName, lastName);
  }

  static listClosedAccounts(): Promise<Account[]> {
    return this.service.listClosedAccounts();
  }

  static loadBoot(): Promise<BootSnapshot> {
    return this.service.loadBoot();
  }

  static listAccounts(): Promise<Account[]> {
    return this.service.listAccounts();
  }

  static createAccount(account: Omit<Account, 'id'>): Promise<Account> {
    return this.service.createAccount(account);
  }

  static updateAccount(id: string, updates: AccountUpdate): Promise<Account> {
    return this.service.updateAccount(id, updates);
  }

  static closeAccount(id: string): Promise<void> {
    return this.service.closeAccount(id);
  }

  static listTransactions(): Promise<Transaction[]> {
    return this.service.listTransactions();
  }

  static loadBootTransactions(): Promise<BootTransactionsResult> {
    return this.service.loadBootTransactions();
  }

  static getAccountBalances(): Promise<ReadonlyMap<string, AccountBalanceSnapshot>> {
    return this.service.getAccountBalances();
  }

  static createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    return this.service.createTransaction(transaction);
  }

  static updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    return this.service.updateTransaction(id, updates);
  }

  static deleteTransaction(id: string): Promise<void> {
    return this.service.deleteTransaction(id);
  }

  static setTransactionsCleared(ids: string[], cleared: boolean): Promise<number> {
    return this.service.setTransactionsCleared(ids, cleared);
  }

  static finalizeReconciliation(
    accountId: string,
    endingBalance: number,
    reconciledOn: Date
  ): Promise<ReconciliationOutcome> {
    return this.service.finalizeReconciliation(accountId, endingBalance, reconciledOn);
  }

  static applyCategoryToUncategorized(ids: string[], category: string): Promise<number> {
    return this.service.applyCategoryToUncategorized(ids, category);
  }

  static confirmTransactionCategories(ids: string[]): Promise<number> {
    return this.service.confirmTransactionCategories(ids);
  }

  static importTransactions(
    accountId: string,
    transactions: ReadonlyArray<Omit<Transaction, 'id'>>,
    options?: {
      onProgress?: (progress: BulkImportProgress) => void;
      source?: ImportSourceKind;
    }
  ): Promise<BulkImportResult> {
    return this.service.importTransactions(accountId, transactions, options);
  }

  static financialDataIsEmpty(): Promise<boolean> {
    return this.service.financialDataIsEmpty();
  }

  static collectBackup(options?: {
    onProgress?: (progress: ExportProgress) => void;
  }): Promise<BackupBundle> {
    return this.service.collectBackup(options);
  }

  static restoreBackup(
    bundle: BackupBundle,
    options?: { onProgress?: (progress: RestoreProgress) => void }
  ): Promise<BackupRestoreOutcome> {
    return this.service.restoreBackup(bundle, options);
  }

  static wipeAllFinancialData(
    options?: { onProgress?: (progress: WipeProgress) => void }
  ): Promise<void> {
    return this.service.wipeAllFinancialData(options);
  }

  static importMsMoney(
    result: MsMoneyImportResult,
    options?: { onProgress?: (progress: ImportProgress) => void }
  ): Promise<void> {
    return this.service.importMsMoney(result, options);
  }

  static archiveTransactionsBefore(accountId: string, cutoff: Date): Promise<number> {
    return this.service.archiveTransactionsBefore(accountId, cutoff);
  }

  static unarchiveAccount(accountId: string): Promise<number> {
    return this.service.unarchiveAccount(accountId);
  }

  static listTransactionSplits(): Promise<TransactionSplit[]> {
    return this.service.listTransactionSplits();
  }

  static linkTransferPair(idA: string, idB: string): Promise<{ a: Transaction; b: Transaction }> {
    return this.service.linkTransferPair(idA, idB);
  }

  static linkSplitLineTransfer(
    splitId: string,
    transactionId: string
  ): Promise<{ split: TransactionSplit; transaction: Transaction }> {
    return this.service.linkSplitLineTransfer(splitId, transactionId);
  }

  static unlinkTransfers(ids: string[]): Promise<number> {
    return this.service.unlinkTransfers(ids);
  }

  static setTransactionArchived(id: string, archived: boolean): Promise<void> {
    return this.service.setTransactionArchived(id, archived);
  }

  static repairClaimedTransfer(
    strandedId: string,
    counterpartId: string,
    partnerId: string,
    adjustmentCategoryId: string
  ): Promise<{ stranded: Transaction; counterpart: Transaction; partner: Transaction }> {
    return this.service.repairClaimedTransfer(
      strandedId, counterpartId, partnerId, adjustmentCategoryId
    );
  }

  static createTransferCounterpart(
    id: string,
    targetAccountId: string
  ): Promise<{ source: Transaction; counterpart: Transaction }> {
    return this.service.createTransferCounterpart(id, targetAccountId);
  }

  static repointTransfer(
    id: string,
    targetAccountId: string,
    disposition?: TransferDisplacedDisposition
  ): Promise<TransferRepointResult> {
    return this.service.repointTransfer(id, targetAccountId, disposition);
  }

  static listTransactionSplitsFor(transactionId: string): Promise<TransactionSplit[]> {
    return this.service.listTransactionSplitsFor(transactionId);
  }

  static setTransactionSplits(
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: number | null
  ): Promise<SplitWriteResult> {
    return this.service.setTransactionSplits(transactionId, splits, expectedAmount);
  }

  static mergeCategories(sourceId: string, targetId: string): Promise<CategoryMergeResult> {
    return this.service.mergeCategories(sourceId, targetId);
  }

  static listSuggestionDismissals(): Promise<SuggestionDismissal[]> {
    return this.service.listSuggestionDismissals();
  }

  static dismissSuggestion(
    kind: DismissalKind,
    subjectKey: string,
    subjectIds: string[]
  ): Promise<SuggestionDismissal> {
    return this.service.dismissSuggestion(kind, subjectKey, subjectIds);
  }

  static restoreSuggestion(kind: DismissalKind, subjectKey: string): Promise<void> {
    return this.service.restoreSuggestion(kind, subjectKey);
  }

  static listBudgets(): Promise<Budget[]> {
    return this.service.listBudgets();
  }

  static createBudget(budget: Omit<Budget, 'id' | 'spent'>): Promise<Budget> {
    return this.service.createBudget(budget);
  }

  static updateBudget(id: string, updates: Partial<Budget>): Promise<Budget> {
    return this.service.updateBudget(id, updates);
  }

  static deleteBudget(id: string): Promise<void> {
    return this.service.deleteBudget(id);
  }

  static listGoals(): Promise<Goal[]> {
    return this.service.listGoals();
  }

  static createGoal(goal: Omit<Goal, 'id' | 'progress'>): Promise<Goal> {
    return this.service.createGoal(goal);
  }

  static updateGoal(id: string, updates: Partial<Goal>): Promise<Goal> {
    return this.service.updateGoal(id, updates);
  }

  static deleteGoal(id: string): Promise<void> {
    return this.service.deleteGoal(id);
  }

  static listCustomReports(): Promise<CustomReport[]> {
    return this.service.listCustomReports();
  }

  static listForecastAdjustments(): Promise<ForecastAdjustment[]> {
    return this.service.listForecastAdjustments();
  }

  static setForecastAdjustment(categoryId: string, monthlyMinor: number): Promise<ForecastAdjustment> {
    return this.service.setForecastAdjustment(categoryId, monthlyMinor);
  }

  static clearForecastAdjustment(categoryId: string): Promise<void> {
    return this.service.clearForecastAdjustment(categoryId);
  }

  static createCustomReport(report: Omit<CustomReport, 'id'>): Promise<CustomReport> {
    return this.service.createCustomReport(report);
  }

  static updateCustomReport(id: string, updates: Partial<CustomReport>): Promise<CustomReport> {
    return this.service.updateCustomReport(id, updates);
  }

  static deleteCustomReport(id: string): Promise<void> {
    return this.service.deleteCustomReport(id);
  }

  static listInvestments(): Promise<InvestmentHolding[]> {
    return this.service.listInvestments();
  }

  static createInvestment(draft: InvestmentDraft): Promise<InvestmentHolding> {
    return this.service.createInvestment(draft);
  }

  static updateInvestment(id: string, changes: InvestmentChanges): Promise<InvestmentHolding> {
    return this.service.updateInvestment(id, changes);
  }

  static deleteInvestment(id: string): Promise<void> {
    return this.service.deleteInvestment(id);
  }

  static applyInvestmentPrices(quotes: readonly QuoteWriteback[]): Promise<number> {
    return this.service.applyInvestmentPrices(quotes);
  }

  static importInvestmentPriceHistory(
    rows: readonly { symbol: string; date: string; price: string; currency: string }[]
  ): Promise<number> {
    return this.service.importInvestmentPriceHistory(rows);
  }

  static listInvestmentPrices(
    symbol: string
  ): Promise<Array<{ date: string; price: string; source: 'quote' | 'manual' | 'trade' | 'import' }>> {
    return this.service.listInvestmentPrices(symbol);
  }

  static recordInvestmentPrice(
    entry: { symbol: string; date: string; price: string; currency: string }
  ): Promise<void> {
    return this.service.recordInvestmentPrice(entry);
  }

  static importInvestmentEvents(rows: readonly InvestmentEventDraft[]): Promise<number> {
    return this.service.importInvestmentEvents(rows);
  }

  static listInvestmentEvents(accountId: string): Promise<InvestmentEvent[]> {
    return this.service.listInvestmentEvents(accountId);
  }

  static listAllInvestmentEvents(): Promise<InvestmentEvent[]> {
    return this.service.listAllInvestmentEvents();
  }

  static recordInvestmentEvent(draft: Omit<InvestmentEventDraft, 'sourceRef'>): Promise<void> {
    return this.service.recordInvestmentEvent(draft);
  }

  static moveInvestmentEventDate(eventId: string, newDate: string): Promise<{ previousDate: string }> {
    return this.service.moveInvestmentEventDate(eventId, newDate);
  }

  static deleteInvestmentEvent(eventId: string): Promise<{
    date: string; kind: 'buy' | 'sell' | 'write_off'; quantity: string; amount: string; symbol: string | null;
  }> {
    return this.service.deleteInvestmentEvent(eventId);
  }

  static recordTradePrices(
    rows: readonly { symbol: string; date: string; price: string; currency: string }[]
  ): Promise<number> {
    return this.service.recordTradePrices(rows);
  }

  static deleteInvestmentEvents(accountId: string, symbol: string): Promise<void> {
    return this.service.deleteInvestmentEvents(accountId, symbol);
  }

  static listAllInvestmentPrices(): Promise<
    Array<{ symbol: string; date: string; price: string; currency: string }>
  > {
    return this.service.listAllInvestmentPrices();
  }

  static createCategory(category: Omit<Category, 'id'>): Promise<Category> {
    return this.service.createCategory(category);
  }

  static createCategories(categories: Array<Omit<Category, 'id'>>): Promise<Category[]> {
    return this.service.createCategories(categories);
  }

  static updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    return this.service.updateCategory(id, updates);
  }

  static deleteCategory(id: string): Promise<void> {
    return this.service.deleteCategory(id);
  }

  static deleteUnusedCategories(ids: string[]): Promise<number> {
    return this.service.deleteUnusedCategories(ids);
  }

  static listCategories(): Promise<Category[]> {
    return this.service.listCategories();
  }

  static prepareCategories(): Promise<Category[]> {
    return this.service.prepareCategories();
  }

  static subscribeToUpdates(callbacks: {
    onAccountUpdate?: (payload: unknown) => void;
    onTransactionUpdate?: (payload: unknown) => void;
  }): () => void {
    return this.service.subscribeToUpdates(callbacks);
  }

  static capabilities(): DataPortCapabilities {
    return this.service.capabilities();
  }
}

export const createDataService = (options: DataServiceOptions = {}) => new DataServiceImpl(options);
