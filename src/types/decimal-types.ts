import type { DecimalInstance } from '@wealthtracker/utils';
import type { Budget } from './index';
import type { AccountType } from './accountType';

/**
 * Decimal-based types for financial calculations
 * These will gradually replace the number-based types
 */

export type { DecimalInstance } from '@wealthtracker/utils';

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
  // The canonical union rather than a copy of it: an Account converted to its
  // Decimal twin must not be able to lose or fail on a type the app allows.
  type: AccountType;
  balance: DecimalInstance;
  currency: string;
  institution?: string;
  lastUpdated: Date;
  openingBalance?: DecimalInstance;
  openingBalanceDate?: Date;
  /* No `holdings` here either — see the note on `Account` in ./index.ts. */
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

export interface DecimalBudget extends Omit<Budget, 'amount'> {
  amount: DecimalInstance;
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
  updatedAt?: Date;
  progress?: number;
}
