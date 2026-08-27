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
 * exactly the ones DataService owns today. HOLDINGS joined at slice 31 and were
 * the last region of the data layer outside it — the Investments page called
 * `services/api/investmentService` and a Supabase client directly, which is the
 * measurement `src/desktop/routes.ts` recorded as the reason its route could not
 * be mounted in a window. Bulk import has joined it (the CSV
 * and OFX importers write through `importTransactions`), and so have the
 * backup, the emptiness check, the restore, the wipe and the Microsoft Money
 * migration. The capability descriptor has joined too, and with it went the
 * last question the app asked about its engine BY NAME: nothing above this
 * file says `isUsingSupabase` any more.
 *
 * ── The names ────────────────────────────────────────────────────────────
 *
 * Every operation carried DataService's own name while the app was being moved
 * onto this file, deliberately: renaming and re-routing in one step would have
 * made a rename indistinguishable from a behaviour change in review. The
 * re-routing is finished, so the names below are the seam's own, and they
 * follow two rules an implementation is expected to keep:
 *
 * `list…` ENUMERATES — every row of one kind this store holds, or every row of
 * one kind belonging to one parent, and then `…For` names the parent. That
 * suffix is what stops `listTransactionSplits` (all of them, for category
 * aggregation) and `listTransactionSplitsFor` (one transaction's lines) from
 * being told apart only by their arity at the call site. A read that answers
 * something other than an enumeration keeps `get…`: `getAccountBalances` hands
 * back a lookup table with an "I don't know" state rather than a list of
 * balances, and `prepareCategories` is not a read at all.
 *
 * AN OPERATION IS NAMED FOR WHAT IT DOES, not for the button that calls it.
 * `closeAccount` is the one that had to be renamed for that rule: it was
 * `deleteAccount`, it has never deleted an account in any implementation, and
 * the screen that calls it already asks "Close this account?".
 */

import type {
  Account,
  AccountUpdate,
  Budget,
  Category,
  CategoryMergeResult,
  CustomReport,
  ForecastAdjustment,
  DismissalKind,
  Goal,
  SplitWriteResult,
  SuggestionDismissal,
  Transaction,
  TransactionSplit,
  TransactionSplitInput,
  TransferDisplacedDisposition,
  TransferRepointResult
} from '../../types';
/**
 * The backup FILE format, imported rather than restated.
 *
 * `import type` is erased at build, so this costs nothing and keeps the "emits
 * nothing" promise above. It is imported rather than re-declared because these
 * types describe a file on the user's disk, not an engine: `buildBackupBundle`,
 * `validateBackupBundle` and `remapBackupIds` are pure functions over rows that
 * BOTH of today's engines already share, and a second declaration of the same
 * shape here would be free to drift from the one the file is actually written
 * and validated against. A local edition inherits the format for the same
 * reason it inherits the seam.
 *
 * Since slice 27 the format has a module of its own — `backup/format.ts`, with
 * no Supabase client anywhere in its scope — and these come from there. Six of
 * the seven were always describable that way; `ExportProgress` is the odd one
 * and stays where the export that reports it lives, because it is a statement
 * about reading fourteen tables over a network rather than about a file.
 */
import type {
  BackupBundle,
  BackupEntity,
  BackupRow,
  DanglingReference,
  RestoreOutcome,
  RestoreProgress
} from '../backup/format';
import type { ExportProgress } from '../backupService';
/**
 * The wipe's progress, and the migration's — imported for the same reason the
 * backup format above is, and erased at build for the same reason too.
 *
 * `WipeProgress` describes a chunked, table-by-table erase: which table, how
 * many rows have gone, how many there were, which step of how many. Nothing in
 * that shape is about Microsoft Money or about PostgREST — it is where the one
 * chunked wipe in the app happens to live, because the total migration is what
 * first needed it and "Delete All Data" then shared it rather than growing a
 * second one. Restating it here would give the dialog's progress bar a second
 * definition free to drift from the one the engine actually reports.
 *
 * `MsMoneyImportResult` is a parsed .mny file, and it is emphatically NOT
 * app state: it is the transform's output, and the transform is what a second
 * implementation would reuse unchanged. A local edition reads the same file
 * through the same parser and differs only in where the rows land.
 */
import type { ImportProgress, WipeProgress } from '../import/msMoney/msMoneyImport';
import type { MsMoneyImportResult } from '../import/msMoney/transform';
/**
 * A HOLDING, and the three shapes that write one.
 *
 * Imported for the reason the backup format above is, and from a module chosen
 * for the same reason: `services/investments/holding.ts` has no Supabase client
 * in its scope. `services/api/investmentService.ts` — which re-exports every one
 * of these — does, in its first line.
 *
 * The types are the APP's rather than a column set, exactly as `Account` and
 * `Transaction` are, and the one place they differ in KIND from everything else
 * this seam carries is deliberate: a holding's `quantity`, `currentPrice` and
 * `purchasePrice` are `DecimalInstance` and not `MoneyNumber`. See
 * {@link DataPortInvestmentWrites} for why, which is the same argument
 * {@link MoneyNumber} makes in the opposite direction.
 */
import type {
  InvestmentChanges,
  InvestmentDraft,
  InvestmentHolding,
  QuoteWriteback
} from '../investments/holding';
import type { InvestmentEvent, InvestmentEventDraft } from '../investments/events';

export type {
  InvestmentChanges,
  InvestmentDraft,
  InvestmentHolding,
  QuoteWriteback,
  InvestmentEvent,
  InvestmentEventDraft
};

export type {
  BackupBundle,
  BackupEntity,
  BackupRow,
  DanglingReference,
  ExportProgress,
  ImportProgress,
  MsMoneyImportResult,
  RestoreProgress,
  WipeProgress
};

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
 * Everything the app boots with, in one answer.
 *
 * Six questions the boot used to ask one after another — the accounts, the
 * categories (prepared, not merely listed), the transactions and their stats,
 * the split lines, the budgets, the goals. They are gathered here because the
 * ORDER between them is a rule rather than an accident (categories before
 * transactions; budgets and goals together, never one after the other), and a
 * rule spread over six call-site awaits can only be kept by the one call site
 * that happens to read it. Gathered, it becomes the implementation's rule, and
 * every implementation is held to it by the same contract test.
 *
 * `phases` is the boot-timing breakdown, in milliseconds, measured where the
 * work actually happens. The app prints it on one console line, so a slow load
 * can be attributed from the console of any environment, production included.
 * An implementation names its own phases; nothing branches on the keys.
 *
 * ── WHY THE CUSTOM REPORTS ARE IN HERE AND NOT FETCHED WHERE THEY ARE DRAWN ─
 *
 * Because two of their readers are SYNCHRONOUS. `CustomReportWidget` resolves a
 * pinned report inside a `useMemo` during render, and the dashboard's report
 * picker lists them inline in a modal body — neither has an await to put a fetch
 * in, and giving them one would mean a pinned widget that renders nothing on
 * first paint and pops into place a moment later, every load.
 *
 * They ride the boot for the reason the goals do: they are a small, bounded list
 * the app wants in hand before it draws anything, and a seventh round trip for
 * them would cost every signed-in boot a crossing in exchange for a list that is
 * almost always shorter than the accounts.
 */
export interface BootSnapshot {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  transactionStats: BootTransactionStats;
  splits: TransactionSplit[];
  budgets: Budget[];
  goals: Goal[];
  customReports: CustomReport[];
  /** Milliseconds per phase, named by the implementation. Diagnostic only. */
  phases: Record<string, number>;
}

/**
 * The boot, as ONE crossing.
 *
 * Separate from the reads because it is not one: it may CHANGE the store on the
 * way past (see `prepareCategories`, whose one-time id migration is the reason
 * the ordering inside this snapshot is load-bearing), and because a second
 * implementation is expected to answer it in a way that has nothing to do with
 * calling the reads six times. The cloud composes it from its own reads — six
 * network crossings in the order the app depended on — and a local core answers
 * it from one transaction against one file. Both satisfy the same contract, and
 * the difference is declared in the contract suite's BOOT_COMPOSITION table
 * rather than discovered.
 */
export interface DataPortBoot {
  /**
   * The whole boot in one call.
   *
   * ── WHY `getAccountBalances` IS NOT IN THIS SNAPSHOT ──────────────────────
   *
   * It is the one boot read deliberately left OUTSIDE, and the omission is
   * load-bearing rather than an oversight to tidy up later.
   *
   * Those figures exist for exactly the seconds a long history is in flight.
   * Until the first page of transactions lands, every client-side ledger sum is
   * just the opening balance, so the dashboard would open on zeros; the
   * server-computed map lands early and lets it open on real money instead. The
   * whole value of it is that it arrives BEFORE the rest of the boot does.
   *
   * Folding it in here would close that window completely. The map would arrive
   * with — not before — the transactions it was meant to cover for, so the
   * seeding rule (which fires only while `transactions.length === 0`) would
   * have nothing left to seed, and every account would read £0.00 for the whole
   * boot instead of for none of it. A read whose entire purpose is to be early
   * cannot be bundled with the thing it is early for.
   *
   * So it stays the parallel seventh read, and the call site fires it EARLIER
   * than it used to — before this call is awaited rather than in the middle of
   * the sequence. It takes no arguments, which is what makes that possible: the
   * seam resolves its own owner (rule 1), so there is nothing this call has to
   * resolve first for it to be startable.
   *
   * **NEVER REJECTS.** The boot effect has ONE outer catch, and reaching it
   * puts a full-page "Failed to load data" in front of somebody whose ledger
   * may be perfectly fine. This call is now the only thing inside that try, so
   * it carries the same floor `loadBootTransactions` does: a store that will
   * not open costs whatever could not be read, said out loud in
   * `transactionStats.fullFetchReason`, and never a rejected promise.
   */
  loadBoot(): Promise<BootSnapshot>;
}

/**
 * Reads. None of them take a filter: the app loads its ledger and does its own
 * filtering in memory, and pretending otherwise here would invent a query
 * language that no implementation actually has.
 */
export interface DataPortReads {
  listAccounts(): Promise<Account[]>;
  /** Closed accounts are excluded from `listAccounts` and read on demand. */
  listClosedAccounts(): Promise<Account[]>;
  listTransactions(): Promise<Transaction[]>;
  /**
   * The boot's transaction read, which is a different question from
   * `listTransactions`: that one always wants a straight re-pull (bank sync,
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
  listTransactionSplits(): Promise<TransactionSplit[]>;
  /** One transaction's lines, in display order (`sortOrder`), empty when not split. */
  listTransactionSplitsFor(transactionId: string): Promise<TransactionSplit[]>;
  listBudgets(): Promise<Budget[]>;
  listGoals(): Promise<Goal[]>;
  /**
   * Every report this owner has built, oldest first.
   *
   * The whole report, not a summary: `components` and `filters` come back as the
   * caller stored them, because the only thing anybody does with a report is
   * generate it, and a generator handed half a definition would draw half a
   * report without saying so.
   */
  listCustomReports(): Promise<CustomReport[]>;
  /**
   * The forecast scenario's stated deviations — one per adjusted category.
   *
   * NOT in the boot payload, unlike custom reports, and the asymmetry is
   * argued rather than inherited: reports went into boot because two of
   * their readers are SYNCHRONOUS; the one reader of adjustments is the
   * Forecast page, which is async from birth, and a boot that carried them
   * would tax every session for one page's convenience.
   */
  listForecastAdjustments(): Promise<ForecastAdjustment[]>;
  listCategories(): Promise<Category[]>;
  listSuggestionDismissals(): Promise<SuggestionDismissal[]>;
  /**
   * Every position this owner holds, by symbol.
   *
   * **Divergence B-12**: an engine with nowhere to keep a holding answers with
   * an EMPTY LIST rather than rejecting, and says so through
   * {@link DataPortCapabilities.cannotKeep} so that a screen can explain the
   * emptiness instead of showing a portfolio that looks lost. Browser storage is
   * that engine — local mode has never had a holdings store, a writer or a
   * reader — and the empty list is the honest answer there rather than a stub:
   * there are none, because there is nowhere to keep them.
   */
  listInvestments(): Promise<InvestmentHolding[]>;
}

export interface DataPortAccountWrites {
  createAccount(account: Omit<Account, 'id'>): Promise<Account>;
  updateAccount(id: string, updates: AccountUpdate): Promise<Account>;
  /**
   * A SOFT close, in every implementation: the account leaves the live list
   * and its transactions stay exactly where they are. Nothing in this seam
   * hard-deletes an account, because a deleted account is a hole in a ledger.
   */
  closeAccount(id: string): Promise<void>;
}

/**
 * What finishing a reconciliation DID, as opposed to what was on screen.
 *
 * The count is the number of rows this finalize converted from marked to
 * committed — not how many the account holds, and not how many were ticked
 * (rows already committed are not counted twice). The screen reports it back,
 * because "Reconciliation complete" with no number is the sentence the old
 * flow ended on and it is what made a button that did nothing look like a
 * button that worked.
 */
export interface ReconciliationOutcome {
  /** Rows converted from marked to committed by this call. */
  reconciled: number;
  /** The ending balance the account now records; the next session opens on it. */
  endingBalance: number;
  /** The day the account now records as its last reconciliation. */
  reconciledOn: Date;
}

export interface DataPortTransactionWrites {
  createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction>;
  /**
   * A partial update of the fields a row's own editor owns.
   *
   * **Divergence D-7**: only these sixteen are honoured by the cloud
   * implementation — `description, amount, type, date, accountId, category,
   * categoryConfirmed, needsReview, notes, tags, isRecurring, cleared,
   * transferAccountId, metadata, categoryId, merchantName`. Anything else is
   * silently discarded there, silently applied by browser storage, and refused
   * by name by the local core. Callers must send only those sixteen: every
   * field outside the list has a dedicated operation on this interface, and the
   * dedicated operation is the contract (archiving is `setTransactionArchived`,
   * linking is the transfer group, splitting is `setTransactionSplits`).
   *
   * `needsReview` is the only one of the sixteen that is meaningful ONLY as
   * `false`, and it has no dedicated operation on purpose. Ending a review is
   * not a thing a user does to a row; it is what happens when they save one, so
   * it rides the save that caused it — one write, one audit entry, no race
   * between a save and a separate "and I've now looked at it" call. Which is
   * also why NO engine may infer it: a caller that does not mention the field
   * leaves it exactly as it was, however much else it changed. The bulk
   * categorise sweep, the payee rename and the transfer-link repair all come
   * through here and none of them is a person reading a row.
   */
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction>;
  /**
   * Remove one row and reverse its account's balance.
   *
   * ── IT UNLINKS THE SURVIVOR ─────────────────────────────────────────────
   *
   * Deleting one half of a linked transfer leaves the OTHER half in place — the
   * movement is not undone, only half of it is (see describeDeleteStranding,
   * which is what the confirmation says out loud). What must not survive is the
   * LINK: a row pointing at an id that no longer exists is a row every screen
   * still treats as half of a transfer, so the editor goes on refusing to move
   * it and the register goes on offering to jump to a transaction that is gone.
   *
   * Every engine therefore leaves the survivor unlinked, and states it here
   * because it is not free anywhere: the cloud gets it from
   * `transactions_linked_transfer_id_fkey`, which is ON DELETE SET NULL, and
   * browser storage has to do it by hand.
   *
   * The survivor keeps its `type`, its To/From category and its
   * `transferAccountId`: it is an UNMATCHED transfer leg, which is a real state
   * the app has a name and a repair flow for, and re-typing it on the user's
   * behalf would be inventing an answer to a question only they can settle.
   */
  deleteTransaction(id: string): Promise<void>;
  /**
   * Mark rows off against a statement, or take the mark back. Balance-neutral
   * by definition. Returns rows touched.
   *
   * A MARK IS NOT A RECONCILIATION. This is Microsoft Money's C — a working
   * flag, persisted immediately so eight hundred ticks survive walking away
   * from the screen, and settling nothing on its own. Only
   * {@link DataPortTransactionWrites.finalizeReconciliation} commits.
   *
   * Every engine keeps one rule about the committed flag beside it: marking
   * LEAVES it alone, unmarking CLEARS it. A row that is not ticked cannot be a
   * row a statement was balanced against, and the pair (committed, unmarked)
   * would put the cleared balance and the reconciled set permanently out of
   * step. The rule is written once, in
   * src/utils/transactionReconciliation.ts (`reconciledAfterMarking`), and read
   * from there rather than restated per engine.
   */
  setTransactionsCleared(ids: string[], cleared: boolean): Promise<number>;
  /**
   * Finish a reconciliation: commit this account's marked rows and record what
   * they were settled against.
   *
   * ── WHAT IT PROMISES ────────────────────────────────────────────────────
   *
   * Afterwards, every row of the account that was MARKED AND NOT YET COMMITTED
   * is committed, and the account records the day and the ending balance the
   * user confirmed — the two facts Money showed at the top of the next
   * reconciliation ("last reconciled on…, ending balance…"), and the two the
   * next session opens from.
   *
   * It converts exactly the working set. Rows that a store cannot say anything
   * about — written before the committed flag existed, so their mark is the
   * only answer they carry — are LEFT ALONE rather than swept in: they already
   * read as reconciled everywhere (see transactionReconciliation.ts), and
   * rewriting them would re-stamp a whole history to change nothing anybody
   * can see.
   *
   * All-or-nothing in every implementation: the rows and the account's record
   * of them land together or neither does. The intermediate state — rows
   * committed against a statement the account has no memory of — is what makes
   * the NEXT reconciliation open at a figure that is not the one this one
   * finished on.
   *
   * Balance-neutral. `endingBalance` is a RECORD of what a person confirmed,
   * never an amount added to anything, and no engine may reconcile `balance`
   * to it — a difference between the two is the thing the screen exists to
   * show, and silently closing it would be inventing money.
   *
   * IT REJECTS an account that is not the caller's, and an absent ending
   * balance. `0` is a perfectly good ending balance (an account swept to zero
   * every night closes on exactly that), so "no balance" and "zero" are
   * different arguments and only the first is refused.
   *
   * **Divergence D-9**: `reconciledOn` is a `Date` here because that is what
   * the caller holds, but which calendar day an instant belongs to is answered
   * differently by the implementations — the same disagreement declared for
   * `archiveTransactionsBefore` at D-8. Callers should pass a day that is
   * unambiguous.
   */
  finalizeReconciliation(
    accountId: string,
    endingBalance: number,
    reconciledOn: Date
  ): Promise<ReconciliationOutcome>;
  /**
   * Fill-blanks only: rows that already carry a category are left alone.
   *
   * Leaves `needsReview` alone too, and the contrast with
   * `confirmTransactionCategories` is deliberate: this is a decision about a
   * CATEGORY taken from a list of payees, not a decision about each row, so the
   * rows it fills stay in the register's To Review list.
   */
  applyCategoryToUncategorized(ids: string[], category: string): Promise<number>;
  /**
   * Agree with a suggested category; one boolean, never the category itself.
   *
   * Also clears `needsReview` on every row it confirms. Both surfaces that call
   * this are a person looking at a row and answering the question it was
   * asking, and the one-click answer is still an answer — a register that kept
   * the row bold afterwards would be nagging about work already done.
   */
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

/**
 * How far a bulk import got, reported while it is still running.
 *
 * `inserted` is the same number `BulkImportResult.inserted` ends up holding,
 * seen part-way: rows of THIS import that are in the account so far. It is what
 * the progress bar is drawn from, so an implementation that cannot honestly
 * measure its own progress must stay silent rather than estimate — see the
 * divergence on `importTransactions` below.
 */
export interface BulkImportProgress {
  /** Rows of the import that are in the account so far. */
  inserted: number;
  /** Total rows to import. */
  total: number;
}

/**
 * What a bulk import DID, as opposed to what the file offered.
 *
 * ── `inserted` IS A PREFIX COUNT (divergence B-9) ───────────────────────────
 *
 * Rows `[0, inserted)` of the array that was handed in are in the account; rows
 * `[inserted, total)` are not, IN FILE ORDER. That is not a description of how
 * one engine happens to work, it is the contract: both callers slice the
 * original array at this number to name the payments that are missing, on
 * screen, to somebody holding the statement they came from. A count that
 * merely totalled the rows written — with the gaps anywhere else in the file —
 * would have them looking for the wrong transactions.
 *
 * How far a partial can get differs, and is declared rather than asserted
 * equal: the cloud posts in chunks that each commit on their own, so it can
 * stop anywhere; a device write is one atomic transaction, so its answer is
 * always 0 or all of them. Both keep the prefix rule — 0 and `total` are
 * prefixes too.
 */
export interface BulkImportResult {
  /**
   * Rows of the import that are now IN THE ACCOUNT — written by this run, or
   * refused by the store as a repeat of a row this same run had already
   * written (see `alreadyPresent`). Always a PREFIX: rows [inserted, total)
   * are the ones that are missing, in file order.
   */
  inserted: number;
  /**
   * How many of `inserted` the store already held under this import's own id
   * and therefore did not write again — a re-posted chunk after a timeout, or
   * a statement offering rows the account already has under the bank's own
   * transaction id. Counted as landed because they ARE landed; reported
   * separately because "we wrote 900 rows" and "800 of those were already
   * here" are different sentences and the user is owed the true one.
   *
   * An engine with no request to re-send and no id to collide with answers 0,
   * and that is a statement rather than a stub.
   */
  alreadyPresent: number;
  /** Rows the caller asked to import. */
  total: number;
  /** True when the whole import landed. */
  complete: boolean;
  /** Why it stopped, in prose a user can act on, when it did not finish. */
  error?: string;
}

/**
 * What the rows carry with them, which decides what a store can key them by.
 *
 * 'ofx' says every row holds the bank's own transaction id (the OFX modal
 * writes it into `notes`), which OFX guarantees unique within the account — so
 * an engine can refuse a second copy of one it already has, and "just import
 * the file again" becomes true of the register rather than only of the screen.
 * 'file' says the rows have no identity of their own beyond their position,
 * which is all a CSV or a QIF can promise.
 */
export type ImportSourceKind = 'ofx' | 'file';

export interface DataPortBulkWrites {
  /**
   * Add a file's worth of transactions to one account.
   *
   * The rows are drafts, exactly as a create takes them, and the account they
   * go into is the one named HERE — the destination the user chose wins over
   * whatever a parser guessed for each row.
   *
   * EVERY ROW IT WRITES ARRIVES `needsReview: true`, whatever the draft says.
   * This operation IS the file-import path — a statement the user has just
   * handed the app — so the rows are new work by definition, and the engine
   * says so rather than trusting each parser to remember (a parser that forgets
   * fails silently, which is indistinguishable from the feature being off).
   * Rows that arrive some other way are not affected: `createTransaction` is a
   * person typing and is born reviewed, and the Microsoft Money migration
   * (`importMsMoney`) is history the user already worked through in Money.
   *
   * ── WHAT IT PROMISES ────────────────────────────────────────────────────
   *
   * The account's balance moves by the sum of the rows that landed, to the
   * penny, and it moves WITH them: no engine may leave a register holding rows
   * a balance does not account for. Every engine writes in units that are
   * all-or-nothing (one database transaction in the cloud, one store write on a
   * device), so a failure leaves a whole unit unwritten rather than half of one.
   *
   * `inserted` is a PREFIX count. The rule, and why the callers depend on it
   * literally, is written out on {@link BulkImportResult}.
   *
   * IT DOES NOT REJECT for a store that refused the write: a bulk import is
   * reported, not thrown, because "412 of 900 landed" is an outcome a caller
   * has to render rather than a failure it can retry blindly. It may reject for
   * a caller error.
   *
   * ── DIVERGENCE B-9 ──────────────────────────────────────────────────────
   *
   * Two things differ and are declared rather than asserted equal:
   *
   *   HOW FAR A PARTIAL GETS — the cloud commits chunk by chunk and can stop
   *   at any chunk boundary; a device write is one transaction, so its answer
   *   is 0 or all of them.
   *
   *   WHETHER PROGRESS IS REPORTED — `onProgress` fires per committed chunk in
   *   the cloud and never on a device, because one atomic write has no honest
   *   fraction. A caller must therefore treat silence as normal and never wait
   *   on a first report.
   *
   * IT DOES NOT TAKE AN OWNER, and the rule stated at length on
   * `createBudget` applies here with the most money on it of anywhere in this
   * seam: a statement filed into the wrong store is a register that disagrees
   * with the bank by however much the file was worth.
   */
  importTransactions(
    accountId: string,
    transactions: ReadonlyArray<Omit<Transaction, 'id'>>,
    options?: {
      /** Called as rows land, where the engine can honestly measure it. */
      onProgress?: (progress: BulkImportProgress) => void;
      /** What the rows carry; defaults to 'file'. See {@link ImportSourceKind}. */
      source?: ImportSourceKind;
    }
  ): Promise<BulkImportResult>;
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
  /**
   * Point an EXISTING linked transfer at a different account.
   *
   * ── WHAT IT PROMISES ────────────────────────────────────────────────────
   *
   * Afterwards the pair faces `targetAccountId` and is filed consistently in
   * both directions: the edited row carries the target's "To/From" category and
   * names it as its transfer account, and the counterpart — sitting in the
   * target — carries the EDITED ROW'S account's "To/From" category and names
   * that. The crossover rule is written down once, in
   * src/utils/transferRepoint.ts, and every engine derives both sides from it
   * rather than patching whichever one visibly changed.
   *
   * Amounts, dates, descriptions, notes, tags and reconciled state are never
   * touched — a re-point is a change of address, not of fact.
   *
   * All-or-nothing in every implementation: the displaced row, the row that
   * replaces it, both re-filings and every balance movement land together or
   * none of them do. There is no half-repointed state to compensate for,
   * because the intermediate state — a transfer with no other side — is a
   * stranded leg that reads as a real payment in an account nobody is looking
   * at, and one of those went unnoticed for years.
   *
   * `disposition` decides the fate of the counterpart being displaced; see
   * {@link TransferDisplacedDisposition}. Defaults to `move`.
   *
   * IT IS SAFE TO CALL WHEN THE TARGET HAS NOT CHANGED. The counterpart is then
   * already where it belongs, no balance moves, and the operation is purely a
   * re-file — which is what makes it the right thing to send when the row's OWN
   * account moved instead, and the counterpart's category has gone stale as a
   * result.
   *
   * IT REJECTS when the row is not half of a linked pair, when the two rows do
   * not name each other (a stale list), when the target is the row's own
   * account, when either side is a split parent or the opposite half of a split
   * LINE (that link lives on the line and must be unpicked in the split), when
   * either row is archived, and when the two accounts hold different currencies
   * — the counterpart's amount is the source's negated with no conversion, the
   * same guard `createTransferCounterpart` applies.
   */
  repointTransfer(
    id: string,
    targetAccountId: string,
    disposition?: TransferDisplacedDisposition
  ): Promise<TransferRepointResult>;
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
   * Create a budget: an amount against a category, for a period.
   *
   * `spent` is not supplied because it is not stored knowledge — it is the sum
   * of the rows filed under that category in the period, recomputed from the
   * ledger — so a new budget starts at zero in every implementation.
   *
   * ── OWNERSHIP (divergence B-3) ──────────────────────────────────────────
   *
   * Rule 1 of this seam (no operation takes a user id) is load-bearing HERE in
   * a way it is not for a read, and this is the paragraph that says why.
   *
   * The service the cloud branch delegates to takes `(userId, budget)` and
   * treats a null id as "write the browser's copy instead". It does not throw,
   * does not warn, and hands back an ordinary Budget. So a caller that let an
   * unresolved id through would watch a signed-in person create a budget, see
   * it appear on the page, and find it gone at the next boot — because the
   * READ beside it goes to the cloud, where the row never landed. Nothing
   * anywhere says a word. That is silent, permanent, user-visible data loss,
   * and the only defence that actually holds is making the mistake
   * unrepresentable: the owner is resolved INSIDE the implementation, on the
   * same tick as the write.
   *
   * What "the owner" means is allowed to differ — browser storage has one
   * store and no owner at all, the cloud stamps the row and RLS enforces it, a
   * local core is the device — and that is declared as B-3 in the contract
   * suite. What may NOT differ: no operation accepts an owner, and a write
   * whose owner could not be resolved must never land in another owner's
   * store.
   */
  createBudget(budget: Omit<Budget, 'id' | 'spent'>): Promise<Budget>;
  /**
   * Change a budget, and hand back the whole budget as it now stands (the
   * caller replaces its copy with this, so a partial answer would blank the
   * fields it left out).
   *
   * A budget that is not there is refused BY NAME rather than created, and the
   * refusal leaves the store exactly as it was — the same all-or-nothing rule
   * the splits and the merge keep.
   */
  updateBudget(id: string, updates: Partial<Budget>): Promise<Budget>;
  /**
   * Remove a budget.
   *
   * A real delete, not the soft close an account gets: a budget holds no money
   * and nothing is filed against it, so removing one leaves no hole in the
   * ledger. Removing one that is already gone is a NO-OP, not an error — a
   * double-click, or a second device that got there first, must not turn a
   * decision into an error message (the same rule `dismissSuggestion` keeps).
   */
  deleteBudget(id: string): Promise<void>;
  /**
   * Create a goal: a target amount, a date to reach it by, and how much has
   * been put by so far.
   *
   * `progress` is not supplied, and that is not the same statement `spent` on a
   * budget makes. A budget's `spent` is summed from the ledger and can never be
   * the caller's to state; a goal's progress is a figure nobody else knows —
   * money already set aside before the goal was written down. So it is not
   * absent, it is DERIVED FROM `currentAmount`, and a goal created saying £250
   * is already put by starts at £250 rather than at zero. That equality is
   * asserted in the contract suite, because the version of this that hard-coded
   * zero lost the opening amount, and lost it differently in each engine —
   * banked in the browser's copy, thrown away in the cloud.
   *
   * The ownership rule stated at length on `createBudget` above applies here
   * word for word: no implementation takes a user id, and a write whose owner
   * could not be resolved must not land in another owner's store. A goal is a
   * plan for money rather than money itself, which makes losing one no less
   * annoying and no more visible — the goals page would simply be empty in the
   * morning.
   */
  createGoal(goal: Omit<Goal, 'id' | 'progress'>): Promise<Goal>;
  /**
   * Change a goal, and hand back the whole goal as it now stands (the caller
   * replaces its copy with this, so a partial answer would blank the fields it
   * left out).
   *
   * A goal that is not there is refused BY NAME rather than created, and the
   * refusal leaves the store exactly as it was.
   *
   * ALSO THE CONTRIBUTION PATH, and this is the part an implementation must not
   * improvise: putting money towards a goal arrives here as an ordinary update
   * carrying the new `progress`. That figure has ALREADY been added up and
   * capped against the target by the caller, so this operation SETS what it is
   * given and never adds to what is stored. An implementation that treated the
   * field as an increment would push a goal past its own target — the one thing
   * the cap upstream exists to prevent — and the contract suite asks for that
   * by name.
   */
  updateGoal(id: string, updates: Partial<Goal>): Promise<Goal>;
  /**
   * Remove a goal. Same rule as `deleteBudget` above: removing one that is
   * already gone is a no-op, not an error.
   *
   * What this does NOT do is forget the goal's trophy — the achievement record
   * kept beside the ledger. That belongs to the caller that owns the
   * celebration, and it stays there deliberately: a store is not the place to
   * put the rule about what a completed goal feels like.
   */
  deleteGoal(id: string): Promise<void>;
  /**
   * Create one category — a name rows can be filed under.
   *
   * The ownership rule stated at length on `createBudget` applies unchanged. A
   * category is not money, but losing one is not a smaller problem than losing a
   * budget: every transaction filed under it holds its id, so a category written
   * into the wrong store leaves a register of rows pointing at a name that is
   * not there.
   *
   * ── THE ID COMES BACK USABLE (divergence B-5) ────────────────────────────
   *
   * The caller uses the returned id IMMEDIATELY — as the value of the select it
   * just added the option to, and as the `parentId` of the children created in
   * the same breath (this is how a tree import builds its second level). So the
   * id must be final: a placeholder an implementation intends to replace when it
   * next syncs would file transactions under an id that stops existing.
   *
   * Where the id is MADE may differ — the client mints a uuid for browser
   * storage and for a device edition, the database's column default mints it in
   * the cloud — and that is declared as B-5 rather than asserted equal. What may
   * not differ: it is stable, and it is usable on the next line.
   */
  createCategory(category: Omit<Category, 'id'>): Promise<Category>;
  /**
   * Create several categories at once — the tree import's operation, which
   * otherwise makes one round trip per name in a list that is routinely
   * hundreds long.
   *
   * NOTHING IN, NOTHING OUT, AND NOTHING WRITTEN. An empty list is the ordinary
   * case rather than a caller's mistake: an import that adds a level of detail
   * to a tree the account already has plans no new groups at all, and asks for
   * them anyway because the plan is computed before it is known to be empty. So
   * an empty list resolves to an empty array without opening the store — which
   * also keeps a cloud implementation from sending an insert with no rows, a
   * thing some drivers answer with an error rather than a shrug.
   *
   * The answer is one category per category supplied, each with the id rule
   * `createCategory` above states. Callers match the answers to what they asked
   * for BY NAME, never by position: an implementation is free to hand them back
   * in whatever order its store produced them.
   */
  createCategories(categories: Array<Omit<Category, 'id'>>): Promise<Category[]>;
  /**
   * Change a category, and hand back the whole category as it now stands (the
   * caller replaces its copy with this, so a partial answer would blank the
   * fields it left out).
   *
   * A category that is not there is refused BY NAME rather than created, and the
   * refusal leaves the store exactly as it was — the rule the budget and goal
   * updates above keep, for the same reason: an id that names nothing is a stale
   * page, and inventing a category to satisfy it would put a name in somebody's
   * list that they never typed.
   */
  updateCategory(id: string, updates: Partial<Category>): Promise<Category>;
  /**
   * Remove a category, AND THE CATEGORIES UNDER IT.
   *
   * The cascade is the part an implementation must not improvise: the cloud
   * spells it as `ON DELETE CASCADE` on the parent id, browser storage spells it
   * as a filter that drops children too, and both mean the same thing — a group
   * cannot outlive itself as a set of orphans whose parent is gone. It is
   * asserted in the contract suite rather than left to each engine's FK
   * declaration, because an engine without foreign keys has nothing to inherit
   * it from.
   *
   * What this does NOT do is re-file what was filed under it. Removing a
   * category that transactions still point at leaves those rows pointing at
   * nothing, so the screen that offers this refuses when anything references the
   * category and offers `mergeCategories` instead — that operation exists
   * precisely because this one cannot be made safe for the in-use case.
   */
  deleteCategory(id: string): Promise<void>;
  /**
   * Remove a batch of categories nothing is filed against — the "replace my
   * category list with this one" half of a tree import.
   *
   * ── THE COUNT IS WHAT WAS ACTUALLY DELETED (divergence B-6) ──────────────
   *
   * Not the size of the list it was handed. The caller shows this figure to the
   * user and re-reads the category set because of it, and the two engines can
   * legitimately remove a different number of rows than were named: an
   * implementation that re-judges every row against the ledger AS IT IS NOW may
   * delete FEWER (the caller's plan was computed from a snapshot, and a
   * transaction filed in another tab since is exactly the row that must survive
   * a stale plan), and one that cascades children removes MORE for one named
   * parent. Returning `ids.length` would be a guess dressed as a count, and the
   * "kept 12 in use" sentence built from it would be a fiction.
   *
   * Empty in, zero out, nothing written — the same statement `createCategories`
   * makes, and for the same reason: the prune plan is computed before anyone
   * knows it is empty.
   */
  deleteUnusedCategories(ids: string[]): Promise<number>;
  /**
   * Move every reference from one category to another, then remove the source.
   * All-or-nothing, and the refusals are ordered: the source is judged before
   * the target, because that is the order the user is asked to think in.
   */
  mergeCategories(sourceId: string, targetId: string): Promise<CategoryMergeResult>;
}

/**
 * Custom reports — a group of their own, and the only entity on this seam that
 * holds no money at all.
 *
 * ── WHY IT IS NOT FILED WITH THE PLANNING WRITES ────────────────────────────
 *
 * A budget and a goal are amounts somebody committed to; the page beside them
 * compares each one against a Decimal sum of real rows, which is why every rule
 * on {@link DataPortPlanningWrites} is ultimately about a penny. A report is a
 * QUESTION about the ledger — which components, over which accounts, for which
 * period — and every figure it shows is recomputed from the transactions at the
 * moment it is generated. Nothing here is ever added to anything.
 *
 * That difference decides the two rules below that have no analogue in the
 * planning group: `components` and `filters` REPLACE WHOLESALE, and a report's
 * ids are the caller's to state.
 *
 * ── WHY IT REACHED THIS SEAM AT ALL ─────────────────────────────────────────
 *
 * Until slice 32 a report's only home was
 * `localStorage['money_management_custom_reports']`. So a report built on the
 * laptop did not exist on the phone, clearing browser data deleted it with no
 * warning and no undo, a backup did not carry it, and on a desktop it lived in
 * the WebView's storage rather than in the ledger file the user chose — which
 * means copying that file to a new machine left every report behind. None of
 * those failures says anything on screen: the reports page simply comes up
 * empty, which reads exactly like never having made one.
 */
export interface DataPortReportWrites {
  /**
   * Save a report somebody built.
   *
   * The ownership rule stated at length on `createBudget` applies word for word.
   * A report is not money and losing one is a smaller loss than losing a budget
   * — it is also a completely silent one, because an empty reports page and a
   * page whose reports went to the wrong store look identical.
   *
   * ── THE ID IS THE STORE'S (divergence B-5, unchanged) ────────────────────
   *
   * `Omit<CustomReport, 'id'>`, so the engine mints it, exactly as it does for a
   * category. The builder used to mint one itself (`report-${Date.now()}`) and
   * that id could not be kept: it is not a uuid, and the cloud's column is. The
   * caller uses the id it gets back immediately — it is what the reports list is
   * keyed by and what a dashboard pin points at — so the same rule
   * `createCategory` states applies here: final on the next line, never a
   * placeholder an implementation intends to replace.
   *
   * `createdAt` and `updatedAt` are NOT honoured, exactly as a new budget's are
   * not: every engine stamps its own, because a caller's copy of a timestamp is
   * what it last read rather than an instruction. The one place that costs
   * something is the adoption out of browser storage — reports built years ago
   * arrive dated the day they were carried across — and it is accepted rather
   * than fixed on one side, because the cloud's INSERT could honour a stated
   * date and a ledger file's verb cannot: honouring it in one edition and not
   * the other would be two engines disagreeing about when somebody did
   * something.
   */
  createCustomReport(report: Omit<CustomReport, 'id'>): Promise<CustomReport>;
  /**
   * Change a report, and hand back the whole report as it now stands (the caller
   * replaces its copy with this, so a partial answer would blank the fields it
   * left out).
   *
   * A report that is not there is refused BY NAME rather than created, and the
   * refusal leaves the store exactly as it was — the rule the budget, goal and
   * category updates keep.
   *
   * ── `components` AND `filters` REPLACE, THEY DO NOT MERGE ────────────────
   *
   * The one rule an implementation must not improvise, and the one place this
   * group differs from a goal's `metadata` — which DOES merge, in the verb's own
   * transaction, because three unrelated fields share that one column and
   * rebuilding it from a partial update once deleted a goal's linked accounts.
   *
   * Nothing shares these two columns. A report's components are the ARRAY the
   * builder just handed over, in the order it handed them over, and its filters
   * are the whole filter object: an engine that merged either one would make
   * removing a component impossible — the deleted component would survive every
   * save, and no screen would explain why.
   */
  updateCustomReport(id: string, updates: Partial<CustomReport>): Promise<CustomReport>;
  /**
   * Remove a report.
   *
   * A real delete, like a budget's: a report holds no money and nothing is filed
   * against it, so removing one leaves no hole in the ledger. Removing one that
   * is already gone is a NO-OP, not an error — the rule `deleteBudget` and
   * `deleteGoal` keep, for the same reason: a double-click, or a second device
   * that got there first, must not turn a decision into an error message.
   */
  deleteCustomReport(id: string): Promise<void>;

  /**
   * State, or restate, one category's scenario monthly figure — PENNIES, an
   * integer, the figure both engines store verbatim. An upsert on the
   * (owner, category) unique pair: the scenario is a single stated figure
   * per category, and `updated_at` is its edit history's one remnant.
   *
   * A category the engine does not hold is REFUSED by the file's own foreign
   * key, not by a check either implementation writes — the dismissal
   * family's discipline.
   */
  setForecastAdjustment(categoryId: string, monthlyMinor: number): Promise<ForecastAdjustment>;

  /**
   * The category goes back to following the base. A real delete: an absent
   * row IS "no adjustment". Clearing a category that holds none is a
   * successful nothing.
   */
  clearForecastAdjustment(categoryId: string): Promise<void>;
}

/**
 * Holdings — the last region of the ledger to reach this seam.
 *
 * ── WHY IT IS A GROUP OF ITS OWN ────────────────────────────────────────────
 *
 * Not because there are four of them, but because a holding is not a ledger
 * entry and must never be totalled with one. `investmentService.ts` states the
 * rule this group exists to protect: the Investments page's headline figures
 * come from the LEDGER — the investment↔cash account pair, opening balance plus
 * transactions — and holdings × price is a SECOND, clearly-labelled opinion
 * about the same money. Adding the two counts it twice. Putting the holdings
 * beside `createTransaction` in the transaction group would have been an
 * invitation to do exactly that.
 *
 * ── THE ONE PLACE THIS SEAM DOES NOT SAY `MoneyNumber` ──────────────────────
 *
 * Rule 2 says money crosses as {@link MoneyNumber}, which is `number`, because
 * *"the app's own types say `number`, so the seam says `number`"*. The app's own
 * type for a holding says `DecimalInstance`, so the seam says `DecimalInstance`
 * — the same rule, reaching the opposite answer because the app reached it
 * first, and rightly:
 *
 *   `quantity` is not money. Fund units and crypto are fractional to eight
 *   places, and a `number` cannot hold 0.00000001 of anything reliably.
 *
 *   `currentPrice` and `purchasePrice` are RATES, not amounts. Rounding a rate
 *   before multiplying it by a quantity is how a portfolio comes to disagree
 *   with the broker, and it is not hypothetical: `numeric(10,2)` turned a
 *   £32.775 LSE price into £32.78 on every write until migration
 *   20260809120000 widened the column — half a penny a share, every night, in
 *   the same direction.
 *
 * `costBasis` IS money and is a `DecimalInstance` too, because it lives on the
 * same object; what matters is that no implementation may reach it by float
 * arithmetic.
 *
 * **Divergence M-2**: a figure with more than eight decimal places is kept
 * verbatim by browser storage (which stores none of these at all, so the
 * question is moot there), silently rounded by a `numeric(20,8)` column, and
 * refused outright by the local core. M-1's rule one scale out, and declared for
 * the same reason: the difference is recorded rather than discovered.
 *
 * ── WHAT IS NOT HERE ────────────────────────────────────────────────────────
 *
 * `investment_transactions` — the buys, sells and dividends. The table exists in
 * both schemas and in the backup format, and NOTHING in this app has ever
 * written a row to it: no screen, no service, no importer. A seam operation for
 * a table with no writer would be an operation with no behaviour to agree about,
 * so the table is carried by the backup and by nothing else. What a delete does
 * to those rows is still decided — every engine cascades — because a restore can
 * bring them.
 */
export interface DataPortInvestmentWrites {
  /**
   * Record a position.
   *
   * ── `costBasis` IS DERIVED, WHICH IS WHY THE DRAFT HAS NO FIELD FOR IT ────
   *
   * `quantity × averageCost`, computed by the implementation. The cloud's
   * writer says why in one line — *"two numbers that must agree are two numbers
   * that will not"* — and the consequence of letting a caller state both is a
   * row describing a position nobody ever held. Every engine computes it, and
   * the contract suite asserts they compute the same figure to the penny,
   * including the half that rounds away from zero.
   *
   * The ownership rule stated at length on `createBudget` applies word for word.
   *
   * **Divergence B-12**: an engine with nowhere to keep a holding REJECTS, in
   * words, rather than pretending to store one. That is not the same statement
   * the read makes: an empty list is a true answer about what is held, and a
   * successful create that stored nothing would be a false one.
   */
  createInvestment(draft: InvestmentDraft): Promise<InvestmentHolding>;
  /**
   * Change a position, and hand back the whole holding as it now stands (the
   * caller replaces its copy with this, so a partial answer would blank the
   * fields it left out).
   *
   * QUANTITY AND UNIT COST MOVE `costBasis` TOGETHER OR NOT AT ALL. Naming
   * either one recomputes it from the pair, taking the half that was not stated
   * from the stored row. An implementation that wrote one without the other
   * would leave a holding whose cost contradicts its own figures, and nothing on
   * screen would say so.
   *
   * A holding that is not there is refused BY NAME rather than created, and the
   * refusal leaves the store exactly as it was — the rule the budget, goal and
   * category updates keep.
   *
   * IT CANNOT SET A PRICE. `currentPrice` is not in {@link InvestmentChanges}
   * and no engine may accept one here: a price comes from an exchange through
   * {@link DataPortInvestmentWrites.applyInvestmentPrices}, and an edit box that
   * could set one would be a way to make a holding claim a price that was never
   * printed.
   */
  updateInvestment(id: string, changes: InvestmentChanges): Promise<InvestmentHolding>;
  /**
   * Remove a position.
   *
   * A REAL delete, unlike an account's close: no transaction is filed against a
   * holding and no balance is derived from one, so removing it leaves no hole in
   * the ledger. Its `investment_transactions` go with it, in every engine.
   *
   * Removing one that is already gone is a NO-OP, not an error — the rule
   * `deleteBudget` and `deleteGoal` keep, for the same reason: a double-click,
   * or a second device that got there first, must not turn a decision into an
   * error message.
   */
  deleteInvestment(id: string): Promise<void>;
  /**
   * Write fetched prices onto the rows they are about, and say how many moved.
   *
   * BY SYMBOL, NOT BY ID. A quote is about a SECURITY: the same fund held in an
   * ISA and a dealing account is two rows and one price, and pricing them
   * separately would leave the second stale whenever the first fetch failed.
   *
   * ONLY THE PRICE AND ITS DATE MOVE. Quantity, cost basis and account are the
   * user's data and a price refresh has no business touching them. No engine
   * stores a market value: it is quantity × price, and a stored copy of a
   * derived number is a copy that goes stale, so the screen computes it and a
   * holding can never display a value its own price contradicts.
   *
   * THE COUNT IS ROWS REPRICED, never quotes offered — a symbol nobody holds
   * contributes zero. The caller renders it ("3 of 5 updated"), so an engine
   * that returned `quotes.length` would be putting a claim it did not verify in
   * front of somebody.
   *
   * Nothing in, zero out, nothing written.
   */
  applyInvestmentPrices(quotes: readonly QuoteWriteback[]): Promise<number>;

  /**
   * File a batch of DATED prices as history — another program's price table
   * (Microsoft Money's SP), arriving with a date per row.
   *
   * Distinct from {@link applyInvestmentPrices}, which stamps TODAY's quote
   * onto the holding and files today's history as a side effect. This one
   * touches no holding row at all: history is its whole cargo, and existing
   * rows for a (symbol, day) WIN over it — 'import' is the weakest
   * provenance, so a re-run of the same file is a no-op, never a rewrite.
   *
   * Returns how many rows were actually written, because the door says
   * "131 imported" and must not claim the batch.
   */
  importInvestmentPriceHistory(
    rows: readonly { symbol: string; date: string; price: string; currency: string }[]
  ): Promise<number>;

  /**
   * A symbol's dated price series, oldest first. The holding register derives
   * its revaluation lines from consecutive points of this — stored nowhere,
   * per the owner's ruling, so a corrected price corrects the register.
   */
  listInvestmentPrices(
    symbol: string
  ): Promise<Array<{ date: string; price: string; source: 'quote' | 'manual' | 'trade' | 'import' }>>;

  /**
   * The owner types a price — Revalue, in the register. Manual is the
   * STRONGEST provenance and overwrites its day; the current-price snapshot
   * follows only when this is the symbol's newest date, so restating a
   * historical day cannot stamp an old figure over today's.
   */
  recordInvestmentPrice(
    entry: { symbol: string; date: string; price: string; currency: string }
  ): Promise<void>;

  /**
   * File a batch of quantity events — another program's buys, sells and
   * write-offs (Microsoft Money's, typically). Events are the VIEW-LAYER
   * lane the historical registers derive from: this writes no transactions,
   * because the cash side of every historical trade already lives in the
   * ledger. Idempotent on each row's sourceRef — a re-run of the same file
   * is a no-op — and it returns how many rows were actually written, because
   * the door says "92 imported" and must not claim the batch.
   */
  importInvestmentEvents(rows: readonly InvestmentEventDraft[]): Promise<number>;

  /**
   * One account's quantity events, oldest first — a portfolio's trading
   * history. Folding these gives who-held-what-when; interleaving the fold
   * with {@link listInvestmentPrices} gives the historical register.
   */
  listInvestmentEvents(accountId: string): Promise<InvestmentEvent[]>;

  /**
   * ONE quantity event, typed by hand — a live buy or sell (slice 4). No
   * idempotency key: a person's second identical buy is a second buy. The
   * event is the register's record; the CASH truth of the trade is the
   * caller's transfer or sale split, written separately.
   */
  recordInvestmentEvent(draft: Omit<InvestmentEventDraft, 'sourceRef'>): Promise<void>;

  /**
   * Prices implied by live trades — importInvestmentPriceHistory's
   * never-overwrite behaviour with 'trade' provenance.
   */
  recordTradePrices(
    rows: readonly { symbol: string; date: string; price: string; currency: string }[]
  ): Promise<number>;

  /**
   * EVERY quantity event, oldest first — what the net-worth valuation folds
   * (slice 3b). One read, because the walks value all accounts at once.
   */
  listAllInvestmentEvents(): Promise<InvestmentEvent[]>;

  /**
   * EVERY dated price, with symbol and currency — the valuation's other
   * half. The per-symbol read stays for the registers.
   */
  listAllInvestmentPrices(): Promise<
    Array<{ symbol: string; date: string; price: string; currency: string }>
  >;
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

/**
 * What a finished restore looks like, whichever engine did it.
 *
 * Derived from the outcome the restore already reports rather than restated, so
 * a field added there joins the seam instead of quietly failing to.
 */
export interface BackupRestoreOutcome extends RestoreOutcome {
  /**
   * Rows the file carries that this store has nowhere to keep, named with the
   * reason why.
   *
   * The one field a login never fills. A browser has no investments, no goal
   * contributions and no repeating templates, so a file taken from a login and
   * restored onto a device genuinely cannot keep some of what it holds — and
   * saying so is the difference between a restore and a restore that quietly
   * lost things. An engine that holds every table the format carries answers
   * with an empty list, and that is a statement rather than a stub.
   */
  notStoredLocally: { label: string; rows: number; absence: string }[];
}

/**
 * Getting the whole ledger out, and putting it back.
 *
 * The one group whose failure mode is not "a wrong number on a screen" but "the
 * only copy of somebody's financial life". Every rule below exists because the
 * alternative loses data silently.
 */
export interface DataPortBackupLifecycle {
  /**
   * Is there anything here at all?
   *
   * "Empty" means the same three tables in every implementation — accounts,
   * categories and transactions — because it is asked for exactly one reason:
   * a restore only ever writes into an empty store, and the dialog has to know
   * before it offers the button. An engine that answered a broader or narrower
   * question would refuse restores that are safe, or allow ones that are not.
   *
   * REJECTS rather than guessing. Unlike the boot reads, there is no honest
   * fallback: `true` from a store that could not be reached would unlock the
   * restore button in front of a login full of data.
   */
  financialDataIsEmpty(): Promise<boolean>;
  /**
   * Read every table whole and build the file the user downloads.
   *
   * WHOLE ROWS, NOT APP STATE. The file has to be restorable, and app state is
   * a lossy picture of the store by design — it drops columns, skips tables
   * with no screen behind them, and renames what is left. A file built from it
   * could never be poured back in.
   *
   * IT DOES NOT TAKE AN OWNER (rule 1), and this is the operation where that
   * matters most sharply: a backup taken against an unresolved identity would
   * hand a signed-in person a file made of whatever demo or imported data their
   * browser happens to hold, and they would find out on the day they needed it.
   * An implementation that cannot resolve its owner refuses in words rather
   * than reading the nearest store it can find.
   *
   * Progress is reported per table because a real dataset is 50k+ rows and 50+
   * round trips, and a button that says nothing for that long reads as broken.
   * An engine with nothing to report stays silent rather than estimating.
   */
  collectBackup(options?: {
    onProgress?: (progress: ExportProgress) => void;
  }): Promise<BackupBundle>;
  /**
   * Pour a file back in.
   *
   * ── ONLY INTO AN EMPTY STORE ────────────────────────────────────────────
   *
   * A restore REPLACES; it does not merge. So it is refused unless
   * `financialDataIsEmpty()` is true, and emptying is a separate decision with
   * its own confirmation. That is not caution, it is what makes the operation
   * safe to attempt at all: nothing the user already has can be mixed with the
   * file, re-dated or half-overwritten.
   *
   * ── EVERY ID IS REPLACED ON THE WAY IN ──────────────────────────────────
   *
   * Not an optimisation and not conditional on a collision being detected. The
   * primary keys in a backup are unique across the whole store rather than per
   * owner, so a file restored anywhere but where it came from carries ids that
   * belong to somebody else's rows — which is the MAIN case a backup exists
   * for ("my account is gone, I made a new one, put my file back"). Every
   * reference to a remapped id is rewritten with it, and a reference the file
   * does not contain is left exactly as it was and REPORTED in `danglingRefs`
   * rather than blanked: a restore that silently detaches data is the one
   * failure a backup must never have.
   *
   * ── HOW FAR A FAILURE GETS (divergence B-10) ────────────────────────────
   *
   * Declared rather than asserted equal. The cloud restores in chunks that each
   * commit on their own, so a failure halfway leaves the login PARTLY
   * POPULATED — survivable, because the login had to be empty first, but it
   * must be said rather than smoothed over. A device write is one transaction,
   * so it either landed or it did not. Callers render whichever is true of the
   * engine that answered; no caller may assume one of them.
   */
  restoreBackup(
    bundle: BackupBundle,
    options?: {
      onProgress?: (progress: RestoreProgress) => void;
    }
  ): Promise<BackupRestoreOutcome>;
  /**
   * Erase everything this store holds.
   *
   * ── A WIPE IS DEFINED BY THE RESTORE THAT FOLLOWS IT ────────────────────
   *
   * The same sentence the backup is defined by, and it is what decides how much
   * an implementation has to delete. Two things are promised, and neither is
   * negotiable:
   *
   *   `financialDataIsEmpty()` is true afterwards — the emptiness check and the
   *   wipe answer the same question, or the dialog that erases a login and then
   *   asks whether it is empty gets two different answers about one store.
   *
   *   `restoreBackup()` of any well-formed file SUCCEEDS afterwards. A store
   *   that emptied the three tables the emptiness check asks about, and left a
   *   table the FILE also carries, has not wiped: the restore lands on top of
   *   the survivors and stops halfway, in front of somebody who has just erased
   *   their own login on purpose. So "everything" means every table a backup
   *   carries, not the three that decide the flag.
   *
   * ── AND IT IS IDEMPOTENT ────────────────────────────────────────────────
   *
   * Running it twice is safe, and that is a working recovery rather than a
   * tidiness rule. An engine that erases in pieces (the cloud does, because one
   * statement over 51,000 rows is cancelled by the database's own statement
   * timeout — the failure this chunking exists because of) leaves some rows gone
   * and some there when it stops. It cannot avoid that state, so it makes it
   * SAFE instead: deleting rows that have already gone is a no-op, so running it
   * again carries on from wherever it stopped, and the dialog says exactly that
   * rather than showing a bare error.
   *
   * IT TAKES NO CONFIRMATION PHRASE, and takes no owner either (rule 1). The
   * screen in front of it holds the confirmation — both of today's callers
   * refuse to enable the button until the phrase is typed exactly — and the
   * implementation supplies whatever phrase its own engine demands. A
   * confirmation that travelled through here would be a string an implementation
   * could get wrong; the screen's is one the user typed.
   *
   * Progress is reported per table because a real dataset is 50k+ rows and
   * minutes of work, and a button that says "Deleting…" for four minutes reads
   * exactly like one that has hung. An engine that erases in one atomic write
   * has no honest fraction and stays silent, which the callers already handle.
   */
  wipeAllFinancialData(options?: {
    onProgress?: (progress: WipeProgress) => void;
  }): Promise<void>;
}

/**
 * Coming from another money manager.
 *
 * Its own group rather than a bulk write, because it is not one: `importTransactions`
 * ADDS a statement to an account somebody chose, and this REPLACES the whole
 * store — every account, every category, every transaction and every transfer
 * between them, in place of whatever was there.
 */
export interface DataPortMigration {
  /**
   * Replace everything with a parsed Microsoft Money file.
   *
   * DESTRUCTIVE BY DEFINITION. It wipes first and writes second, and the caller
   * that reaches it has already taken the user through a confirmation and an
   * offer to download the current data as a file. This operation does not
   * re-ask: a second confirmation invented down here would be one the screen
   * above cannot word properly, and one an implementation could forget.
   *
   * IT TAKES NO OWNER (rule 1), and this is the operation with the most on it
   * of anything in this seam. Getting the store wrong here does not mislay a
   * row — it writes somebody's entire financial history, thirty years of it,
   * into a place their app will never read again, and reports it as a success.
   *
   * IT REJECTS, unlike `importTransactions`. A bulk import is REPORTED because
   * "412 of 900 landed" is an outcome a caller renders; a total migration has no
   * such halfway answer to render, so a failure comes back as an error with the
   * engine's own sentence on it — which is what the dialog puts on screen, and
   * what somebody needs when a migration has stopped part-way through replacing
   * everything they own.
   *
   * Progress crosses as the importer's own phases (wiping, accounts, categories,
   * transactions, links, splits, verifying) with a fraction and a sentence,
   * because the operation is minutes long on a real file and the wipe alone can
   * be most of it.
   */
  importMsMoney(
    result: MsMoneyImportResult,
    options?: {
      onProgress?: (progress: ImportProgress) => void;
    }
  ): Promise<void>;
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
   * `listCategories` asks what is stored, this one is allowed to CHANGE what is
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

/**
 * WHICH EDITION IS ANSWERING — for words, and for nothing else.
 *
 * The one field on this descriptor that exists purely so a screen can say
 * "login" or "device" in a sentence a person reads. It is NOT a routing
 * question and no production code may branch on it: every decision that used to
 * be taken from `isUsingSupabase` is a named capability below, and each of those
 * says what it actually governs (can this store push changes to me? how many
 * writes may be in flight? where does a backup go?). The moment a caller writes
 * `if (edition === 'cloud')` it has re-invented the flag this descriptor
 * retired, and the next engine — one that is neither of these two — is back to
 * being unrepresentable.
 *
 * That rule is enforced rather than requested: a test greps the source tree and
 * fails on any production reference to `capabilities.edition` outside a JSX
 * expression. Crude on purpose. A rule about where a word may appear is exactly
 * the kind a grep can hold and a type cannot.
 */
export type Edition = 'cloud' | 'device';

/**
 * Whether this implementation knows WHOSE data it is holding, right now.
 *
 * - 'ready' — an owner is resolved; reads and writes land where they should.
 * - 'connecting' — a sign-in is in progress and the owner has NOT resolved yet.
 *   The dangerous state, and the reason this is on the descriptor at all: a
 *   write attempted here has no owner to stamp, and an implementation that
 *   quietly fell back to a device-local store would put a signed-in person's
 *   data somewhere their app will never read again. Screens that start
 *   irreversible work (a restore, a wipe) refuse while this is the answer.
 * - 'anonymous' — nobody is signing in. Demo mode, a signed-out browser, a
 *   device edition that has no logins at all. This is a perfectly good state to
 *   work in, and is not a degraded 'ready'.
 */
export type SessionState = 'ready' | 'connecting' | 'anonymous';

/**
 * One table of the backup format this store has nowhere to put, and why.
 *
 * The same three fields `BackupRestoreOutcome.notStoredLocally` reports AFTER a
 * restore, asked BEFORE one — which is the whole point of it existing, and is
 * explained at {@link DataPortCapabilities.cannotKeep}.
 */
export interface UnstorableEntity {
  /** The table, as the backup format names it. */
  entity: BackupEntity;
  /** What a person calls it — 'Investments', 'Goal contributions'. */
  label: string;
  /** The reason, in the form somebody reading a warning deserves. */
  absence: string;
}

/**
 * What this implementation can do, answered SYNCHRONOUSLY.
 *
 * Synchronous is a requirement rather than a convenience: every consumer is a
 * render — copy on a card, a batch size chosen on the tick of a write, a gate
 * on opening a subscription — and an async capability check would put a
 * loading state in front of a sentence, or a promise in the middle of a for
 * loop. An implementation that cannot answer these six without I/O is being
 * asked the wrong question; each one is a property of the engine, not of the
 * data in it.
 *
 * It is also a SNAPSHOT. Nothing here is a subscription: `session` in particular
 * changes as a sign-in completes, and a caller that cached this descriptor at
 * boot and read it an hour later would be reading history. Callers re-ask.
 */
export interface DataPortCapabilities {
  /** WORDS ONLY. See {@link Edition} — no production code may branch on this. */
  edition: Edition;
  /** Whether an owner is resolved. See {@link SessionState}. */
  session: SessionState;
  /**
   * Whether changes made somewhere else arrive here on their own.
   *
   * `subscribeToUpdates` is safe to call either way — an implementation with
   * nothing to listen to hands back a no-op unsubscribe — so this is not a
   * guard against calling it. It is what lets a caller skip the machinery
   * AROUND a subscription (debounce timers, suppression windows, teardown
   * bookkeeping) that exists solely to cope with events that will never arrive.
   */
  realtime: boolean;
  /**
   * How many writes a caller may have in flight at once, ALWAYS at least 1.
   *
   * Not a performance hint — a correctness one, and the number is the engine's
   * to state because only the engine knows what its writes cost each other. In
   * the cloud each write is an independent request that lands on its own row, so
   * a handful at a time keeps a few thousand renames tolerable without opening a
   * few thousand sockets. A store that re-reads and re-persists a whole
   * collection per write has no such freedom: two in flight is a lost-update
   * race, and the second write silently overwrites the first from a snapshot
   * taken before it. So the safe answer is 1, and 1 is what every engine that is
   * not sure must say.
   */
  maxConcurrentWrites: number;
  /**
   * Where a backup taken now would come FROM, and be restored INTO.
   *
   * 'login' means an account somewhere else holds the rows and a file is a
   * second copy of them; 'device' means the file is the ONLY copy that exists,
   * which is a materially different thing to tell somebody before they close the
   * tab. The two screens that offer backups say exactly that, and this is what
   * they say it from.
   *
   * 'login' implies `session === 'ready'`: a store whose owner has not resolved
   * is not a login, and offering to read somebody's whole ledger out of one that
   * cannot be named is how a backup ends up full of the wrong data. The contract
   * suite asserts the implication.
   */
  backupTarget: 'login' | 'device';
  /**
   * What a backup file could carry that THIS store has nowhere to put.
   *
   * ── WHY THIS IS A CAPABILITY AND NOT A LIST A SCREEN KEEPS ────────────────
   *
   * Because the screen that needs it was keeping the wrong one, and the bug had
   * a shape worth remembering. `RestoreBackupModal` warns, before a restore
   * begins, that a file holds rows the target cannot keep — and it built that
   * warning from `LOCAL_BACKUP_BINDINGS`, which is a description of the
   * BROWSER's store, chosen by `backupTarget !== 'login'`. A device edition
   * matches that condition and keeps all fourteen tables, so it would have been
   * told its own file's budgets, goals and dismissals could not be restored.
   * Not a cosmetic error: it is a warning about data loss, shown to somebody
   * deciding whether to press a button, and it would have been false.
   *
   * The question — *"what can this store not hold?"* — is a property of the
   * ENGINE, which is what this descriptor is for, and the answer genuinely
   * differs per engine rather than per edition-name. So each implementation
   * describes its own store, and no screen may infer one from `edition` or from
   * `backupTarget` (the rule {@link Edition} states, enforced by the same grep).
   *
   * ── AND IT IS THE SAME ANSWER THE RESTORE GIVES ───────────────────────────
   *
   * `BackupRestoreOutcome.notStoredLocally` reports, afterwards, what was
   * actually left behind. These two must name the same tables, or the dialog
   * warns about one thing and then reports another. The contract suite asserts
   * exactly that — the capability's entities against the outcome's, for a file
   * carrying rows in every table — which is a stronger check than either alone
   * and is why the shapes are one type.
   *
   * EMPTY IS A STATEMENT. An engine that holds every table the format carries
   * says so with `[]` rather than by staying quiet, and the screen then shows no
   * warning because there is nothing to warn about.
   */
  cannotKeep: readonly UnstorableEntity[];
}

export interface DataPortCapabilityDescriptor {
  /**
   * What this implementation can do. Cheap, synchronous, and safe to call in a
   * render — see {@link DataPortCapabilities}.
   */
  capabilities(): DataPortCapabilities;
}

/** The whole seam as it stands. */
export interface DataPort extends
  DataPortReads,
  DataPortBoot,
  DataPortAccountWrites,
  DataPortTransactionWrites,
  DataPortBulkWrites,
  DataPortTransferWrites,
  DataPortSplitWrites,
  DataPortPlanningWrites,
  DataPortReportWrites,
  DataPortInvestmentWrites,
  DataPortDismissalWrites,
  DataPortBackupLifecycle,
  DataPortMigration,
  DataPortLifecycle,
  DataPortCapabilityDescriptor {}
