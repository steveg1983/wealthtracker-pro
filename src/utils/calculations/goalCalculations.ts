/**
 * Goal Calculations Module
 * Goal and projection calculations
 */

import type { Goal } from '../../types';
import type { ProjectedSavingsResult, EmergencyFundResult } from './types';

/**
 * Calculate goal progress percentage
 */
export function calculateGoalProgress(goal: Goal): number {
  const decimalGoal = {
    ...goal,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount
  };
  return decimalGoal.targetAmount === 0 ? 0 : 
    (decimalGoal.currentAmount / decimalGoal.targetAmount) * 100;
}

/**
 * Calculate months to reach goal
 */
export function calculateMonthsToGoal(
  currentAmount: number,
  targetAmount: number,
  monthlyContribution: number
): number {
  if (monthlyContribution <= 0 || currentAmount >= targetAmount) return 0;
  
  const remaining = targetAmount - currentAmount;
  return Math.ceil(remaining / monthlyContribution);
}

/**
 * Calculate required monthly savings to reach goal
 */
export function calculateRequiredMonthlySavings(
  currentAmount: number,
  targetAmount: number,
  targetDate: Date
): number {
  const currentDate = new Date();
  const monthsDiff = (targetDate.getFullYear() - currentDate.getFullYear()) * 12 + 
                     (targetDate.getMonth() - currentDate.getMonth());
  
  if (monthsDiff <= 0) return 0;
  
  const remaining = targetAmount - currentAmount;
  return remaining / monthsDiff;
}

/**
 * Calculate projected savings based on current amount and monthly contribution
 */
export function calculateProjectedSavings(
  currentAmount: number,
  monthlyContribution: number,
  targetDate: Date
): ProjectedSavingsResult {
  const currentDate = new Date();
  const monthsDiff = (targetDate.getFullYear() - currentDate.getFullYear()) * 12 + 
                     (targetDate.getMonth() - currentDate.getMonth());
  
  const projectedAmount = currentAmount + (monthlyContribution * monthsDiff);
  
  return {
    projectedAmount,
    willMeetGoal: true, // Can be enhanced with goal target comparison
    monthsToGoal: Math.max(0, monthsDiff)
  };
}

/**
 * Calculate emergency fund coverage in months
 */
export function calculateEmergencyFundCoverage(
  emergencyFund: number,
  monthlyExpenses: number
): EmergencyFundResult {
  if (monthlyExpenses === 0) {
    return {
      months: Infinity,
      isAdequate: true
    };
  }
  
  const months = emergencyFund / monthlyExpenses;
  const isAdequate = months >= 6; // 6 months is generally recommended
  
  return {
    months,
    isAdequate
  };
}

/**
 * Calculate retirement readiness score
 */
export function calculateRetirementReadiness(
  currentAge: number,
  retirementAge: number,
  currentSavings: number,
  monthlyContribution: number,
  expectedReturn: number = 0.07
): {
  score: number;
  projectedAmount: number;
  onTrack: boolean;
} {
  const yearsToRetirement = retirementAge - currentAge;
  
  if (yearsToRetirement <= 0) {
    return {
      score: 100,
      projectedAmount: currentSavings,
      onTrack: true
    };
  }
  
  // Calculate future value with compound interest
  const monthlyRate = expectedReturn / 12;
  const months = yearsToRetirement * 12;
  
  const futureValue = currentSavings * Math.pow(1 + expectedReturn, yearsToRetirement) +
    monthlyContribution * 12 * ((Math.pow(1 + expectedReturn, yearsToRetirement) - 1) / expectedReturn);
  
  // Simple scoring based on multiple of annual expenses (25x rule)
  const annualContribution = monthlyContribution * 12;
  const estimatedAnnualNeed = annualContribution * 3; // Rough estimate
  const targetAmount = estimatedAnnualNeed * 25;
  
  const score = Math.min(100, (futureValue / targetAmount) * 100);
  
  return {
    score,
    projectedAmount: futureValue,
    onTrack: score >= 75
  };
}

/**
 * Calculate FIRE (Financial Independence Retire Early) number
 */
export function calculateFIRENumber(
  annualExpenses: number,
  safeWithdrawalRate: number = 0.04
): number {
  return annualExpenses / safeWithdrawalRate;
}

/**
 * Calculate years to financial independence
 */
export function calculateYearsToFI(
  currentNetWorth: number,
  annualSavings: number,
  annualExpenses: number,
  expectedReturn: number = 0.07
): number {
  const fireNumber = calculateFIRENumber(annualExpenses);
  
  if (currentNetWorth >= fireNumber) return 0;
  
  // Using compound interest formula to solve for years
  const remaining = fireNumber - currentNetWorth;
  
  if (annualSavings <= 0) return Infinity;
  
  const years = Math.log(
    (remaining * expectedReturn + annualSavings) / annualSavings
  ) / Math.log(1 + expectedReturn);
  
  return Math.max(0, Math.ceil(years));
}