/**
 * Transaction Analytics Service Tests
 * Tests for transaction analysis and reporting functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { transactionAnalyticsService } from './transactionAnalyticsService';
import type { Transaction, Category } from '../types';

describe('TransactionAnalyticsService', () => {
  let mockTransactions: Transaction[];
  let mockCategories: Category[];

  beforeEach(() => {
    mockCategories = [
      {
        id: 'cat-1',
        name: 'Food',
        type: 'expense',
        icon: 'utensils',
        color: '#FF6B6B',
      },
      {
        id: 'cat-2',
        name: 'Transport',
        type: 'expense',
        icon: 'car',
        color: '#4ECDC4',
      },
      {
        id: 'cat-3',
        name: 'Salary',
        type: 'income',
        icon: 'dollar',
        color: '#95E1D3',
      },
      {
        id: 'cat-4',
        name: 'Utilities',
        type: 'expense',
        icon: 'home',
        color: '#F7DC6F',
      },
    ];

    mockTransactions = [
      {
        id: 'tx-1',
        date: new Date('2025-01-10'),
        amount: 50.00,
        description: 'Grocery shopping',
        type: 'expense',
        category: 'cat-1',
        accountId: 'acc-1',
      },
      {
        id: 'tx-2',
        date: new Date('2025-01-15'),
        amount: 30.00,
        description: 'Gas',
        type: 'expense',
        category: 'cat-2',
        accountId: 'acc-1',
      },
      {
        id: 'tx-3',
        date: new Date('2025-01-01'),
        amount: 3000.00,
        description: 'Monthly salary',
        type: 'income',
        category: 'cat-3',
        accountId: 'acc-1',
      },
      {
        id: 'tx-4',
        date: new Date('2025-01-20'),
        amount: 120.00,
        description: 'Electricity bill',
        type: 'expense',
        category: 'cat-4',
        accountId: 'acc-1',
      },
      {
        id: 'tx-5',
        date: new Date('2025-01-25'),
        amount: 75.50,
        description: 'Restaurant',
        type: 'expense',
        category: 'cat-1',
        accountId: 'acc-1',
      },
      {
        id: 'tx-6',
        date: new Date('2025-02-05'),
        amount: 45.00,
        description: 'Bus pass',
        type: 'expense',
        category: 'cat-2',
        accountId: 'acc-1',
      },
    ];
  });

  describe('calculateSpendingByCategory', () => {
    it('calculates spending by category for expenses', () => {
      const spending = transactionAnalyticsService.calculateSpendingByCategory(
        mockTransactions,
        mockCategories,
        undefined,
        undefined,
        'expense'
      );

      expect(spending).toBeDefined();
      expect(spending.length).toBeGreaterThan(0);

      // Food category should have highest spending (50 + 75.50 = 125.50)
      expect(spending[0].categoryId).toBe('cat-1');
      expect(spending[0].categoryName).toBe('Food');
      expect(spending[0].amount).toBe(125.50);
      expect(spending[0].transactionCount).toBe(2);
    });

    it('calculates correct percentages', () => {
      const spending = transactionAnalyticsService.calculateSpendingByCategory(
        mockTransactions,
        mockCategories,
        undefined,
        undefined,
        'expense'
      );

      const totalSpending = spending.reduce((sum, cat) => sum + cat.amount, 0);
      
      spending.forEach(category => {
        const expectedPercentage = (category.amount / totalSpending) * 100;
        expect(category.percentage).toBeCloseTo(expectedPercentage, 2);
      });
    });

    it('filters by date range', () => {
      const startDate = new Date('2025-01-15');
      const endDate = new Date('2025-01-31');

      const spending = transactionAnalyticsService.calculateSpendingByCategory(
        mockTransactions,
        mockCategories,
        startDate,
        endDate,
        'expense'
      );

      // Should only include transactions from Jan 15-31
      const totalAmount = spending.reduce((sum, cat) => sum + cat.amount, 0);
      expect(totalAmount).toBe(30 + 120 + 75.50); // Transport + Utilities + Restaurant
    });

    it('handles income categories', () => {
      const incomeSpending = transactionAnalyticsService.calculateSpendingByCategory(
        mockTransactions,
        mockCategories,
        undefined,
        undefined,
        'income'
      );

      expect(incomeSpending).toHaveLength(1);
      expect(incomeSpending[0].categoryId).toBe('cat-3');
      expect(incomeSpending[0].amount).toBe(3000);
      expect(incomeSpending[0].percentage).toBe(100);
    });

    it('returns empty array for no transactions', () => {
      const spending = transactionAnalyticsService.calculateSpendingByCategory(
        [],
        mockCategories
      );

      expect(spending).toEqual([]);
    });

    it('sorts categories by amount descending', () => {
      const spending = transactionAnalyticsService.calculateSpendingByCategory(
        mockTransactions,
        mockCategories,
        undefined,
        undefined,
        'expense'
      );

      for (let i = 1; i < spending.length; i++) {
        expect(spending[i - 1].amount).toBeGreaterThanOrEqual(spending[i].amount);
      }
    });
  });

  describe('getTransactionSummary', () => {
    it('calculates correct summary totals', () => {
      const summary = transactionAnalyticsService.getTransactionSummary(
        mockTransactions
      );

      expect(summary.totalIncome).toBe(3000);
      expect(summary.totalExpenses).toBe(50 + 30 + 120 + 75.50 + 45); // 320.50
      expect(summary.netIncome).toBe(3000 - 320.50); // 2679.50
      expect(summary.transactionCount).toBe(6);
    });

    it('identifies largest transactions', () => {
      const summary = transactionAnalyticsService.getTransactionSummary(
        mockTransactions
      );

      expect(summary.largestIncome?.id).toBe('tx-3');
      expect(summary.largestIncome?.amount).toBe(3000);
      
      expect(summary.largestExpense?.id).toBe('tx-4');
      expect(summary.largestExpense?.amount).toBe(120);
    });

    it('calculates average transaction amount', () => {
      const summary = transactionAnalyticsService.getTransactionSummary(
        mockTransactions
      );

      const expectedAverage = (3000 + 320.50) / 6;
      expect(summary.averageTransaction).toBeCloseTo(expectedAverage, 2);
    });

    it('filters by date range', () => {
      const summary = transactionAnalyticsService.getTransactionSummary(
        mockTransactions,
        new Date('2025-01-15'),
        new Date('2025-01-31')
      );

      expect(summary.totalIncome).toBe(0); // No income in this range
      expect(summary.totalExpenses).toBe(30 + 120 + 75.50); // 225.50
      expect(summary.transactionCount).toBe(3);
    });

    it('handles empty transaction list', () => {
      const summary = transactionAnalyticsService.getTransactionSummary([]);

      expect(summary.totalIncome).toBe(0);
      expect(summary.totalExpenses).toBe(0);
      expect(summary.netIncome).toBe(0);
      expect(summary.transactionCount).toBe(0);
      expect(summary.averageTransaction).toBe(0);
      expect(summary.largestExpense).toBeNull();
      expect(summary.largestIncome).toBeNull();
    });
  });

  describe('calculateTrends', () => {
    it('calculates monthly trends', () => {
      const trends = transactionAnalyticsService.calculateTrends(
        mockTransactions,
        new Date('2025-01-01'),
        new Date('2025-02-28'),
        'monthly'
      );

      expect(trends).toHaveLength(2); // January and February
      
      // January trend
      const janTrend = trends.find(t => t.date.getMonth() === 0);
      expect(janTrend?.income).toBe(3000);
      expect(janTrend?.expenses).toBe(50 + 30 + 120 + 75.50); // 275.50
      expect(janTrend?.net).toBe(3000 - 275.50); // 2724.50
      
      // February trend
      const febTrend = trends.find(t => t.date.getMonth() === 1);
      expect(febTrend?.expenses).toBe(45);
      expect(febTrend?.income).toBe(0);
      expect(febTrend?.net).toBe(-45);
    });

    it('calculates cumulative net correctly', () => {
      const trends = transactionAnalyticsService.calculateTrends(
        mockTransactions,
        new Date('2025-01-01'),
        new Date('2025-02-28'),
        'monthly'
      );

      let expectedCumulative = 0;
      trends.forEach(trend => {
        expectedCumulative += trend.net;
        expect(trend.cumulativeNet).toBeCloseTo(expectedCumulative, 2);
      });
    });

    it('handles daily grouping', () => {
      const trends = transactionAnalyticsService.calculateTrends(
        mockTransactions,
        new Date('2025-01-01'),
        new Date('2025-01-31'),
        'daily'
      );

      // Should have entries for days with transactions
      const daysWithTransactions = new Set(
        mockTransactions
          .filter(t => {
            const date = new Date(t.date);
            return date >= new Date('2025-01-01') && date <= new Date('2025-01-31');
          })
          .map(t => new Date(t.date).getDate())
      );

      expect(trends.length).toBe(daysWithTransactions.size);
    });

    it('handles yearly grouping', () => {
      const yearlyTrends = transactionAnalyticsService.calculateTrends(
        mockTransactions,
        new Date('2025-01-01'),
        new Date('2025-12-31'),
        'yearly'
      );

      expect(yearlyTrends).toHaveLength(1); // Only 2025
      expect(yearlyTrends[0].date.getFullYear()).toBe(2025);
    });

    it('returns empty array for no transactions in range', () => {
      const trends = transactionAnalyticsService.calculateTrends(
        mockTransactions,
        new Date('2024-01-01'),
        new Date('2024-12-31'),
        'monthly'
      );

      expect(trends).toEqual([]);
    });
  });


  describe('edge cases and validation', () => {
    it('handles transactions with zero amounts', () => {
      const transactionsWithZero = [
        ...mockTransactions,
        {
          id: 'tx-zero',
          date: new Date('2025-01-15'),
          amount: 0,
          description: 'Zero amount',
          type: 'expense',
          category: 'cat-1',
          accountId: 'acc-1',
        },
      ];

      const spending = transactionAnalyticsService.calculateSpendingByCategory(
        transactionsWithZero,
        mockCategories
      );

      expect(spending).toBeDefined();
      // Should still count the transaction
      const foodCategory = spending.find(s => s.categoryId === 'cat-1');
      expect(foodCategory?.transactionCount).toBe(3); // 2 regular + 1 zero
    });

    it('handles missing categories gracefully', () => {
      const transactionsWithMissingCategory = [
        {
          id: 'tx-missing',
          date: new Date('2025-01-15'),
          amount: 100,
          description: 'Unknown category',
          type: 'expense',
          category: 'unknown-cat',
          accountId: 'acc-1',
        },
      ];

      const spending = transactionAnalyticsService.calculateSpendingByCategory(
        transactionsWithMissingCategory,
        mockCategories
      );

      expect(spending).toEqual([]); // Transaction is ignored if category not found
    });

    it('handles decimal precision correctly', () => {
      const preciseTransactions = [
        {
          id: 'tx-precise',
          date: new Date('2025-01-15'),
          amount: 10.999,
          description: 'Precise amount',
          type: 'expense',
          category: 'cat-1',
          accountId: 'acc-1',
        },
        {
          id: 'tx-precise2',
          date: new Date('2025-01-16'),
          amount: 20.001,
          description: 'Another precise amount',
          type: 'expense',
          category: 'cat-1',
          accountId: 'acc-1',
        },
      ];

      const summary = transactionAnalyticsService.getTransactionSummary(
        preciseTransactions
      );

      expect(summary.totalExpenses).toBeCloseTo(31, 2);
    });
  });
});