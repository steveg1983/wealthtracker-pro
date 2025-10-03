/**
 * Analytics Engine Module
 * Advanced analytics and data processing capabilities
 */

// Main service
export { analyticsEngine, AnalyticsEngine } from './analyticsEngine';

// Sub-modules
export { timeIntelligence, TimeIntelligence } from './timeIntelligence';
export { forecastEngine, ForecastEngine } from './forecastEngine';
export { correlationAnalyzer, CorrelationAnalyzer } from './correlationAnalyzer';
export { queryEngine, QueryEngine } from './queryEngine';

// Types
export type {
  // Time types
  PeriodType,
  ComparisonType,
  AggregationType,
  TimeRange,
  
  // Data types
  MetricValue,
  ChartDataPoint,
  SegmentFilter,
  
  // Query types
  AnalyticsQuery,
  
  // Result types
  ForecastResult,
  CorrelationResult,
  TrendAnalysis,
  CohortData
} from './types';