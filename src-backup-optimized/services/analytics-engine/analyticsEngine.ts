/**
 * Analytics Engine Service
 * Main orchestrator for advanced analytics and data processing
 */

import type { Transaction, Account, Budget, Goal } from '../../types';
import type {
  PeriodType,
  ComparisonType,
  TimeRange,
  MetricValue,
  ChartDataPoint,
  AnalyticsQuery,
  ForecastResult,
  CorrelationResult,
  TrendAnalysis,
  CohortData,
  SegmentFilter
} from './types';

import { timeIntelligence } from './timeIntelligence';
import { forecastEngine } from './forecastEngine';
import { correlationAnalyzer } from './correlationAnalyzer';
import { queryEngine } from './queryEngine';

export class AnalyticsEngine {
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
    return timeIntelligence.calculatePeriodComparison(
      transactions,
      currentPeriod,
      previousPeriod,
      metric,
      comparisonType
    );
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
    return timeIntelligence.calculateRollingWindow(
      transactions,
      windowSize,
      windowUnit,
      metric,
      endDate
    );
  }

  /**
   * Perform cohort analysis
   */
  performCohortAnalysis(
    transactions: Transaction[],
    accounts: Account[],
    cohortField: 'account' | 'category' | 'month',
    metric: 'retention' | 'value' | 'frequency'
  ): CohortData[] {
    return timeIntelligence.performCohortAnalysis(
      transactions,
      cohortField,
      metric
    );
  }

  /**
   * Detect seasonal patterns
   */
  detectSeasonalPatterns(
    transactions: Transaction[],
    metric: 'income' | 'expenses' = 'expenses'
  ): TrendAnalysis {
    return forecastEngine.detectSeasonalPatterns(transactions, metric);
  }

  /**
   * Generate forecasts
   */
  async generateForecast(
    transactions: Transaction[],
    metric: 'income' | 'expenses' | 'net',
    periods: number = 3,
    model: 'linear' | 'exponential' | 'polynomial' | 'auto' = 'auto'
  ): Promise<ForecastResult> {
    return forecastEngine.generateForecast(transactions, metric, periods, model);
  }

  /**
   * Calculate correlations between metrics
   */
  calculateCorrelations(
    transactions: Transaction[],
    metrics: Array<'income' | 'expenses' | 'savings' | 'categories'>
  ): CorrelationResult[] {
    return correlationAnalyzer.calculateCorrelations(transactions, metrics);
  }

  /**
   * Analyze category correlations
   */
  analyzeCategoryCorrelations(transactions: Transaction[]): CorrelationResult[] {
    return correlationAnalyzer.analyzeCategoryCorrelations(transactions);
  }

  /**
   * Execute custom analytics query
   */
  executeQuery(
    transactions: Transaction[],
    query: AnalyticsQuery
  ): Array<Record<string, unknown>> {
    return queryEngine.executeQuery(transactions, query);
  }

  /**
   * Apply filters to transactions
   */
  applyFilters(
    transactions: Transaction[],
    filters: SegmentFilter[]
  ): Transaction[] {
    return queryEngine.applyFilters(transactions, filters);
  }

  /**
   * Create custom segment
   */
  createSegment(
    transactions: Transaction[],
    name: string,
    filters: SegmentFilter[]
  ): { name: string; transactions: Transaction[]; count: number; total: number } {
    return queryEngine.createSegment(transactions, name, filters);
  }

  /**
   * Perform multi-dimensional analysis
   */
  performMultiDimensionalAnalysis(
    transactions: Transaction[],
    dimensions: string[],
    metric: string = 'amount',
    aggregation: 'sum' | 'average' | 'median' | 'min' | 'max' | 'count' | 'stddev' = 'sum'
  ): Map<string, Map<string, number>> {
    return queryEngine.performMultiDimensionalAnalysis(
      transactions,
      dimensions,
      metric,
      aggregation
    );
  }

  /**
   * Aggregate by time period
   */
  aggregateByPeriod(
    transactions: Transaction[],
    period: 'day' | 'week' | 'month' | 'quarter' | 'year',
    metric: 'income' | 'expenses' | 'net'
  ): ChartDataPoint[] {
    return timeIntelligence.aggregateByPeriod(transactions, period, metric);
  }

  /**
   * Get summary statistics
   */
  getSummaryStatistics(
    transactions: Transaction[],
    timeRange?: TimeRange
  ): {
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    transactionCount: number;
    averageTransaction: number;
    largestExpense: number;
    largestIncome: number;
    mostFrequentCategory: string;
  } {
    let filtered = transactions;
    
    if (timeRange) {
      filtered = queryEngine.applyFilters(transactions, [{
        field: 'custom',
        operator: 'between',
        value: [timeRange.start.toISOString(), timeRange.end.toISOString()],
        customFunction: (t) => {
          const date = new Date(t.date);
          return date >= timeRange.start && date <= timeRange.end;
        }
      }]);
    }

    const income = filtered.filter(t => t.type === 'income');
    const expenses = filtered.filter(t => t.type === 'expense');
    
    const categoryCount = new Map<string, number>();
    filtered.forEach(t => {
      if (t.category) {
        categoryCount.set(t.category, (categoryCount.get(t.category) || 0) + 1);
      }
    });
    
    const mostFrequent = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])[0];

    return {
      totalIncome: income.reduce((sum, t) => sum + t.amount, 0),
      totalExpenses: expenses.reduce((sum, t) => sum + t.amount, 0),
      netIncome: income.reduce((sum, t) => sum + t.amount, 0) - 
                 expenses.reduce((sum, t) => sum + t.amount, 0),
      transactionCount: filtered.length,
      averageTransaction: filtered.length > 0 
        ? filtered.reduce((sum, t) => sum + t.amount, 0) / filtered.length 
        : 0,
      largestExpense: Math.max(...expenses.map(t => t.amount), 0),
      largestIncome: Math.max(...income.map(t => t.amount), 0),
      mostFrequentCategory: mostFrequent ? mostFrequent[0] : 'None'
    };
  }
}

export const analyticsEngine = new AnalyticsEngine();