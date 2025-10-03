/**
 * @module RealTimePortfolioTypes
 * @description Enterprise-grade type definitions for real-time portfolio components
 */

import type { StockHolding } from '../../../services/realTimePortfolioService';

// Re-export StockHolding for convenience
export type { StockHolding } from '../../../services/realTimePortfolioService';

/** Portfolio metrics interface */
export interface PortfolioMetrics {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

/** Risk metrics interface */
export interface RiskMetrics {
  volatility: number;
  beta: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

/** Asset allocation data */
export interface AssetAllocation {
  category: string;
  value: number;
  percentage: number;
}

/** Quote data structure */
export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  previousClose: number;
}

/** Market status */
export type MarketStatus = 'pre-market' | 'open' | 'after-hours' | 'closed';

/** Sort options for holdings table */
export type SortBy = 'symbol' | 'value' | 'gain' | 'dayChange' | 'allocation';

/** Holdings table props */
export interface HoldingsTableProps {
  holdings: StockHolding[];
  quotes: Record<string, Quote>;
  searchQuery: string;
  sortBy: SortBy;
  formatCurrency: (value: number) => string;
}

/** Controls section props */
export interface ControlsSectionProps {
  searchQuery: string;
  sortBy: SortBy;
  isRefreshing: boolean;
  onSearchChange: (query: string) => void;
  onSortChange: (sort: SortBy) => void;
  onRefresh: () => void;
}

/** Movers section props */
export interface MoversSectionProps {
  gainers: StockHolding[];
  losers: StockHolding[];
  quotes: Record<string, Quote>;
  formatCurrency: (value: number) => string;
}

/** Risk metrics section props */
export interface RiskMetricsSectionProps {
  riskMetrics: RiskMetrics;
}

/** Error state props */
export interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}