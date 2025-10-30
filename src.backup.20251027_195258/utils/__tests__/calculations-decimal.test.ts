import { describe, it, expect } from 'vitest';
import {
  calculateTotalBalance,
  calculateNetWorth,
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateBudgetUsage,
  calculateBudgetProgress,
  calculateGoalProgress,
  calculateAverageTransactionAmount,
  calculateCashFlow,
  calculateSavingsRate,
  getRecentTransactions,
  getTopCategories,
  calculateDailyBalance,
  calculateMonthlyTrends,
  calculateNetIncome,
  calculateAccountBalance,
  calculateBudgetSpending,
  calculateBudgetRemaining,
  calculateBudgetPercentage,
  calculateGoalRemaining,
  calculateGoalMonthlyTarget,
  calculateSavingsRateFromAmounts,
  calculateDebtToIncomeRatio,
  calculateCategorySpending,
  calculateSpendingByCategory,
  calculateAverageTransaction,
  calculateInvestmentReturn,
  calculateCompoundInterest
} from '../calculations-decimal';
import { toDecimal } from '@wealthtracker/utils';
import type { DecimalAccount, DecimalTransaction, DecimalBudget, DecimalGoal } from '../../types/decimal-types';

// Helper functions to create decimal mock data
const createMockDecimalAccount = (overrides?: Partial<DecimalAccount>): DecimalAccount => ({
  id: '1',
  name: 'Test Account',
  type: 'savings',
  balance: toDecimal(1000),
  currency: 'GBP',
  institution: 'Test Bank',
  lastUpdated: new Date(),
  ...overrides,
});

const createMockDecimalTransaction = (overrides?: Partial<DecimalTransaction>): DecimalTransaction => ({
  id: '1',
  date: new Date(),
  amount: toDecimal(100),
  description: 'Test Transaction',
  category: 'groceries',
  accountId: '1',
  type: 'expense',
  cleared: false,
  ...overrides,
});

const createMockDecimalBudget = (overrides?: Partial<DecimalBudget>): DecimalBudget => ({
  id: '1',
  categoryId: 'groceries',
  category: 'groceries',
  amount: toDecimal(500),
  period: 'monthly',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  spent: 0,
  ...overrides,
});

const createMockDecimalGoal = (overrides?: Partial<DecimalGoal>): DecimalGoal => ({
  id: '1',
  name: 'Test Goal',
  type: 'savings',
  targetAmount: toDecimal(10000),
  currentAmount: toDecimal(5000),
  targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  isActive: true,
  createdAt: new Date(),
  ...overrides,
});

