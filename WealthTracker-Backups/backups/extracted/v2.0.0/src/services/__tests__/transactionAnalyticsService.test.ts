import { describe, it, expect, beforeEach } from 'vitest';
import { transactionAnalyticsService } from '../transactionAnalyticsService';
import type { Transaction, Category } from '../../types';

describe('TransactionAnalyticsService', () => {
  let mockTransactions: Transaction[];
  let mockCategories: Category[];

  beforeEach(() => {
    mockCategories = [
      { id: 'cat1', name: 'Groceries', type: 'expense', color: '#3B82F6', parentId: null },
      { id: 'cat2', name: 'Entertainment', type: 'expense', color: '#EF4444', parentId: null },
      { id: 'cat3', name: 'Salary', type: 'income', color: '#10B981', parentId: null }
    ];

    mockTransactions = [
      {
        id: 't1',
        date: new Date('2025-01-05').toISOString(),
        amount: 150,
        description: 'Grocery shopping',
        category: 'cat1',
        type: 'expense',
        account: 'acc1'
      },
      {
        id: 't2',
        date: new Date('2025-01-10').toISOString(),
        amount: 200,
        description: 'More groceries',
        category: 'cat1',
        type: 'expense',
        account: 'acc1'
      },
      {
        id: 't3',
        date: new Date('2025-01-15').toISOString(),
        amount: 50,
        description: 'Movie tickets',
        category: 'cat2',
        type: 'expense',
        account: 'acc1'
      },
      {
        id: 't4',
        date: new Date('2025-01-01').toISOString(),
        amount: 3000,
        description: 'Monthly salary',
        category: 'cat3',
        type: 'income',
        account: 'acc1'
      }
    ];
  });

  describe('calculateSpendingByCategory', () => {
    it('should calculate expense spending by category', () => {
      const spending = transactionAnalyticsService.calculateSpendingByCategory(
        mockTransactions,
        mockCategories,
        undefined,
        undefined,
        'expense'
      );

      expect(spending).toHaveLength(2);
      expect(spending[0].categoryId).toBe('cat1');
      expect(spending[0].categoryName).toBe('Groceries');
      expect(spending[0].amount).toBe(350);
      expect(spending[0].percentage).toBeCloseTo(87.5, 1);
      expect(spending[0].transactionCount).toBe(2);

      expect(spending[1].categoryId).toBe('cat2');
      expect(spending[1].amount).toBe(50);
      expect(spending[1].percentage).toBeCloseTo(12.5, 1);
    });

    it('should filter by date range', () => {
      const startDate = new Date('2025-01-10');
      const endDate = new Date('2025-01-20');

      const spending = transactionAnalyticsService.calculateSpendingByCategory(
        mockTransactions,
        mockCategories,
        startDate,
        endDate,
        'expense'
      );

      expect(spending).toHaveLength(2);
      expect(spending[0].amount).toBe(200); // Only second grocery transaction
      expect(spending[1].amount).toBe(50);  // Entertainment
    });

    it('should calculate income by category', () => {
      const income = transactionAnalyticsService.calculateSpendingByCategory(
        mockTransactions,
        mockCategories,
        undefined,
        undefined,
        'income'
      );

      expect(income).toHaveLength(1);
      expect(income[0].categoryId).toBe('cat3');
      expect(income[0].amount).toBe(3000);
      expect(income[0].percentage).toBe(100);
    });
  });

  describe('getTransactionSummary', () => {
    it('should calculate transaction summary correctly', () => {
      const summary = transactionAnalyticsService.getTransactionSummary(
        mockTransactions
      );

      expect(summary.totalIncome).toBe(3000);
      expect(summary.totalExpenses).toBe(400);
      expect(summary.netIncome).toBe(2600);
      expect(summary.transactionCount).toBe(4);
      expect(summary.averageTransaction).toBe(850); // 3400/4
      expect(summary.largestIncome?.id).toBe('t4');
      expect(summary.largestExpense?.id).toBe('t2');
    });

    it('should handle date filtering', () => {
      const summary = transactionAnalyticsService.getTransactionSummary(
        mockTransactions,
        new Date('2025-01-10'),
        new Date('2025-01-20')
      );

      expect(summary.totalExpenses).toBe(250); // 200 + 50
      expect(summary.totalIncome).toBe(0);
      expect(summary.transactionCount).toBe(2);
    });
  });

  describe('calculateTrends', () => {
    it('should calculate monthly trends', () => {
      const trends = transactionAnalyticsService.calculateTrends(
        mockTransactions,
        new Date('2025-01-01'),
        new Date('2025-01-31'),
        'monthly'
      );

      expect(trends).toHaveLength(1);
      expect(trends[0].income).toBe(3000);
      expect(trends[0].expenses).toBe(400);
      expect(trends[0].net).toBe(2600);
      expect(trends[0].cumulativeNet).toBe(2600);
    });

    it('should calculate daily trends', () => {
      const trends = transactionAnalyticsService.calculateTrends(
        mockTransactions,
        new Date('2025-01-01'),
        new Date('2025-01-15'),
        'daily'
      );

      expect(trends.length).toBeGreaterThan(0);
      const jan1 = trends.find(t => t.date.getDate() === 1);
      expect(jan1?.income).toBe(3000);
    });
  });

  describe('analyzeCategoryTrends', () => {
    it('should analyze spending trends by category', () => {
      // Add more recent transactions for trend analysis
      const recentTransactions = [
        ...mockTransactions,
        {
          id: 't10',
          date: new Date().toISOString(),
          amount: 100,
          description: 'Recent grocery',
          category: 'cat1',
          type: 'expense' as const,
          account: 'acc1'
        }
      ];

      const trends = transactionAnalyticsService.analyzeCategoryTrends(
        recentTransactions,
        mockCategories,
        6 // Look back 6 months
      );

      expect(trends.length).toBeGreaterThan(0);
      const groceryTrend = trends.find(t => t.categoryId === 'cat1');
      expect(groceryTrend).toBeDefined();
    });
  });

  describe('findAnomalousTransactions', () => {
    it('should identify outlier transactions', () => {
      // Add more transactions to establish a pattern
      const moreTransactions = [
        ...mockTransactions,
        { id: 't5', date: new Date().toISOString(), amount: 30, category: 'cat1', type: 'expense' as const, account: 'acc1', description: 'Small grocery' },
        { id: 't6', date: new Date().toISOString(), amount: 40, category: 'cat1', type: 'expense' as const, account: 'acc1', description: 'Small grocery' },
        { id: 't7', date: new Date().toISOString(), amount: 35, category: 'cat1', type: 'expense' as const, account: 'acc1', description: 'Small grocery' },
        { id: 't8', date: new Date().toISOString(), amount: 1000, category: 'cat1', type: 'expense' as const, account: 'acc1', description: 'Huge grocery bill' }
      ];

      const anomalous = transactionAnalyticsService.findAnomalousTransactions(
        moreTransactions,
        mockCategories
      );

      expect(anomalous.length).toBeGreaterThan(0);
      expect(anomalous.some(t => t.amount === 1000)).toBe(true);
    });
  });

  describe('getSpendingPatterns', () => {
    it('should analyze spending patterns', () => {
      const patterns = transactionAnalyticsService.getSpendingPatterns(mockTransactions);

      expect(patterns.byDayOfWeek.size).toBe(7);
      expect(patterns.byDayOfMonth.size).toBe(31);
      expect(patterns.byHour.size).toBe(24);

      // Check that some spending was recorded
      const totalByDay = Array.from(patterns.byDayOfWeek.values()).reduce((sum, val) => sum + val, 0);
      expect(totalByDay).toBe(400); // Total expenses
    });
  });
});