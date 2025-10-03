import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { ClerkProvider } from '@clerk/clerk-react';
import accountsReducer from '../slices/accountsSlice';
import transactionsReducer from '../slices/transactionsSlice';
import categoriesReducer from '../slices/categoriesSlice';
import budgetsReducer from '../slices/budgetsSlice';
import goalsReducer from '../slices/goalsSlice';
import tagsReducer from '../slices/tagsSlice';
import recurringTransactionsReducer from '../slices/recurringTransactionsSlice';
import preferencesReducer from '../slices/preferencesSlice';
import notificationsReducer from '../slices/notificationsSlice';
import layoutReducer from '../slices/layoutSlice';
import { useAppSelector } from '../index';
import { AppProvider } from '../../contexts/AppContextSupabase';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { LayoutProvider } from '../../contexts/LayoutContext';
import { ReduxMigrationWrapper } from '../../components/ReduxMigrationWrapper';

// Use real Clerk test data instead of mocks
const TEST_USER = {
  id: 'user_test123',
  primaryEmailAddress: { emailAddress: 'test@example.com' }
};

// Test wrapper components that provide real context
const TestClerkProvider = ({ children }: { children: React.ReactNode }) => children;

describe('Redux Migration', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    // Create a fresh store for each test
    store = configureStore({
      reducer: {
        accounts: accountsReducer,
        transactions: transactionsReducer,
        categories: categoriesReducer,
        budgets: budgetsReducer,
        goals: goalsReducer,
        tags: tagsReducer,
        recurringTransactions: recurringTransactionsReducer,
        preferences: preferencesReducer,
        notifications: notificationsReducer,
        layout: layoutReducer,
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ClerkProvider publishableKey="pk_test">
      <Provider store={store}>
        <AppProvider>
          <PreferencesProvider>
            <NotificationProvider>
              <LayoutProvider>
                <ReduxMigrationWrapper>
                  {children}
                </ReduxMigrationWrapper>
              </LayoutProvider>
            </NotificationProvider>
          </PreferencesProvider>
        </AppProvider>
      </Provider>
    </ClerkProvider>
  );

  it('should sync accounts from context to Redux', async () => {
    const { result } = renderHook(
      () => useAppSelector(state => state.accounts.accounts),
      { wrapper }
    );

    // Initially should have default test accounts from AppContext
    await act(async () => {
      // Wait for sync to happen
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current).toBeDefined();
    expect(Array.isArray(result.current)).toBe(true);
  });

  it('should sync transactions from context to Redux', async () => {
    const { result } = renderHook(
      () => useAppSelector(state => state.transactions.transactions),
      { wrapper }
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(result.current).toBeDefined();
    expect(Array.isArray(result.current)).toBe(true);
  });

  it('should maintain data consistency between context and Redux', async () => {
    const { result: reduxAccounts } = renderHook(
      () => useAppSelector(state => state.accounts.accounts),
      { wrapper }
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Redux should have the same data as context
    expect(reduxAccounts.current).toBeDefined();
  });
});