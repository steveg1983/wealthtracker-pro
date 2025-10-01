import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { budgetCalculationService } from '../budgetCalculationService';
import type { Budget, Transaction, Category } from '../../types';

describe('BudgetCalculationService', () => {
  let mockBudget: Budget;
  let mockTransactions: Transaction[];
  let mockCategories: Category[];

  beforeEach(() => {
    // Set system time to January 2025 for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-25'));
    mockBudget = {
      id: '1',
      name: 'Monthly Budget',
      amount: 1000,
      categoryId: 'cat1',
      period: 'monthly',
      startDate: new Date('2025-01-01').toISOString(),
      color: '#3B82F6'
    };

    mockCategories = [
      { id: 'cat1', name: 'Groceries', type: 'expense', color: '#3B82F6', parentId: null },
      { id: 'cat2', name: 'Entertainment', type: 'expense', color: '#EF4444', parentId: null }
    ];

    mockTransactions = [
      {
        id: 't1',
        date: new Date('2025-01-15').toISOString(),
        amount: 150,
        description: 'Grocery shopping',
        category: 'cat1',
        type: 'expense',
        account: 'acc1'
      },
      {
        id: 't2',
        date: new Date('2025-01-20').toISOString(),
        amount: 200,
        description: 'More groceries',
        category: 'cat1',
        type: 'expense',
        account: 'acc1'
      },
      {
        id: 't3',
        date: new Date('2024-12-20').toISOString(),
        amount: 100,
        description: 'Old transaction',
        category: 'cat1',
        type: 'expense',
        account: 'acc1'
      }
    ];
  });

  describe('getCurrentPeriod', () => {
    it('should calculate correct monthly period', () => {
      const period = budgetCalculationService.getCurrentPeriod(mockBudget);
      
      expect(period.period).toBe('monthly');
      expect(period.startDate.getDate()).toBe(1);
      expect(period.endDate.getDate()).toBeLessThanOrEqual(31);
    });

    it('should calculate correct quarterly period', () => {
      const quarterlyBudget = { ...mockBudget, period: 'quarterly' as const };
      const period = budgetCalculationService.getCurrentPeriod(quarterlyBudget);
      
      expect(period.period).toBe('quarterly');
    });

    it('should calculate correct yearly period', () => {
      const yearlyBudget = { ...mockBudget, period: 'yearly' as const };
      const period = budgetCalculationService.getCurrentPeriod(yearlyBudget);
      
      expect(period.period).toBe('yearly');
      expect(period.startDate.getMonth()).toBe(0);
      expect(period.endDate.getMonth()).toBe(11);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('calculateBudgetSpending', () => {
    it('should calculate spending correctly for current period', () => {
      const spending = budgetCalculationService.calculateBudgetSpending(
        mockBudget,
        mockTransactions,
        mockCategories
      );

      expect(spending.budgetId).toBe('1');
      expect(spending.categoryId).toBe('cat1');
      expect(spending.categoryName).toBe('Groceries');
      expect(spending.budgetAmount).toBe(1000);
      expect(spending.spentAmount).toBe(350); // 150 + 200
      expect(spending.remainingAmount).toBe(650);
      expect(spending.percentageUsed).toBe(35);
      expect(spending.isOverBudget).toBe(false);
      expect(spending.isNearLimit).toBe(false);
      expect(spending.transactions).toHaveLength(2);
    });

    it('should detect over budget scenarios', () => {
      const overBudget = { ...mockBudget, amount: 300 };
      const spending = budgetCalculationService.calculateBudgetSpending(
        overBudget,
        mockTransactions,
        mockCategories
      );

      expect(spending.isOverBudget).toBe(true);
      expect(spending.percentageUsed).toBeGreaterThan(100);
    });

    it('should detect near limit scenarios', () => {
      const nearLimitBudget = { ...mockBudget, amount: 400 };
      const spending = budgetCalculationService.calculateBudgetSpending(
        nearLimitBudget,
        mockTransactions,
        mockCategories
      );

      expect(spending.isNearLimit).toBe(true);
      expect(spending.isOverBudget).toBe(false);
      expect(spending.percentageUsed).toBeGreaterThanOrEqual(80);
    });
  });

  describe('calculateAllBudgetSpending', () => {
    it('should aggregate multiple budgets correctly', () => {
      const budgets = [
        mockBudget,
        { ...mockBudget, id: '2', categoryId: 'cat2', amount: 500 }
      ];

      const summary = budgetCalculationService.calculateAllBudgetSpending(
        budgets,
        mockTransactions,
        mockCategories
      );

      expect(summary.totalBudgeted).toBe(1500);
      expect(summary.totalSpent).toBe(350);
      expect(summary.totalRemaining).toBe(1150);
      expect(summary.budgetsByCategory).toHaveLength(2);
      expect(summary.overBudgetCategories).toHaveLength(0);
      expect(summary.nearLimitCategories).toHaveLength(0);
    });
  });

  describe('projectEndOfPeriodSpending', () => {
    it('should project spending based on current rate', () => {
      const period = budgetCalculationService.getCurrentPeriod(mockBudget);
      const projection = budgetCalculationService.projectEndOfPeriodSpending(
        mockBudget,
        350,
        period
      );

      expect(projection).toBeGreaterThan(350);
    });
  });

  describe('compareSpendingPeriods', () => {
    it('should calculate spending trend correctly', () => {
      const comparison = budgetCalculationService.compareSpendingPeriods(350, 300);

      expect(comparison.difference).toBe(50);
      expect(comparison.percentageChange).toBeCloseTo(16.67, 1);
      expect(comparison.trend).toBe('increase');
    });

    it('should detect stable spending', () => {
      const comparison = budgetCalculationService.compareSpendingPeriods(300, 295);

      expect(comparison.trend).toBe('stable');
    });

    it('should detect decreased spending', () => {
      const comparison = budgetCalculationService.compareSpendingPeriods(250, 300);

      expect(comparison.trend).toBe('decrease');
    });
  });

  describe('getBudgetAlerts', () => {
    it('should generate appropriate alerts', () => {
      const summary = {
        totalBudgeted: 1000,
        totalSpent: 920,
        totalRemaining: 80,
        percentageUsed: 92,
        budgetsByCategory: [],
        overBudgetCategories: ['Groceries'],
        nearLimitCategories: ['Entertainment']
      };

      const alerts = budgetCalculationService.getBudgetAlerts(summary);

      expect(alerts).toContain('Over budget in: Groceries');
      expect(alerts).toContain('Near budget limit in: Entertainment');
      expect(alerts.some(a => a.includes('92.0%'))).toBe(true);
    });
  });
});