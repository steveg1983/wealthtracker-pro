import React, { type ComponentType, type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import type { Transaction, Account, Budget, Goal, Category } from '@/types';

import { AllProviders } from './testingWrappers';

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  wrapper?: ComponentType<{
    children: ReactNode;
  }>;
}

export const renderWithProviders = (
  ui: ReactElement,
  { wrapper: CustomWrapper, ...options }: RenderWithProvidersOptions = {},
) => {
  const Wrapper: ComponentType<{ children: ReactNode }> = ({ children }) => {
    if (CustomWrapper) {
      return (
        <AllProviders>
          <CustomWrapper>{children}</CustomWrapper>
        </AllProviders>
      );
    }

    return <AllProviders>{children}</AllProviders>;
  };

  return render(ui, { wrapper: Wrapper, ...options });
};

export const createMockTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: `test-transaction-${Math.random().toString(36).slice(2, 11)}`,
  accountId: 'test-account-1',
  amount: 100,
  type: 'expense',
  category: 'groceries',
  description: 'Test transaction',
  date: new Date('2025-01-20'),
  pending: false,
  ...overrides,
});

export const createMockAccount = (overrides: Partial<Account> = {}): Account => ({
  id: `test-account-${Math.random().toString(36).slice(2, 11)}`,
  name: 'Test Account',
  type: 'current',
  balance: 1000,
  currency: 'GBP',
  lastUpdated: new Date('2025-01-20'),
  updatedAt: new Date('2025-01-20'),
  ...overrides,
});

export const createMockBudget = (overrides: Partial<Budget> = {}): Budget => ({
  id: `test-budget-${Math.random().toString(36).slice(2, 11)}`,
  name: 'Test Budget',
  categoryId: 'groceries',
  amount: 500,
  period: 'monthly',
  startDate: new Date('2025-01-01').toISOString(),
  endDate: new Date('2025-12-31').toISOString(),
  spent: 0,
  isActive: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-20'),
  ...overrides,
});

export const createMockGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: `test-goal-${Math.random().toString(36).slice(2, 11)}`,
  name: 'Test Goal',
  targetAmount: 1000,
  currentAmount: 250,
  targetDate: new Date('2025-12-31'),
  type: 'savings',
  isActive: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-20'),
  progress: 0,
  priority: 'medium',
  category: 'savings',
  ...overrides,
});

export const createMockCategory = (overrides: Partial<Category> = {}): Category => ({
  id: `test-category-${Math.random().toString(36).slice(2, 11)}`,
  name: 'Test Category',
  color: '#3B82F6',
  type: 'expense',
  level: 'detail',
  parentId: null,
  isActive: true,
  ...overrides,
});

export const mockTransactions: Transaction[] = [
  createMockTransaction({
    id: 'trans-1',
    type: 'income',
    amount: 3000,
    category: 'salary',
    description: 'Monthly salary',
    date: new Date('2025-01-15'),
  }),
  createMockTransaction({
    id: 'trans-2',
    type: 'expense',
    amount: 500,
    category: 'groceries',
    description: 'Weekly groceries',
    date: new Date('2025-01-18'),
  }),
  createMockTransaction({
    id: 'trans-3',
    type: 'expense',
    amount: 1200,
    category: 'housing',
    description: 'Monthly rent',
    date: new Date('2025-01-01'),
  }),
];

export const mockAccounts: Account[] = [
  createMockAccount({
    id: 'acc-1',
    name: 'Main Checking',
    type: 'current',
    balance: 5000,
  }),
  createMockAccount({
    id: 'acc-2',
    name: 'Savings Account',
    type: 'savings',
    balance: 10000,
  }),
  createMockAccount({
    id: 'acc-3',
    name: 'Credit Card',
    type: 'credit',
    balance: -2000,
  }),
];
