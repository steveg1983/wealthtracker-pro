/**
 * The data seam.
 *
 * One interface between the app and whatever holds its ledger. Today the only
 * implementation is the cloud/browser-storage pair inside DataService; the
 * point of naming it is that a second implementation (the local edition, which
 * keeps everything on the device) can be written against this file and proved
 * against the same contract suite — `__tests__/contract.ts` — without the app
 * above learning which one it is talking to.
 *
 * TYPES ONLY. This module emits nothing: an interface is erased at build, so
 * naming the seam costs zero bytes and cannot itself change behaviour.
 *
 * ── The five rules that bind every operation ──────────────────────────────
 *
 * 1. IDENTITY IS INTERNAL. No operation takes a user id. Every implementation
 *    resolves the owner itself. This is what stops "which user?" leaking into
 *    components, and it is why the local edition can supply a device-local
 *    owner without a single caller changing.
 *
 * 2. MONEY CROSSES AS `MoneyNumber` (see below) and is only ever moved with
 *    Decimal arithmetic inside an implementation. Float arithmetic on a
 *    balance is banned on both sides of this seam.
 *
 * 3. DATES CROSS AS THE APP SPELLS THEM — a `Date` where the app holds a
 *    `Date`, a 'YYYY-MM-DD' string where the app deliberately holds a calendar
 *    day (see `Account.bankBalanceDate`). Conversion belongs to the
 *    implementation, and where two implementations convert differently that is
 *    a declared divergence, not an accident (D-8).
 *
 * 4. ERRORS ARE `Error`, AND `.message` IS USER-FACING PROSE. The app renders
 *    `error.message` straight into the UI in ~28 places, so the wording of the
 *    refusals the contract suite names is part of this contract. An
 *    implementation MAY attach a machine code alongside; no caller may branch
 *    on one.
 *
 * 5. READS AND WRITES ARE SEPARATE GROUPS. A local implementation is expected
 *    to serve reads and writes through different mechanisms, so the split is
 *    load-bearing rather than tidiness.
 *
 * ── Scope ────────────────────────────────────────────────────────────────
 *
 * This is the seam as it stands, not as it will end: the operations below are
 * exactly the ones DataService owns today, under the names it uses today.
 * Planning writes (budgets/goals/categories, which still bypass to
 * PlanningService), bulk import, backup/restore/wipe, and the capability
 * descriptor that will retire `isUsingSupabase` all join this interface as
 * their consumers are routed through it. The names here are today's names
 * deliberately: renaming and re-routing in one step would make a rename
 * indistinguishable from a behaviour change in review.
 */

import type {
  Account,
  AccountUpdate,
  Budget,
  Category,
  CategoryMergeResult,
  DismissalKind,
  Goal,
  SplitWriteResult,
  SuggestionDismissal,
  Transaction,
  TransactionSplit,
  TransactionSplitInput
} from '../../types';

/**
 * An amount of money, exactly representable at two decimal places.
 *
 * The app's own types say `number`, so the seam says `number` — widening that
 * to a decimal type is a rewrite of every arithmetic site, not a seam. The
 * alias exists to carry the rule that the plain type cannot:
 *
 * - An implementation MUST serialise it as a fixed two-place decimal string,
 *   never as a raw JSON number, when it crosses a process or wire boundary.
 * - **Divergence M-1**: a value with more than two decimal places is kept
 *   verbatim by browser storage, silently rounded by a `numeric(20,2)` column,
 *   and refused outright by the local core. No caller may rely on any of the
 *   three; the contract suite asserts the engine-appropriate outcome so that
 *   the difference is recorded rather than discovered.
 */
export type MoneyNumber = number;

/**
 * Where a boot's transactions came from.
 *
 * This is diagnostic, not decorative: it is printed on the boot-timing console
 * line, and it exists because a 200ms boot that hydrated a stale snapshot and a
 * 200ms boot that fetched nothing because nothing had changed look identical
 * otherwise — and the next slowness report would then start from a lie.
 *
 * `total` is the number of rows actually handed to the app, so it must agree
 * with the array beside it in every implementation. `fullFetchReason` is null
 * ONLY when a cached path really was used; an implementation that has no cache
 * says so in words rather than leaving it null.
 */
