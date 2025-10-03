/**
 * Time Intelligence Module
 * Handles period comparisons, rolling windows, and time-based calculations
 */

import {
  format,
  parseISO,
  isWithinInterval,
  subMonths,
  addMonths,
  endOfMonth,
  getQuarter,
  getYear
} from 'date-fns';
import * as ss from 'simple-statistics';
import type { Transaction } from '../../types';
import type {
  TimeRange,
  MetricValue,
  ChartDataPoint,
  ComparisonType,
  CohortData
} from './types';

export class TimeIntelligence {
  /**
   * Calculate period-over-period comparisons
   */
  calculatePeriodComparison(
    transactions: Transaction[],
    currentPeriod: TimeRange,
    previousPeriod: TimeRange,
    metric: 'income' | 'expenses' | 'net' | 'count' = 'net',
    comparisonType: ComparisonType = 'both'
  ): MetricValue {
    const currentTransactions = this.filterByTimeRange(transactions, currentPeriod);
    const previousTransactions = this.filterByTimeRange(transactions, previousPeriod);

    const currentValue = this.calculateMetric(currentTransactions, metric);
    const previousValue = this.calculateMetric(previousTransactions, metric);

    const change = currentValue - previousValue;
    const changePercent = previousValue !== 0 ? (change / previousValue) * 100 : 0;

    return {
      value: currentValue,
      change: comparisonType !== 'percentage' ? change : undefined,
      changePercent: comparisonType !== 'absolute' ? changePercent : undefined,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
    };
  }

  /**
   * Calculate rolling windows (moving averages)
   */
  calculateRollingWindow(
    transactions: Transaction[],
    windowSize: number,
    windowUnit: 'days' | 'months',
    metric: 'income' | 'expenses' | 'net' = 'net',
    endDate: Date = new Date()
  ): ChartDataPoint[] {
    const results: ChartDataPoint[] = [];
    
    for (let i = 0; i < 12; i++) {
      const periodEnd = windowUnit === 'months' 
        ? subMonths(endDate, i)
        : new Date(endDate.getTime() - i * windowSize * 24 * 60 * 60 * 1000);
      
      const periodStart = windowUnit === 'months'
        ? subMonths(periodEnd, windowSize)
        : new Date(periodEnd.getTime() - windowSize * 24 * 60 * 60 * 1000);

      const periodTransactions = this.filterByTimeRange(
        transactions,
        { start: periodStart, end: periodEnd }
      );

      const value = this.calculateMetric(periodTransactions, metric);
      const avgValue = value / (windowUnit === 'months' ? windowSize : windowSize);

      results.unshift({
        x: format(periodEnd, 'MMM yyyy'),
        y: avgValue,
        metadata: {
          periodStart,
          periodEnd,
          transactionCount: periodTransactions.length
        }
      });
    }

    return results;
  }

  /**
   * Perform cohort analysis
   */
  performCohortAnalysis(
    transactions: Transaction[],
    cohortField: 'account' | 'category' | 'month',
    metric: 'retention' | 'value' | 'frequency'
  ): CohortData[] {
    const cohorts = new Map<string, Transaction[]>();

    // Group transactions into cohorts
    transactions.forEach(transaction => {
      let cohortKey: string;
      
      switch (cohortField) {
        case 'account':
          cohortKey = transaction.accountId;
          break;
        case 'category':
          cohortKey = transaction.category || 'Uncategorized';
          break;
        case 'month':
          cohortKey = format(
            typeof transaction.date === 'string' ? parseISO(transaction.date) : transaction.date, 
            'yyyy-MM'
          );
          break;
      }

      if (!cohorts.has(cohortKey)) {
        cohorts.set(cohortKey, []);
      }
      cohorts.get(cohortKey)!.push(transaction);
    });

    // Analyze each cohort
    const results: CohortData[] = [];

    cohorts.forEach((cohortTransactions, cohortKey) => {
      const periods: Array<{ period: number; value: number }> = [];
      const firstDate = new Date(Math.min(...cohortTransactions.map(t => new Date(t.date).getTime())));

      for (let period = 0; period < 12; period++) {
        const periodStart = addMonths(firstDate, period);
        const periodEnd = endOfMonth(periodStart);

        const periodTransactions = cohortTransactions.filter(t => {
          const tDate = typeof t.date === 'string' ? parseISO(t.date) : t.date;
          return isWithinInterval(tDate, { start: periodStart, end: periodEnd });
        });

        let value = 0;
        switch (metric) {
          case 'retention':
            value = periodTransactions.length > 0 ? 1 : 0;
            break;
          case 'value':
            value = this.calculateMetric(periodTransactions, 'net');
            break;
          case 'frequency':
            value = periodTransactions.length;
            break;
        }

        periods.push({ period, value });
      }

      results.push({ cohort: cohortKey, periods });
    });

    return results;
  }

  /**
   * Aggregate data by time period
   */
  aggregateByPeriod(
    transactions: Transaction[],
    period: 'day' | 'week' | 'month' | 'quarter' | 'year',
    metric: 'income' | 'expenses' | 'net'
  ): ChartDataPoint[] {
    const grouped = new Map<string, Transaction[]>();

    transactions.forEach(transaction => {
      const date = typeof transaction.date === 'string' ? parseISO(transaction.date) : transaction.date;
      let key: string;

      switch (period) {
        case 'day':
          key = format(date, 'yyyy-MM-dd');
          break;
        case 'week':
          key = format(date, 'yyyy-ww');
          break;
        case 'month':
          key = format(date, 'yyyy-MM');
          break;
        case 'quarter':
          key = `${getYear(date)}-Q${getQuarter(date)}`;
          break;
        case 'year':
          key = format(date, 'yyyy');
          break;
      }

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(transaction);
    });

    const results: ChartDataPoint[] = [];
    
    Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([key, transactions]) => {
        results.push({
          x: key,
          y: this.calculateMetric(transactions, metric)
        });
      });

    return results;
  }

  /**
   * Get unique months from transactions
   */
  getUniqueMonths(transactions: Transaction[]): string[] {
    const months = new Set<string>();
    transactions.forEach(t => {
      const date = typeof t.date === 'string' ? parseISO(t.date) : t.date;
      months.add(format(date, 'yyyy-MM'));
    });
    return Array.from(months).sort();
  }

  // Helper methods
  
  private filterByTimeRange(transactions: Transaction[], range: TimeRange): Transaction[] {
    return transactions.filter(t => {
      const date = typeof t.date === 'string' ? parseISO(t.date) : t.date;
      return isWithinInterval(date, { start: range.start, end: range.end });
    });
  }

  private calculateMetric(
    transactions: Transaction[],
    metric: 'income' | 'expenses' | 'net' | 'count'
  ): number {
    switch (metric) {
      case 'income':
        return transactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);
      case 'expenses':
        return transactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);
      case 'net':
        const income = this.calculateMetric(transactions, 'income');
        const expenses = this.calculateMetric(transactions, 'expenses');
        return income - expenses;
      case 'count':
        return transactions.length;
    }
  }
}

export const timeIntelligence = new TimeIntelligence();