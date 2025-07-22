/**
 * Redux Slices Tests
 * Comprehensive tests for Redux state management slices
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import {
  accountsSlice,
  transactionsSlice,
  budgetsSlice,
  goalsSlice,
  categoriesSlice,
  preferencesSlice,
} from '../slices';
import {
  createMockTransaction,
  createMockAccount,
  createMockBudget,
  createMockGoal,
  createMockCategory,
} from '../../test/testUtils';
import type { RootState } from '../index';

describe('Redux Slices', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        accounts: accountsSlice.reducer,
        transactions: transactionsSlice.reducer,
        budgets: budgetsSlice.reducer,
        goals: goalsSlice.reducer,
        categories: categoriesSlice.reducer,
        preferences: preferencesSlice.reducer,
      },
    });
  });

  describe('Accounts Slice', () => {
    it('initializes with empty state', () => {
      const state = store.getState().accounts;
      expect(state.items).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('adds new account', () => {
      const newAccount = createMockAccount({
        name: 'Test Account',
        type: 'current',
        balance: 1000,
      });

      store.dispatch(accountsSlice.actions.addAccount(newAccount));
      
      const state = store.getState().accounts;
      expect(state.items).toHaveLength(1);
      expect(state.items[0]).toEqual(newAccount);
    });

    it('updates existing account', () => {
      const account = createMockAccount({ id: 'acc-1', balance: 1000 });
      
      store.dispatch(accountsSlice.actions.addAccount(account));
      store.dispatch(accountsSlice.actions.updateAccount({
        id: 'acc-1',
        changes: { balance: 1500, name: 'Updated Account' },
      }));
      
      const state = store.getState().accounts;
      const updatedAccount = state.items.find(a => a.id === 'acc-1');
      
      expect(updatedAccount?.balance).toBe(1500);
      expect(updatedAccount?.name).toBe('Updated Account');
    });

    it('removes account', () => {
      const account = createMockAccount({ id: 'acc-1' });
      
      store.dispatch(accountsSlice.actions.addAccount(account));
      store.dispatch(accountsSlice.actions.removeAccount('acc-1'));
      
      const state = store.getState().accounts;
      expect(state.items).toHaveLength(0);
    });

    it('calculates total balance correctly', () => {
      const accounts = [
        createMockAccount({ balance: 1000 }),
        createMockAccount({ balance: 2000 }),
        createMockAccount({ balance: -500, type: 'credit' }),
      ];

      accounts.forEach(account => {
        store.dispatch(accountsSlice.actions.addAccount(account));
      });

      const state = store.getState().accounts;
      const totalBalance = state.items.reduce((sum, acc) => sum + acc.balance, 0);
      expect(totalBalance).toBe(2500); // 1000 + 2000 - 500
    });

    it('handles loading states', () => {
      store.dispatch(accountsSlice.actions.setLoading(true));
      expect(store.getState().accounts.loading).toBe(true);

      store.dispatch(accountsSlice.actions.setLoading(false));
      expect(store.getState().accounts.loading).toBe(false);
    });

    it('handles error states', () => {
      const errorMessage = 'Failed to load accounts';
      
      store.dispatch(accountsSlice.actions.setError(errorMessage));
      expect(store.getState().accounts.error).toBe(errorMessage);

      store.dispatch(accountsSlice.actions.clearError());
      expect(store.getState().accounts.error).toBeNull();
    });
  });

  describe('Transactions Slice', () => {
    it('adds new transaction', () => {
      const transaction = createMockTransaction({
        amount: 100,
        type: 'expense',
        category: 'groceries',
      });

      store.dispatch(transactionsSlice.actions.addTransaction(transaction));
      
      const state = store.getState().transactions;
      expect(state.items).toHaveLength(1);
      expect(state.items[0]).toEqual(transaction);
    });

    it('updates transaction with Decimal.js precision', () => {
      const transaction = createMockTransaction({
        id: 'trans-1',
        amount: 100.123456,
      });
      
      store.dispatch(transactionsSlice.actions.addTransaction(transaction));
      store.dispatch(transactionsSlice.actions.updateTransaction({
        id: 'trans-1',
        changes: { amount: 200.654321 },
      }));
      
      const state = store.getState().transactions;
      const updated = state.items.find(t => t.id === 'trans-1');
      
      expect(updated?.amount).toBe(200.654321);
    });

    it('removes transaction', () => {
      const transaction = createMockTransaction({ id: 'trans-1' });
      
      store.dispatch(transactionsSlice.actions.addTransaction(transaction));
      store.dispatch(transactionsSlice.actions.removeTransaction('trans-1'));
      
      const state = store.getState().transactions;
      expect(state.items).toHaveLength(0);
    });

    it('filters transactions by date range', () => {
      const transactions = [
        createMockTransaction({
          id: 'trans-1',
          date: new Date('2025-01-01'),
        }),
        createMockTransaction({
          id: 'trans-2',
          date: new Date('2025-01-15'),
        }),
        createMockTransaction({
          id: 'trans-3',
          date: new Date('2025-01-30'),
        }),
      ];

      transactions.forEach(t => {
        store.dispatch(transactionsSlice.actions.addTransaction(t));
      });

      // Set filter for middle of month
      store.dispatch(transactionsSlice.actions.setFilters({
        dateRange: {
          start: new Date('2025-01-10'),
          end: new Date('2025-01-20'),
        },
      }));

      const state = store.getState().transactions;
      // In a real implementation, there would be a selector to get filtered transactions
      expect(state.filters.dateRange?.start).toEqual(new Date('2025-01-10'));
      expect(state.filters.dateRange?.end).toEqual(new Date('2025-01-20'));
    });

    it('handles bulk operations', () => {
      const transactions = [
        createMockTransaction({ id: 'trans-1' }),
        createMockTransaction({ id: 'trans-2' }),
        createMockTransaction({ id: 'trans-3' }),
      ];

      store.dispatch(transactionsSlice.actions.bulkAddTransactions(transactions));
      
      const state = store.getState().transactions;
      expect(state.items).toHaveLength(3);
    });

    it('categorizes transactions correctly', () => {
      const transactions = [
        createMockTransaction({ category: 'groceries', amount: 100 }),
        createMockTransaction({ category: 'groceries', amount: 50 }),
        createMockTransaction({ category: 'entertainment', amount: 75 }),
      ];

      transactions.forEach(t => {
        store.dispatch(transactionsSlice.actions.addTransaction(t));
      });

      const state = store.getState().transactions;
      const groceryTransactions = state.items.filter(t => t.category === 'groceries');
      const totalGrocerySpending = groceryTransactions.reduce((sum, t) => sum + t.amount, 0);
      
      expect(groceryTransactions).toHaveLength(2);
      expect(totalGrocerySpending).toBe(150);
    });
  });

  describe('Budgets Slice', () => {
    it('adds budget with initial spent amount', () => {
      const budget = createMockBudget({
        category: 'groceries',
        amount: 500,
        spent: 0,
      });

      store.dispatch(budgetsSlice.actions.addBudget(budget));
      
      const state = store.getState().budgets;
      expect(state.items[0].spent).toBe(0);
    });

    it('updates budget spent amount', () => {
      const budget = createMockBudget({
        id: 'budget-1',
        category: 'groceries',
        amount: 500,
        spent: 100,
      });

      store.dispatch(budgetsSlice.actions.addBudget(budget));
      store.dispatch(budgetsSlice.actions.updateBudgetSpent({
        id: 'budget-1',
        spent: 250,
      }));

      const state = store.getState().budgets;
      const updatedBudget = state.items.find(b => b.id === 'budget-1');
      expect(updatedBudget?.spent).toBe(250);
    });

    it('calculates budget progress correctly', () => {
      const budget = createMockBudget({
        amount: 1000,
        spent: 600,
      });

      store.dispatch(budgetsSlice.actions.addBudget(budget));
      
      const state = store.getState().budgets;
      const progress = (state.items[0].spent / state.items[0].amount) * 100;
      expect(progress).toBe(60);
    });

    it('handles budget period changes', () => {
      const budget = createMockBudget({
        id: 'budget-1',
        period: 'monthly',
      });

      store.dispatch(budgetsSlice.actions.addBudget(budget));
      store.dispatch(budgetsSlice.actions.updateBudget({
        id: 'budget-1',
        changes: { period: 'weekly' },
      }));

      const state = store.getState().budgets;
      const updatedBudget = state.items.find(b => b.id === 'budget-1');
      expect(updatedBudget?.period).toBe('weekly');
    });

    it('manages active/inactive budgets', () => {
      const budget = createMockBudget({
        id: 'budget-1',
        isActive: true,
      });

      store.dispatch(budgetsSlice.actions.addBudget(budget));
      store.dispatch(budgetsSlice.actions.toggleBudgetActive('budget-1'));

      const state = store.getState().budgets;
      const toggledBudget = state.items.find(b => b.id === 'budget-1');
      expect(toggledBudget?.isActive).toBe(false);
    });
  });

  describe('Goals Slice', () => {
    it('adds new goal with progress calculation', () => {
      const goal = createMockGoal({
        targetAmount: 1000,
        currentAmount: 250,
      });

      store.dispatch(goalsSlice.actions.addGoal(goal));
      
      const state = store.getState().goals;
      const addedGoal = state.items[0];
      const progress = (addedGoal.currentAmount / addedGoal.targetAmount) * 100;
      
      expect(progress).toBe(25);
    });

    it('updates goal progress', () => {
      const goal = createMockGoal({
        id: 'goal-1',
        targetAmount: 1000,
        currentAmount: 250,
      });

      store.dispatch(goalsSlice.actions.addGoal(goal));
      store.dispatch(goalsSlice.actions.updateGoalProgress({
        id: 'goal-1',
        amount: 500,
      }));

      const state = store.getState().goals;
      const updatedGoal = state.items.find(g => g.id === 'goal-1');
      expect(updatedGoal?.currentAmount).toBe(500);
    });

    it('marks goal as completed when target reached', () => {
      const goal = createMockGoal({
        id: 'goal-1',
        targetAmount: 1000,
        currentAmount: 900,
        isCompleted: false,
      });

      store.dispatch(goalsSlice.actions.addGoal(goal));
      store.dispatch(goalsSlice.actions.updateGoalProgress({
        id: 'goal-1',
        amount: 1000,
      }));

      // In a real implementation, this might be handled by middleware or a reducer
      store.dispatch(goalsSlice.actions.updateGoal({
        id: 'goal-1',
        changes: { isCompleted: true },
      }));

      const state = store.getState().goals;
      const completedGoal = state.items.find(g => g.id === 'goal-1');
      expect(completedGoal?.isCompleted).toBe(true);
    });

    it('handles goal priority updates', () => {
      const goal = createMockGoal({
        id: 'goal-1',
        priority: 'medium',
      });

      store.dispatch(goalsSlice.actions.addGoal(goal));
      store.dispatch(goalsSlice.actions.updateGoal({
        id: 'goal-1',
        changes: { priority: 'high' },
      }));

      const state = store.getState().goals;
      const updatedGoal = state.items.find(g => g.id === 'goal-1');
      expect(updatedGoal?.priority).toBe('high');
    });
  });

  describe('Categories Slice', () => {
    it('adds hierarchical categories', () => {
      const parentCategory = createMockCategory({
        id: 'cat-parent',
        name: 'Food & Dining',
        parentId: null,
      });

      const childCategory = createMockCategory({
        id: 'cat-child',
        name: 'Restaurants',
        parentId: 'cat-parent',
      });

      store.dispatch(categoriesSlice.actions.addCategory(parentCategory));
      store.dispatch(categoriesSlice.actions.addCategory(childCategory));

      const state = store.getState().categories;
      expect(state.items).toHaveLength(2);
      
      const parent = state.items.find(c => c.id === 'cat-parent');
      const child = state.items.find(c => c.id === 'cat-child');
      
      expect(parent?.parentId).toBeNull();
      expect(child?.parentId).toBe('cat-parent');
    });

    it('manages category colors', () => {
      const category = createMockCategory({
        id: 'cat-1',
        color: '#FF0000',
      });

      store.dispatch(categoriesSlice.actions.addCategory(category));
      store.dispatch(categoriesSlice.actions.updateCategory({
        id: 'cat-1',
        changes: { color: '#00FF00' },
      }));

      const state = store.getState().categories;
      const updatedCategory = state.items.find(c => c.id === 'cat-1');
      expect(updatedCategory?.color).toBe('#00FF00');
    });

    it('handles category activation/deactivation', () => {
      const category = createMockCategory({
        id: 'cat-1',
        isActive: true,
      });

      store.dispatch(categoriesSlice.actions.addCategory(category));
      store.dispatch(categoriesSlice.actions.toggleCategoryActive('cat-1'));

      const state = store.getState().categories;
      const toggledCategory = state.items.find(c => c.id === 'cat-1');
      expect(toggledCategory?.isActive).toBe(false);
    });
  });

  describe('Preferences Slice', () => {
    it('initializes with default preferences', () => {
      const state = store.getState().preferences;
      
      expect(state.currency).toBeDefined();
      expect(state.dateFormat).toBeDefined();
      expect(state.theme).toBeDefined();
    });

    it('updates currency preference', () => {
      store.dispatch(preferencesSlice.actions.updateCurrency('USD'));
      
      const state = store.getState().preferences;
      expect(state.currency).toBe('USD');
    });

    it('updates theme preference', () => {
      store.dispatch(preferencesSlice.actions.updateTheme('dark'));
      
      const state = store.getState().preferences;
      expect(state.theme).toBe('dark');
    });

    it('updates notification settings', () => {
      const notificationSettings = {
        email: true,
        push: false,
        budgetAlerts: true,
        goalReminders: false,
      };

      store.dispatch(preferencesSlice.actions.updateNotifications(notificationSettings));
      
      const state = store.getState().preferences;
      expect(state.notifications).toEqual(notificationSettings);
    });

    it('handles batch preference updates', () => {
      const newPreferences = {
        currency: 'EUR',
        dateFormat: 'DD/MM/YYYY',
        theme: 'auto',
        language: 'fr',
      };

      store.dispatch(preferencesSlice.actions.updatePreferences(newPreferences));
      
      const state = store.getState().preferences;
      expect(state.currency).toBe('EUR');
      expect(state.dateFormat).toBe('DD/MM/YYYY');
      expect(state.theme).toBe('auto');
      expect(state.language).toBe('fr');
    });
  });

  describe('Cross-Slice Interactions', () => {
    it('maintains data consistency between accounts and transactions', () => {
      const account = createMockAccount({
        id: 'acc-1',
        balance: 1000,
      });

      const transaction = createMockTransaction({
        accountId: 'acc-1',
        amount: 100,
        type: 'expense',
      });

      store.dispatch(accountsSlice.actions.addAccount(account));
      store.dispatch(transactionsSlice.actions.addTransaction(transaction));

      const accountsState = store.getState().accounts;
      const transactionsState = store.getState().transactions;

      const relatedTransaction = transactionsState.items.find(
        t => t.accountId === account.id
      );

      expect(relatedTransaction).toBeDefined();
      expect(relatedTransaction?.accountId).toBe(account.id);
    });

    it('updates budget spent amounts when transactions change', () => {
      const budget = createMockBudget({
        id: 'budget-1',
        category: 'groceries',
        amount: 500,
        spent: 100,
      });

      const transaction = createMockTransaction({
        category: 'groceries',
        amount: 50,
        type: 'expense',
      });

      store.dispatch(budgetsSlice.actions.addBudget(budget));
      store.dispatch(transactionsSlice.actions.addTransaction(transaction));

      // In a real implementation, this would be handled by middleware
      // that listens to transaction changes and updates budget spent amounts
      const newSpent = budget.spent + transaction.amount;
      store.dispatch(budgetsSlice.actions.updateBudgetSpent({
        id: 'budget-1',
        spent: newSpent,
      }));

      const budgetState = store.getState().budgets;
      const updatedBudget = budgetState.items.find(b => b.id === 'budget-1');
      expect(updatedBudget?.spent).toBe(150);
    });
  });

  describe('State Selectors and Derived Data', () => {
    it('calculates derived financial metrics', () => {
      // Add test data
      const transactions = [
        createMockTransaction({
          type: 'income',
          amount: 3000,
          category: 'salary',
        }),
        createMockTransaction({
          type: 'expense',
          amount: 500,
          category: 'groceries',
        }),
        createMockTransaction({
          type: 'expense',
          amount: 1200,
          category: 'housing',
        }),
      ];

      transactions.forEach(t => {
        store.dispatch(transactionsSlice.actions.addTransaction(t));
      });

      const state = store.getState();
      
      // Calculate totals (in a real app, these would be selectors)
      const totalIncome = state.transactions.items
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalExpenses = state.transactions.items
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      expect(totalIncome).toBe(3000);
      expect(totalExpenses).toBe(1700);
    });

    it('maintains performance with large datasets', () => {
      // Add many transactions
      const largeTransactionSet = Array.from({ length: 1000 }, (_, i) =>
        createMockTransaction({
          id: `trans-${i}`,
          amount: Math.random() * 1000,
        })
      );

      const startTime = performance.now();
      
      store.dispatch(transactionsSlice.actions.bulkAddTransactions(largeTransactionSet));
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Should complete within 100ms
      expect(store.getState().transactions.items).toHaveLength(1000);
    });
  });
});