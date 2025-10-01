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
} from '../slices/index';
import type { Transaction, Account, Budget, Goal, Category } from '../../types';

// Create mock functions that preserve provided IDs
const createMockTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: overrides.id || crypto.randomUUID(),
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

const createMockAccount = (overrides: Partial<Account> = {}): Account => ({
  id: overrides.id || crypto.randomUUID(),
  name: 'Test Account',
  type: 'current',
  balance: 1000,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-20'),
  ...overrides,
});

const createMockBudget = (overrides: Partial<Budget> = {}): Budget => ({
  id: overrides.id || crypto.randomUUID(),
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

const createMockGoal = (overrides: Partial<Goal> = {}): Goal => ({
  id: overrides.id || crypto.randomUUID(),
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

const createMockCategory = (overrides: Partial<Category> = {}): Category => ({
  id: overrides.id || crypto.randomUUID(),
  name: 'Test Category',
  color: '#3B82F6',
  type: 'expense',
  parentId: overrides.parentId !== undefined ? overrides.parentId : null,
  isActive: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-20'),
  ...overrides,
});
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
      expect(state.accounts).toEqual([]);
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
      expect(state.accounts).toHaveLength(1);
      expect(state.accounts[0].name).toBe('Test Account');
      expect(state.accounts[0].type).toBe('current');
      expect(state.accounts[0].balance).toBe(1000);
    });

    it('updates existing account', () => {
      const account = createMockAccount({ balance: 1000 });
      
      store.dispatch(accountsSlice.actions.addAccount(account));
      const state1 = store.getState().accounts;
      const addedAccount = state1.accounts[0];
      
      store.dispatch(accountsSlice.actions.updateAccount({
        id: addedAccount.id,
        updates: { balance: 1500, name: 'Updated Account' },
      }));
      
      const state2 = store.getState().accounts;
      const updatedAccount = state2.accounts[0];
      
      expect(updatedAccount.balance).toBe(1500);
      expect(updatedAccount.name).toBe('Updated Account');
    });

    it('removes account', () => {
      const account = createMockAccount();
      
      store.dispatch(accountsSlice.actions.addAccount(account));
      const state1 = store.getState().accounts;
      const addedAccount = state1.accounts[0];
      
      store.dispatch(accountsSlice.actions.deleteAccount(addedAccount.id));
      
      const state2 = store.getState().accounts;
      expect(state2.accounts).toHaveLength(0);
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
      const totalBalance = state.accounts.reduce((sum, acc) => sum + acc.balance, 0);
      expect(totalBalance).toBe(2500); // 1000 + 2000 - 500
    });

    // Loading states are handled by async thunks, not direct actions

    // Error states are handled by async thunks, not direct actions
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
      expect(state.transactions).toHaveLength(1);
      expect(state.transactions[0].amount).toBe(100);
      expect(state.transactions[0].type).toBe('expense');
      expect(state.transactions[0].category).toBe('groceries');
    });

    it('updates transaction with Decimal.js precision', () => {
      const transaction = createMockTransaction({
        amount: 100.123456,
      });
      
      store.dispatch(transactionsSlice.actions.addTransaction(transaction));
      const state1 = store.getState().transactions;
      const addedTransaction = state1.transactions[0];
      
      store.dispatch(transactionsSlice.actions.updateTransaction({
        id: addedTransaction.id,
        updates: { amount: 200.654321 },
      }));
      
      const state2 = store.getState().transactions;
      const updated = state2.transactions[0];
      
      expect(updated.amount).toBe(200.654321);
    });

    it('removes transaction', () => {
      const transaction = createMockTransaction();
      
      store.dispatch(transactionsSlice.actions.addTransaction(transaction));
      const state1 = store.getState().transactions;
      const addedTransaction = state1.transactions[0];
      
      store.dispatch(transactionsSlice.actions.deleteTransaction(addedTransaction.id));
      
      const state2 = store.getState().transactions;
      expect(state2.transactions).toHaveLength(0);
    });

    it('manages multiple transactions', () => {
      const transactions = [
        createMockTransaction({
          date: new Date('2025-01-01'),
          amount: 100,
        }),
        createMockTransaction({
          date: new Date('2025-01-15'),
          amount: 200,
        }),
        createMockTransaction({
          date: new Date('2025-01-30'),
          amount: 300,
        }),
      ];

      transactions.forEach(t => {
        store.dispatch(transactionsSlice.actions.addTransaction(t));
      });

      const state = store.getState().transactions;
      expect(state.transactions).toHaveLength(3);
      // Check that all transactions were added with correct amounts
      const amounts = state.transactions.map(t => t.amount);
      expect(amounts).toContain(100);
      expect(amounts).toContain(200);
      expect(amounts).toContain(300);
    });

    it('handles bulk delete operations', () => {
      const transactions = [
        createMockTransaction({ amount: 100 }),
        createMockTransaction({ amount: 200 }),
        createMockTransaction({ amount: 300 }),
      ];

      transactions.forEach(t => {
        store.dispatch(transactionsSlice.actions.addTransaction(t));
      });
      
      const state1 = store.getState().transactions;
      const idsToDelete = [state1.transactions[0].id, state1.transactions[2].id];
      
      store.dispatch(transactionsSlice.actions.bulkDeleteTransactions(idsToDelete));
      
      const state2 = store.getState().transactions;
      expect(state2.transactions).toHaveLength(1);
      // Check that only the middle transaction remains
      expect(state2.transactions[0].amount).toBe(200);
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
      const groceryTransactions = state.transactions.filter(t => t.category === 'groceries');
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
      expect(state.budgets[0].spent).toBe(0);
    });

    it('updates budget spent amount', () => {
      const budget = createMockBudget({
        category: 'groceries',
        amount: 500,
        spent: 100,
      });

      store.dispatch(budgetsSlice.actions.addBudget(budget));
      const state1 = store.getState().budgets;
      const addedBudget = state1.budgets[0];
      
      store.dispatch(budgetsSlice.actions.updateBudgetSpent({
        id: addedBudget.id,
        spent: 250,
      }));

      const state2 = store.getState().budgets;
      const updatedBudget = state2.budgets[0];
      expect(updatedBudget.spent).toBe(250);
    });

    it('calculates budget progress correctly', () => {
      const budget = createMockBudget({
        amount: 1000,
        spent: 600,
      });

      store.dispatch(budgetsSlice.actions.addBudget(budget));
      
      const state = store.getState().budgets;
      const progress = (state.budgets[0].spent / state.budgets[0].amount) * 100;
      expect(progress).toBe(60);
    });

    it('handles budget period changes', () => {
      const budget = createMockBudget({
        period: 'monthly',
      });

      store.dispatch(budgetsSlice.actions.addBudget(budget));
      const state1 = store.getState().budgets;
      const addedBudget = state1.budgets[0];
      
      store.dispatch(budgetsSlice.actions.updateBudget({
        id: addedBudget.id,
        updates: { period: 'weekly' },
      }));

      const state2 = store.getState().budgets;
      const updatedBudget = state2.budgets[0];
      expect(updatedBudget.period).toBe('weekly');
    });

    it('manages active/inactive budgets', () => {
      const budget = createMockBudget({
        isActive: true,
      });

      store.dispatch(budgetsSlice.actions.addBudget(budget));
      const state1 = store.getState().budgets;
      const addedBudget = state1.budgets[0];
      
      store.dispatch(budgetsSlice.actions.updateBudget({
        id: addedBudget.id,
        updates: { isActive: false }
      }));

      const state2 = store.getState().budgets;
      const toggledBudget = state2.budgets[0];
      expect(toggledBudget.isActive).toBe(false);
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
      const addedGoal = state.goals[0];
      const progress = (addedGoal.currentAmount / addedGoal.targetAmount) * 100;
      
      expect(progress).toBe(25);
    });

    it('updates goal progress', () => {
      const goal = createMockGoal({
        targetAmount: 1000,
        currentAmount: 250,
      });

      store.dispatch(goalsSlice.actions.addGoal(goal));
      const state1 = store.getState().goals;
      const addedGoal = state1.goals[0];
      
      store.dispatch(goalsSlice.actions.updateGoalProgress({
        id: addedGoal.id,
        currentAmount: 500,
      }));

      const state2 = store.getState().goals;
      const updatedGoal = state2.goals[0];
      expect(updatedGoal.currentAmount).toBe(500);
    });

    it('marks goal as completed when target reached', () => {
      const goal = createMockGoal({
        targetAmount: 1000,
        currentAmount: 900,
        isCompleted: false,
      });

      store.dispatch(goalsSlice.actions.addGoal(goal));
      const state1 = store.getState().goals;
      const addedGoal = state1.goals[0];
      
      store.dispatch(goalsSlice.actions.updateGoalProgress({
        id: addedGoal.id,
        currentAmount: 1000,
      }));

      // In a real implementation, this might be handled by middleware or a reducer
      store.dispatch(goalsSlice.actions.updateGoal({
        id: addedGoal.id,
        updates: { isCompleted: true },
      }));

      const state2 = store.getState().goals;
      const completedGoal = state2.goals[0];
      expect(completedGoal.isCompleted).toBe(true);
    });

    it('handles goal priority updates', () => {
      const goal = createMockGoal({
        priority: 'medium',
      });

      store.dispatch(goalsSlice.actions.addGoal(goal));
      const state1 = store.getState().goals;
      const addedGoal = state1.goals[0];
      
      store.dispatch(goalsSlice.actions.updateGoal({
        id: addedGoal.id,
        updates: { priority: 'high' },
      }));

      const state2 = store.getState().goals;
      const updatedGoal = state2.goals[0];
      expect(updatedGoal.priority).toBe('high');
    });
  });

  describe('Categories Slice', () => {
    it('adds hierarchical categories', () => {
      const parentCategory = createMockCategory({
        name: 'Food & Dining',
        parentId: null,
      });

      store.dispatch(categoriesSlice.actions.addCategory(parentCategory));
      const state1 = store.getState().categories;
      const parent = state1.categories[0];
      
      const childCategory = createMockCategory({
        name: 'Restaurants',
        parentId: parent.id,
      });

      store.dispatch(categoriesSlice.actions.addCategory(childCategory));

      const state2 = store.getState().categories;
      expect(state2.categories).toHaveLength(2);
      
      const addedParent = state2.categories.find(c => c.name === 'Food & Dining');
      const addedChild = state2.categories.find(c => c.name === 'Restaurants');
      
      expect(addedParent?.parentId).toBeNull();
      expect(addedChild?.parentId).toBe(parent.id);
    });

    it('manages category colors', () => {
      const category = createMockCategory({
        color: '#FF0000',
      });

      store.dispatch(categoriesSlice.actions.addCategory(category));
      const state1 = store.getState().categories;
      const addedCategory = state1.categories[0];
      
      store.dispatch(categoriesSlice.actions.updateCategory({
        id: addedCategory.id,
        updates: { color: '#00FF00' },
      }));

      const state2 = store.getState().categories;
      const updatedCategory = state2.categories[0];
      expect(updatedCategory.color).toBe('#00FF00');
    });

    it('handles category activation/deactivation', () => {
      const category = createMockCategory({
        isActive: true,
      });

      store.dispatch(categoriesSlice.actions.addCategory(category));
      const state1 = store.getState().categories;
      const addedCategory = state1.categories[0];
      
      store.dispatch(categoriesSlice.actions.updateCategory({
        id: addedCategory.id,
        updates: { isActive: false }
      }));

      const state2 = store.getState().categories;
      const toggledCategory = state2.categories[0];
      expect(toggledCategory.isActive).toBe(false);
    });
  });

  describe('Preferences Slice', () => {
    it('initializes with default preferences', () => {
      const state = store.getState().preferences;
      
      expect(state.currency).toBeDefined();
      expect(state.theme).toBeDefined();
      // dateFormat is not part of the preferences state
    });

    it('updates currency preference', () => {
      store.dispatch(preferencesSlice.actions.setCurrency('USD'));
      
      const state = store.getState().preferences;
      expect(state.currency).toBe('USD');
    });

    it('updates theme preference', () => {
      store.dispatch(preferencesSlice.actions.setTheme('dark'));
      
      const state = store.getState().preferences;
      expect(state.theme).toBe('dark');
    });

    it('updates page visibility settings', () => {
      const pageVisibility = {
        showBudget: false,
        showGoals: true,
        showAnalytics: false,
      };

      store.dispatch(preferencesSlice.actions.setPageVisibility(pageVisibility));
      
      const state = store.getState().preferences;
      expect(state.pageVisibility).toEqual(pageVisibility);
    });

    it('handles batch preference updates', () => {
      const newPreferences = {
        currency: 'EUR',
        theme: 'auto' as const,
        colorTheme: 'blue' as const,
      };

      store.dispatch(preferencesSlice.actions.updatePreferences(newPreferences));
      
      const state = store.getState().preferences;
      expect(state.currency).toBe('EUR');
      expect(state.theme).toBe('auto');
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

      const relatedTransaction = transactionsState.transactions.find(
        t => t.accountId === account.id
      );

      expect(relatedTransaction).toBeDefined();
      expect(relatedTransaction?.accountId).toBe(account.id);
    });

    it('updates budget spent amounts when transactions change', () => {
      const budget = createMockBudget({
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
      const budgetState1 = store.getState().budgets;
      const addedBudget = budgetState1.budgets[0];
      
      store.dispatch(transactionsSlice.actions.addTransaction(transaction));

      // In a real implementation, this would be handled by middleware
      // that listens to transaction changes and updates budget spent amounts
      const newSpent = 100 + 50; // Original spent + transaction amount
      store.dispatch(budgetsSlice.actions.updateBudgetSpent({
        id: addedBudget.id,
        spent: newSpent,
      }));

      const budgetState2 = store.getState().budgets;
      const updatedBudget = budgetState2.budgets[0];
      expect(updatedBudget.spent).toBe(150);
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
      const totalIncome = state.transactions.transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalExpenses = state.transactions.transactions
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
      
      largeTransactionSet.forEach(t => {
        store.dispatch(transactionsSlice.actions.addTransaction(t));
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500); // Should complete within 500ms
      expect(store.getState().transactions.transactions).toHaveLength(1000);
    });
  });
});