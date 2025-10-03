import type { AssetAllocation } from '../../services/portfolioRebalanceService';
import type { Investment } from '../../types';

export interface AllocationAnalysisProps {
  accountId?: string;
}

export type ViewMode = 'pie' | 'bar' | 'treemap';
export type GroupBy = 'assetClass' | 'account' | 'symbol';

export interface ChartData {
  name: string;
  value: number;
  percent: number;
  color?: string;
  target?: number;
}

export const COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // yellow
  '#EF4444', // red
  '#8B5CF6', // purple
  '#6366F1', // indigo
  '#14B8A6', // teal
  '#F97316', // orange
  '#EC4899', // pink
  '#84CC16', // lime
];