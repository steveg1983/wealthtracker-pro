/**
 * Which reports can be pinned to the dashboard.
 *
 * Kept apart from the widgets that render them so that file exports components
 * and nothing else — a module mixing components with constants loses React Fast
 * Refresh for every component in it, which is the whole file's edit-reload loop.
 */
import type React from 'react';
import { TrendingUpIcon, PieChartIcon, BarChart3Icon } from '../../icons';

/** Everything a pinned report can be. Custom reports use `custom:<id>`. */
export type PinnableReportId = 'net-worth' | 'income-expense-trend' | 'expense-categories' | `custom:${string}`;

export const BUILT_IN_REPORTS: Array<{ id: PinnableReportId; label: string; icon: React.ElementType }> = [
  { id: 'net-worth', label: 'Net Worth Over Time', icon: TrendingUpIcon },
  { id: 'income-expense-trend', label: 'Income vs Expenses Trend', icon: BarChart3Icon },
  { id: 'expense-categories', label: 'Expense Categories', icon: PieChartIcon },
];
