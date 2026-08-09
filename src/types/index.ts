import type { AccountType } from './accountType';

export type { AccountType };

export interface Holding {
  ticker: string;
  name: string;
  shares: number;
  value: number;
  averageCost?: number;
  currentPrice?: number;
  marketValue?: number;
  gain?: number;
  gainPercent?: number;
  currency?: string;
  costBasis?: number;
  lastUpdated?: Date;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  institution?: string;
  lastUpdated: Date;
  openingBalance?: number;
  openingBalanceDate?: Date;
  /**
   * Soft-archive cutoff: transactions on/before this date (that are
   * reconciled) are hidden from the live register. NULL/undefined = nothing
   * archived ("keep all"). Balances are unaffected — see soft_archive.
   */
  archiveThroughDate?: Date | null;
  /**
   * Investment↔cash pairing (the Microsoft Money model): set on a CASH
   * account, pointing at the investment account it belongs to. The Accounts
   * page nests it inside that parent and counts its balance in the parent's
   * section; the cash account itself stays a full, real account (register,
   * transfers, reconciliation). NULL/undefined = a normal top-level account.
   */
  parentAccountId?: string | null;
  holdings?: Holding[];
  notes?: string;
  isActive?: boolean;
  plaidConnectionId?: string;
  plaidAccountId?: string;
  mask?: string;
  updatedAt?: Date;
  createdAt?: Date;
  sortCode?: string; // UK bank sort code (XX-XX-XX format)
  accountNumber?: string; // Bank account number (typically 8 digits)
  available?: number;
  tags?: string[];
  creditLimit?: number;
  subtype?: string;
  bankBalance?: number | null;
  /**
   * The day `bankBalance` is true for — a calendar day, 'YYYY-MM-DD'.
   *
   * A string rather than a Date on purpose. The column is a Postgres DATE: a
   * day with no time and no zone. Wrapping it in a Date invents a midnight,
   * and a midnight has to belong to some zone — which is how a statement dated
   * the 31st comes to be displayed as the 30th west of Greenwich. Kept as the
   * day itself, storage, comparison and display are all exact, and "is this
   * statement older than what we already hold?" is a string comparison that
   * cannot drift.
   */
  bankBalanceDate?: string | null;
  lastReconciledDate?: Date | null;
  lowBalanceThreshold?: number;
  lowBalanceAlertEnabled?: boolean;
}

/**
 * The fields an account update may write.
 *
 * Distinct from `Partial<Account>` because an update can CLEAR a field, which a
 * stored Account never represents: `null` means "remove the stored value".
 * `undefined` cannot express that — mapAccountToDb (services/api/accountService)
 * skips undefined fields, so an undefined sortCode leaves the column untouched
 * rather than emptying it. Any `Partial<Account>` is still a valid update.
 */
export type AccountUpdate = Partial<Omit<Account, 'sortCode'>> & {
  sortCode?: string | null;
};

