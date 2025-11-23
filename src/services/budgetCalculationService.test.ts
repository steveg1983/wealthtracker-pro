/**
 * budgetCalculationService Tests
 * Comprehensive tests for budget calculation and tracking
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { budgetCalculationService } from './budgetCalculationService';
import type { Budget, Transaction, Category } from '../types';
import type { BudgetPeriod, BudgetSummary } from './budgetCalculationService';

// Mock the BaseService
vi.mock('./base/BaseService', () => ({
  BaseService: class {
    protected serviceName: string;
    constructor(name: string) {
      this.serviceName = name;
    }
  }
}));

describe('budgetCalculationService', () => {
  // Sample test data
  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Groceries', type: 'expense' },
    { id: 'cat-2', name: 'Entertainment', type: 'expense' },
    { id: 'cat-3', name: 'Utilities', type: 'expense' },
    { id: 'cat-4', name: 'Income', type: 'income' }
  ];

  const mockBudgets: Budget[] = [
    {
      id: 'budget-1',
      categoryId: 'cat-1',
      category: 'Groceries',
      amount: 500,
      period: 'monthly',
      spent: 0,
      budgeted: 500
    },
    {
      id: 'budget-2',
      categoryId: 'cat-2',
      category: 'Entertainment',
      amount: 200,
      period: 'monthly',
      spent: 0,
      budgeted: 200
    },
    {
      id: 'budget-3',
      categoryId: 'cat-3',
      category: 'Utilities',
      amount: 300,
      period: 'quarterly',
      spent: 0,
      budgeted: 300
    }
  ];

  const createTransaction = (overrides: Partial<Transaction>): Transaction => ({
    id: 'trans-1',
    accountId: 'acc-1',
    amount: 50,
    description: 'Test transaction',
    date: new Date(),
    type: 'expense',
    category: 'cat-1',
    tags: [],
    isRecurring: false,
    isTransfer: false,
    ...overrides
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getCurrentPeriod', () => {
    it('calculates monthly period correctly', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:00:00'));
      
      const budget: Budget = { ...mockBudgets[0], period: 'monthly' };
      const period = budgetCalculationService.getCurrentPeriod(budget);
      
      expect(period.period).toBe('monthly');
      expect(period.startDate).toEqual(new Date('2025-01-01T00:00:00'));
      expect(period.endDate).toEqual(new Date('2025-01-31T23:59:59'));
    });

    it('calculates quarterly period correctly', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-02-15T10:00:00')); // Q1
      
      const budget: Budget = { ...mockBudgets[0], period: 'quarterly' };
      const period = budgetCalculationService.getCurrentPeriod(budget);
      
      expect(period.period).toBe('quarterly');
      expect(period.startDate).toEqual(new Date('2025-01-01T00:00:00'));
      expect(period.endDate).toEqual(new Date('2025-03-31T23:59:59'));
    });

    it('calculates yearly period correctly', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T10:00:00'));
      
      const budget: Budget = { ...mockBudgets[0], period: 'yearly' };
      const period = budgetCalculationService.getCurrentPeriod(budget);
      
      expect(period.period).toBe('yearly');
      expect(period.startDate).toEqual(new Date('2025-01-01T00:00:00'));
      expect(period.endDate).toEqual(new Date('2025-12-31T23:59:59'));
    });

    it('handles different quarters correctly', () => {
      vi.useFakeTimers();
      const quarterTests = [
        { month: '2025-01-15', expectedStart: '2025-01-01' }, // Q1
        { month: '2025-05-15', expectedStart: '2025-04-01' }, // Q2
        { month: '2025-08-15', expectedStart: '2025-07-01' }, // Q3
        { month: '2025-11-15', expectedStart: '2025-10-01' }, // Q4
      ];
      
      const budget: Budget = { ...mockBudgets[0], period: 'quarterly' };
      
      quarterTests.forEach(test => {
        vi.setSystemTime(new Date(test.month));
        const period = budgetCalculationService.getCurrentPeriod(budget);
        expect(period.startDate).toEqual(new Date(`${test.expectedStart}T00:00:00`));
      });
    });

    it('throws error for unknown period', () => {
      const budget: Budget = { ...mockBudgets[0], period: 'weekly' as any };
      
      expect(() => budgetCalculationService.getCurrentPeriod(budget))
        .toThrow('Unknown budget period: weekly');
    });
  });

  describe('calculateBudgetSpending', () => {
    it('calculates spending correctly for a budget', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:00:00'));
      
      const transactions = [
        createTransaction({ amount: 100, date: new Date('2025-01-05') }),
        createTransaction({ amount: 150, date: new Date('2025-01-10') }),
        createTransaction({ amount: 75, date: new Date('2025-01-12') }),
      ];
      
      const spending = budgetCalculationService.calculateBudgetSpending(
        mockBudgets[0],
        transactions,
        mockCategories
      );
      
      expect(spending).toMatchObject({
        budgetId: 'budget-1',
        categoryId: 'cat-1',
        categoryName: 'Groceries',
        budgetAmount: 500,
        spentAmount: 325,
        remainingAmount: 175,
        percentageUsed: 65,
        isOverBudget: false,
        isNearLimit: false
      });
      expect(spending.transactions).toHaveLength(3);
    });

    it('identifies over-budget situations', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:00:00'));
      
      const transactions = [
        createTransaction({ amount: 300, date: new Date('2025-01-05') }),
        createTransaction({ amount: 250, date: new Date('2025-01-10') }),
      ];
      
      const spending = budgetCalculationService.calculateBudgetSpending(
        mockBudgets[0],
        transactions,
        mockCategories
      );
      
      expect(spending.spentAmount).toBe(550);
      expect(spending.remainingAmount).toBe(-50);
      expect(spending.percentageUsed).toBe(110);
      expect(spending.isOverBudget).toBe(true);
      expect(spending.isNearLimit).toBe(true);
    });

    it('identifies near-limit situations', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:00:00'));
      
      const transactions = [
        createTransaction({ amount: 200, date: new Date('2025-01-05') }),
        createTransaction({ amount: 200, date: new Date('2025-01-10') }),
      ];
      
      const spending = budgetCalculationService.calculateBudgetSpending(
        mockBudgets[0],
        transactions,
        mockCategories
      );
      
      expect(spending.spentAmount).toBe(400);
      expect(spending.percentageUsed).toBe(80);
      expect(spending.isOverBudget).toBe(false);
      expect(spending.isNearLimit).toBe(true);
    });

    it('filters transactions by category correctly', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:00:00'));
      
      const transactions = [
        createTransaction({ amount: 100, category: 'cat-1' }),
        createTransaction({ amount: 150, category: 'cat-2' }), // Different category
        createTransaction({ amount: 75, category: 'cat-1' }),
      ];
      
      const spending = budgetCalculationService.calculateBudgetSpending(
        mockBudgets[0],
        transactions,
        mockCategories
      );
      
      expect(spending.spentAmount).toBe(175); // Only cat-1 transactions
      expect(spending.transactions).toHaveLength(2);
    });

    it('filters transactions by date correctly', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:00:00'));
      
      const transactions = [
        createTransaction({ amount: 100, date: new Date('2025-01-05') }),
        createTransaction({ amount: 150, date: new Date('2024-12-30') }), // Previous period
        createTransaction({ amount: 75, date: new Date('2025-02-01') }), // Next period
      ];
      
      const spending = budgetCalculationService.calculateBudgetSpending(
        mockBudgets[0],
        transactions,
        mockCategories
      );
      
      expect(spending.spentAmount).toBe(100); // Only January transaction
      expect(spending.transactions).toHaveLength(1);
    });

    it('ignores income transactions', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:00:00'));
      
      const transactions = [
        createTransaction({ amount: 100, type: 'expense' }),
        createTransaction({ amount: 1000, type: 'income' }), // Should be ignored
      ];
      
      const spending = budgetCalculationService.calculateBudgetSpending(
        mockBudgets[0],
        transactions,
        mockCategories
      );
      
      expect(spending.spentAmount).toBe(100);
      expect(spending.transactions).toHaveLength(1);
    });

    it('handles zero budget amount', () => {
      const zeroBudget = { ...mockBudgets[0], amount: 0 };
      const transactions = [createTransaction({ amount: 100 })];
      
      const spending = budgetCalculationService.calculateBudgetSpending(
        zeroBudget,
        transactions,
        mockCategories
      );
      
      expect(spending.percentageUsed).toBe(0);
    });

    it('handles unknown category gracefully', () => {
      const budget = { ...mockBudgets[0], categoryId: 'unknown-cat' };
      
      const spending = budgetCalculationService.calculateBudgetSpending(
        budget,
        [],
        mockCategories
      );
      
      expect(spending.categoryName).toBe('Unknown');
    });
  });

  describe('calculateAllBudgetSpending', () => {
    it('calculates summary for all budgets', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:00:00'));
      
      const transactions = [
        createTransaction({ amount: 300, category: 'cat-1', date: new Date('2025-01-05') }),
        createTransaction({ amount: 150, category: 'cat-2', date: new Date('2025-01-10') }),
        createTransaction({ amount: 100, category: 'cat-3', date: new Date('2025-01-12') }),
      ];
      
      const summary = budgetCalculationService.calculateAllBudgetSpending(
        mockBudgets.slice(0, 2), // Only monthly budgets
        transactions,
        mockCategories
      );
      
      expect(summary.totalBudgeted).toBe(700); // 500 + 200
      expect(summary.totalSpent).toBe(450); // 300 + 150
      expect(summary.totalRemaining).toBe(250);
      expect(summary.percentageUsed).toBeCloseTo(64.29, 2);
      expect(summary.budgetsByCategory).toHaveLength(2);
    });

    it('identifies over-budget and near-limit categories', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:00:00'));
      
      const transactions = [
        createTransaction({ amount: 550, category: 'cat-1' }), // Over budget
        createTransaction({ amount: 180, category: 'cat-2' }), // Near limit
      ];
      
      const summary = budgetCalculationService.calculateAllBudgetSpending(
        mockBudgets.slice(0, 2),
        transactions,
        mockCategories
      );
      
      expect(summary.overBudgetCategories).toEqual(['Groceries']);
      expect(summary.nearLimitCategories).toEqual(['Entertainment']);
    });

    it('handles empty budgets array', () => {
      const summary = budgetCalculationService.calculateAllBudgetSpending(
        [],
        [],
        mockCategories
      );
      
      expect(summary.totalBudgeted).toBe(0);
      expect(summary.totalSpent).toBe(0);
      expect(summary.percentageUsed).toBe(0);
      expect(summary.budgetsByCategory).toEqual([]);
    });
  });

  describe('getBudgetAlerts', () => {
    it('generates over-budget alerts', () => {
      const summary: BudgetSummary = {
        totalBudgeted: 1000,
        totalSpent: 800,
        totalRemaining: 200,
        percentageUsed: 80,
        budgetsByCategory: [],
        overBudgetCategories: ['Groceries', 'Entertainment'],
        nearLimitCategories: []
      };
      
      const alerts = budgetCalculationService.getBudgetAlerts(summary);
      
      expect(alerts).toContain('Over budget in: Groceries, Entertainment');
    });

    it('generates near-limit alerts', () => {
      const summary: BudgetSummary = {
        totalBudgeted: 1000,
        totalSpent: 800,
        totalRemaining: 200,
        percentageUsed: 80,
        budgetsByCategory: [],
        overBudgetCategories: [],
        nearLimitCategories: ['Utilities', 'Transport']
      };
      
      const alerts = budgetCalculationService.getBudgetAlerts(summary);
      
      expect(alerts).toContain('Near budget limit in: Utilities, Transport');
    });

    it('generates overall usage alert when over 90%', () => {
      const summary: BudgetSummary = {
        totalBudgeted: 1000,
        totalSpent: 920,
        totalRemaining: 80,
        percentageUsed: 92,
        budgetsByCategory: [],
        overBudgetCategories: [],
        nearLimitCategories: []
      };
      
      const alerts = budgetCalculationService.getBudgetAlerts(summary);
      
      expect(alerts).toContain('Overall budget usage at 92.0%');
    });

    it('returns empty array when no alerts', () => {
      const summary: BudgetSummary = {
        totalBudgeted: 1000,
        totalSpent: 500,
        totalRemaining: 500,
        percentageUsed: 50,
        budgetsByCategory: [],
        overBudgetCategories: [],
        nearLimitCategories: []
      };
      
      const alerts = budgetCalculationService.getBudgetAlerts(summary);
      
      expect(alerts).toEqual([]);
    });
  });

  describe('projectEndOfPeriodSpending', () => {
    it('projects spending based on current rate', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:00:00')); // Mid-month
      
      const period: BudgetPeriod = {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        period: 'monthly'
      };
      
      const currentSpending = 250; // Spent in 14 days
      const projected = budgetCalculationService.projectEndOfPeriodSpending(
        mockBudgets[0],
        currentSpending,
        period
      );
      
      // Daily rate: 250/14 = ~17.86
      // Total days: 31
      // Expected: 17.86 * 31 = ~553.57
      expect(projected).toBeCloseTo(553.57, 0);
    });

    it('handles first day of period', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T10:00:00')); // First day
      
      const period: BudgetPeriod = {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        period: 'monthly'
      };
      
      const currentSpending = 50;
      const projected = budgetCalculationService.projectEndOfPeriodSpending(
        mockBudgets[0],
        currentSpending,
        period
      );
      
      // Daily rate: 50/1 = 50
      // Total days: 31
      // Expected: 50 * 31 = 1550
      expect(projected).toBe(1550);
    });
  });

  describe('getSpendingByCategory', () => {
    it('calculates spending by category correctly', () => {
      const transactions = [
        createTransaction({ amount: 100, category: 'cat-1', date: new Date('2025-01-15') }),
        createTransaction({ amount: 150, category: 'cat-1', date: new Date('2025-01-20') }),
        createTransaction({ amount: 200, category: 'cat-2', date: new Date('2025-01-25') }),
        createTransaction({ amount: 75, category: 'cat-3', date: new Date('2025-01-10') }),
      ];
      
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      
      const spendingMap = budgetCalculationService.getSpendingByCategory(
        transactions,
        mockCategories,
        startDate,
        endDate
      );
      
      expect(spendingMap.get('cat-1')?.amount).toBe(250);
      expect(spendingMap.get('cat-2')?.amount).toBe(200);
      expect(spendingMap.get('cat-3')?.amount).toBe(75);
      expect(spendingMap.get('cat-4')?.amount).toBe(0); // Income category
    });

    it('initializes all categories with zero', () => {
      const spendingMap = budgetCalculationService.getSpendingByCategory(
        [],
        mockCategories,
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );
      
      expect(spendingMap.size).toBe(mockCategories.length);
      mockCategories.forEach(cat => {
        expect(spendingMap.get(cat.id)?.amount).toBe(0);
      });
    });

    it('filters by date range', () => {
      const transactions = [
        createTransaction({ amount: 100, date: new Date('2025-01-15') }),
        createTransaction({ amount: 150, date: new Date('2024-12-30') }), // Before range
        createTransaction({ amount: 200, date: new Date('2025-02-01') }), // After range
      ];
      
      const spendingMap = budgetCalculationService.getSpendingByCategory(
        transactions,
        mockCategories,
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );
      
      expect(spendingMap.get('cat-1')?.amount).toBe(100);
    });

    it('ignores income transactions', () => {
      const transactions = [
        createTransaction({ amount: 100, type: 'expense', category: 'cat-1', date: new Date('2025-01-15') }),
        createTransaction({ amount: 1000, type: 'income', category: 'cat-4', date: new Date('2025-01-15') }),
      ];
      
      const spendingMap = budgetCalculationService.getSpendingByCategory(
        transactions,
        mockCategories,
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );
      
      expect(spendingMap.get('cat-1')?.amount).toBe(100);
      expect(spendingMap.get('cat-4')?.amount).toBe(0);
    });
  });

  describe('compareSpendingPeriods', () => {
    it('calculates increase correctly', () => {
      const result = budgetCalculationService.compareSpendingPeriods(1200, 1000);
      
      expect(result.difference).toBe(200);
      expect(result.percentageChange).toBe(20);
      expect(result.trend).toBe('increase');
    });

    it('calculates decrease correctly', () => {
      const result = budgetCalculationService.compareSpendingPeriods(800, 1000);
      
      expect(result.difference).toBe(-200);
      expect(result.percentageChange).toBe(-20);
      expect(result.trend).toBe('decrease');
    });

    it('identifies stable spending', () => {
      const result = budgetCalculationService.compareSpendingPeriods(1030, 1000);
      
      expect(result.difference).toBe(30);
      expect(result.percentageChange).toBe(3);
      expect(result.trend).toBe('stable');
    });

    it('handles zero previous spending', () => {
      const result = budgetCalculationService.compareSpendingPeriods(500, 0);
      
      expect(result.difference).toBe(500);
      expect(result.percentageChange).toBe(0);
      expect(result.trend).toBe('stable');
    });

    it('handles equal spending', () => {
      const result = budgetCalculationService.compareSpendingPeriods(1000, 1000);
      
      expect(result.difference).toBe(0);
      expect(result.percentageChange).toBe(0);
      expect(result.trend).toBe('stable');
    });
  });
});