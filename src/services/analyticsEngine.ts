/**
 * Analytics Engine Service
 * Core calculation engine for advanced analytics and data processing
 */

import { Matrix } from 'ml-matrix';
import * as ss from 'simple-statistics';
import regression from 'regression';
import { 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  addMonths,
  differenceInDays,
  format,
  parseISO,
  isWithinInterval,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  getQuarter,
  getYear,
  eachMonthOfInterval,
  eachQuarterOfInterval
} from 'date-fns';
import type { Transaction, Account, Budget, Goal } from '../types';
import { toDecimal } from '../utils/decimal';
import type { DecimalInstance } from '../types/decimal-types';

// Time intelligence types
export type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
export type ComparisonType = 'absolute' | 'percentage' | 'both';
export type AggregationType = 'sum' | 'average' | 'median' | 'min' | 'max' | 'count' | 'stddev';

export interface TimeRange {
  start: Date;
  end: Date;
  label?: string;
}

export interface MetricValue {
  value: number;
  change?: number;
  changePercent?: number;
  trend?: 'up' | 'down' | 'stable';
  forecast?: number;
  confidence?: number;
}

export interface ChartDataPoint {
  x: string | number | Date;
  y: number;
  label?: string;
  metadata?: Record<string, any>;
}

export interface SegmentFilter {
  field: keyof Transaction | 'custom';
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'between' | 'in';
  value: any;
  customFunction?: (transaction: Transaction) => boolean;
}

export interface AnalyticsQuery {
  metrics: string[];
  dimensions?: string[];
  filters?: SegmentFilter[];
  timeRange?: TimeRange;
  aggregation?: AggregationType;
  groupBy?: string;
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
}

export interface ForecastResult {
  predictions: Array<{ date: Date; value: number; lower: number; upper: number }>;
  accuracy: number;
  model: string;
  parameters: Record<string, any>;
}

export interface CorrelationResult {
  variable1: string;
  variable2: string;
  correlation: number;
  pValue: number;
  strength: 'strong' | 'moderate' | 'weak' | 'none';
  direction: 'positive' | 'negative' | 'none';
}

export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable';
  slope: number;
  rSquared: number;
  changeRate: number;
  seasonality?: {
    detected: boolean;
    pattern?: string;
    strength?: number;
  };
}

