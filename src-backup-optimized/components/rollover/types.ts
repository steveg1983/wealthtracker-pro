import type { DecimalInstance } from '../../utils/decimal';

export interface RolloverSettings {
  enabled: boolean;
  mode: 'percentage' | 'fixed' | 'all';
  percentage: number;
  maxAmount?: number;
  excludeCategories: string[];
  autoApply: boolean;
  carryNegative: boolean;
  autoApprove?: boolean;
  notifyOnRollover?: boolean;
}

export interface RolloverHistory {
  id: string;
  fromPeriod: {
    month: number;
    year: number;
  };
  toPeriod: {
    month: number;
    year: number;
  };
  rollovers: Array<{
    budgetId: string;
    category: string;
    originalBudget: DecimalInstance;
    spent: DecimalInstance;
    remaining: DecimalInstance;
    rolledOver: DecimalInstance;
  }>;
  totalRolledOver: DecimalInstance;
  appliedAt: Date;
}

export interface BudgetRolloverData {
  budgetId: string;
  category: string;
  originalBudget: DecimalInstance;
  spent: DecimalInstance;
  remaining: DecimalInstance;
  rolloverAmount: DecimalInstance;
  isEligible: boolean;
  willRollover: boolean;
}

export interface BudgetRolloverProps {}

export interface RolloverPreview {
  settings: RolloverSettings;
  rollovers: BudgetRolloverData[];
  totalAmount: DecimalInstance;
  affectedBudgets: number;
  fromPeriod: { month: number; year: number };
  toPeriod: { month: number; year: number };
}

export interface CategoryRollover {
  category: string;
  amount: DecimalInstance;
  originalBudget: DecimalInstance;
  newBudget: DecimalInstance;
}

export interface RolloverSummary {
  totalRolledOver: DecimalInstance;
  categoriesAffected: number;
  largestRollover: { category: string; amount: DecimalInstance };
  averageRollover: DecimalInstance;
  lastRolloverDate?: string | Date;
}

export const DEFAULT_ROLLOVER_SETTINGS: RolloverSettings = {
  enabled: false,
  mode: 'percentage',
  percentage: 100,
  maxAmount: undefined,
  excludeCategories: [],
  autoApply: false,
  carryNegative: false
};