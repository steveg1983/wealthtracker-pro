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
 * Reads. None of them take a filter: the app loads its ledger and does its own
 * filtering in memory, and pretending otherwise here would invent a query
 * language that no implementation actually has.
 */
export interface DataPortReads {
  getAccounts(): Promise<Account[]>;
  /** Closed accounts are excluded from `getAccounts` and read on demand. */
  getClosedAccounts(): Promise<Account[]>;
  getTransactions(): Promise<Transaction[]>;
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