export interface BootTransactionStats {
  /** Rows served from a local snapshot; 0 when everything came over the wire. */
  cached: number;
  /** Rows this load pulled over the network. */
  fetched: number;
  /** Rows handed to the app. */
  total: number;
  /** Why no snapshot was used, in words, or null when one was. */
  fullFetchReason: string | null;
}

export interface BootTransactionsResult {
  transactions: Transaction[];
  stats: BootTransactionStats;
}

/**
 * One account's balance as the STORE itself computes it — the same invariant
 * the client uses (opening balance + Σ amounts), evaluated where the rows
 * already are.
 */
export interface AccountBalanceSnapshot {
  balance: MoneyNumber;
  txnCount: number;
}

/**
 * Reads. None of them take a filter: the app loads its ledger and does its own
 * filtering in memory, and pretending otherwise here would invent a query
 * language that no implementation actually has.
 */
export interface DataPortReads {
  getAccounts(): Promise<Account[]>;
  /** Closed accounts are excluded from `getAccounts` and read on demand. */
  getClosedAccounts(): Promise<Account[]>;
  getTransactions(): Promise<Transaction[]>;
  /**
   * The boot's transaction read, which is a different question from
   * `getTransactions`: that one always wants a straight re-pull (bank sync,
   * real-time refresh), this one is allowed to serve a local snapshot and ask
   * only for what changed, and must report which it did.
   *
   * **NEVER REJECTS.** The boot effect that calls this has ONE outer catch, and
   * reaching it puts a full-page "Failed to load data" in front of somebody
   * whose ledger is fine. Every failure here — no network, an unreadable
   * snapshot, a store that will not open — resolves as an empty list with the
   * reason stated in `stats.fullFetchReason`. An implementation that wants to
   * shout about a failure logs it; it does not throw it at the boot.
   *
   * **Divergence B-1**: browser storage has no snapshot layer and always says
   * 'local mode'; the cloud serves snapshot+delta and says null when the
   * snapshot stood; the local core reads its one store and honestly says
   * 'local mode' too. The ROW SET is the same question in all three — the
   * stats are how they differ, which is why they are reported and not asserted
   * equal.
   */
  loadBootTransactions(): Promise<BootTransactionsResult>;
  /**
   * Every account's balance in one answer, computed where the rows live.
   *
   * Purely an optimisation for the seconds a long history is in flight: until
   * the first page of transactions lands, every client-side ledger sum is just
   * the opening balance, and these figures let the dashboard open on real money
   * instead of zeros. The client sum is the source of truth and wins back the
   * moment any transaction is present.
   *
   * **NEVER REJECTS, AND NEVER GUESSES.** An empty map means "I don't know" and
   * the app falls back to its own sum. Returning zeros instead would be a
   * guess, and a wrong one: the seeding rule keys off the map being non-empty,
   * so a map of zeros would paint every account at £0.00 and call it real
   * money.
   *
   * **Divergence B-2**: browser storage returns an empty map (it has no second
   * engine to ask); the cloud answers from one RPC that usually lands BEFORE
   * the transactions do, which is the whole point of it; a local core may
   * answer synchronously, closing that window to nothing. All three must agree
   * to the penny with opening balance + Σ amounts once the rows are in.
   */
  getAccountBalances(): Promise<ReadonlyMap<string, AccountBalanceSnapshot>>;
  /** Every split line the owner has, for category aggregation. */
  getAllTransactionSplits(): Promise<TransactionSplit[]>;
  /** One transaction's lines, in display order (`sortOrder`), empty when not split. */
  getTransactionSplits(transactionId: string): Promise<TransactionSplit[]>;
  getBudgets(): Promise<Budget[]>;
  getGoals(): Promise<Goal[]>;
  getCategories(): Promise<Category[]>;
  getSuggestionDismissals(): Promise<SuggestionDismissal[]>;
}

