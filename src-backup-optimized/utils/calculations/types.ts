/**
 * Calculation Types
 * Type definitions for financial calculations
 */

import type { Account, Transaction, Budget, Goal } from '../../types';

export interface CashFlowResult {
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  savingsRate: number;
}

export interface BudgetProgressResult {
  percentage: number;
  remaining: number;
  status: 'good' | 'warning' | 'danger';
}

export interface ProjectedSavingsResult {
  projectedAmount: number;
  willMeetGoal: boolean;
  monthsToGoal: number;
}

export interface EmergencyFundResult {
  months: number;
  isAdequate: boolean;
}

export interface InvestmentReturnResult {
  amount: number;
  percentage: number;
}

export interface MonthlyTrendData {
  month: string;
  income: number;
  expenses: number;
  netIncome: number;
}

export interface CategoryTrendData {
  month: string;
  amount: number;
}

export interface BalanceHistoryData {
  date: Date;
  balance: number;
}

export interface IconMap {
  [key: string]: string;
}