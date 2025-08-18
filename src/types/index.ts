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
  category: string;
  amount: number;
  period: 'monthly' | 'weekly' | 'yearly';
  isActive: boolean;
  createdAt: Date;
  name?: string;
  color?: string;
  spent?: number;
  budgeted?: number;
  limit?: number;
  updatedAt?: Date;
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
  progress?: number;
  updatedAt?: Date;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  level: 'type' | 'sub' | 'detail';
  parentId?: string;
  color?: string;
  icon?: string;
  isSystem?: boolean;
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
