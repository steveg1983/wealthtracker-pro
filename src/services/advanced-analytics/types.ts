import type { Transaction, Account, Budget, Category } from '../../types';
import type { DecimalInstance } from '../../types/decimal-types';

export interface SpendingAnomaly {
  id: string;
  date: Date;
  description: string;
  amount: DecimalInstance;
  category: string;
  severity: 'low' | 'medium' | 'high';
  reason: string;
  percentageAboveNormal: number;
}

export interface SpendingPrediction {
  category: string;
  predictedAmount: DecimalInstance;
  confidence: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  monthlyAverage: DecimalInstance;
  recommendation?: string;
}

export interface SavingsOpportunity {
  id: string;
  type: 'subscription' | 'recurring' | 'category' | 'merchant';
  title: string;
  description: string;
  potentialSavings: DecimalInstance;
  difficulty: 'easy' | 'medium' | 'hard';
  actionRequired: string;
  relatedTransactions?: string[];
}

export interface FinancialInsight {
  id: string;
  type: 'spending' | 'saving' | 'income' | 'budget' | 'goal';
  title: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  relatedData?: Record<string, unknown>;
}

export interface BillNegotiationSuggestion {
  merchant: string;
  currentAmount: DecimalInstance;
  potentialSavings: DecimalInstance;
  category: string;
  negotiationTips: string[];
  successRate: number;
  lastTransactionDate: Date;
}

export interface CategoryStatistics {
  category: string;
  mean: DecimalInstance;
  median: DecimalInstance;
  stdDev: DecimalInstance;
  max: DecimalInstance;
  min: DecimalInstance;
  count: number;
  total: DecimalInstance;
}

export interface TimeSeriesPoint {
  date: Date;
  value: number;
}

export interface PredictionResult {
  predictions: SpendingPrediction[];
  confidence: number;
  methodology: string;
  dataPoints: number;
}

export interface AnalysisOptions {
  lookbackMonths?: number;
  minTransactions?: number;
  confidenceThreshold?: number;
  includeCategories?: string[];
  excludeCategories?: string[];
}