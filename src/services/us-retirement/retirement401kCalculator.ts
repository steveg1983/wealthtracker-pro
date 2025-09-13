/**
 * 401(k) Calculator Module
 * Handles 401(k) retirement account calculations
 */

import Decimal from 'decimal.js';
import usRetirementConstants from '../../data/us-retirement-constants-2025.json';
import type { Retirement401kCalculation } from './types';

export class Retirement401kCalculator {
  private constants = usRetirementConstants;

  /**
   * Get catch-up contribution amount based on age
   */
  private getCatchUpAmount(age: number): number {
    const limits = this.constants.retirement401k.contributionLimits.employee;
    if (age >= 64) return limits.catchUp64plus;
    if (age >= 60) return limits.catchUp60to63;
    if (age >= 50) return limits.catchUp50to59;
    return 0;
  }

  /**
   * Calculate 401(k) contributions and projections
   */
  calculate401k(
    annualSalary: number,
    employeeRate: number,
    employerMatchRate: number,
    employerMatchLimit: number,
    currentAge: number,
    retirementAge: number,
    currentBalance: number,
    growthRate: number = 0.07
  ): Retirement401kCalculation {
    const limits = this.constants.retirement401k.contributionLimits;
    
    // Calculate employee contribution
    let employeeContribution = annualSalary * employeeRate;
    const catchUpAmount = this.getCatchUpAmount(currentAge);
    const maxContribution = limits.employee.regular + catchUpAmount;
    
    // Apply contribution limit
    employeeContribution = Math.min(employeeContribution, maxContribution);
    
    // Calculate employer match
    const matchableAmount = Math.min(annualSalary * employerMatchLimit, annualSalary);
    const employerMatch = Math.min(
      matchableAmount * employerMatchRate,
      limits.combined.regular - employeeContribution
    );
    
    // Total annual contribution
    const totalAnnualContribution = employeeContribution + employerMatch;
    const totalMonthlyContribution = totalAnnualContribution / 12;
    
    // Calculate projected balance
    const yearsToRetirement = retirementAge - currentAge;
    const projectedBalance = this.calculateCompoundGrowth(
      currentBalance,
      totalAnnualContribution,
      growthRate,
      yearsToRetirement
    );
    
    // Assume fully vested (would need vesting schedule for accurate calculation)
    const vestedAmount = currentBalance + (employerMatch * yearsToRetirement);
    
    // Calculate tax deferred amount
    const taxDeferred = employeeContribution;
    
    return {
      employeeContribution,
      employerMatch,
      totalMonthlyContribution,
      annualContribution: totalAnnualContribution,
      projectedBalance,
      vestedAmount,
      taxDeferred,
      catchUpEligible: currentAge >= 50,
      catchUpAmount: catchUpAmount > 0 ? catchUpAmount : undefined
    };
  }

  /**
   * Calculate Safe Harbor 401(k) contributions
   */
  calculateSafeHarbor401k(
    annualSalary: number,
    employeeRate: number,
    safeHarborType: 'basic' | 'enhanced',
    currentAge: number
  ): { employee: number; employer: number; total: number } {
    const limits = this.constants.retirement401k.contributionLimits;
    
    // Calculate employee contribution
    const catchUpAmount = this.getCatchUpAmount(currentAge);
    const maxContribution = limits.employee.regular + catchUpAmount;
    
    const employeeContribution = Math.min(
      annualSalary * employeeRate,
      maxContribution
    );
    
    // Calculate Safe Harbor employer contribution
    let employerContribution = 0;
    
    if (safeHarborType === 'basic') {
      // Basic match: 100% of first 3%, 50% of next 2%
      const firstTier = Math.min(annualSalary * 0.03, employeeContribution);
      const secondTier = Math.min(
        Math.max(0, Math.min(annualSalary * 0.02, employeeContribution - firstTier)) * 0.5,
        annualSalary * 0.01
      );
      employerContribution = firstTier + secondTier;
    } else {
      // Enhanced match: 100% of first 4%
      employerContribution = Math.min(annualSalary * 0.04, employeeContribution);
    }
    
    return {
      employee: employeeContribution,
      employer: employerContribution,
      total: employeeContribution + employerContribution
    };
  }

  /**
   * Calculate Solo 401(k) contributions for self-employed
   */
  calculateSolo401k(
    netSelfEmploymentIncome: number,
    currentAge: number
  ): { employee: number; employer: number; total: number } {
    const limits = this.constants.retirement401k.contributionLimits;
    
    // Calculate maximum employee deferral
    const catchUpAmount = this.getCatchUpAmount(currentAge);
    const maxEmployeeDeferral = limits.employee.regular + catchUpAmount;
    
    // Employee contribution (up to 100% of compensation or limit)
    const employeeContribution = Math.min(netSelfEmploymentIncome, maxEmployeeDeferral);
    
    // Employer contribution (up to 25% of compensation)
    // For self-employed, this is 20% of net self-employment income
    const employerContribution = Math.min(
      netSelfEmploymentIncome * 0.20,
      limits.combined.regular - employeeContribution
    );
    
    return {
      employee: employeeContribution,
      employer: employerContribution,
      total: Math.min(employeeContribution + employerContribution, limits.combined.regular)
    };
  }

  /**
   * Calculate compound growth with regular contributions
   */
  private calculateCompoundGrowth(
    principal: number,
    annualContribution: number,
    rate: number,
    years: number
  ): number {
    if (years <= 0) return principal;
    
    // Future value of initial balance
    const futureValuePrincipal = principal * Math.pow(1 + rate, years);
    
    // Future value of annuity (regular contributions)
    const futureValueContributions = annualContribution * 
      ((Math.pow(1 + rate, years) - 1) / rate);
    
    return futureValuePrincipal + futureValueContributions;
  }

  /**
   * Calculate required minimum distribution for 401(k)
   */
  calculateRMD(
    accountBalance: number,
    age: number,
    birthYear: number
  ): { age: number; amount: number; penalty: number } | undefined {
    const rmdRules = this.constants.retirement401k.requiredMinimumDistributions;
    
    // Determine RMD start age based on birth year
    const rmdStartAge = birthYear >= 1960 ? rmdRules.born1960OrLater : rmdRules.startAge;
    
    if (age < rmdStartAge) {
      return undefined;
    }
    
    // IRS Uniform Lifetime Table factors (simplified)
    const lifetimeFactors: { [key: number]: number } = {
      73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9,
      78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5,
      83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
      88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8,
      93: 10.1, 94: 9.5, 95: 8.9
    };
    
    const factor = lifetimeFactors[Math.min(age, 95)] || 8.9;
    const rmdAmount = accountBalance / factor;
    
    // Calculate penalty if not taken (25% of RMD amount)
    const penalty = rmdAmount * rmdRules.penalty;
    
    return {
      age: rmdStartAge,
      amount: rmdAmount,
      penalty
    };
  }
}

export const retirement401kCalculator = new Retirement401kCalculator();