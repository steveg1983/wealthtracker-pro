import type { Account, Transaction, Budget } from '../../../types';

export interface DashboardMetrics {
  netWorth: number;
  netWorthChange: number;
  netWorthChangePercent: number;
  totalAssets: number;
  totalLiabilities: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  savingsRate: number;
  budgetStatus: BudgetStatus[];
  overallBudgetPercent: number;
  accountsNeedingAttention: Account[];
  recentActivity: Transaction[];
}

export interface BudgetStatus {
  id: string;
  category: string;
  amount: number;
  spent: number;
  percentUsed: number;
  isOverBudget: boolean;
}

export interface ChartDataPoint {
  month: string;
  netWorth: number;
}

export interface PieDataPoint {
  name: string;
  value: number;
  id: string;
}

export interface AccountSelectionState {
  selectedAccountIds: string[];
  showAccountSettings: boolean;
}