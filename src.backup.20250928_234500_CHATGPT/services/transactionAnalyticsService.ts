import { BaseService } from './base/BaseService';
import Decimal from 'decimal.js';
import type { Transaction, Category, Account } from '../types';

type DecimalType = InstanceType<typeof Decimal>;

export interface SpendingByCategory {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  transactionCount: number;
  subcategories?: SpendingByCategory[];
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  transactionCount: number;
  averageTransaction: number;
  largestExpense: Transaction | null;
  largestIncome: Transaction | null;
}

export interface TrendData {
  date: Date;
  income: number;
  expenses: number;
  net: number;
  cumulativeNet: number;
}

export interface CategoryTrend {
  categoryId: string;
  categoryName: string;
  data: Array<{
    date: Date;
    amount: number;
  }>;
  average: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

class TransactionAnalyticsService extends BaseService {
  constructor() {
    super('TransactionAnalyticsService');
  }

  /**
   * Calculate spending by category for a date range
   */
  calculateSpendingByCategory(
    transactions: Transaction[],
    categories: Category[],
    startDate?: Date,
    endDate?: Date,
    type: 'expense' | 'income' | 'all' = 'expense'
  ): SpendingByCategory[] {
    // Filter transactions by date and type
    const filteredTransactions = this.filterTransactions(
      transactions,
      startDate,
      endDate,
      type
    );

    // Group by category
    const categoryMap = new Map<string, { amount: DecimalType; count: number }>();
    let totalAmount = new Decimal(0);

    filteredTransactions.forEach(transaction => {
      const amount = new Decimal(transaction.amount);
      totalAmount = totalAmount.plus(amount);

      const existing = categoryMap.get(transaction.category);
      if (existing) {
        existing.amount = existing.amount.plus(amount);
        existing.count++;
      } else {
        categoryMap.set(transaction.category, {
          amount,
          count: 1
        });
      }
    });

    // Build spending array with percentages
    const spending: SpendingByCategory[] = [];
    
    categoryMap.forEach((data, categoryId) => {
      const category = categories.find(c => c.id === categoryId);
      if (category) {
        const amount = data.amount.toNumber();
        const percentage = totalAmount.gt(0)
          ? data.amount.dividedBy(totalAmount).times(100).toNumber()
          : 0;

        spending.push({
          categoryId,
          categoryName: category.name,
          amount,
          percentage,
          transactionCount: data.count
        });
      }
    });

    // Sort by amount descending
    return spending.sort((a, b) => b.amount - a.amount);
  }

  /**
   * Get transaction summary for a period
   */
  getTransactionSummary(
    transactions: Transaction[],
    startDate?: Date,
    endDate?: Date
  ): TransactionSummary {
    const filteredTransactions = this.filterTransactions(
      transactions,
      startDate,
      endDate
    );

    let totalIncome = new Decimal(0);
    let totalExpenses = new Decimal(0);
    let largestExpense: Transaction | null = null;
    let largestIncome: Transaction | null = null;

    filteredTransactions.forEach(transaction => {
      const amount = new Decimal(transaction.amount);

      if (transaction.type === 'income') {
        totalIncome = totalIncome.plus(amount);
        if (!largestIncome || amount.gt(largestIncome.amount)) {
          largestIncome = transaction;
        }
      } else if (transaction.type === 'expense') {
        totalExpenses = totalExpenses.plus(amount);
        if (!largestExpense || amount.gt(largestExpense.amount)) {
          largestExpense = transaction;
        }
      }
    });

    const netIncome = totalIncome.minus(totalExpenses);
    const transactionCount = filteredTransactions.length;
    const averageTransaction = transactionCount > 0
      ? totalIncome.plus(totalExpenses).dividedBy(transactionCount).toNumber()
      : 0;

    return {
      totalIncome: totalIncome.toNumber(),
      totalExpenses: totalExpenses.toNumber(),
      netIncome: netIncome.toNumber(),
      transactionCount,
      averageTransaction,
      largestExpense,
      largestIncome
    };
  }

  /**
   * Calculate daily/monthly/yearly trends
   */
  calculateTrends(
    transactions: Transaction[],
    startDate: Date,
    endDate: Date,
    groupBy: 'daily' | 'monthly' | 'yearly' = 'monthly'
  ): TrendData[] {
    const trends = new Map<string, TrendData>();
    let cumulativeNet = new Decimal(0);

    // Sort transactions by date
    const sortedTransactions = [...transactions]
      .filter(t => {
        const date = new Date(t.date);
        return date >= startDate && date <= endDate;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedTransactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const key = this.getDateKey(date, groupBy);
      
      let trend = trends.get(key);
      if (!trend) {
        trend = {
          date: this.getDateFromKey(key, groupBy),
          income: 0,
          expenses: 0,
          net: 0,
          cumulativeNet: 0
        };
        trends.set(key, trend);
      }

      const amount = new Decimal(transaction.amount);
      if (transaction.type === 'income') {
        trend.income = new Decimal(trend.income).plus(amount).toNumber();
        cumulativeNet = cumulativeNet.plus(amount);
      } else if (transaction.type === 'expense') {
        trend.expenses = new Decimal(trend.expenses).plus(amount).toNumber();
        cumulativeNet = cumulativeNet.minus(amount);
      }

      trend.net = new Decimal(trend.income).minus(trend.expenses).toNumber();
      trend.cumulativeNet = cumulativeNet.toNumber();
    });

    return Array.from(trends.values());
  }