export interface Transaction {
  id: string;
  date: Date;
  amount: number;
  description: string;
  category: string;
  /**
   * Has a human vouched for `category`?
   *
   * false = the app guessed it (the smart categoriser on a statement file,
   * payee memory on a bank feed) and nobody has agreed yet. The register shows
   * such a category differently and offers a one-click confirm; the figure
   * still counts in every report exactly as before, because a suggestion the
   * user has not got to is still the best answer available.
   *
   * true / undefined = confirmed. `undefined` is what a database without
   * migration 20260808100000 returns, and what the local/demo store holds, so
   * "unmarked" must read as confirmed or the badge appears on everything the
   * user ever typed. See src/utils/categoryProvenance.ts — that asymmetry is
   * written down once and read from there, never re-derived.
   */
  categoryConfirmed?: boolean;
  categoryName?: string;
  accountId: string;
  type: 'income' | 'expense' | 'transfer';
  tags?: string[];
  notes?: string;
  cleared?: boolean;
  /** @deprecated Will be removed in reconciliation cleanup */
  reconciledWith?: string;
  /** @deprecated Will be removed in reconciliation cleanup */
  reconciledDate?: Date;
  /** @deprecated Will be removed in reconciliation cleanup */
  reconciledNotes?: string;
  bankReference?: string;
  isRecurring?: boolean;
  isSplit?: boolean;
  isImported?: boolean;
  /**
   * Soft-archived: hidden from the live register but never deleted and still
   * counted in balances and reports. Set by the archive operation and the
   * reconcile-sweep; cleared by unarchive. See the soft_archive migration.
   */
  archived?: boolean;
  pending?: boolean;
  plaidTransactionId?: string;
  merchant?: string;
  paymentChannel?: string;
  location?: {
    city: string | null;
    region: string | null;
    country: string | null;
  };
  goalId?: string;
  accountName?: string;
  /**
   * Position of this row within the statement it was imported from — the
   * BANK's own order among transactions that share a date.
   *
   * `date` is a calendar day, so same-day rows carry no order of their own and
   * the register has to invent one to run a balance down the page. This is the
   * one honest answer: OFX lists <STMTTRN> in statement order, so the file
   * position is the bank's sequence. An ordinal, never a time — a statement
   * states sequence, and a fabricated clock time would be a worse lie.
   *
   * Null/undefined = unknown, which is the truth for every hand-entered row and
   * every row imported before the column existed. See compareChronological for
   * how those interleave with rows that do know their place.
   */
  statementSequence?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
  recurringTransactionId?: string;
  addedBy?: string; // Member ID who added this transaction
  linkedTransferId?: string; // ID of the corresponding transfer transaction in the other account
  transferAccountId?: string; // Account ID of the other side of a transfer
  /**
   * When the linked side is a SPLIT transaction (this leg's opposite is one
   * line inside it, not the whole row): the id of that TransactionSplit line.
   * linkedTransferId then points at the split parent. Absent for ordinary
   * transaction↔transaction pairs.
   */
  linkedTransferSplitId?: string;

  // Transfer-specific metadata for wealth management
  transferMetadata?: {
    // Core transfer info
    transferType?: 'internal' | 'wire' | 'ach' | 'crypto' | 'asset_sale' | 'dividend' | 'rebalance';
    transferPurpose?: string; // "Quarterly rebalancing", "Tax payment", "Investment funding", etc.
    
    // Financial details
    fees?: number; // Transfer fees charged
    feesCurrency?: string; // Currency of fees if different
    exchangeRate?: number; // For cross-currency transfers
    originalAmount?: number; // Amount before conversion
    originalCurrency?: string; // Original currency
    
    // Asset-specific
    assetType?: 'cash' | 'stock' | 'bond' | 'crypto' | 'real_estate' | 'commodity' | 'other';
    units?: number; // Number of units transferred (shares, coins, etc.)
    pricePerUnit?: number; // Price at time of transfer
    marketValue?: number; // Total market value at transfer time
    costBasis?: number; // For tax purposes
    
    // Timing and scheduling
    initiatedDate?: Date; // When transfer was initiated
    settlementDate?: Date; // When transfer actually settles
    isScheduled?: boolean; // Is this a scheduled/recurring transfer
    scheduleId?: string; // Link to transfer schedule
    
    // Compliance and audit
    approvedBy?: string; // For transfers requiring approval
    approvalDate?: Date;
    reference?: string; // External reference number
    documentation?: string[]; // Links to supporting documents
    taxImplications?: string; // Notes on tax impact
    
    // Reconciliation
    expectedAmount?: number; // What we expected to receive
    actualAmount?: number; // What actually arrived
    discrepancy?: number; // Difference if any
    reconciliationStatus?: 'pending' | 'matched' | 'discrepancy' | 'resolved';
    reconciliationNotes?: string;
  };
  
