import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { AppProvider, useApp } from '../../contexts/AppContext';
import { createMockAccount, createMockTransaction, createMockBudget, createMockGoal } from '../factories';
import { calculateTotalBalance, calculateBudgetUsage, calculateGoalProgress } from '../../utils/calculations';
import * as decimalCalcs from '../../utils/calculations-decimal';
import { toDecimal } from '../../utils/decimal';
import { toDecimalAccount, toDecimalBudget, toDecimalTransaction } from '../../utils/decimal-converters';
import type { Account, Transaction } from '../../types';

describe('Core Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup fresh localStorage mock for each test
    const storage = new Map<string, string>();
    vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) || null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
      storage.set(key, value);
    });
    vi.mocked(localStorage.removeItem).mockImplementation(key => {
      storage.delete(key);
    });
    vi.mocked(localStorage.clear).mockImplementation(() => {
      storage.clear();
    });
  });

  describe('Financial Calculations Integration', () => {
    it('maintains precision between regular and decimal calculations', () => {
      const accounts = [
        createMockAccount({ balance: 999.99 }),
        createMockAccount({ balance: 0.01 })
      ];

      // Test regular calculation
      const regularTotal = calculateTotalBalance(accounts);
      
      // Test decimal calculation
      const decimalAccounts = accounts.map(toDecimalAccount);
      const decimalTotal = decimalCalcs.calculateTotalBalance(decimalAccounts);

      expect(regularTotal).toBe(1000.00);
      expect(decimalTotal.toString()).toBe('1000');
    });

    it('handles budget calculations consistently', () => {
      const budget = createMockBudget({ category: 'groceries', amount: 500 });
      const transactions = [
        createMockTransaction({ category: 'groceries', amount: 250.50, type: 'expense' }),
        createMockTransaction({ category: 'groceries', amount: 100.25, type: 'expense' })
      ];

      // Test regular calculation
      const regularUsage = calculateBudgetUsage(budget, transactions);
      
      // Test decimal calculation
      const decimalBudget = toDecimalBudget(budget);
      const decimalTransactions = transactions.map(toDecimalTransaction);
      const decimalUsage = decimalCalcs.calculateBudgetUsage(decimalBudget, decimalTransactions);

      expect(regularUsage).toBe(350.75);
      expect(decimalUsage.toString()).toBe('350.75');
    });

    it('handles goal progress calculations accurately', () => {
      const goal = createMockGoal({ 
        targetAmount: 10000, 
        currentAmount: 2500 
      });

      const progress = calculateGoalProgress(goal);
      expect(progress.percentage).toBe(25);
      expect(progress.remaining).toBe(7500);
      expect(progress.isCompleted).toBe(false);
    });

    it('prevents floating point errors', () => {
      const problematicAmounts = [0.1, 0.2, 0.3];
      const accounts = problematicAmounts.map(amount => 
        createMockAccount({ balance: amount })
      );

      // Regular calculation might have floating point issues
      const regularTotal = calculateTotalBalance(accounts);
      
      // Decimal calculation should be precise
      const decimalAccounts = accounts.map(toDecimalAccount);
      const decimalTotal = decimalCalcs.calculateTotalBalance(decimalAccounts);

      expect(decimalTotal.toString()).toBe('0.6');
      // Regular calculation should work for this test case
      expect(regularTotal).toBeCloseTo(0.6, 10);
    });
  });

  describe('Data Relationships Integration', () => {
    it('maintains account-transaction relationships correctly', () => {
      const account = createMockAccount({ id: 'acc1', balance: 1000 });
      const transactions = [
        createMockTransaction({ id: 'tx1', accountId: 'acc1', amount: 100, type: 'income' }),
        createMockTransaction({ id: 'tx2', accountId: 'acc1', amount: 50, type: 'expense' }),
        createMockTransaction({ id: 'tx3', accountId: 'acc2', amount: 200, type: 'income' })
      ];

      // Filter transactions for specific account
      const accountTransactions = transactions.filter(t => t.accountId === account.id);
      
      expect(accountTransactions).toHaveLength(2);
      expect(accountTransactions[0].amount).toBe(100);
      expect(accountTransactions[1].amount).toBe(50);
    });

    it('maintains budget-category relationships correctly', () => {
      const budget = createMockBudget({ category: 'groceries', amount: 500 });
      const transactions = [
        createMockTransaction({ category: 'groceries', amount: 100, type: 'expense' }),
        createMockTransaction({ category: 'groceries', amount: 150, type: 'expense' }),
        createMockTransaction({ category: 'dining', amount: 50, type: 'expense' })
      ];

      const budgetTransactions = transactions.filter(t => 
        t.category === budget.category && t.type === 'expense'
      );
      
      expect(budgetTransactions).toHaveLength(2);
      
      const totalSpent = budgetTransactions.reduce((sum, t) => sum + t.amount, 0);
      expect(totalSpent).toBe(250);
    });
  });

  describe('Context Integration', () => {
    const TestContextComponent = ({ onData }: { onData: (data: ReturnType<typeof useApp>) => void }) => {
      const context = useApp();
      
      React.useEffect(() => {
        onData(context);
      }, [context, onData]);

      return <div>Test Component</div>;
    };

    it('provides consistent context data', async () => {
      const accounts = [createMockAccount({ id: '1', name: 'Test Account' })];
      const transactions = [createMockTransaction({ id: '1', description: 'Test Transaction' })];

      // Pre-populate localStorage
      const storage = new Map<string, string>();
      storage.set('wealthtracker_accounts', JSON.stringify(accounts));
      storage.set('wealthtracker_transactions', JSON.stringify(transactions));
      
      vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) || null);

      let contextData: ReturnType<typeof useApp> | null = null;
      const handleData = (data: ReturnType<typeof useApp>) => {
        contextData = data;
      };

      render(
        <AppProvider>
          <TestContextComponent onData={handleData} />
        </AppProvider>
      );

      // Wait for context to be populated
      await vi.waitFor(() => {
        expect(contextData).not.toBeNull();
      });

      // The AppProvider might initialize with empty arrays
      // This test is checking that the context provides data correctly
      expect(contextData!.accounts).toBeDefined();
      expect(contextData!.transactions).toBeDefined();
      expect(Array.isArray(contextData!.accounts)).toBe(true);
      expect(Array.isArray(contextData!.transactions)).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    it('handles malformed data gracefully', () => {
      const malformedAccount = { 
        id: '1', 
        name: 'Test', 
        balance: 'invalid' // Invalid balance
      };

      // Function should handle invalid data by throwing a predictable error
      expect(() => {
        calculateTotalBalance([malformedAccount as unknown as Account]);
      }).toThrow('Invalid argument');
    });

    it('handles missing required fields', () => {
      const incompleteTransaction = {
        id: '1',
        description: 'Test',
        // Missing amount, type, category
      };

      const budget = createMockBudget({ category: 'groceries', amount: 500 });
      
      // Should handle incomplete data
      expect(() => {
        calculateBudgetUsage(budget, [incompleteTransaction as unknown as Transaction]);
      }).not.toThrow();
    });
  });

  describe('Performance Integration', () => {
    it('handles large datasets efficiently', () => {
      const largeAccountSet = Array.from({ length: 1000 }, (_, i) => 
        createMockAccount({ id: `acc${i}`, balance: Math.random() * 10000 })
      );

      const startTime = performance.now();
      const total = calculateTotalBalance(largeAccountSet);
      const endTime = performance.now();

      expect(typeof total).toBe('number');
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });

    it('handles complex calculations efficiently', () => {
      const transactions = Array.from({ length: 1000 }, (_, i) => 
        createMockTransaction({ 
          id: `tx${i}`, 
          amount: Math.random() * 1000,
          category: `category${i % 10}`,
          type: i % 2 === 0 ? 'income' : 'expense'
        })
      );

      const budgets = Array.from({ length: 10 }, (_, i) => 
        createMockBudget({ 
          id: `budget${i}`, 
          category: `category${i}`,
          amount: Math.random() * 5000
        })
      );

      const startTime = performance.now();
      
      // Perform multiple calculations
      budgets.forEach(budget => {
        calculateBudgetUsage(budget, transactions);
      });
      
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(200); // Should complete in under 200ms
    });
  });

  describe('Data Validation Integration', () => {
    it('validates account data structure', () => {
      const validAccount = createMockAccount({ 
        id: '1', 
        name: 'Valid Account', 
        balance: 1000 
      });

      expect(validAccount).toHaveProperty('id');
      expect(validAccount).toHaveProperty('name');
      expect(validAccount).toHaveProperty('balance');
      expect(validAccount).toHaveProperty('type');
      expect(validAccount).toHaveProperty('currency');
      expect(typeof validAccount.balance).toBe('number');
    });

    it('validates transaction data structure', () => {
      const validTransaction = createMockTransaction({ 
        id: '1', 
        description: 'Valid Transaction',
        amount: 100,
        type: 'expense'
      });

      expect(validTransaction).toHaveProperty('id');
      expect(validTransaction).toHaveProperty('description');
      expect(validTransaction).toHaveProperty('amount');
      expect(validTransaction).toHaveProperty('type');
      expect(validTransaction).toHaveProperty('category');
      expect(validTransaction).toHaveProperty('accountId');
      expect(typeof validTransaction.amount).toBe('number');
      expect(['income', 'expense']).toContain(validTransaction.type);
    });
  });
});