/**
 * Financial Planning Page Service
 * Business logic for financial planning page operations
 */

import { financialPlanningService } from './financialPlanningService';
// Local view types for page consumption (service does not export these)
type RetirementPlan = { id: string; name?: string };
type MortgageCalculation = { id: string };
type DebtPayoffPlan = { id: string; debtName: string; currentBalance: number; interestRate: number };
type FinancialGoal = { id: string };
type InsuranceNeed = { id: string; type: string; currentCoverage: number; recommendedCoverage: number; monthlyPremium: number };
import { CheckCircleIcon, AlertCircleIcon } from '../components/icons';
import React from 'react';

export type ActiveTab = 'overview' | 'tax' | 'retirement' | 'mortgage' | 'debt' | 'goals' | 'insurance' | 'networth';

export interface PlanningData {
  retirementPlans: RetirementPlan[];
  mortgageCalculations: MortgageCalculation[];
  debtPlans: DebtPayoffPlan[];
  financialGoals: FinancialGoal[];
  insuranceNeeds: InsuranceNeed[];
}

export interface InsuranceStatus {
  status: 'adequate' | 'low' | 'critical';
  color: string;
}

class FinancialPlanningPageService {
  /**
   * Load all financial planning data
   */
  async loadData(): Promise<PlanningData> {
    // For now, return empty data as we don't have clerkUserId in this context
    // This should be refactored to pass clerkUserId from the component
    return {
      retirementPlans: [],
      mortgageCalculations: [],
      debtPlans: [],
      financialGoals: [],
      insuranceNeeds: []
    };
  }

  /**
   * Get goal status color
   */
  getGoalStatusColor(goal: FinancialGoal): string {
    // Since FinancialGoal only has id, we can't calculate projection
    // This should be refactored to include actual goal data
    return 'text-gray-600 dark:text-gray-400';
  }

  /**
   * Get goal status icon
   */
  getGoalStatusIcon(goal: FinancialGoal): React.ReactNode {
    // Since FinancialGoal only has id, we can't calculate projection
    // This should be refactored to include actual goal data
    return React.createElement(AlertCircleIcon, { size: 16, className: "text-gray-500" });
  }

  /**
   * Get insurance coverage status
   */
  getInsuranceCoverageStatus(need: InsuranceNeed): InsuranceStatus {
    const coverageRatio = need.currentCoverage / need.recommendedCoverage;
    if (coverageRatio >= 0.9) {
      return { status: 'adequate', color: 'text-green-600 dark:text-green-400' };
    }
    if (coverageRatio >= 0.5) {
      return { status: 'low', color: 'text-yellow-600 dark:text-yellow-400' };
    }
    return { status: 'critical', color: 'text-red-600 dark:text-red-400' };
  }

  /**
   * Calculate goal progress percentage
   */
  getGoalProgress(goal: FinancialGoal): number {
    // Since FinancialGoal only has id, we can't calculate progress
    // This should be refactored to include actual goal data
    return 0;
  }

  /**
   * Get retirement projection
   */
  getRetirementProjection(plan: RetirementPlan) {
    return financialPlanningService.calculateRetirementProjection(plan);
  }

  /**
   * Get debt payoff projection
   */
  getDebtPayoffProjection(plan: DebtPayoffPlan) {
    return financialPlanningService.calculateDebtPayoff(
      plan.currentBalance,
      plan.interestRate,
      100 // Default minimum payment, should be part of DebtPayoffPlan
    );
  }

  /**
   * Get goal projection
   */
  getGoalProjection(goal: FinancialGoal) {
    // Since FinancialGoal only has id, we can't calculate projection
    // This should be refactored to include actual goal data
    return financialPlanningService.calculateGoalProjection(
      10000, // Default target amount
      0,     // Default initial amount
      100    // Default monthly contribution
    );
  }

  /**
   * Get tab button class
   */
  getTabButtonClass(isActive: boolean): string {
    return `py-2 px-4 my-1 border-b-2 font-medium text-sm whitespace-nowrap rounded-t-lg transition-all ${
      isActive
        ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20'
        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
    }`;
  }
}

export const financialPlanningPageService = new FinancialPlanningPageService();