export interface DataPortAccountWrites {
  createAccount(account: Omit<Account, 'id'>): Promise<Account>;
  updateAccount(id: string, updates: AccountUpdate): Promise<Account>;
  /**
   * A SOFT close, in every implementation: the account leaves the live list
   * and its transactions stay exactly where they are. Nothing in this seam
   * hard-deletes an account, because a deleted account is a hole in a ledger.
   */
  deleteAccount(id: string): Promise<void>;
}

export interface DataPortTransactionWrites {
  createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction>;
  /**
   * A partial update of the fields a row's own editor owns.
   *
   * **Divergence D-7**: only these fifteen are honoured by the cloud
   * implementation — `description, amount, type, date, accountId, category,
   * categoryConfirmed, notes, tags, isRecurring, cleared, transferAccountId,
   * metadata, categoryId, merchantName`. Anything else is silently discarded
   * there, silently applied by browser storage, and refused by name by the
   * local core. Callers must send only those fifteen: every field outside the
   * list has a dedicated operation on this interface, and the dedicated
   * operation is the contract (archiving is `setTransactionArchived`, linking
   * is the transfer group, splitting is `setTransactionSplits`).
   */
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  /** Bulk reconciliation flag. Balance-neutral by definition. Returns rows touched. */
  setTransactionsCleared(ids: string[], cleared: boolean): Promise<number>;
  /** Fill-blanks only: rows that already carry a category are left alone. */
  applyCategoryToUncategorized(ids: string[], category: string): Promise<number>;
  /** Agree with a suggested category; one boolean, never the category itself. */
  confirmTransactionCategories(ids: string[]): Promise<number>;
  /** Soft-archive one row: hidden from the register, never deleted, reversible. */
  setTransactionArchived(id: string, archived: boolean): Promise<void>;
  /**
   * Archive an account's reconciled rows up to and including a cutoff day, and
   * stamp the account with it.
   *
   * **Divergence D-8**: the cutoff is a `Date` here because that is what the
   * caller holds, but "which calendar day" is answered differently by the
   * implementations — the cloud path converts through UTC, browser storage
   * compares the instants directly, and the local core validates a
   * 'YYYY-MM-DD' string it is handed. West of Greenwich those can name
   * different days for the same instant. Callers should pass a cutoff whose
   * day is unambiguous.
   */
  archiveTransactionsBefore(accountId: string, cutoff: Date): Promise<number>;
  /** Bring an account's archived rows back into the register. Returns rows touched. */
  unarchiveAccount(accountId: string): Promise<number>;
}

export interface DataPortTransferWrites {
  /**
   * Join two existing rows as the two halves of one transfer. Balance-neutral:
   * no amount moves, only the link and the categories that name each side.
   */
  linkTransferPair(idA: string, idB: string): Promise<{ a: Transaction; b: Transaction }>;
  /**
   * Join one LINE of a split to an existing row. Amounts are compared against
   * the line, never against the split's parent — the parent's total includes
   * the other lines and is supposed to differ.
   */
  linkSplitLineTransfer(
    splitId: string,
    transactionId: string
  ): Promise<{ split: TransactionSplit; transaction: Transaction }>;
  /** Break links on the named rows. Returns how many were actually unlinked. */
  unlinkTransfers(ids: string[]): Promise<number>;
  /**
   * Re-pair a counterpart onto the row that really matches it, filing the row
   * it displaces under an adjustment category. All-or-nothing: three rows
   * change together or none do.
   */
  repairClaimedTransfer(
    strandedId: string,
    counterpartId: string,
    partnerId: string,
    adjustmentCategoryId: string
  ): Promise<{ stranded: Transaction; counterpart: Transaction; partner: Transaction }>;
  /** Create the other side of a transfer in the target account, and link it. */
  createTransferCounterpart(
    id: string,
    targetAccountId: string
  ): Promise<{ source: Transaction; counterpart: Transaction }>;
}

