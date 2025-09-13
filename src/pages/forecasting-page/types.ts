import type { Budget, Transaction, Account, Category } from '../../types';
import type Decimal from 'decimal.js';

export type ActiveTab = 'budget' | 'forecast' | 'seasonal';
export type BudgetSubTab = 'traditional' | 'envelope' | 'templates' | 'rollover' | 'alerts' | 'zero-based';

export interface BudgetWithSpent extends Budget {
  spent: number;
  percentage: number;
  remaining: number;
}

export interface BudgetTotals {
  totalBudgeted: string;
  totalSpent: string;
  totalRemaining: string;
  totalRemainingValue: number;
}

export interface BudgetAlert {
  budgetId: string;
  categoryName: string;
  percentage: number;
  spent: number;
  budget: number;
  period: string;
  type: 'warning' | 'danger';
}

export interface DateValues {
  currentMonth: number;
  currentYear: number;
}

export interface ForecastingState {
  activeTab: ActiveTab;
  budgetSubTab: BudgetSubTab;
  selectedAccountIds: string[];
  isModalOpen: boolean;
  editingBudget: Budget | null;
  isLoading: boolean;
}