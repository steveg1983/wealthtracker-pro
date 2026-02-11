/* eslint-disable react-refresh/only-export-components */
/**
 * Test Utilities
 * Common testing utilities and helpers for unit and integration tests
 */

import React from 'react';
import { createScopedLogger } from '../loggers/scopedLogger';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { store } from '../store';
import { AppProvider } from './mocks/AppContextSupabase';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { LayoutProvider } from '../contexts/LayoutContext';
import { ThemeProvider } from '../design-system';
import type { Transaction, Account, Budget, Goal, Category } from '../types';

// Mock data generators
export const createMockTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'test-transaction-' + Math.random().toString(36).substr(2, 9),
  accountId: 'test-account-1',
  amount: 100,
  type: 'expense',
  category: 'groceries',
  description: 'Test transaction',
  date: new Date('2025-01-20'),
  pending: false,
  isReconciled: false,
  ...overrides,
});

export const createMockAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'test-account-' + Math.random().toString(36).substr(2, 9),
  name: 'Test Account',
  type: 'current',
  balance: 1000,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-20'),
  ...overrides,
});

export const createMockBudget = (overrides: Partial<Budget> = {}): Budget => ({
  id: 'test-budget-' + Math.random().toString(36).substr(2, 9),
  name: 'Test Budget',
  category: 'groceries',
  amount: 500,
  period: 'monthly',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-12-31'),
  spent: 0,
  isActive: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-20'),
  ...overrides,
});

export const createMockGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 'test-goal-' + Math.random().toString(36).substr(2, 9),
  name: 'Test Goal',
  targetAmount: 1000,
  currentAmount: 250,
  targetDate: new Date('2025-12-31'),
  category: 'savings',
  isCompleted: false,
  priority: 'medium',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-20'),
  ...overrides,
});

export const createMockCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'test-category-' + Math.random().toString(36).substr(2, 9),
  name: 'Test Category',
  color: '#3B82F6',
  type: 'expense',
  parentId: null,
  isActive: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-20'),
  ...overrides,
});

// Test data sets
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

export const mockBudgets: Budget[] = [
  createMockBudget({
    id: 'budget-1',
    name: 'Groceries Budget',
    category: 'groceries',
    amount: 600,
    spent: 250,
  }),
  createMockBudget({
    id: 'budget-2',
    name: 'Entertainment Budget',
    category: 'entertainment',
    amount: 200,
    spent: 150,
  }),
];

export const mockGoals: Goal[] = [
  createMockGoal({
    id: 'goal-1',
    name: 'Emergency Fund',
    targetAmount: 10000,
    currentAmount: 3500,
    priority: 'high',
  }),
  createMockGoal({
    id: 'goal-2',
    name: 'Vacation Fund',
    targetAmount: 3000,
    currentAmount: 1200,
    priority: 'medium',
  }),
];

// Context providers wrapper for testing
interface AllProvidersProps {
  children: React.ReactNode;
  initialState?: {
    accounts?: Account[];
    transactions?: Transaction[];
    budgets?: Budget[];
    goals?: Goal[];
  };
}

export const AllProviders: React.FC<AllProvidersProps> = ({ 
  children, 
  initialState = {} 
}) => {
  return (
    <BrowserRouter>
      <Provider store={store}>
        <PreferencesProvider>
          <ThemeProvider>
            <AppProvider initialData={initialState}>
              <NotificationProvider>
                <LayoutProvider>
                  {children}
                </LayoutProvider>
              </NotificationProvider>
            </AppProvider>
          </ThemeProvider>
        </PreferencesProvider>
      </Provider>
    </BrowserRouter>
  );
};

// Custom render function that includes all providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialState?: {
    accounts?: Account[];
    transactions?: Transaction[];
    budgets?: Budget[];
    goals?: Goal[];
  };
  wrapper?: React.ComponentType<{ children?: React.ReactNode }>;
}

export const renderWithProviders = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { initialState, wrapper, ...renderOptions } = options;

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (wrapper) {
      const CustomWrapper = wrapper;
      return (
        <AllProviders initialState={initialState}>
          <CustomWrapper>{children}</CustomWrapper>
        </AllProviders>
      );
    }
    return <AllProviders initialState={initialState}>{children}</AllProviders>;
  };

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Mock hook generators
export const createMockHook = <T,>(returnValue: T) => {
  return vi.fn(() => returnValue);
};

// Common assertions
export const expectToBeWithinRange = (
  actual: number,
  expected: number,
  tolerance: number = 0.01
) => {
  expect(actual).toBeGreaterThanOrEqual(expected - tolerance);
  expect(actual).toBeLessThanOrEqual(expected + tolerance);
};

// Date helpers for testing
export const createDateRange = (startDays: number, endDays: number) => {
  const now = new Date('2025-01-20');
  const start = new Date(now);
  start.setDate(start.getDate() + startDays);
  const end = new Date(now);
  end.setDate(end.getDate() + endDays);
  return { start, end };
};

// Async testing helpers
export const waitForNextTick = () => new Promise(resolve => setTimeout(resolve, 0));

export const waitForCondition = async (
  condition: () => boolean,
  timeout: number = 1000,
  interval: number = 10
): Promise<void> => {
  const startTime = Date.now();
  
  while (!condition() && Date.now() - startTime < timeout) {
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  if (!condition()) {
    throw new Error(`Condition not met within ${timeout}ms`);
  }
};

// Storage testing utilities
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  const mockStorage = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
  
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true,
  });
  
  return mockStorage;
};

// Error boundary for testing
const testLogger = createScopedLogger('TestErrorBoundary');
export class TestErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    testLogger.error('Test error boundary caught an error', { error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return <div data-testid="error-boundary">An error occurred</div>;
    }

    return this.props.children;
  }
}

// Performance testing utilities
export const measureRenderTime = async (renderFn: () => void): Promise<number> => {
  const start = performance.now();
  renderFn();
  await waitForNextTick();
  return performance.now() - start;
};

// Form testing utilities
export const fillForm = async (
  form: HTMLFormElement,
  data: Record<string, string>
) => {
  const { fireEvent } = await import('@testing-library/react');
  
  Object.entries(data).forEach(([name, value]) => {
    const input = form.querySelector(`[name="${name}"]`) as HTMLInputElement;
    if (input) {
      fireEvent.change(input, { target: { value } });
    }
  });
};

// Export everything for convenience
export * from '@testing-library/react';
export { vi } from 'vitest';