export interface DataPortSplitWrites {
  /**
   * Replace a transaction's split lines atomically; an empty array un-splits
   * it. All-or-nothing in every implementation: a refusal leaves the store
   * exactly as it was, including when a line of the incoming set is one half
   * of a transfer.
   *
   * Which server path a payload needs — plain replace, or the one that matches
   * lines by id so a leg can survive an edit beside it — is the
   * implementation's decision, not the caller's.
   */
  setTransactionSplits(
    transactionId: string,
    splits: TransactionSplitInput[],
    expectedAmount: MoneyNumber | null
  ): Promise<SplitWriteResult>;
}

export interface DataPortPlanningWrites {
  /**
   * Move every reference from one category to another, then remove the source.
   * All-or-nothing, and the refusals are ordered: the source is judged before
   * the target, because that is the order the user is asked to think in.
   */
  mergeCategories(sourceId: string, targetId: string): Promise<CategoryMergeResult>;
}

export interface DataPortDismissalWrites {
  /**
   * Record that the user does not want a suggestion offered again. Idempotent:
   * refusing something already refused returns the existing record, so a
   * double-click cannot turn a decision into an error message.
   */
  dismissSuggestion(
    kind: DismissalKind,
    subjectKey: string,
    subjectIds: string[]
  ): Promise<SuggestionDismissal>;
  /** Undo a refusal; the suggestion is offered again from the next scan. */
  restoreSuggestion(kind: DismissalKind, subjectKey: string): Promise<void>;
}

export interface DataPortLifecycle {
  /**
   * Make sure the signed-in person has a store to read. A no-op for an
   * implementation that has no accounts to reconcile.
   */
  initialize(clerkId: string, email: string, firstName?: string, lastName?: string): Promise<void>;
  /**
   * The categories the ledger is about to be read through — and, where an
   * implementation needs one, the one-time migration that has to finish first.
   *
   * Lifecycle rather than a read, and the distinction is the whole point:
   * `getCategories` asks what is stored, this one is allowed to CHANGE what is
   * stored.
   *
   * **ORDERING IS LOAD-BEARING. This must resolve before any transaction or
   * budget read.** On its first signed-in load the cloud implementation runs
   * `migrate_categories_atomic`, which gives every category a per-user uuid AND
   * remaps the category references on transactions and budgets — one database
   * transaction, both halves together. Rows read before that lands carry the
   * OLD ids, so an app that read them first would sit there holding a register
   * whose every row points at a category that no longer exists: blank category
   * cells, empty budgets, nothing broken enough to throw. Any implementation
   * that renumbers anything inherits the same rule, which is why it is written
   * here rather than at the one call site that has to obey it.
   *
   * NEVER EMPTY. A ledger with no categories has nowhere to file anything, and
   * the boot does not ask twice: whatever comes back IS the list the register,
   * the budgets page and every filter are built from. An implementation with
   * nothing stored answers with its default set.
   *
   * **Divergence B-4**: browser storage returns what is stored, or the defaults
   * unwritten; the cloud returns its rows, or migrates the browser's list into
   * per-user ids and remaps every reference to it; the local core seeds its
   * defaults into the store on first use and never has anything to remap.
   */
  prepareCategories(): Promise<Category[]>;
  /**
   * Watch for changes made somewhere else. An implementation with no other
   * device to hear from returns a no-op unsubscribe, which is what the caller
   * already handles.
   */
  subscribeToUpdates(callbacks: {
    onAccountUpdate?: (payload: unknown) => void;
    onTransactionUpdate?: (payload: unknown) => void;
  }): () => void;
}

/** The whole seam as it stands. */
export interface DataPort extends
  DataPortReads,
  DataPortAccountWrites,
  DataPortTransactionWrites,
  DataPortTransferWrites,
  DataPortSplitWrites,
  DataPortPlanningWrites,
  DataPortDismissalWrites,
  DataPortLifecycle {}
