export interface Account {
  id: string;
  name: string;
  type: 'current' | 'savings' | 'credit' | 'loan' | 'investment' | 'other';
  balance: number;
  currency: string;
  institution: string;
  lastUpdated: Date;
  holdings?: any[];
  notes?: string;
}

export interface Transaction {
  id: string;
  date: Date;
  amount: number;
  description: string;
  category: string; // This will now store the detail category ID
  categoryName?: string; // For backward compatibility and display
  accountId: string;
  type: 'income' | 'expense';
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
