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
  type: 'current' | 'savings' | 'credit' | 'loan' | 'investment' | 'asset' | 'liability' | 'mortgage' | 'assets' | 'other' | 'checking';
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
  lastReconciledDate?: Date | null;
  lowBalanceThreshold?: number;
  lowBalanceAlertEnabled?: boolean;
}

export interface Transaction {
  id: string;
  date: Date;
  amount: number;
  description: string;
  category: string;
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
 */
export type DismissalKind = 'transfer-pair' | 'transfer-leg' | 'stranded' | 'duplicate';

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
