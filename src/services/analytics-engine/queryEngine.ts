/**
 * Query Engine Module
 * Executes custom analytics queries with filtering and aggregation
 */

import * as ss from 'simple-statistics';
import { parseISO, isWithinInterval } from 'date-fns';
import type { Transaction } from '../../types';
import type { AnalyticsQuery, SegmentFilter, AggregationType, TimeRange } from './types';

export class QueryEngine {
  /**
   * Execute custom analytics query
   */
  executeQuery(
    transactions: Transaction[],
    query: AnalyticsQuery
  ): Array<Record<string, unknown>> {
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
    const results: Array<Record<string, unknown>> = [];

    grouped.forEach((groupTransactions, groupKey) => {
      const row: Record<string, unknown> = {};
      
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
        const aVal = Number(a[query.orderBy!.field]) || 0;
        const bVal = Number(b[query.orderBy!.field]) || 0;
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

  /**
   * Apply filters to transactions
   */
  applyFilters(transactions: Transaction[], filters: SegmentFilter[]): Transaction[] {
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
            return value !== undefined && value !== null && 
                   String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'greater':
            return Number(value) > Number(filter.value);
          case 'less':
            return Number(value) < Number(filter.value);
          case 'between':
            if (Array.isArray(filter.value) && filter.value.length === 2) {
              return Number(value) >= Number(filter.value[0]) && 
                     Number(value) <= Number(filter.value[1]);
            }
            return false;
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(value as any);
          default:
            return true;
        }
      });
    });
  }

  /**
   * Create segment based on custom criteria
   */
  createSegment(
    transactions: Transaction[],
    name: string,
    filters: SegmentFilter[]
  ): { name: string; transactions: Transaction[]; count: number; total: number } {
    const segmentTransactions = this.applyFilters(transactions, filters);
    
    return {
      name,
      transactions: segmentTransactions,
      count: segmentTransactions.length,
      total: segmentTransactions.reduce((sum, t) => sum + t.amount, 0)
    };
  }

  /**
   * Perform multi-dimensional analysis
   */
  performMultiDimensionalAnalysis(
    transactions: Transaction[],
    dimensions: string[],
    metric: string = 'amount',
    aggregation: AggregationType = 'sum'
  ): Map<string, Map<string, number>> {
    const results = new Map<string, Map<string, number>>();
    
    // Create combinations of dimension values
    const dimensionValues = new Map<string, Set<string>>();
    
    dimensions.forEach(dimension => {
      dimensionValues.set(dimension, new Set());
      transactions.forEach(t => {
        const value = String(t[dimension as keyof Transaction] || 'Unknown');
        dimensionValues.get(dimension)!.add(value);
      });
    });
    
    // Calculate metrics for each combination
    if (dimensions.length === 2) {
      const [dim1, dim2] = dimensions;
      const values1 = Array.from(dimensionValues.get(dim1)!);
      const values2 = Array.from(dimensionValues.get(dim2)!);
      
      values1.forEach(v1 => {
        const innerMap = new Map<string, number>();
        
        values2.forEach(v2 => {
          const filtered = transactions.filter(t => 
            String(t[dim1 as keyof Transaction]) === v1 &&
            String(t[dim2 as keyof Transaction]) === v2
          );
          
          innerMap.set(v2, this.calculateCustomMetric(filtered, metric, aggregation));
        });
        
        results.set(v1, innerMap);
      });
    }
    
    return results;
  }

  // Helper methods
  
  private filterByTimeRange(transactions: Transaction[], range: TimeRange): Transaction[] {
    return transactions.filter(t => {
      const date = typeof t.date === 'string' ? parseISO(t.date) : t.date;
      return isWithinInterval(date, { start: range.start, end: range.end });
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
      return this.calculateMetric(transactions, metric as 'income' | 'expenses' | 'net' | 'count');
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
      case 'net': {
        const income = this.calculateMetric(transactions, 'income');
        const expenses = this.calculateMetric(transactions, 'expenses');
        return income - expenses;
      }
      case 'count':
        return transactions.length;
    }
  }
}

export const queryEngine = new QueryEngine();