class AnalyticsEngine {
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
    accounts: Account[],
    cohortField: 'account' | 'category' | 'month',
    metric: 'retention' | 'value' | 'frequency'
  ): Array<{ cohort: string; periods: Array<{ period: number; value: number }> }> {
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
          cohortKey = format(parseISO(transaction.date), 'yyyy-MM');
          break;
      }

      if (!cohorts.has(cohortKey)) {
        cohorts.set(cohortKey, []);
      }
      cohorts.get(cohortKey)!.push(transaction);
    });

    // Analyze each cohort
    const results: Array<{ cohort: string; periods: Array<{ period: number; value: number }> }> = [];

    cohorts.forEach((cohortTransactions, cohortKey) => {
      const periods: Array<{ period: number; value: number }> = [];
      const firstDate = new Date(Math.min(...cohortTransactions.map(t => new Date(t.date).getTime())));

      for (let period = 0; period < 12; period++) {
        const periodStart = addMonths(firstDate, period);
        const periodEnd = endOfMonth(periodStart);

        const periodTransactions = cohortTransactions.filter(t => {
          const tDate = parseISO(t.date);
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
   * Detect seasonal patterns using decomposition
   */
  detectSeasonalPatterns(
    transactions: Transaction[],
    metric: 'income' | 'expenses' = 'expenses'
  ): TrendAnalysis {
    const monthlyData = this.aggregateByPeriod(transactions, 'month', metric);
    
    if (monthlyData.length < 12) {
      return {
        direction: 'stable',
        slope: 0,
        rSquared: 0,
        changeRate: 0,
        seasonality: { detected: false }
      };
    }

    const values = monthlyData.map(d => d.y);
    
    // Calculate trend using linear regression
    const regressionData = values.map((y, x) => [x, y]);
    const result = regression.linear(regressionData);
    
    // Detrend the data
    const detrended = values.map((y, x) => y - result.predict(x)[1]);
    
    // Check for seasonality using autocorrelation
    const seasonalStrength = this.calculateAutocorrelation(detrended, 12);
    
    return {
      direction: result.equation[0] > 0.01 ? 'increasing' : result.equation[0] < -0.01 ? 'decreasing' : 'stable',
      slope: result.equation[0],
      rSquared: result.r2,
      changeRate: (result.equation[0] / (values[0] || 1)) * 100,
      seasonality: {
        detected: Math.abs(seasonalStrength) > 0.3,
        pattern: Math.abs(seasonalStrength) > 0.3 ? 'monthly' : undefined,
        strength: Math.abs(seasonalStrength)
      }
    };
  }

  /**
   * Generate forecasts using multiple models
   */
  async generateForecast(
    transactions: Transaction[],
    metric: 'income' | 'expenses' | 'net',
    periods: number = 3,
    model: 'linear' | 'exponential' | 'polynomial' | 'auto' = 'auto'
  ): Promise<ForecastResult> {
    const historicalData = this.aggregateByPeriod(transactions, 'month', metric);
    
    if (historicalData.length < 3) {
      throw new Error('Insufficient data for forecasting');
    }

    const values = historicalData.map((d, i) => [i, d.y]);
    
    // Select best model if auto
    let selectedModel = model;
    let bestFit = { equation: [0, 0], r2: 0, predict: (x: number) => [0, 0] };
    
    if (model === 'auto') {
      const models = {
        linear: regression.linear(values),
        exponential: regression.exponential(values),
        polynomial: regression.polynomial(values, { order: 2 })
      };
      
      // Select model with highest R²
      let maxR2 = 0;
      Object.entries(models).forEach(([name, fit]) => {
        if (fit.r2 > maxR2) {
          maxR2 = fit.r2;
          selectedModel = name as any;
          bestFit = fit;
        }
      });
    } else {
      switch (model) {
        case 'linear':
          bestFit = regression.linear(values);
          break;
        case 'exponential':
          bestFit = regression.exponential(values);
          break;
        case 'polynomial':
          bestFit = regression.polynomial(values, { order: 2 });
          break;
      }
    }

    // Generate predictions
    const predictions: Array<{ date: Date; value: number; lower: number; upper: number }> = [];
    const lastIndex = values.length - 1;
    const lastDate = parseISO(historicalData[historicalData.length - 1].x as string);
    
    // Calculate confidence intervals based on historical variance
    const residuals = values.map(([x, y]) => y - bestFit.predict(x)[1]);
    const stdError = ss.standardDeviation(residuals);
    
    for (let i = 1; i <= periods; i++) {
      const futureIndex = lastIndex + i;
      const prediction = bestFit.predict(futureIndex)[1];
      const confidence = 1.96 * stdError * Math.sqrt(1 + 1/values.length + Math.pow(futureIndex - ss.mean(values.map(v => v[0])), 2) / ss.sum(values.map(v => Math.pow(v[0] - ss.mean(values.map(v => v[0])), 2))));
      
      predictions.push({
        date: addMonths(lastDate, i),
        value: Math.max(0, prediction),
        lower: Math.max(0, prediction - confidence),
        upper: prediction + confidence
      });
    }

    return {
      predictions,
      accuracy: bestFit.r2,
      model: selectedModel,
      parameters: {
        equation: bestFit.equation,
        dataPoints: values.length
      }
    };
  }

  /**
   * Calculate correlations between metrics
   */
  calculateCorrelations(
    transactions: Transaction[],
    metrics: Array<'income' | 'expenses' | 'savings' | 'categories'>
  ): CorrelationResult[] {
    const results: CorrelationResult[] = [];
    const monthlyData = new Map<string, Map<string, number>>();

    // Aggregate data by month for each metric
    const months = this.getUniqueMonths(transactions);
    
    months.forEach(month => {
      const monthTransactions = transactions.filter(t => 
        format(parseISO(t.date), 'yyyy-MM') === month
      );
      
      const monthMetrics = new Map<string, number>();
      
      if (metrics.includes('income')) {
        monthMetrics.set('income', this.calculateMetric(monthTransactions, 'income'));
      }
      if (metrics.includes('expenses')) {
        monthMetrics.set('expenses', this.calculateMetric(monthTransactions, 'expenses'));
      }
      if (metrics.includes('savings')) {
        const income = this.calculateMetric(monthTransactions, 'income');
        const expenses = this.calculateMetric(monthTransactions, 'expenses');
        monthMetrics.set('savings', income - expenses);
      }
      
      monthlyData.set(month, monthMetrics);
    });

    // Calculate pairwise correlations
    const metricNames = Array.from(new Set(Array.from(monthlyData.values()).flatMap(m => Array.from(m.keys()))));
    
    for (let i = 0; i < metricNames.length; i++) {
      for (let j = i + 1; j < metricNames.length; j++) {
        const metric1 = metricNames[i];
        const metric2 = metricNames[j];
        
        const values1: number[] = [];
        const values2: number[] = [];
        
        monthlyData.forEach(monthMetrics => {
          const v1 = monthMetrics.get(metric1);
          const v2 = monthMetrics.get(metric2);
          if (v1 !== undefined && v2 !== undefined) {
            values1.push(v1);
            values2.push(v2);
          }
        });
        
        if (values1.length >= 3) {
          const correlation = ss.sampleCorrelation(values1, values2);
          const absCorr = Math.abs(correlation);
          
          results.push({
            variable1: metric1,
            variable2: metric2,
            correlation,
            pValue: this.calculatePValue(correlation, values1.length),
            strength: absCorr > 0.7 ? 'strong' : absCorr > 0.4 ? 'moderate' : absCorr > 0.2 ? 'weak' : 'none',
            direction: correlation > 0 ? 'positive' : correlation < 0 ? 'negative' : 'none'
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute custom analytics query
   */
  executeQuery(
    transactions: Transaction[],
    query: AnalyticsQuery
  ): Array<Record<string, any>> {
    let filteredTransactions = [...transactions];

    // Apply filters
    if (query.filters) {
      filteredTransactions = this.applyFilters(filteredTransactions, query.filters);
    }

    // Apply time range
    if (query.timeRange) {
      filteredTransactions = this.filterByTimeRange(filteredTransactions, query.timeRange);
    }

    // Group by dimension if specified
    const grouped = query.groupBy 
      ? this.groupBy(filteredTransactions, query.groupBy)
      : new Map([['all', filteredTransactions]]);

    // Calculate metrics for each group
    const results: Array<Record<string, any>> = [];

    grouped.forEach((groupTransactions, groupKey) => {
      const row: Record<string, any> = {};
      
      if (query.groupBy) {
        row[query.groupBy] = groupKey;
      }

      query.metrics.forEach(metric => {
        row[metric] = this.calculateCustomMetric(groupTransactions, metric, query.aggregation);
      });

      results.push(row);
    });

    // Sort results
    if (query.orderBy) {
      results.sort((a, b) => {
        const aVal = a[query.orderBy!.field];
        const bVal = b[query.orderBy!.field];
        const diff = aVal - bVal;
        return query.orderBy!.direction === 'asc' ? diff : -diff;
      });
    }

    // Apply limit
    if (query.limit) {
      return results.slice(0, query.limit);
    }

    return results;
  }

  // Private helper methods
  
  private filterByTimeRange(transactions: Transaction[], range: TimeRange): Transaction[] {
    return transactions.filter(t => {
      const date = parseISO(t.date);
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

  private aggregateByPeriod(
    transactions: Transaction[],
    period: 'day' | 'week' | 'month' | 'quarter' | 'year',
    metric: 'income' | 'expenses' | 'net'
  ): ChartDataPoint[] {
    const grouped = new Map<string, Transaction[]>();

    transactions.forEach(transaction => {
      const date = parseISO(transaction.date);
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

  private calculateAutocorrelation(data: number[], lag: number): number {
    if (data.length <= lag) return 0;
    
    const mean = ss.mean(data);
    const c0 = ss.sum(data.map(x => Math.pow(x - mean, 2))) / data.length;
    
    let sum = 0;
    for (let i = 0; i < data.length - lag; i++) {
      sum += (data[i] - mean) * (data[i + lag] - mean);
    }
    
    return (sum / (data.length - lag)) / c0;
  }

  private calculatePValue(correlation: number, n: number): number {
    // Fisher's z-transformation for correlation p-value
    const z = 0.5 * Math.log((1 + correlation) / (1 - correlation));
    const se = 1 / Math.sqrt(n - 3);
    const zScore = z / se;
    
    // Approximate p-value using normal distribution
    return 2 * (1 - this.normalCDF(Math.abs(zScore)));
  }

  private normalCDF(x: number): number {
    // Approximation of the cumulative distribution function for standard normal
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1 / (1 + p * x);
    const t2 = t * t;
    const t3 = t2 * t;
    const t4 = t3 * t;
    const t5 = t4 * t;

    const y = 1 - ((((a5 * t5 + a4 * t4) + a3 * t3) + a2 * t2) + a1 * t) * Math.exp(-x * x);

    return 0.5 * (1 + sign * y);
  }

  private getUniqueMonths(transactions: Transaction[]): string[] {
    const months = new Set<string>();
    transactions.forEach(t => {
      months.add(format(parseISO(t.date), 'yyyy-MM'));
    });
    return Array.from(months).sort();
  }

  private applyFilters(transactions: Transaction[], filters: SegmentFilter[]): Transaction[] {
    return transactions.filter(transaction => {
      return filters.every(filter => {
        if (filter.customFunction) {
          return filter.customFunction(transaction);
        }

        const value = filter.field === 'custom' ? null : transaction[filter.field];

        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'contains':
            return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'greater':
            return Number(value) > Number(filter.value);
          case 'less':
            return Number(value) < Number(filter.value);
          case 'between':
            return Number(value) >= filter.value[0] && Number(value) <= filter.value[1];
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(value);
          default:
            return true;
        }
      });
    });
  }

  private groupBy(transactions: Transaction[], field: string): Map<string, Transaction[]> {
    const grouped = new Map<string, Transaction[]>();
    
    transactions.forEach(transaction => {
      const key = String(transaction[field as keyof Transaction] || 'Unknown');
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(transaction);
    });

    return grouped;
  }

  private calculateCustomMetric(
    transactions: Transaction[],
    metric: string,
    aggregation: AggregationType = 'sum'
  ): number {
    // Handle predefined metrics
    if (['income', 'expenses', 'net', 'count'].includes(metric)) {
      return this.calculateMetric(transactions, metric as any);
    }

    // Handle custom field aggregations
    const values = transactions.map(t => Number(t[metric as keyof Transaction]) || 0);
    
    switch (aggregation) {
      case 'sum':
        return ss.sum(values);
      case 'average':
        return values.length > 0 ? ss.mean(values) : 0;
      case 'median':
        return values.length > 0 ? ss.median(values) : 0;
      case 'min':
        return values.length > 0 ? ss.min(values) : 0;
      case 'max':
        return values.length > 0 ? ss.max(values) : 0;
      case 'count':
        return values.length;
      case 'stddev':
        return values.length > 1 ? ss.standardDeviation(values) : 0;
      default:
        return 0;
    }
  }
}

export const analyticsEngine = new AnalyticsEngine();