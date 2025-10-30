import type { Account, Transaction, Budget, Goal } from '@/types';

export const createMockAccount = (overrides: Partial<Account> = {}): Account => ({
  id: '1',
  name: 'Test Account',
  type: 'savings',
  balance: 1000,
  currency: 'GBP',
  institution: 'Test Bank',
  lastUpdated: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockTransaction = (
  overrides: Partial<Transaction> = {},
): Transaction => ({
  id: '1',
  date: new Date(),
  amount: 100,
  description: 'Test Transaction',
  category: 'groceries',
  accountId: '1',
  type: 'expense',
  cleared: false,
  ...overrides,
});

export const createMockBudget = (overrides: Partial<Budget> = {}): Budget => ({
  id: '1',
  categoryId: 'groceries',
  amount: 500,
  period: 'monthly',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  spent: 0,
  ...overrides,
});

export const createMockGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: '1',
  name: 'Test Goal',
  type: 'savings',
  targetAmount: 10000,
  currentAmount: 5000,
  targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  progress: 0.5,
  ...overrides,
});
