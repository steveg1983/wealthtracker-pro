// Type definitions for advanced analytics service

import type { DecimalInstance } from './decimal-types';

export interface Subscription {
  id: string;
  merchant: string;
  amount: DecimalInstance;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  category: string;
  lastChargeDate: Date;
  nextChargeDate?: Date;
  isActive: boolean;
  unusedMonths?: number;
  monthlyAmount?: DecimalInstance;
  transactionIds?: string[];
}

export interface CategorySpendingStats {
  categoryId: string;
  categoryName: string;
  totalSpent: DecimalInstance;
  averageTransaction: DecimalInstance;
  transactionCount: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  percentageOfTotal: number;
  percentageOfIncome?: number;
  percentageIncrease?: number;
  monthlyAverage?: DecimalInstance;
}

export interface DuplicateService {
  type: string;
  services: Array<{
    merchant: string;
    amount: DecimalInstance;
    lastDate: Date;
  }>;
  potentialSavings: DecimalInstance;
  category?: string;
  transactionIds?: string[];
}

export interface MerchantSpendingStats {
  merchantName: string;
  totalSpent: DecimalInstance;
  transactionCount: number;
  averageAmount: DecimalInstance;
  frequency: 'daily' | 'weekly' | 'monthly' | 'occasional';
  category: string;
  averageTransaction?: DecimalInstance;
  monthlyTotal?: DecimalInstance;
}

export interface SpendingVelocity {
  daily: DecimalInstance;
  weekly: DecimalInstance;
  monthly: DecimalInstance;
  trend: 'accelerating' | 'stable' | 'decelerating';
  projectedMonthly: DecimalInstance;
  isAccelerating?: boolean;
  percentageIncrease?: number;
}

export interface SavingsBehavior {
  monthlySavingsRate: number;
  averageMonthlySavings: DecimalInstance;
  savingsStreak: number;
  totalSaved: DecimalInstance;
  savingsTrend: 'improving' | 'stable' | 'declining';
  consistentSaving?: boolean;
  averagePercentage?: number;
}

export interface BudgetPerformance {
  budgetId: string;
  adherenceRate: number;
  overBudgetMonths: number;
  underBudgetMonths: number;
  averageUtilization: number;
  trend: 'improving' | 'stable' | 'worsening';
  consistentlyUnder?: boolean;
  averageUsage?: number;
  name?: string;
}

export interface IncomeStability {
  isStable: boolean;
  variabilityPercentage: number;
  averageMonthlyIncome: DecimalInstance;
  incomeStreams: number;
  primaryIncomePercentage: number;
  isIrregular?: boolean;
}

export interface SeasonalPattern {
  category: string;
  pattern: 'summer' | 'winter' | 'holiday' | 'back-to-school' | 'other';
  peakMonths: number[];
  averageIncrease: number;
  affectedAmount: DecimalInstance;
  description?: string;
}

export interface RecurringBill {
  id: string;
  merchant: string;
  amount: DecimalInstance;
  variability: 'fixed' | 'variable';
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  category: string;
  dueDay?: number;
  isEssential: boolean;
  lastDate?: Date;
}