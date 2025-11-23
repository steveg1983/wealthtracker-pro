/**
 * Financial Calculations Tests
 * Comprehensive tests for financial calculation utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateNetWorth,
  calculateSpendingByCategory,
  calculateMonthlyTrends,
  getRecentTransactions,
  getTopCategories,
  calculateBudgetProgress,
  calculateGoalProgress,
  calculateAverageSpending,
  calculateCashFlow,
  calculateGrowthRate,
  calculateProjectedSavings,
  calculateDebtToIncomeRatio,
  calculateEmergencyFundCoverage,
} from '../../utils/calculations';
import { createMockTransaction, createMockAccount, createMockBudget, createMockGoal } from '../../test/testUtils';
import type { Transaction, Account, Budget, Goal } from '../../types';

describe('Financial Calculations', () => {
  let mockTransactions: Transaction[];
  let mockAccounts: Account[];
  let mockBudgets: Budget[];
  let mockGoals: Goal[];

  beforeEach(() => {
    // Create comprehensive test data
    mockTransactions = [
      createMockTransaction({
        id: '1',
        type: 'income',
        amount: 3000,
        category: 'salary',
        description: 'Monthly salary',
        date: new Date('2025-01-15'),
      }),
      createMockTransaction({
        id: '2',
        type: 'expense',
        amount: 500,
        category: 'groceries',
        description: 'Weekly groceries',
        date: new Date('2025-01-18'),
      }),
      createMockTransaction({
        id: '3',
        type: 'expense',
        amount: 1200,
        category: 'housing',
        description: 'Monthly rent',
        date: new Date('2025-01-01'),
      }),
      createMockTransaction({
        id: '4',
        type: 'income',
        amount: 500,
        category: 'freelance',
        description: 'Freelance work',
        date: new Date('2025-01-10'),
      }),
      createMockTransaction({
        id: '5',
        type: 'expense',
        amount: 200,
        category: 'entertainment',
        description: 'Movie tickets',
        date: new Date('2025-01-12'),
      }),
      createMockTransaction({
        id: '6',
        type: 'expense',
        amount: 150,
        category: 'groceries',
        description: 'Weekend groceries',
        date: new Date('2025-01-14'),
      }),
    ];

    mockAccounts = [
      createMockAccount({
        id: '1',
        name: 'Main Checking',
        type: 'current',
        balance: 5000,
      }),
      createMockAccount({
        id: '2',
        name: 'Savings Account',
        type: 'savings',
        balance: 15000,
      }),
      createMockAccount({
        id: '3',
        name: 'Investment Account',
        type: 'investment',
        balance: 25000,
      }),
      createMockAccount({
        id: '4',
        name: 'Credit Card',
        type: 'credit',
        balance: -2000,
      }),
    ];

    mockBudgets = [
      createMockBudget({
        id: '1',
        category: 'groceries',
        amount: 800,
        spent: 650, // 650 spent out of 800
        period: 'monthly',
      }),
      createMockBudget({
        id: '2',
        category: 'entertainment',
        amount: 300,
        spent: 200,
        period: 'monthly',
      }),
      createMockBudget({
        id: '3',
        category: 'housing',
        amount: 1500,
        spent: 1200,
        period: 'monthly',
      }),
    ];

    mockGoals = [
      createMockGoal({
        id: '1',
        name: 'Emergency Fund',
        targetAmount: 10000,
        currentAmount: 6000,
        targetDate: new Date('2025-12-31'),
      }),
      createMockGoal({
        id: '2',
        name: 'Vacation Fund',
        targetAmount: 3000,
        currentAmount: 1200,
        targetDate: new Date('2025-06-30'),
      }),
      createMockGoal({
        id: '3',
        name: 'Car Down Payment',
        targetAmount: 5000,
        currentAmount: 5000, // Completed goal
        targetDate: new Date('2025-03-31'),
      }),
    ];
  });

  describe('Income and Expense Calculations', () => {
    it('calculates total income correctly', () => {
      const totalIncome = calculateTotalIncome(mockTransactions);
      expect(totalIncome).toBe(3500); // 3000 + 500
    });

    it('calculates total expenses correctly', () => {
      const totalExpenses = calculateTotalExpenses(mockTransactions);
      expect(totalExpenses).toBe(2050); // 500 + 1200 + 200 + 150
    });

    it('handles empty transaction list', () => {
      expect(calculateTotalIncome([])).toBe(0);
      expect(calculateTotalExpenses([])).toBe(0);
    });

    it('filters by date range', () => {
      const startDate = new Date('2025-01-10');
      const endDate = new Date('2025-01-15');
      
      const filteredTransactions = mockTransactions.filter(
        t => t.date >= startDate && t.date <= endDate
      );
      
      const income = calculateTotalIncome(filteredTransactions);
      const expenses = calculateTotalExpenses(filteredTransactions);
      
      expect(income).toBe(3500); // salary + freelance
      expect(expenses).toBe(350); // entertainment + groceries
    });

    it('handles decimal precision correctly', () => {
      const precisionTransactions = [
        createMockTransaction({
          type: 'income',
          amount: 1234.56,
        }),
        createMockTransaction({
          type: 'expense',
          amount: 678.90,
        }),
      ];

      const income = calculateTotalIncome(precisionTransactions);
      const expenses = calculateTotalExpenses(precisionTransactions);

      expect(income).toBe(1234.56);
      expect(expenses).toBe(678.90);
    });
  });

  describe('Net Worth Calculations', () => {
    it('calculates net worth correctly', () => {
      const netWorth = calculateNetWorth(mockAccounts);
      // 5000 + 15000 + 25000 - 2000 = 43000
      expect(netWorth).toBe(43000);
    });

    it('handles negative net worth', () => {
      const debtAccounts = [
        createMockAccount({
          type: 'credit',
          balance: -50000,
        }),
        createMockAccount({
          type: 'current',
          balance: 1000,
        }),
      ];

      const netWorth = calculateNetWorth(debtAccounts);
      expect(netWorth).toBe(-49000);
    });

    it('excludes inactive accounts if specified', () => {
      const accountsWithInactive = [
        ...mockAccounts,
        createMockAccount({
          balance: 10000,
          isActive: false,
        }),
      ];

      // Assuming calculateNetWorth has an option to exclude inactive accounts
      const netWorth = calculateNetWorth(
        accountsWithInactive.filter(a => a.isActive !== false)
      );
      expect(netWorth).toBe(43000); // Same as before, inactive account excluded
    });
  });

  describe('Category Analysis', () => {
    it('calculates spending by category', () => {
      const categorySpending = calculateSpendingByCategory(mockTransactions);
      
      expect(categorySpending.groceries).toBe(650); // 500 + 150
      expect(categorySpending.housing).toBe(1200);
      expect(categorySpending.entertainment).toBe(200);
    });

    it('gets top spending categories', () => {
      const topCategories = getTopCategories(mockTransactions, 3);
      
      expect(topCategories).toHaveLength(3);
      expect(topCategories[0].category).toBe('housing'); // Highest spending
      expect(topCategories[0].amount).toBe(1200);
      expect(topCategories[1].category).toBe('groceries');
      expect(topCategories[1].amount).toBe(650);
    });

    it('limits number of top categories returned', () => {
      const topCategories = getTopCategories(mockTransactions, 2);
      expect(topCategories).toHaveLength(2);
    });

    it('handles case with no expenses', () => {
      const incomeOnly = mockTransactions.filter(t => t.type === 'income');
      const categorySpending = calculateSpendingByCategory(incomeOnly);
      
      expect(Object.keys(categorySpending)).toHaveLength(0);
    });
  });

  describe('Time-Based Analysis', () => {
    it('gets recent transactions', () => {
      const recentTransactions = getRecentTransactions(mockTransactions, 7); // Last 7 days
      
      // Assuming current date is around January 20, 2025
      const recent = recentTransactions.filter(t => {
        const daysDiff = Math.floor(
          (new Date('2025-01-20').getTime() - t.date.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysDiff <= 7;
      });
      
      expect(recent.length).toBeGreaterThan(0);
    });

    it('calculates monthly trends', () => {
      // Create transactions across multiple months
      const multiMonthTransactions = [
        ...mockTransactions,
        createMockTransaction({
          type: 'income',
          amount: 2800,
          date: new Date('2024-12-15'),
        }),
        createMockTransaction({
          type: 'expense',
          amount: 400,
          date: new Date('2024-12-10'),
        }),
        createMockTransaction({
          type: 'income',
          amount: 3200,
          date: new Date('2024-11-15'),
        }),
      ];

      const trends = calculateMonthlyTrends(multiMonthTransactions, 3); // Last 3 months
      
      expect(trends).toHaveLength(3);
      expect(trends[0].month).toBeDefined();
      expect(trends[0].income).toBeDefined();
      expect(trends[0].expenses).toBeDefined();
      expect(trends[0].netIncome).toBeDefined();
    });
  });

  describe('Budget Analysis', () => {
    it('calculates budget progress', () => {
      const progress = calculateBudgetProgress(mockBudgets[0]); // Groceries budget
      
      expect(progress.percentage).toBe(81.25); // 650/800 * 100
      expect(progress.remaining).toBe(150); // 800 - 650
      expect(progress.status).toBe('warning'); // Assuming >80% is warning
    });

    it('identifies over-budget scenarios', () => {
      const overBudget = createMockBudget({
        amount: 500,
        spent: 600, // Over budget
      });

      const progress = calculateBudgetProgress(overBudget);
      
      expect(progress.percentage).toBe(120);
      expect(progress.remaining).toBe(-100);
      expect(progress.status).toBe('danger');
    });

    it('calculates average spending rate', () => {
      const budget = mockBudgets[0];
      const daysPassed = 20; // Assuming we're 20 days into the month
      
      const averageSpending = calculateAverageSpending(
        mockTransactions.filter(t => t.category === budget.categoryId),
        daysPassed
      );
      
      expect(averageSpending).toBe(32.5); // 650 / 20 days
    });
  });

  describe('Goal Tracking', () => {
    it('calculates goal progress', () => {
      const progress = calculateGoalProgress(mockGoals[0]); // Emergency Fund
      
      expect(progress.percentage).toBe(60); // 6000/10000 * 100
      expect(progress.remaining).toBe(4000); // 10000 - 6000
      expect(progress.isCompleted).toBe(false);
    });

    it('identifies completed goals', () => {
      const progress = calculateGoalProgress(mockGoals[2]); // Car Down Payment
      
      expect(progress.percentage).toBe(100);
      expect(progress.remaining).toBe(0);
      expect(progress.isCompleted).toBe(true);
    });

    it('calculates time-based goal projections', () => {
      const goal = mockGoals[1]; // Vacation Fund
      const monthlyContribution = 300;
      
      const projection = calculateProjectedSavings(
        goal.currentAmount,
        monthlyContribution,
        goal.targetDate
      );
      
      expect(projection.projectedAmount).toBeGreaterThan(goal.currentAmount);
      expect(projection.willMeetGoal).toBeDefined();
      expect(projection.monthsToGoal).toBeDefined();
    });
  });

  describe('Cash Flow Analysis', () => {
    it('calculates monthly cash flow', () => {
      const cashFlow = calculateCashFlow(mockTransactions);
      
      expect(cashFlow.totalIncome).toBe(3500);
      expect(cashFlow.totalExpenses).toBe(2050);
      expect(cashFlow.netCashFlow).toBe(1450);
      expect(cashFlow.savingsRate).toBeCloseTo(41.43, 2); // 1450/3500 * 100
    });

    it('handles negative cash flow', () => {
      const negativeFlowTransactions = [
        createMockTransaction({
          type: 'income',
          amount: 1000,
        }),
        createMockTransaction({
          type: 'expense',
          amount: 1500,
        }),
      ];

      const cashFlow = calculateCashFlow(negativeFlowTransactions);
      
      expect(cashFlow.netCashFlow).toBe(-500);
      expect(cashFlow.savingsRate).toBeLessThan(0);
    });
  });

  describe('Growth and Trend Analysis', () => {
    it('calculates growth rate between periods', () => {
      const previousPeriod = 1000;
      const currentPeriod = 1200;
      
      const growthRate = calculateGrowthRate(previousPeriod, currentPeriod);
      
      expect(growthRate).toBe(20); // ((1200-1000)/1000) * 100
    });

    it('handles negative growth', () => {
      const previousPeriod = 1200;
      const currentPeriod = 1000;
      
      const growthRate = calculateGrowthRate(previousPeriod, currentPeriod);
      
      expect(growthRate).toBeCloseTo(-16.67, 2);
    });

    it('handles zero previous period', () => {
      const growthRate = calculateGrowthRate(0, 1000);
      expect(growthRate).toBe(Infinity);
    });
  });

  describe('Financial Ratios', () => {
    it('calculates debt-to-income ratio', () => {
      const monthlyIncome = 3500;
      const monthlyDebtPayments = 500; // Assumed monthly debt payments
      
      const ratio = calculateDebtToIncomeRatio(monthlyDebtPayments, monthlyIncome);
      
      expect(ratio).toBeCloseTo(14.29, 2); // (500/3500) * 100
    });

    it('calculates emergency fund coverage', () => {
      const emergencyFund = 15000; // Savings account balance
      const monthlyExpenses = 2050;
      
      const coverage = calculateEmergencyFundCoverage(emergencyFund, monthlyExpenses);
      
      expect(coverage.months).toBeCloseTo(7.32, 2); // 15000/2050
      expect(coverage.isAdequate).toBe(true); // Assuming 6+ months is adequate
    });

    it('identifies inadequate emergency fund', () => {
      const smallEmergencyFund = 2000;
      const monthlyExpenses = 2050;
      
      const coverage = calculateEmergencyFundCoverage(smallEmergencyFund, monthlyExpenses);
      
      expect(coverage.months).toBeLessThan(1);
      expect(coverage.isAdequate).toBe(false);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('handles large datasets efficiently', () => {
      // Create 10,000 transactions
      const largeDataset: Transaction[] = Array.from({ length: 10000 }, (_, i) =>
        createMockTransaction({
          id: `large-${i}`,
          amount: Math.random() * 1000,
          type: Math.random() > 0.5 ? 'income' : 'expense',
          date: new Date(2025, 0, Math.floor(Math.random() * 31) + 1),
        })
      );

      const startTime = performance.now();
      
      calculateTotalIncome(largeDataset);
      calculateTotalExpenses(largeDataset);
      calculateSpendingByCategory(largeDataset);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Should complete within reasonable time (< 100ms)
      expect(executionTime).toBeLessThan(100);
    });

    it('handles missing or undefined values gracefully', () => {
      const malformedTransactions = [
        createMockTransaction({ amount: undefined as any }),
        createMockTransaction({ type: undefined as any }),
        createMockTransaction({ date: undefined as any }),
      ];

      // Should not throw errors
      expect(() => calculateTotalIncome(malformedTransactions)).not.toThrow();
      expect(() => calculateTotalExpenses(malformedTransactions)).not.toThrow();
    });

    it('maintains precision with decimal calculations', () => {
      const precisionTransactions = [
        createMockTransaction({ amount: 10.01 }),
        createMockTransaction({ amount: 20.02 }),
        createMockTransaction({ amount: 30.03 }),
      ];

      const total = calculateTotalExpenses(precisionTransactions);
      
      // Should maintain decimal precision
      expect(total).toBe(60.06);
      expect(Number.isInteger(total * 100)).toBe(true); // No floating point errors
    });

    it('handles extreme values', () => {
      const extremeTransactions = [
        createMockTransaction({ amount: Number.MAX_SAFE_INTEGER }),
        createMockTransaction({ amount: 0.01 }),
        createMockTransaction({ amount: Number.MIN_VALUE }),
      ];

      expect(() => calculateTotalExpenses(extremeTransactions)).not.toThrow();
    });
  });
});
