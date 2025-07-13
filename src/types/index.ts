export interface Holding {
  ticker: string;
  name: string;
  shares: number;
  value: number;
}

export interface Account {
  id: string;
  name: string;
  type: 'current' | 'checking' | 'savings' | 'credit' | 'loan' | 'investment' | 'assets' | 'other';
  balance: number;
  currency: string;
  institution?: string;
  lastUpdated: Date;
  openingBalance?: number;
  openingBalanceDate?: Date;
  holdings?: Holding[];
  notes?: string;
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
  bankReference?: string;
  isRecurring?: boolean;
}

export interface Budget {
  id: string;
  category: string;
  amount: number;
  period: 'monthly' | 'weekly' | 'yearly';
  isActive: boolean;
  createdAt: Date;
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
}