  // Investment-specific fields
  investmentData?: {
    symbol?: string;
    quantity?: number;
    pricePerShare?: number;
    transactionFee?: number;
    stampDuty?: number;
    totalCost?: number;
  };
}

/**
 * One category line of a split transaction. A split transaction stays a
 * single ledger row (one date, one payee, one signed amount, one balance
 * effect); its categorisation moves into lines that MUST sum exactly to the
 * transaction amount — enforced by the set_transaction_splits RPC and its
 * guard trigger. Amounts are signed with the same convention as
 * Transaction.amount; a negative-relative line (e.g. cashback inside a shop)
 * is legal, exactly like Microsoft Money.
 */
export interface TransactionSplit {
  id: string;
  transactionId: string;
  /** Category id as text — same convention as Transaction.category. */
  category: string;
  amount: number;
  memo?: string;
  sortOrder: number;
  /**
   * Set when this LINE is one leg of a transfer (the Microsoft Money model —
   * a transfer recorded inside a split): the account on the other side, and
   * the counterpart transaction over there. The counterpart's
   * linkedTransferId points back at this line's parent transaction, and its
   * linkedTransferSplitId at this line.
   */
  transferAccountId?: string;
  linkedTransferId?: string;
}

/** Input for creating/replacing a transaction's splits (ids are server-assigned). */
export interface TransactionSplitInput {
  category: string;
  amount: number;
  memo?: string;
  /**
   * The line this input replaces, when it came from an existing split. Sending
   * it is what lets the writer tell "this line was edited" from "this line was
   * removed and another arrived" — the distinction a split containing a
   * transfer leg depends on, because a removed leg strands its counterpart.
   * Omitted for brand-new lines (the id is then server-assigned).
   */
  id?: string;
  /**
   * Set to make this LINE one leg of a transfer: the account on the other
   * side. A line that gains a target has its counterpart created and linked in
   * the same write; a line that already carries this target keeps whatever
   * link it has (never a second counterpart).
   */
  transferAccountId?: string;
}

/**
 * What a split write actually did. `counterparts` holds the transactions
 * created for lines that BECAME transfer legs in this write — real rows in
 * other accounts, so the caller updates its state and those accounts'
 * balances from them rather than guessing. Empty for every ordinary split.
 */
export interface SplitWriteResult {
  isSplit: boolean;
  splitCount: number;
  amount: number;
  counterparts: Transaction[];
}

/**
 * Which sweep made the offer the user refused. Part of a dismissal's identity,
 * because the same two rows can be a transfer pair to one scan and a duplicate
 * to another, and those two offers have opposite consequences — refusing one
 * must never silently suppress the other.
 *
 * The payee kinds are the odd ones out: they are refusals about payee TEXT,
 * not about rows. Payee cleanup guesses which payee texts are one merchant, and
 * that guess is recomputed from the register every time the screen opens — so a
 * refusal of it has to outlive the transactions it happened to be drawn from
 * (re-import a statement and the same wording arrives on brand new rows). They
 * therefore carry no subjectIds, and their subjectKey holds text rather than
 * ids. See utils/suggestionDismissals for the key format that keeps that safe.
 */

/**
 * The three granularities Payee cleanup can be told to stop offering, from
 * narrowest to widest. They are separate kinds rather than one, because they
 * have three different consequences and a user who invoked one must never have
 * another applied for them:
 *
 *   payee-line      one payee kept out of ONE suggested merchant. The payee
 *                   stays in the list and in every other suggestion.
 *   payee-merchant  a whole suggested grouping refused. Every payee under it
 *                   stays in the list, and each may still be renamed by hand.
 *   payee-hidden    a payee taken off the screen altogether: out of the list,
 *                   out of every suggestion, and out of every count on it.
 */
export type PayeeDismissalKind =
  /** A whole suggested merchant on Payee cleanup: "these are not one shop". */
  | 'payee-merchant'
  /** One payee text kept out of a suggested merchant it otherwise matches. */
  | 'payee-line'
  /** One payee text the screen must stop listing and stop counting entirely. */
  | 'payee-hidden';

