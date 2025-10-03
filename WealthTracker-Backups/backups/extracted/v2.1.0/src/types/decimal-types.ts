import type { DecimalInstance } from '../utils/decimal';

/**
 * Decimal-based types for financial calculations
 * These will gradually replace the number-based types
 */

export type { DecimalInstance } from '../utils/decimal';

export interface DecimalHolding {
  ticker: string;
  name: string;
  shares: DecimalInstance;
  value: DecimalInstance;
  averageCost?: DecimalInstance;
  currentPrice?: DecimalInstance;
  marketValue?: DecimalInstance;
  gain?: DecimalInstance;
  gainPercent?: DecimalInstance;
  currency?: string;
  lastUpdated?: Date;
}

export interface DecimalAccount {
  id: string;
  name: string;
  type: 'current' | 'savings' | 'credit' | 'loan' | 'investment' | 'asset' | 'mortgage' | 'assets' | 'other' | 'checking';
  balance: DecimalInstance;
  currency: string;
  institution?: string;
  lastUpdated: Date;
  openingBalance?: DecimalInstance;
  openingBalanceDate?: Date;
  holdings?: DecimalHolding[];
  notes?: string;
  isActive?: boolean;
  plaidConnectionId?: string;
  plaidAccountId?: string;
  mask?: string;
  initialBalance?: DecimalInstance;
}

export interface DecimalTransaction {
  id: string;
  date: Date;
  amount: DecimalInstance;
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
}

export interface DecimalBudget {
  id: string;
  category: string;
  amount: DecimalInstance;
  period: 'monthly' | 'weekly' | 'yearly';
  isActive: boolean;
  createdAt: Date;
}

export interface DecimalGoal {
  id: string;
  name: string;
  type: 'savings' | 'debt-payoff' | 'investment' | 'custom';
  targetAmount: DecimalInstance;
  currentAmount: DecimalInstance;
  targetDate: Date;
  description?: string;
  linkedAccountIds?: string[];
  isActive: boolean;
  createdAt: Date;
}