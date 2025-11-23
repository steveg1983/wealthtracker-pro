/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore, type PreloadedState } from '@reduxjs/toolkit';
import { MemoryRouter, Routes } from 'react-router-dom';
import type { RootState } from '../../store';

// Import all slices
import accountsReducer from '../../store/slices/accountsSlice';
import transactionsReducer from '../../store/slices/transactionsSlice';
import budgetsReducer from '../../store/slices/budgetsSlice';
import categoriesReducer from '../../store/slices/categoriesSlice';
import goalsReducer from '../../store/slices/goalsSlice';
import preferencesReducer from '../../store/slices/preferencesSlice';
import recurringTransactionsReducer from '../../store/slices/recurringTransactionsSlice';
import tagsReducer from '../../store/slices/tagsSlice';
import notificationsReducer from '../../store/slices/notificationsSlice';
import layoutReducer from '../../store/slices/layoutSlice';

import { CombinedProvider } from '../../contexts/CombinedProvider';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: PreloadedState<RootState>;
  route?: string;
  routes?: React.ReactElement;
}

// Create a custom render function that includes all providers
export function renderWithProviders(
  ui: React.ReactElement,
  {
    preloadedState = {},
    route = '/',
    routes,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  // Create a fresh store for each test
  const store = configureStore({
    reducer: {
      accounts: accountsReducer,
      transactions: transactionsReducer,
      budgets: budgetsReducer,
      categories: categoriesReducer,
      goals: goalsReducer,
      preferences: preferencesReducer,
      recurringTransactions: recurringTransactionsReducer,
      tags: tagsReducer,
      notifications: notificationsReducer,
      layout: layoutReducer,
    },
    preloadedState,
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>
          <CombinedProvider>
            {routes ? (
              <Routes>{routes}</Routes>
            ) : (
              children
            )}
          </CombinedProvider>
        </MemoryRouter>
      </Provider>
    );
  }

  return {
    ...rtlRender(ui, { wrapper: Wrapper, ...renderOptions }),
    store,
  };
}

// Helper to wait for async operations
export const waitForLoadingToFinish = () => {
  return new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
};

// Mock localStorage
export const mockLocalStorage = () => {
  const storage: { [key: string]: string } = {};
  
  const localStorageMock = {
    getItem: (key: string) => storage[key] || null,
    setItem: (key: string, value: string) => {
      storage[key] = value;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    clear: () => {
      Object.keys(storage).forEach(key => delete storage[key]);
    },
    get length() {
      return Object.keys(storage).length;
    },
    key: (index: number) => {
      const keys = Object.keys(storage);
      return keys[index] || null;
    },
  };

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  return localStorageMock;
};

// Helper to create test data
export const createTestData = () => {
  const accounts = [
    {
      id: 'acc1',
      name: 'Checking Account',
      type: 'current' as const,
      balance: 1000,
      currency: 'GBP',
      institution: 'Test Bank',
      lastUpdated: new Date(),
    },
    {
      id: 'acc2',
      name: 'Savings Account',
      type: 'savings' as const,
      balance: 5000,
      currency: 'GBP',
      institution: 'Test Bank',
      lastUpdated: new Date(),
    },
  ];

  const categories = [
    { id: 'cat1', name: 'Food & Dining', type: 'expense' as const, color: '#FF6B6B' },
    { id: 'cat2', name: 'Transportation', type: 'expense' as const, color: '#4ECDC4' },
    { id: 'cat3', name: 'Shopping', type: 'expense' as const, color: '#45B7D1' },
    { id: 'cat4', name: 'Salary', type: 'income' as const, color: '#96CEB4' },
  ];

  const transactions = [
    {
      id: 'trans1',
      accountId: 'acc1',
      amount: 50,
      type: 'expense' as const,
      category: 'cat1',
      description: 'Grocery shopping',
      date: new Date().toISOString(),
    },
    {
      id: 'trans2',
      accountId: 'acc1',
      amount: 2000,
      type: 'income' as const,
      category: 'cat4',
      description: 'Monthly salary',
      date: new Date().toISOString(),
    },
  ];

  const budgets = [
    {
      id: 'budget1',
      category: 'cat1',
      amount: 500,
      period: 'monthly' as const,
      isActive: true,
    },
    {
      id: 'budget2',
      category: 'cat2',
      amount: 200,
      period: 'monthly' as const,
      isActive: true,
    },
  ];

  const goals = [
    {
      id: 'goal1',
      name: 'Emergency Fund',
      targetAmount: 10000,
      currentAmount: 5000,
      targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      category: 'savings',
    },
  ];

  return {
    accounts,
    categories,
    transactions,
    budgets,
    goals,
  };
};

// Re-export everything from RTL
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
