import type { Query } from '../../components/analytics/QueryBuilder';

export type ActiveTab = 'dashboards' | 'explorer' | 'insights' | 'reports';

export interface Widget {
  id: string;
  // Allow broader set of widget types to match builder and page usage
  type: string;
  title: string;
  data?: unknown;
  config?: Record<string, unknown>;
  position?: { x: number; y: number; w: number; h: number };
}

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  static?: boolean;
}

export interface ChartConfig {
  type: string;
  title: string;
  dataKey: string;
  options?: Record<string, unknown>;
}

export interface Insight {
  type: string;
  title: string;
  description: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  data?: unknown;
}

export interface QueryResult {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  summary?: Record<string, unknown>;
}

export interface CategorySegment {
  total: number;
  count: number;
  average: number;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: Widget[];
  layout: LayoutItem[];
  createdAt: Date;
  updatedAt: Date;
  settings?: {
    columns?: number;
    rowHeight?: number;
    theme?: 'light' | 'dark' | 'auto';
    autoRefresh?: boolean;
    refreshInterval?: number;
  };
}

export interface SavedQuery extends Query {
  lastRun?: Date;
  results?: QueryResult;
}

export interface KeyMetrics {
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  transactionCount: number;
  netWorth: number;
  budgetUtilization: number;
}