export type DismissalKind =
  | 'transfer-pair'
  | 'transfer-leg'
  | 'stranded'
  | 'duplicate'
  | PayeeDismissalKind;

/**
 * A suggestion the user has told a sweep to stop offering. Holds no financial
 * data and changes no figure: it can only hide an offer.
 *
 * See utils/suggestionDismissals for how `subjectKey` is built — canonical and
 * order-independent, so a dismissal survives a re-scan that reaches the same
 * rows from the other end.
 */
export interface SuggestionDismissal {
  id: string;
  kind: DismissalKind;
  subjectKey: string;
  /** The transactions the suggestion was about, in role order. */
  subjectIds: string[];
  dismissedAt: Date;
}

export interface Budget {
  id: string;
  categoryId: string;  // Changed from 'category' to match service implementation
  amount: number;
  period: 'monthly' | 'weekly' | 'yearly' | 'custom' | 'quarterly';
  isActive: boolean;
  createdAt: Date;
  name?: string;
  color?: string;
  spent: number;  // Made required to match service
  budgeted?: number;
  limit?: number;
  updatedAt: Date;  // Made required to match service
  startDate?: string;
  endDate?: string;
  rollover?: boolean;
  rolloverAmount?: number;
  alertThreshold?: number;
  notes?: string;
}

export interface Goal {
  id: string;
  name: string;
  type: 'savings' | 'debt-payoff' | 'investment' | 'custom';
  targetAmount: number;
  currentAmount: number;
  targetDate: Date;
  description?: string;
  linkedAccountIds?: string[];
  isActive: boolean;
  createdAt: Date;
  achieved?: boolean;
  progress: number;  // Made required to match service
  updatedAt: Date;  // Made required to match service
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: 'active' | 'completed' | 'paused';
  accountId?: string;
  autoContribute?: boolean;
  contributionAmount?: number;
  contributionFrequency?: string;
  icon?: string;
  color?: string;
  completedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  level: 'type' | 'sub' | 'detail';
  parentId?: string | null;
  color?: string;
  icon?: string;
  isSystem?: boolean;
  description?: string;
  isTransferCategory?: boolean; // Indicates this is an account-specific transfer category
  isRevaluationCategory?: boolean; // Indicates a change in VALUE (portfolio revaluation) — not income, expense or transfer
  isUnassignedBucket?: boolean; // Rows here are NOT classified — they carry a category id only because the splits schema forbids blank; treated as uncategorised (the MS Money importer's "Unassigned" bucket)
  accountId?: string; // The account this transfer category is associated with
  isActive?: boolean; // Used for soft-deleting categories (e.g., when account is deleted)
}

/**
 * What a category merge actually moved — the database's own counts, not the
 * client's prediction, so the confirmation toast reports what happened rather
 * than what was expected. `splitTransactions` is the number of split PARENTS
 * touched; `splitLines` the number of individual lines inside them.
 */
export interface CategoryMergeResult {
  sourceId: string;
  targetId: string;
  transactions: number;
  splitLines: number;
  splitTransactions: number;
  budgets: number;
  recurring: number;
}

export interface Investment {
  id: string;
  accountId: string;
  symbol: string;
  name: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: Date;
  currentPrice?: number;
  lastUpdated?: Date;
  notes?: string;
  costBasis?: number;
  currentValue: number;
  averageCost: number;
  createdAt: Date;
}

// Export AppState
export type { AppState, Tag } from './app-state';

// User type for authentication
export interface User {
  id: string;
  email: string;
  name?: string;
  profileImageUrl?: string;
  createdAt: Date;
}

export interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  accountId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  startDate: Date;
  endDate?: Date;
  nextDate: Date;
  lastProcessed?: Date;
  isActive: boolean;
  tags?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Re-export widget types
export * from './widget-types';

// Re-export subscription types
export * from '@app-types/subscription';
