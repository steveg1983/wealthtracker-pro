/**
 * IRA Calculator Module
 * Handles Traditional and Roth IRA calculations
 */

import Decimal from 'decimal.js';
import usRetirementConstants from '../../data/us-retirement-constants-2025.json';
import type { IRACalculation } from './types';

export class IRACalculator {
  private constants = usRetirementConstants;

  /**
   * Calculate IRA contributions and benefits
   */
  calculateIRA(
    type: 'traditional' | 'roth',
    requestedContribution: number,
    adjustedGrossIncome: number,
    currentAge: number,
    retirementAge: number,
    currentBalance: number,
    filingStatus: 'single' | 'married' | 'separate',
    hasPlanAtWork: boolean = false,
    growthRate: number = 0.07
  ): IRACalculation {
    const limits = this.constants.ira.contributionLimits;
    
    // Determine contribution limit
    const catchUpEligible = currentAge >= 50;
    const maxContribution = catchUpEligible 
      ? limits.totalWithCatchUp
      : limits.regular;
    
    let actualContribution = Math.min(requestedContribution, maxContribution);
    let deductible = type === 'traditional';
    let phaseOut: { percentage: number; reduced: boolean } | undefined;
    
    // Check income phase-outs
    if (type === 'traditional' && hasPlanAtWork) {
      // Traditional IRA deductibility phase-out
      const thresholds = this.constants.ira.traditional.deductibility[
        filingStatus === 'married' ? 'marriedJoint' : 'single'
      ];
      
      if (adjustedGrossIncome > thresholds.phaseoutEnd) {
        deductible = false;
      } else if (adjustedGrossIncome > thresholds.phaseoutStart) {
        // Partial deduction
        const phaseOutRange = thresholds.phaseoutEnd - thresholds.phaseoutStart;
        const excess = adjustedGrossIncome - thresholds.phaseoutStart;
        const phaseOutPercentage = 1 - (excess / phaseOutRange);
        
        if (phaseOutPercentage < 1) {
          phaseOut = {
            percentage: phaseOutPercentage,
            reduced: true
          };
        }
      }
    } else if (type === 'roth') {
      // Roth IRA income limits
      const thresholds = this.constants.ira.roth.incomeLimits[
        filingStatus === 'married' ? 'marriedJoint' : 'single'
      ];
      
      if (adjustedGrossIncome > thresholds.noContribution) {
        actualContribution = 0;
      } else if (adjustedGrossIncome > thresholds.phaseoutStart) {
        // Phase-out calculation
        const phaseOutRange = thresholds.phaseoutEnd - thresholds.phaseoutStart;
        const excess = adjustedGrossIncome - thresholds.phaseoutStart;
        const phaseOutPercentage = 1 - (excess / phaseOutRange);
        actualContribution = actualContribution * phaseOutPercentage;
        phaseOut = {
          percentage: phaseOutPercentage,
          reduced: true
        };
      }
    }
    
    // Calculate tax benefit
    const marginalRate = this.estimateMarginalTaxRate(adjustedGrossIncome);
    let taxBenefit = 0;
    
    if (type === 'traditional' && deductible) {
      taxBenefit = actualContribution * marginalRate * (phaseOut?.percentage || 1);
    } else if (type === 'roth') {
      // Tax-free growth benefit (estimated)
      const futureValue = this.calculateCompoundGrowth(
        currentBalance,
        actualContribution,
        growthRate,
        retirementAge - currentAge
      );
      const growth = futureValue - currentBalance - (actualContribution * (retirementAge - currentAge));
      taxBenefit = growth * marginalRate; // Tax saved on growth
    }
    
    // Project future value
    const projectedBalance = this.calculateCompoundGrowth(
      currentBalance,
      actualContribution,
      growthRate,
      retirementAge - currentAge
    );
    
    return {
      type,
      monthlyContribution: actualContribution / 12,
      annualContribution: actualContribution,
      taxBenefit,
      projectedBalance,
      deductible,
      phaseOut
    };
  }

  /**
   * Calculate Backdoor Roth conversion
   */
  calculateBackdoorRoth(
    traditionalBalance: number,
    nonDeductibleBasis: number,
    conversionAmount: number,
    currentAge: number
  ): {
    taxableAmount: number;
    taxFreeAmount: number;
    estimatedTax: number;
    netAfterTax: number;
  } {
    // Pro-rata rule calculation
    const totalBalance = traditionalBalance;
    const taxFreePercentage = nonDeductibleBasis / totalBalance;
    const taxFreeAmount = conversionAmount * taxFreePercentage;
    const taxableAmount = conversionAmount - taxFreeAmount;
    
    // Estimate tax on conversion
    const estimatedTax = taxableAmount * 0.24; // Assume 24% bracket
    
    return {
      taxableAmount,
      taxFreeAmount,
      estimatedTax,
      netAfterTax: conversionAmount - estimatedTax
    };
  }

  /**
   * Calculate Mega Backdoor Roth conversion (after-tax 401k to Roth)
   */
  calculateMegaBackdoorRoth(
    annualSalary: number,
    employee401kContribution: number,
    employer401kMatch: number,
    currentAge: number
  ): {
    maxAfterTaxContribution: number;
    totalAnnualLimit: number;
    availableSpace: number;
  } {
    const limits = this.constants.retirement401k.contributionLimits;
    
    // Total annual limit (employee + employer + after-tax)
    const totalAnnualLimit = limits.combined.regular;
    
    // Space already used
    const usedSpace = employee401kContribution + employer401kMatch;
    
    // Available for after-tax contributions
    const availableSpace = Math.max(0, totalAnnualLimit - usedSpace);
    
    return {
      maxAfterTaxContribution: availableSpace,
      totalAnnualLimit,
      availableSpace
    };
  }

  /**
   * Calculate SEPP (72(t)) distributions for early retirement
   */
  calculateSEPP(
    accountBalance: number,
    currentAge: number,
    lifeExpectancy: number = 85
  ): {
    fixedAmortization: number;
    fixedAnnuitization: number;
    rmd: number;
  } {
    // Assumed federal mid-term rate
    const interestRate = 0.045;
    
    // RMD method
    const yearsRemaining = lifeExpectancy - currentAge;
    const rmd = accountBalance / yearsRemaining;
    
    // Fixed amortization method
    const monthlyRate = interestRate / 12;
    const months = yearsRemaining * 12;
    const fixedAmortization = accountBalance * 
      (monthlyRate * Math.pow(1 + monthlyRate, months)) / 
      (Math.pow(1 + monthlyRate, months) - 1) * 12;
    
    // Fixed annuitization method (simplified)
    const annuityFactor = yearsRemaining * 0.95; // Simplified factor
    const fixedAnnuitization = accountBalance / annuityFactor;
    
    return {
      fixedAmortization,
      fixedAnnuitization,
      rmd
    };
  }

  /**
   * Estimate marginal tax rate based on income
   */
  private estimateMarginalTaxRate(income: number): number {
    // 2025 tax brackets (simplified for single filer)
    if (income <= 11600) return 0.10;
    if (income <= 47150) return 0.12;
    if (income <= 100525) return 0.22;
    if (income <= 191950) return 0.24;
    if (income <= 243725) return 0.32;
    if (income <= 609350) return 0.35;
    return 0.37;
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
}

export const iraCalculator = new IRACalculator();