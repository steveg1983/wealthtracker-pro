/**
 * Analytics Engine Types
 * Type definitions for analytics calculations and data structures
 */

import type { Transaction, Account, Budget, Goal } from '../../types';
import type { DecimalInstance } from '../../types/decimal-types';

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
  metadata?: Record<string, unknown>;
}

export interface SegmentFilter {
  field: keyof Transaction | 'custom';
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'between' | 'in';
  value: string | number | boolean | string[] | Date | DecimalInstance;
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
  parameters: Record<string, unknown>;
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

export interface CohortData {
  cohort: string;
  periods: Array<{ period: number; value: number }>;
}