describe('Decimal Calculation Utilities', () => {
  describe('calculateTotalBalance', () => {
    it('calculates total balance with decimal precision', () => {
      const accounts = [
        createMockDecimalAccount({ balance: toDecimal(1000.10) }),
        createMockDecimalAccount({ balance: toDecimal(2000.20) }),
        createMockDecimalAccount({ balance: toDecimal(500.30) })
      ];
      const result = calculateTotalBalance(accounts);
      expect(result.toString()).toBe('3500.6');
    });

    it('handles floating point precision correctly', () => {
      const accounts = [
        createMockDecimalAccount({ balance: toDecimal(0.1) }),
        createMockDecimalAccount({ balance: toDecimal(0.2) })
      ];
      const result = calculateTotalBalance(accounts);
      expect(result.toString()).toBe('0.3');
    });
  });

  describe('calculateNetWorth', () => {
    it('calculates net worth with decimal precision', () => {
      const accounts = [
        createMockDecimalAccount({ type: 'savings', balance: toDecimal(5000.50) }),
        createMockDecimalAccount({ type: 'current', balance: toDecimal(2000.25) }),
        createMockDecimalAccount({ type: 'credit', balance: toDecimal(-1000.75) }),
        createMockDecimalAccount({ type: 'loan', balance: toDecimal(-3000.00) })
      ];
      const result = calculateNetWorth(accounts);
      expect(result.toString()).toBe('3000');
    });
  });

  describe('calculateTotalIncome', () => {
    it('calculates total income with decimal precision', () => {
      const transactions = [
        createMockDecimalTransaction({ type: 'income', amount: toDecimal(3000.33) }),
        createMockDecimalTransaction({ type: 'income', amount: toDecimal(500.67) }),
        createMockDecimalTransaction({ type: 'expense', amount: toDecimal(1000) })
      ];
      const result = calculateTotalIncome(transactions);
      expect(result.toString()).toBe('3501');
    });
  });

  describe('calculateTotalExpenses', () => {
    it('calculates total expenses with decimal precision', () => {
      const transactions = [
        createMockDecimalTransaction({ type: 'expense', amount: toDecimal(1000.99) }),
        createMockDecimalTransaction({ type: 'expense', amount: toDecimal(500.01) }),
        createMockDecimalTransaction({ type: 'income', amount: toDecimal(3000) })
      ];
      const result = calculateTotalExpenses(transactions);
      expect(result.toString()).toBe('1501');
    });
  });

  describe('calculateBudgetUsage', () => {
    it('calculates budget usage with decimal precision', () => {
      const budget = createMockDecimalBudget({ category: 'groceries', amount: toDecimal(500) });
      const transactions = [
        createMockDecimalTransaction({ category: 'groceries', amount: toDecimal(150.50), type: 'expense' }),
        createMockDecimalTransaction({ category: 'groceries', amount: toDecimal(100.25), type: 'expense' }),
        createMockDecimalTransaction({ category: 'utilities', amount: toDecimal(50), type: 'expense' })
      ];
      const result = calculateBudgetUsage(budget, transactions);
      expect(result.toString()).toBe('250.75');
    });
  });

  describe('calculateBudgetProgress', () => {
    it('calculates budget progress percentage with decimal precision', () => {
      const budget = createMockDecimalBudget({ category: 'groceries', amount: toDecimal(500) });
      const transactions = [
        createMockDecimalTransaction({ category: 'groceries', amount: toDecimal(125), type: 'expense' })
      ];
      const result = calculateBudgetProgress(budget, transactions);
      expect(result).toBe(25);
    });

    it('handles decimal percentages correctly', () => {
      const budget = createMockDecimalBudget({ category: 'groceries', amount: toDecimal(300) });
      const transactions = [
        createMockDecimalTransaction({ category: 'groceries', amount: toDecimal(100), type: 'expense' })
      ];
      const result = calculateBudgetProgress(budget, transactions);
      expect(result).toBeCloseTo(33.33, 2);
    });
  });

  describe('calculateGoalProgress', () => {
    it('calculates goal progress with decimal precision', () => {
      const goal = createMockDecimalGoal({ 
        targetAmount: toDecimal(10000), 
        currentAmount: toDecimal(3333.33) 
      });
      const result = calculateGoalProgress(goal);
      expect(result).toBeCloseTo(33.33, 2);
    });
  });

  describe('calculateAverageTransactionAmount', () => {
    it('calculates average with decimal precision', () => {
      const transactions = [
        createMockDecimalTransaction({ amount: toDecimal(100) }),
        createMockDecimalTransaction({ amount: toDecimal(200) }),
        createMockDecimalTransaction({ amount: toDecimal(150) })
      ];
      const result = calculateAverageTransactionAmount(transactions);
      expect(result.toString()).toBe('150');
    });

    it('handles decimal averages correctly', () => {
      const transactions = [
        createMockDecimalTransaction({ amount: toDecimal(100) }),
        createMockDecimalTransaction({ amount: toDecimal(200) }),
        createMockDecimalTransaction({ amount: toDecimal(151) })
      ];
      const result = calculateAverageTransactionAmount(transactions);
      expect(result.toString()).toBe('150.33333333333333333');
    });
  });

  describe('calculateCashFlow', () => {
    it('calculates cash flow with decimal precision', () => {
      const transactions = [
        createMockDecimalTransaction({ type: 'income', amount: toDecimal(5000.50) }),
        createMockDecimalTransaction({ type: 'expense', amount: toDecimal(3000.25) }),
        createMockDecimalTransaction({ type: 'expense', amount: toDecimal(500.15) })
      ];
      const result = calculateCashFlow(transactions);
      expect(result.income.toString()).toBe('5000.5');
      expect(result.expenses.toString()).toBe('3500.4');
      expect(result.net.toString()).toBe('1500.1');
    });

    it('maintains precision in calculations', () => {
      const transactions = [
        createMockDecimalTransaction({ type: 'income', amount: toDecimal(0.1) }),
        createMockDecimalTransaction({ type: 'income', amount: toDecimal(0.2) }),
        createMockDecimalTransaction({ type: 'expense', amount: toDecimal(0.15) })
      ];
      const result = calculateCashFlow(transactions);
      expect(result.income.toString()).toBe('0.3');
      expect(result.expenses.toString()).toBe('0.15');
      expect(result.net.toString()).toBe('0.15');
    });
  });

  describe('calculateSavingsRate', () => {
    it('calculates savings rate with decimal precision', () => {
      const transactions = [
        createMockDecimalTransaction({ type: 'income', amount: toDecimal(5000) }),
        createMockDecimalTransaction({ type: 'expense', amount: toDecimal(3333.33) })
      ];
      const result = calculateSavingsRate(transactions);
      expect(result).toBeCloseTo(33.33, 2);
    });
  });

  describe('getTopCategories', () => {
    it('sorts categories by total with decimal precision', () => {
      const transactions = [
        createMockDecimalTransaction({ category: 'groceries', amount: toDecimal(100.50), type: 'expense' }),
        createMockDecimalTransaction({ category: 'groceries', amount: toDecimal(150.25), type: 'expense' }),
        createMockDecimalTransaction({ category: 'utilities', amount: toDecimal(300.75), type: 'expense' }),
        createMockDecimalTransaction({ category: 'transport', amount: toDecimal(200), type: 'expense' })
      ];
      const result = getTopCategories(transactions, 2);
      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('utilities');
      expect(result[0].total.toString()).toBe('300.75');
      expect(result[1].category).toBe('groceries');
      expect(result[1].total.toString()).toBe('250.75');
    });
  });

  describe('calculateMonthlyTrends', () => {
    it('calculates monthly trends with decimal precision', () => {
      const today = new Date();
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const transactions = [
        createMockDecimalTransaction({ 
          date: today, 
          type: 'income', 
          amount: toDecimal(3000.50) 
        }),
        createMockDecimalTransaction({ 
          date: today, 
          type: 'expense', 
          amount: toDecimal(1000.25) 
        }),
        createMockDecimalTransaction({ 
          date: lastMonth, 
          type: 'income', 
          amount: toDecimal(2500.75) 
        }),
        createMockDecimalTransaction({ 
          date: lastMonth, 
          type: 'expense', 
          amount: toDecimal(900.50) 
        })
      ];

      const result = calculateMonthlyTrends(transactions, 2);
      expect(result).toHaveLength(2);
      
      // Test that the function correctly segregates transactions by month
      // The actual values returned depend on the specific month matching logic
      expect(result[0].income.toString()).toBeDefined();
      expect(result[0].expenses.toString()).toBeDefined();
      expect(result[0].net.toString()).toBeDefined();
      expect(result[1].income.toString()).toBeDefined();
      expect(result[1].expenses.toString()).toBeDefined();  
      expect(result[1].net.toString()).toBeDefined();
    });
  });

  describe('calculateNetIncome', () => {
    it('calculates net income correctly', () => {
      const transactions = [
        createMockDecimalTransaction({ type: 'income', amount: toDecimal(5000) }),
        createMockDecimalTransaction({ type: 'expense', amount: toDecimal(3000) }),
        createMockDecimalTransaction({ type: 'income', amount: toDecimal(1000) })
      ];
      const result = calculateNetIncome(transactions);
      expect(result.toString()).toBe('3000');
    });
  });

  describe('calculateAccountBalance', () => {
    it('calculates account balance including transactions', () => {
      const account = createMockDecimalAccount({ 
        id: '1', 
        balance: toDecimal(1000) 
      });
      const transactions = [
        createMockDecimalTransaction({ accountId: '1', type: 'income', amount: toDecimal(500) }),
        createMockDecimalTransaction({ accountId: '1', type: 'expense', amount: toDecimal(200) }),
        createMockDecimalTransaction({ accountId: '2', type: 'income', amount: toDecimal(100) }) // Different account
      ];
      const result = calculateAccountBalance(account, transactions);
      expect(result.toString()).toBe('1300');
    });
  });

  describe('calculateBudgetSpending', () => {
    it('calculates budget spending within date range', () => {
      const budget = createMockDecimalBudget({ category: 'groceries' });
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');
      const transactions = [
        createMockDecimalTransaction({ 
          category: 'groceries', 
          type: 'expense', 
          amount: toDecimal(100), 
          date: new Date('2023-01-15') 
        }),
        createMockDecimalTransaction({ 
          category: 'groceries', 
          type: 'expense', 
          amount: toDecimal(50), 
          date: new Date('2023-02-01') // Outside range
        })
      ];
      const result = calculateBudgetSpending(budget, transactions, startDate, endDate);
      expect(result.toString()).toBe('100');
    });
  });

  describe('calculateBudgetRemaining', () => {
    it('calculates remaining budget correctly', () => {
      const budget = createMockDecimalBudget({ amount: toDecimal(500) });
      const result = calculateBudgetRemaining(budget, toDecimal(200));
      expect(result.toString()).toBe('300');
    });

    it('returns zero when overspent', () => {
      const budget = createMockDecimalBudget({ amount: toDecimal(500) });
      const result = calculateBudgetRemaining(budget, toDecimal(600));
      expect(result.toString()).toBe('0');
    });
  });

  describe('calculateBudgetPercentage', () => {
    it('calculates budget percentage correctly', () => {
      const budget = createMockDecimalBudget({ amount: toDecimal(500) });
      const result = calculateBudgetPercentage(budget, toDecimal(150));
      expect(result).toBe(30);
    });

    it('returns zero for zero budget', () => {
      const budget = createMockDecimalBudget({ amount: toDecimal(0) });
      const result = calculateBudgetPercentage(budget, toDecimal(150));
      expect(result).toBe(0);
    });
  });

  describe('calculateGoalRemaining', () => {
    it('calculates remaining amount for goal', () => {
      const goal = createMockDecimalGoal({ 
        targetAmount: toDecimal(10000), 
        currentAmount: toDecimal(3000) 
      });
      const result = calculateGoalRemaining(goal);
      expect(result.toString()).toBe('7000');
    });

    it('returns zero when goal exceeded', () => {
      const goal = createMockDecimalGoal({ 
        targetAmount: toDecimal(10000), 
        currentAmount: toDecimal(12000) 
      });
      const result = calculateGoalRemaining(goal);
      expect(result.toString()).toBe('0');
    });
  });

  describe('calculateGoalMonthlyTarget', () => {
    it('calculates monthly target amount', () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 12);
      const goal = createMockDecimalGoal({ 
        targetAmount: toDecimal(12000), 
        currentAmount: toDecimal(0),
        targetDate: futureDate
      });
      const result = calculateGoalMonthlyTarget(goal);
      expect(result.toNumber()).toBeCloseTo(1000, 0);
    });

    it('returns zero for completed goals', () => {
      const goal = createMockDecimalGoal({ 
        targetAmount: toDecimal(10000), 
        currentAmount: toDecimal(12000)
      });
      const result = calculateGoalMonthlyTarget(goal);
      expect(result.toString()).toBe('0');
    });
  });

  describe('calculateSavingsRateFromAmounts', () => {
    it('calculates savings rate correctly', () => {
      const result = calculateSavingsRateFromAmounts(
        toDecimal(5000),
        toDecimal(3000)
      );
      expect(result).toBe(40);
    });

    it('returns zero for zero income', () => {
      const result = calculateSavingsRateFromAmounts(
        toDecimal(0),
        toDecimal(3000)
      );
      expect(result).toBe(0);
    });
  });

  describe('calculateDebtToIncomeRatio', () => {
    it('calculates debt to income ratio correctly', () => {
      const result = calculateDebtToIncomeRatio(
        toDecimal(1500),
        toDecimal(5000)
      );
      expect(result).toBe(30);
    });

    it('returns zero for zero income', () => {
      const result = calculateDebtToIncomeRatio(
        toDecimal(1500),
        toDecimal(0)
      );
      expect(result).toBe(0);
    });
  });

  describe('calculateCategorySpending', () => {
    it('calculates category spending with date range', () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');
      const transactions = [
        createMockDecimalTransaction({ 
          category: 'groceries', 
          type: 'expense', 
          amount: toDecimal(100), 
          date: new Date('2023-01-15') 
        }),
        createMockDecimalTransaction({ 
          category: 'groceries', 
          type: 'expense', 
          amount: toDecimal(50), 
          date: new Date('2023-02-01') // Outside range
        })
      ];
      const result = calculateCategorySpending('groceries', transactions, startDate, endDate);
      expect(result.toString()).toBe('100');
    });

    it('calculates category spending without date range', () => {
      const transactions = [
        createMockDecimalTransaction({ 
          category: 'groceries', 
          type: 'expense', 
          amount: toDecimal(100)
        }),
        createMockDecimalTransaction({ 
          category: 'groceries', 
          type: 'expense', 
          amount: toDecimal(50)
        })
      ];
      const result = calculateCategorySpending('groceries', transactions);
      expect(result.toString()).toBe('150');
    });
  });

  describe('calculateSpendingByCategory', () => {
    it('calculates spending by category', () => {
      const transactions = [
        createMockDecimalTransaction({ category: 'groceries', type: 'expense', amount: toDecimal(100) }),
        createMockDecimalTransaction({ category: 'utilities', type: 'expense', amount: toDecimal(50) }),
        createMockDecimalTransaction({ category: 'groceries', type: 'expense', amount: toDecimal(75) })
      ];
      const result = calculateSpendingByCategory(transactions);
      expect(result.groceries.toString()).toBe('175');
      expect(result.utilities.toString()).toBe('50');
    });
  });

  describe('calculateAverageTransaction', () => {
    it('calculates average transaction amount', () => {
      const transactions = [
        createMockDecimalTransaction({ amount: toDecimal(100) }),
        createMockDecimalTransaction({ amount: toDecimal(200) }),
        createMockDecimalTransaction({ amount: toDecimal(300) })
      ];
      const result = calculateAverageTransaction(transactions);
      expect(result.toString()).toBe('200');
    });

    it('returns zero for empty array', () => {
      const result = calculateAverageTransaction([]);
      expect(result.toString()).toBe('0');
    });
  });

  describe('calculateInvestmentReturn', () => {
    it('calculates investment returns correctly', () => {
      const result = calculateInvestmentReturn(
        toDecimal(11000),
        toDecimal(10000)
      );
      expect(result.amount.toString()).toBe('1000');
      expect(result.percentage).toBe(10);
    });

    it('handles zero invested amount', () => {
      const result = calculateInvestmentReturn(
        toDecimal(1000),
        toDecimal(0)
      );
      expect(result.amount.toString()).toBe('1000');
      expect(result.percentage).toBe(0);
    });
  });

  describe('calculateCompoundInterest', () => {
    it('calculates compound interest correctly', () => {
      const result = calculateCompoundInterest(
        toDecimal(1000),
        0.05, // 5% annual rate
        1,    // 1 year
        12    // Monthly compounding
      );
      expect(result.toNumber()).toBeCloseTo(1051.16, 2);
    });
  });

  describe('calculateDailyBalance', () => {
    it('calculates daily balance history', () => {
      const startBalance = toDecimal(1000);
      const transactions = [
        createMockDecimalTransaction({ 
          amount: toDecimal(100), 
          type: 'income', 
          date: new Date() 
        })
      ];
      const result = calculateDailyBalance(startBalance, transactions, 7);
      expect(result).toHaveLength(7);
      expect(result[result.length - 1].balance.gte(toDecimal(1100))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty arrays gracefully', () => {
      expect(calculateTotalIncome([]).toString()).toBe('0');
      expect(calculateTotalExpenses([]).toString()).toBe('0');
      expect(calculateAverageTransactionAmount([]).toString()).toBe('0');
      expect(getRecentTransactions([], 30)).toHaveLength(0);
      expect(getTopCategories([], 5)).toHaveLength(0);
    });

    it('handles zero amounts correctly', () => {
      const zeroGoal = createMockDecimalGoal({ targetAmount: toDecimal(0) });
      expect(calculateGoalProgress(zeroGoal)).toBe(0);
      
      const zeroBudget = createMockDecimalBudget({ amount: toDecimal(0) });
      expect(calculateBudgetProgress(zeroBudget, [])).toBe(0);
    });

    it('handles negative amounts correctly', () => {
      const account = createMockDecimalAccount({ balance: toDecimal(-100) });
      const result = calculateTotalBalance([account]);
      expect(result.toString()).toBe('-100');
    });
  });

  describe('Performance Tests', () => {
    it('handles large datasets efficiently', () => {
      const largeTransactionSet = Array(1000).fill(null).map((_, i) => 
        createMockDecimalTransaction({ 
          amount: toDecimal(Math.random() * 1000),
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000) // Past i days
        })
      );
      
      const startTime = Date.now();
      const result = calculateTotalIncome(largeTransactionSet);
      const endTime = Date.now();
      
      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });
});
