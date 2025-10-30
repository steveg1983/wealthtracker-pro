/**
 * Professional-grade type definitions for caching system
 * Replacing all 'any' types with proper TypeScript types
 */

// Cache entry metadata
export interface CacheMetadata {
  key: string;
  timestamp: number;
  expiresAt?: number;
  size: number;
  hits: number;
  lastAccessed: number;
  compressed?: boolean;
}

// Cache entry with generic data type
export interface CacheEntry<T> {
  data: T;
  metadata: CacheMetadata;
}

// Preference value types
export type PreferenceValue = string | number | boolean | string[] | { [key: string]: unknown };

// Filter configuration
export interface FilterConfig {
  dateRange?: {
    start: Date | string;
    end: Date | string;
  };
  categories?: string[];
  accounts?: string[];
  tags?: string[];
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  [key: string]: unknown;
}

// Calculation parameters
export interface CalculationParams {
  type: string;
  startDate?: Date | string;
  endDate?: Date | string;
  accountIds?: string[];
  categoryIds?: string[];
  includeRecurring?: boolean;
  groupBy?: 'day' | 'week' | 'month' | 'year';
  [key: string]: unknown; // Allow extensibility for specific calculations
}

// Calculation result
export interface CalculationResult<T = unknown> {
  value: T;
  timestamp: number;
  params: CalculationParams;
  metadata?: {
    executionTimeMs: number;
    cacheHit: boolean;
    dataPoints?: number;
  };
}

// Report configuration
export interface ReportConfig {
  title: string;
  type: 'summary' | 'detailed' | 'comparison' | 'forecast';
  dateRange: {
    start: Date | string;
    end: Date | string;
  };
  includeCharts?: boolean;
  format?: 'pdf' | 'excel' | 'csv' | 'json';
  sections?: string[];
  filters?: FilterConfig;
}

// Export options
export interface ExportOptions {
  format: 'csv' | 'json' | 'excel' | 'pdf';
  includeHeaders?: boolean;
  dateFormat?: string;
  numberFormat?: string;
  encoding?: 'utf-8' | 'utf-16' | 'ascii';
  compression?: boolean;
}

// Cache statistics
export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  compressionRatio?: number;
  averageAccessTime: number;
}

// Cache configuration
export interface CacheConfig {
  maxSize: number; // in bytes
  maxEntries: number;
  ttl: number; // in milliseconds
  compressionThreshold: number; // in bytes
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
  persistToStorage?: boolean;
  storageKey?: string;
}

// Widget settings
export interface WidgetSettings {
  id: string;
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  config: {
    title?: string;
    refreshInterval?: number;
    dataSource?: string;
    visualization?: string;
    filters?: FilterConfig;
    [key: string]: unknown;
  };
}

// Dashboard layout
export interface DashboardLayout {
  id: string;
  name: string;
  widgets: WidgetSettings[];
  grid?: {
    columns: number;
    rows: number;
    gap: number;
  };
  theme?: string;
  isDefault?: boolean;
}

// Type guards for cache data
export function isCacheEntry<T>(value: unknown): value is CacheEntry<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'metadata' in value
  );
}

export function isFilterConfig(value: unknown): value is FilterConfig {
  return typeof value === 'object' && value !== null;
}

export function isCalculationParams(value: unknown): value is CalculationParams {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as CalculationParams).type === 'string'
  );
}
