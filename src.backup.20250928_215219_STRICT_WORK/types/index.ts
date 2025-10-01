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
  lastUpdated?: Date;
}

export interface Account {
  id: string;
  name: string;
  type: 'current' | 'savings' | 'credit' | 'loan' | 'investment' | 'asset' | 'mortgage' | 'assets' | 'other' | 'checking';
  balance: number;
  currency: string;
  institution?: string;
  lastUpdated: Date;
  openingBalance?: number;
  openingBalanceDate?: Date;
  holdings?: Holding[];
  notes?: string;
  isActive?: boolean;
  plaidConnectionId?: string;
  plaidAccountId?: string;
  mask?: string;
  updatedAt?: Date;
  sortCode?: string; // UK bank sort code (XX-XX-XX format)
  accountNumber?: string; // Bank account number (typically 8 digits)
  available?: number;
  tags?: string[];
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
  reconciledWith?: string;
  reconciledDate?: Date;
  reconciledNotes?: string;
  bankReference?: string;
  isRecurring?: boolean;
  isSplit?: boolean;
  isImported?: boolean;
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
  recurringTransactionId?: string;
  addedBy?: string; // Member ID who added this transaction
  linkedTransferId?: string; // ID of the corresponding transfer transaction in the other account
  
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
  accountId?: string; // The account this transfer category is associated with
  isActive?: boolean; // Used for soft-deleting categories (e.g., when account is deleted)
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
export * from './subscription';
