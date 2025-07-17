import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useApp } from '../AppContext';
import { AppProvider } from '../AppContext';
import { createMockAccount, createMockTransaction, createMockBudget, createMockGoal } from '../../test/factories';
import React from 'react';

// Mock localStorage with empty data
const mockLocalStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Helper to render hook with provider
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

describe('AppContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    mockLocalStorage.clear();
    // Mock localStorage to return 'true' for data cleared flag
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'wealthtracker_data_cleared') {
        return 'true';
      }
      return null;
    });
  });

  describe('Account Management', () => {
    it('adds a new account', () => {
      const { result } = renderHook(() => useApp(), { wrapper });
      
      const newAccount = createMockAccount({ name: 'New Test Account' });
      
      act(() => {
        result.current.addAccount(newAccount);
      });
      
      expect(result.current.accounts).toHaveLength(1);
      expect(result.current.accounts[0].name).toBe('New Test Account');
    });

    it('updates an existing account', () => {
      const { result } = renderHook(() => useApp(), { wrapper });
      
      const account = createMockAccount({ balance: 1000 });
      
      act(() => {
        result.current.addAccount(account);
      });
      
      const addedAccount = result.current.accounts[0];
      
      act(() => {
        result.current.updateAccount(addedAccount.id, { balance: 2000 });
      });
      
      expect(result.current.accounts[0].balance).toBe(2000);
    });

    it('deletes an account', () => {
      const { result } = renderHook(() => useApp(), { wrapper });
      
      const account = createMockAccount();
      
      act(() => {
        result.current.addAccount(account);
      });
      
      expect(result.current.accounts).toHaveLength(1);
      const addedAccount = result.current.accounts[0];
      
      act(() => {
        result.current.deleteAccount(addedAccount.id);
      });
      
      expect(result.current.accounts).toHaveLength(0);
    });
  });

  describe('Transaction Management', () => {
    it('adds a new transaction', () => {
      const { result } = renderHook(() => useApp(), { wrapper });
      
      const transaction = createMockTransaction({ description: 'Test Purchase' });
      
      act(() => {
        result.current.addTransaction(transaction);
      });
      
      expect(result.current.transactions).toHaveLength(1);
      expect(result.current.transactions[0].description).toBe('Test Purchase');
    });

    it('updates an existing transaction', () => {
      const { result } = renderHook(() => useApp(), { wrapper });
      
      const transaction = createMockTransaction({ amount: 100 });
      
      act(() => {
        result.current.addTransaction(transaction);
      });
      
      const addedTransaction = result.current.transactions[0];
      
      act(() => {
        result.current.updateTransaction(addedTransaction.id, { amount: 200 });
      });
      
      expect(result.current.transactions[0].amount).toBe(200);
    });

    it('deletes a transaction', () => {
      const { result } = renderHook(() => useApp(), { wrapper });
      
      const transaction = createMockTransaction();
      
      act(() => {
        result.current.addTransaction(transaction);
      });
      
      expect(result.current.transactions).toHaveLength(1);
      const addedTransaction = result.current.transactions[0];
      
      act(() => {
        result.current.deleteTransaction(addedTransaction.id);
      });
      
      expect(result.current.transactions).toHaveLength(0);
    });
  });

  describe('Budget Management', () => {
    it('adds a new budget', () => {
      const { result } = renderHook(() => useApp(), { wrapper });
      
      const budget = createMockBudget({ category: 'food' });
      
      act(() => {
        result.current.addBudget(budget);
      });
      
      expect(result.current.budgets).toHaveLength(1);
      expect(result.current.budgets[0].category).toBe('food');
    });

    it('updates an existing budget', () => {
      const { result } = renderHook(() => useApp(), { wrapper });
      
      const budget = createMockBudget({ amount: 500 });
      
      act(() => {
        result.current.addBudget(budget);
      });
      
      const addedBudget = result.current.budgets[0];
      
      act(() => {
        result.current.updateBudget(addedBudget.id, { amount: 600 });
      });
      
      expect(result.current.budgets[0].amount).toBe(600);
    });

    it('deletes a budget', () => {
      const { result } = renderHook(() => useApp(), { wrapper });
      
      const budget = createMockBudget();
      
      act(() => {
        result.current.addBudget(budget);
      });
      
      expect(result.current.budgets).toHaveLength(1);
      const addedBudget = result.current.budgets[0];
      
      act(() => {
        result.current.deleteBudget(addedBudget.id);
      });
      
      expect(result.current.budgets).toHaveLength(0);
    });
  });

  describe('Goal Management', () => {
    it('adds a new goal', () => {
      const { result } = renderHook(() => useApp(), { wrapper });
      
      const goal = createMockGoal({ name: 'Vacation Fund' });
      
      act(() => {
        result.current.addGoal(goal);
      });
      
      expect(result.current.goals).toHaveLength(1);
      expect(result.current.goals[0].name).toBe('Vacation Fund');
    });

    it('updates an existing goal', () => {
      const { result } = renderHook(() => useApp(), { wrapper });
      
      const goal = createMockGoal({ currentAmount: 1000 });
      
      act(() => {
        result.current.addGoal(goal);
      });
      
      const addedGoal = result.current.goals[0];
      
      act(() => {
        result.current.updateGoal(addedGoal.id, { currentAmount: 1500 });
      });
      
      expect(result.current.goals[0].currentAmount).toBe(1500);
    });

    it('deletes a goal', () => {
      const { result } = renderHook(() => useApp(), { wrapper });
      
      const goal = createMockGoal();
      
      act(() => {
        result.current.addGoal(goal);
      });
      
      expect(result.current.goals).toHaveLength(1);
      const addedGoal = result.current.goals[0];
      
      act(() => {
        result.current.deleteGoal(addedGoal.id);
      });
      
      expect(result.current.goals).toHaveLength(0);
    });
  });

  describe('Data Persistence', () => {
    it('saves data to localStorage', () => {
      const { result } = renderHook(() => useApp(), { wrapper });
      
      const account = createMockAccount();
      
      act(() => {
        result.current.addAccount(account);
      });
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'wealthtracker_accounts',
        expect.any(String)
      );
      
      // Check that the account was serialized properly
      // Verify that setItem was called
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      
      // Find the most recent call to save accounts
      const accountsCalls = mockLocalStorage.setItem.mock.calls.filter(
        call => call[0] === 'wealthtracker_accounts'
      );
      expect(accountsCalls.length).toBeGreaterThan(0);
      
      // Check the last call
      const lastCall = accountsCalls[accountsCalls.length - 1];
      const savedAccounts = JSON.parse(lastCall[1]);
      expect(savedAccounts).toHaveLength(1);
    });

    it('loads data from localStorage on mount', () => {
      const testAccount = createMockAccount();
      const testTransaction = createMockTransaction();
      const testBudget = createMockBudget();
      const testGoal = createMockGoal();
      
      mockLocalStorage.getItem.mockImplementation((key) => {
        switch (key) {
          case 'wealthtracker_accounts':
            return JSON.stringify([testAccount]);
          case 'wealthtracker_transactions':
            return JSON.stringify([testTransaction]);
          case 'wealthtracker_budgets':
            return JSON.stringify([testBudget]);
          case 'wealthtracker_goals':
            return JSON.stringify([testGoal]);
          case 'wealthtracker_data_cleared':
            return 'true';
          default:
            return null;
        }
      });
      
      const { result } = renderHook(() => useApp(), { wrapper });
      
      expect(result.current.accounts).toHaveLength(1);
      expect(result.current.transactions).toHaveLength(1);
      expect(result.current.budgets).toHaveLength(1);
      expect(result.current.goals).toHaveLength(1);
    });
  });

  describe('Decimal Methods', () => {
    it('provides decimal-aware calculation methods', () => {
      const { result } = renderHook(() => useApp(), { wrapper });
      
      expect(result.current.getDecimalAccounts).toBeDefined();
      expect(result.current.getDecimalTransactions).toBeDefined();
      expect(result.current.getDecimalBudgets).toBeDefined();
      expect(result.current.getDecimalGoals).toBeDefined();
    });

    it('maintains precision with decimal calculations', () => {
      const { result } = renderHook(() => useApp(), { wrapper });
      
      // Add transactions that would cause floating point issues
      act(() => {
        result.current.addTransaction(createMockTransaction({ amount: 0.1 }));
        result.current.addTransaction(createMockTransaction({ amount: 0.2 }));
      });
      
      const decimalTransactions = result.current.getDecimalTransactions();
      const total = decimalTransactions[0].amount.plus(decimalTransactions[1].amount);
      
      expect(total.toString()).toBe('0.3');
    });
  });
});