  /**
   * Analyze category spending trends
   */
  analyzeCategoryTrends(
    transactions: Transaction[],
    categories: Category[],
    months: number = 6
  ): CategoryTrend[] {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const categoryTrends: CategoryTrend[] = [];

    categories.forEach(category => {
      const categoryTransactions = transactions.filter(
        t => t.category === category.id && 
        t.type === 'expense' &&
        new Date(t.date) >= startDate
      );

      if (categoryTransactions.length === 0) return;

      // Group by month
      const monthlyData = new Map<string, DecimalType>();
      
      categoryTransactions.forEach(transaction => {
        const date = new Date(transaction.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        const existing = monthlyData.get(key) || new Decimal(0);
        monthlyData.set(key, existing.plus(transaction.amount));
      });

      // Convert to array and calculate average
      const data = Array.from(monthlyData.entries()).map(([key, amount]) => ({
        date: new Date(key + '-01'),
        amount: amount.toNumber()
      }));

      const average = data.reduce((sum, d) => sum + d.amount, 0) / data.length;

      // Determine trend (simple linear regression would be better)
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (data.length >= 3) {
        const firstHalf = data.slice(0, Math.floor(data.length / 2));
        const secondHalf = data.slice(Math.floor(data.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, d) => sum + d.amount, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, d) => sum + d.amount, 0) / secondHalf.length;
        
        const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;
        
        if (percentChange > 10) trend = 'increasing';
        else if (percentChange < -10) trend = 'decreasing';
      }

      categoryTrends.push({
        categoryId: category.id,
        categoryName: category.name,
        data,
        average,
        trend
      });
    });

    return categoryTrends;
  }

  /**
   * Find unusual or anomalous transactions
   */
  findAnomalousTransactions(
    transactions: Transaction[],
    categories: Category[]
  ): Transaction[] {
    const anomalous: Transaction[] = [];
    
    // Group by category to find outliers
    const categoryGroups = new Map<string, Transaction[]>();
    
    transactions
      .filter(t => t.type === 'expense')
      .forEach(transaction => {
        const group = categoryGroups.get(transaction.category) || [];
        group.push(transaction);
        categoryGroups.set(transaction.category, group);
      });

    categoryGroups.forEach((group, categoryId) => {
      if (group.length < 5) return; // Need enough data for statistics

      // Calculate mean and standard deviation
      const amounts = group.map(t => new Decimal(t.amount));
      const sum = amounts.reduce((a, b) => a.plus(b), new Decimal(0));
      const mean = sum.dividedBy(amounts.length);
      
      const squaredDiffs = amounts.map(a => a.minus(mean).pow(2));
      const variance = squaredDiffs.reduce((a, b) => a.plus(b), new Decimal(0))
        .dividedBy(amounts.length);
      const stdDev = variance.sqrt();

      // Find outliers (more than 2 standard deviations from mean)
      group.forEach(transaction => {
        const amount = new Decimal(transaction.amount);
        const zScore = amount.minus(mean).dividedBy(stdDev).abs();
        
        if (zScore.gt(2)) {
          anomalous.push(transaction);
        }
      });
    });

    return anomalous;
  }

  /**
   * Get spending patterns (day of week, time of month, etc.)
   */
  getSpendingPatterns(transactions: Transaction[]): {
    byDayOfWeek: Map<number, number>;
    byDayOfMonth: Map<number, number>;
    byHour: Map<number, number>;
  } {
    const byDayOfWeek = new Map<number, number>();
    const byDayOfMonth = new Map<number, number>();
    const byHour = new Map<number, number>();

    // Initialize maps
    for (let i = 0; i < 7; i++) byDayOfWeek.set(i, 0);
    for (let i = 1; i <= 31; i++) byDayOfMonth.set(i, 0);
    for (let i = 0; i < 24; i++) byHour.set(i, 0);

    transactions
      .filter(t => t.type === 'expense')
      .forEach(transaction => {
        const date = new Date(transaction.date);
        const amount = new Decimal(transaction.amount);

        // Day of week (0 = Sunday)
        const dow = date.getDay();
        byDayOfWeek.set(dow, new Decimal(byDayOfWeek.get(dow) || 0).plus(amount).toNumber());

        // Day of month
        const dom = date.getDate();
        byDayOfMonth.set(dom, new Decimal(byDayOfMonth.get(dom) || 0).plus(amount).toNumber());

        // Hour (if time is available)
        const hour = date.getHours();
        byHour.set(hour, new Decimal(byHour.get(hour) || 0).plus(amount).toNumber());
      });

    return { byDayOfWeek, byDayOfMonth, byHour };
  }

  /**
   * Filter transactions by date and type
   */
  private filterTransactions(
    transactions: Transaction[],
    startDate?: Date,
    endDate?: Date,
    type?: 'expense' | 'income' | 'all'
  ): Transaction[] {
    return transactions.filter(transaction => {
      // Date filter
      if (startDate || endDate) {
        const date = new Date(transaction.date);
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
      }

      // Type filter
      if (type && type !== 'all' && transaction.type !== type) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get date key for grouping
   */
  private getDateKey(date: Date, groupBy: 'daily' | 'monthly' | 'yearly'): string {
    switch (groupBy) {
      case 'daily':
        return date.toISOString().split('T')[0] || '';
      case 'monthly':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'yearly':
        return String(date.getFullYear());
    }
  }

  /**
   * Convert date key back to Date object
   */
  private getDateFromKey(key: string, groupBy: 'daily' | 'monthly' | 'yearly'): Date {
    switch (groupBy) {
      case 'daily':
        return new Date(key);
      case 'monthly':
        return new Date(key + '-01');
      case 'yearly':
        return new Date(key + '-01-01');
    }
  }
}

export const transactionAnalyticsService = new TransactionAnalyticsService();