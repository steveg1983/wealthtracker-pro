import { describe, it, expect } from 'vitest';
import {
  calculateTotalBalance,
  calculateNetWorth,
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateBudgetUsage,
  calculateBudgetProgress,
  calculateGoalProgress,
  getTransactionsByCategory,
  getTransactionsByDateRange,
  calculateAverageTransactionAmount,
  calculateMonthlyAverage,
  getCategoryIcon,
  getAccountTypeIcon,
  groupTransactionsByDate,
  calculateAccountTotals,
  calculateCashFlow,
  calculateSavingsRate,
  getRecentTransactions,
  getTopCategories,
  calculateDailyBalance,
  calculateMonthlyTrends,
  calculateCategoryTrends
} from '../calculations';
import { formatCurrency } from '../currency';
import { createMockAccount, createMockTransaction, createMockBudget, createMockGoal } from '../../test/factories';

describe('Calculation Utilities', () => {
  describe('calculateTotalBalance', () => {
    it('calculates total balance correctly', () => {
      const accounts = [
        createMockAccount({ balance: 1000 }),
        createMockAccount({ balance: 2000 }),
        createMockAccount({ balance: 500 })
      ];
      expect(calculateTotalBalance(accounts)).toBe(3500);
    });

    it('handles empty array', () => {
      expect(calculateTotalBalance([])).toBe(0);
    });
  });

  describe('calculateNetWorth', () => {
    it('calculates net worth correctly', () => {
      const accounts = [
        createMockAccount({ type: 'savings', balance: 5000 }),
        createMockAccount({ type: 'current', balance: 2000 }),
        createMockAccount({ type: 'credit', balance: -1000 }),
        createMockAccount({ type: 'loan', balance: -3000 })
      ];
      expect(calculateNetWorth(accounts)).toBe(3000);
    });

    it('handles no liabilities', () => {
      const accounts = [
        createMockAccount({ type: 'savings', balance: 5000 }),
        createMockAccount({ type: 'current', balance: 2000 })
      ];
      expect(calculateNetWorth(accounts)).toBe(7000);
    });
  });

  describe('calculateTotalIncome', () => {
    it('calculates total income correctly', () => {
      const transactions = [
        createMockTransaction({ type: 'income', amount: 3000 }),
        createMockTransaction({ type: 'income', amount: 500 }),
        createMockTransaction({ type: 'expense', amount: 1000 })
      ];
      expect(calculateTotalIncome(transactions)).toBe(3500);
    });

    it('returns 0 when no income transactions', () => {
      const transactions = [
        createMockTransaction({ type: 'expense', amount: 1000 }),
        createMockTransaction({ type: 'expense', amount: 500 })
      ];
      expect(calculateTotalIncome(transactions)).toBe(0);
    });
  });

  describe('calculateTotalExpenses', () => {
    it('calculates total expenses correctly', () => {
      const transactions = [
        createMockTransaction({ type: 'expense', amount: 1000 }),
        createMockTransaction({ type: 'expense', amount: 500 }),
        createMockTransaction({ type: 'income', amount: 3000 })
      ];
      expect(calculateTotalExpenses(transactions)).toBe(1500);
    });

    it('returns 0 when no expense transactions', () => {
      const transactions = [
        createMockTransaction({ type: 'income', amount: 3000 }),
        createMockTransaction({ type: 'income', amount: 500 })
      ];
      expect(calculateTotalExpenses(transactions)).toBe(0);
    });
  });

  describe('calculateBudgetUsage', () => {
    it('calculates budget usage correctly', () => {
      const budget = createMockBudget({ category: 'groceries', amount: 500 });
      const transactions = [
        createMockTransaction({ category: 'groceries', amount: 150, type: 'expense' }),
        createMockTransaction({ category: 'groceries', amount: 100, type: 'expense' }),
        createMockTransaction({ category: 'utilities', amount: 50, type: 'expense' })
      ];
      expect(calculateBudgetUsage(budget, transactions)).toBe(250);
    });

    it('returns 0 when no matching transactions', () => {
      const budget = createMockBudget({ category: 'groceries', amount: 500 });
      const transactions = [
        createMockTransaction({ category: 'utilities', amount: 50, type: 'expense' })
      ];
      expect(calculateBudgetUsage(budget, transactions)).toBe(0);
    });

    it('ignores income transactions', () => {
      const budget = createMockBudget({ category: 'groceries', amount: 500 });
      const transactions = [
        createMockTransaction({ category: 'groceries', amount: 150, type: 'income' }),
        createMockTransaction({ category: 'groceries', amount: 100, type: 'expense' })
      ];
      expect(calculateBudgetUsage(budget, transactions)).toBe(100);
    });
  });

  describe('calculateBudgetProgress', () => {
    it('calculates budget progress percentage correctly', () => {
      const budget = createMockBudget({ category: 'groceries', amount: 500 });
      const transactions = [
        createMockTransaction({ category: 'groceries', amount: 250, type: 'expense' })
      ];
      expect(calculateBudgetProgress(budget, transactions).percentage).toBe(50);
    });

    it('handles overspending', () => {
      const budget = createMockBudget({ category: 'groceries', amount: 500 });
      const transactions = [
        createMockTransaction({ category: 'groceries', amount: 600, type: 'expense' })
      ];
      expect(calculateBudgetProgress(budget, transactions).percentage).toBe(120);
    });

    it('returns 0 when budget amount is 0', () => {
      const budget = createMockBudget({ category: 'groceries', amount: 0 });
      const transactions = [
        createMockTransaction({ category: 'groceries', amount: 100, type: 'expense' })
      ];
      expect(calculateBudgetProgress(budget, transactions).percentage).toBe(0);
    });
  });

  describe('calculateGoalProgress', () => {
    it('calculates goal progress percentage correctly', () => {
      const goal = createMockGoal({ targetAmount: 10000, currentAmount: 2500 });
      expect(calculateGoalProgress(goal).percentage).toBe(25);
    });

    it('handles completed goals', () => {
      const goal = createMockGoal({ targetAmount: 10000, currentAmount: 10000 });
      expect(calculateGoalProgress(goal).percentage).toBe(100);
    });

    it('handles exceeded goals', () => {
      const goal = createMockGoal({ targetAmount: 10000, currentAmount: 12000 });
      expect(calculateGoalProgress(goal).percentage).toBe(100); // Capped at 100
    });

    it('returns 0 when target amount is 0', () => {
      const goal = createMockGoal({ targetAmount: 0, currentAmount: 1000 });
      expect(calculateGoalProgress(goal).percentage).toBe(100); // Returns 100 when target is 0
    });
  });

  describe('getTransactionsByCategory', () => {
    it('filters transactions by category', () => {
      const transactions = [
        createMockTransaction({ category: 'groceries', amount: 100 }),
        createMockTransaction({ category: 'utilities', amount: 50 }),
        createMockTransaction({ category: 'groceries', amount: 150 })
      ];
      const result = getTransactionsByCategory(transactions, 'groceries');
      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(100);
      expect(result[1].amount).toBe(150);
    });

    it('returns empty array when no matches', () => {
      const transactions = [
        createMockTransaction({ category: 'utilities', amount: 50 })
      ];
      const result = getTransactionsByCategory(transactions, 'groceries');
      expect(result).toHaveLength(0);
    });
  });

  describe('getTransactionsByDateRange', () => {
    it('filters transactions by date range', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      const transactions = [
        createMockTransaction({ date: yesterday }),
        createMockTransaction({ date: today }),
        createMockTransaction({ date: lastWeek })
      ];

      const result = getTransactionsByDateRange(transactions, yesterday, today);
      expect(result).toHaveLength(2);
    });

    it('includes transactions on boundary dates', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      const transactions = [
        createMockTransaction({ date: new Date('2024-01-01') }),
        createMockTransaction({ date: new Date('2024-01-15') }),
        createMockTransaction({ date: new Date('2024-01-31') }),
        createMockTransaction({ date: new Date('2024-02-01') })
      ];

      const result = getTransactionsByDateRange(transactions, startDate, endDate);
      expect(result).toHaveLength(3);
    });
  });

  describe('calculateCashFlow', () => {
    it('calculates cash flow correctly', () => {
      const transactions = [
        createMockTransaction({ type: 'income', amount: 5000 }),
        createMockTransaction({ type: 'expense', amount: 3000 }),
        createMockTransaction({ type: 'expense', amount: 500 })
      ];
      const result = calculateCashFlow(transactions);
      expect(result.totalIncome).toBe(5000);
      expect(result.totalExpenses).toBe(3500);
      expect(result.netCashFlow).toBe(1500);
    });

    it('handles negative cash flow', () => {
      const transactions = [
        createMockTransaction({ type: 'income', amount: 2000 }),
        createMockTransaction({ type: 'expense', amount: 3000 })
      ];
      const result = calculateCashFlow(transactions);
      expect(result.netCashFlow).toBe(-1000);
    });
  });

  describe('calculateSavingsRate', () => {
    it('calculates savings rate correctly', () => {
      const transactions = [
        createMockTransaction({ type: 'income', amount: 5000 }),
        createMockTransaction({ type: 'expense', amount: 3000 })
      ];
      expect(calculateSavingsRate(transactions)).toBe(40);
    });

    it('returns 0 when no income', () => {
      const transactions = [
        createMockTransaction({ type: 'expense', amount: 1000 })
      ];
      expect(calculateSavingsRate(transactions)).toBe(0);
    });

    it('handles negative savings rate', () => {
      const transactions = [
        createMockTransaction({ type: 'income', amount: 2000 }),
        createMockTransaction({ type: 'expense', amount: 3000 })
      ];
      expect(calculateSavingsRate(transactions)).toBe(-50);
    });
  });


  describe('getCategoryIcon', () => {
    it('returns correct icon for known categories', () => {
      expect(getCategoryIcon('groceries')).toBe('🛒');
      expect(getCategoryIcon('utilities')).toBe('💡');
      expect(getCategoryIcon('transport')).toBe('🚗');
    });

    it('returns default icon for unknown categories', () => {
      expect(getCategoryIcon('unknown-category')).toBe('📌');
    });
  });

  describe('getAccountTypeIcon', () => {
    it('returns correct icon for known account types', () => {
      expect(getAccountTypeIcon('current')).toBe('💳');
      expect(getAccountTypeIcon('savings')).toBe('🏦');
      expect(getAccountTypeIcon('credit')).toBe('💳');
    });

    it('returns default icon for unknown account types', () => {
      expect(getAccountTypeIcon('unknown-type' as any)).toBe('💰');
    });
  });
});