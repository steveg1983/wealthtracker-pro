/**
 * @module BudgetProgressTypes
 * @description Enterprise-grade type definitions for budget progress components
 */

import type { Budget, Transaction, Category } from '../../../types';

/**
 * Velocity data for spending analysis
 */
export interface VelocityData {
  dailyAverage: number;
  projectedTotal: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  daysRemaining: number;
  recommendedDailyBudget: number;
  isOnTrack: boolean;
}

/**
 * Budget metrics for display
 */
export interface BudgetMetrics {
  spent: number;
  remaining: number;
  percentage: number;
  velocity: VelocityData;
  status: 'under' | 'warning' | 'over';
  projectedStatus: 'under' | 'warning' | 'over';
}

/**
 * Budget insight information
 */
export interface BudgetInsight {
  type: 'success' | 'warning' | 'danger' | 'info';
  message: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Main component props
 */
export interface BudgetProgressProps {
  budget: Budget;
  transactions?: Transaction[];
  category?: Category;
  showDetails?: boolean;
  showInsights?: boolean;
  showVelocity?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Budget header props
 */
export interface BudgetHeaderProps {
  budget: Budget;
  category?: Category;
  metrics: BudgetMetrics;
  formatCurrency: (value: number) => string;
}

/**
 * Velocity metrics props
 */
export interface VelocityMetricsProps {
  velocity: VelocityData;
  spent: number;
  remaining: number;
  daysInPeriod: number;
  formatCurrency: (value: number) => string;
}

/**
 * Budget insights props
 */
export interface BudgetInsightsProps {
  insights: BudgetInsight[];
  budget: Budget;
  metrics: BudgetMetrics;
  formatCurrency: (value: number) => string;
}

/**
 * Compact view props
 */
export interface CompactViewProps {
  budget: Budget;
  metrics: BudgetMetrics;
  formatCurrency: (value: number) => string;
}

/**
 * Metric card props
 */
export interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

/**
 * Progress visualization props
 */
export interface ProgressVisualizationProps {
  percentage: number;
  status: 'under' | 'warning' | 'over';
  animated?: boolean;
  showLabel?: boolean;
  height?: 'sm' | 'md' | 'lg';
}