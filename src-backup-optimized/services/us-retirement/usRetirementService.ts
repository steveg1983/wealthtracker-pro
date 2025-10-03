/**
 * US Retirement Service
 * Main orchestrator for US retirement calculations
 */

import Decimal from 'decimal.js';
import { taxDataService } from '../taxDataService';
import type { 
  USRetirementProjection,
  RetirementProjectionParams,
  OptimizationRecommendation
} from './types';

import { socialSecurityCalculator } from './socialSecurityCalculator';
import { retirement401kCalculator } from './retirement401kCalculator';
import { iraCalculator } from './iraCalculator';
import { medicareCalculator } from './medicareCalculator';
import { retirementOptimizer } from './retirementOptimizer';

export class USRetirementService {
  /**
   * Calculate complete US retirement projection
   */
  calculateFullRetirementProjection(
    params: RetirementProjectionParams
  ): USRetirementProjection {
    const {
      currentAge,
      retirementAge,
      birthYear,
      annualSalary,
      averageIndexedEarnings,
      yearsWorked,
      current401kBalance,
      employee401kRate,
      employer401kMatch,
      employer401kMatchLimit,
      iraType,
      iraContribution,
      currentIRABalance,
      filingStatus,
      socialSecurityClaimAge,
      growthRate = 0.07
    } = params;
    
    // Calculate Social Security
    const socialSecurity = socialSecurityCalculator.calculateSocialSecurity(
      averageIndexedEarnings / 12, // Convert annual to monthly
      birthYear,
      socialSecurityClaimAge,
      yearsWorked
    );
    
    // Calculate 401(k)
    let retirement401k;
    if (annualSalary > 0 && employee401kRate > 0) {
      retirement401k = retirement401kCalculator.calculate401k(
        annualSalary,
        employee401kRate,
        employer401kMatch,
        employer401kMatchLimit,
        currentAge,
        retirementAge,
        current401kBalance,
        growthRate
      );
    }
    
    // Calculate IRA
    let traditionalIRA;
    let rothIRA;
    
    if (iraContribution > 0 && iraType) {
      const iraCalc = iraCalculator.calculateIRA(
        iraType,
        iraContribution,
        annualSalary, // Using salary as AGI approximation
        currentAge,
        retirementAge,
        currentIRABalance,
        filingStatus,
        retirement401k !== undefined, // Has plan at work
        growthRate
      );
      
      if (iraType === 'traditional') {
        traditionalIRA = iraCalc;
      } else {
        rothIRA = iraCalc;
      }
    }
    
    // Calculate Medicare
    const medicare = medicareCalculator.calculateMedicare(
      annualSalary, // Using salary as MAGI approximation
      filingStatus === 'married' ? 'married' : 'single',
      retirementAge
    );
    
    // Calculate total retirement income
    let annualIncome = socialSecurity.annualBenefit;
    
    // Add 4% withdrawal from retirement accounts
    const withdrawalRate = 0.04;
    if (retirement401k) {
      annualIncome += retirement401k.projectedBalance * withdrawalRate;
    }
    if (traditionalIRA) {
      annualIncome += traditionalIRA.projectedBalance * withdrawalRate;
    }
    if (rothIRA) {
      annualIncome += rothIRA.projectedBalance * withdrawalRate;
    }
    
    // Estimate taxes (simplified)
    const effectiveTaxRate = 0.15;
    const afterTaxIncome = annualIncome * (1 - effectiveTaxRate);
    
    // Calculate RMD if applicable
    let requiredMinimumDistribution;
    if (retirement401k && retirementAge >= 73) {
      requiredMinimumDistribution = retirement401kCalculator.calculateRMD(
        retirement401k.projectedBalance,
        retirementAge,
        birthYear
      );
    }
    
    return {
      socialSecurity,
      retirement401k,
      traditionalIRA,
      rothIRA,
      medicare,
      totalRetirementIncome: {
        annual: annualIncome,
        monthly: annualIncome / 12,
        afterTax: afterTaxIncome
      },
      requiredMinimumDistribution
    };
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(
    projection: USRetirementProjection,
    params: RetirementProjectionParams
  ): OptimizationRecommendation[] {
    return retirementOptimizer.generateOptimizationRecommendations(projection, params);
  }

  /**
   * Calculate optimal Social Security claiming age
   */
  calculateOptimalClaimingAge(
    monthlyPIA: number,
    birthYear: number,
    lifeExpectancy: number = 85,
    discountRate: number = 0.03
  ): { optimalAge: number; lifetimeValue: number } {
    const fra = socialSecurityCalculator.getFullRetirementAge(birthYear);
    return retirementOptimizer.calculateOptimalClaimingAge(
      monthlyPIA,
      fra,
      lifeExpectancy,
      discountRate
    );
  }

  /**
   * Calculate tax-efficient withdrawal strategy
   */
  calculateWithdrawalStrategy(
    traditional401k: number,
    rothIRA: number,
    taxableAccount: number,
    annualNeed: number,
    currentAge: number
  ): {
    taxable: number;
    traditional: number;
    roth: number;
    estimatedTax: number;
  } {
    return retirementOptimizer.calculateWithdrawalStrategy(
      traditional401k,
      rothIRA,
      taxableAccount,
      annualNeed,
      currentAge
    );
  }

  /**
   * Calculate spousal Social Security benefits
   */
  calculateSpousalBenefit(
    primaryPIA: number,
    spouseBirthYear: number,
    spouseClaimingAge: number
  ): number {
    return socialSecurityCalculator.calculateSpousalBenefit(
      primaryPIA,
      spouseBirthYear,
      spouseClaimingAge
    );
  }

  /**
   * Calculate survivor Social Security benefits
   */
  calculateSurvivorBenefit(
    deceasedBenefit: number,
    survivorBirthYear: number,
    survivorClaimingAge: number
  ): number {
    return socialSecurityCalculator.calculateSurvivorBenefit(
      deceasedBenefit,
      survivorBirthYear,
      survivorClaimingAge
    );
  }

  /**
   * Calculate Solo 401(k) for self-employed
   */
  calculateSolo401k(
    netSelfEmploymentIncome: number,
    currentAge: number
  ): { employee: number; employer: number; total: number } {
    return retirement401kCalculator.calculateSolo401k(
      netSelfEmploymentIncome,
      currentAge
    );
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
    return iraCalculator.calculateBackdoorRoth(
      traditionalBalance,
      nonDeductibleBasis,
      conversionAmount,
      currentAge
    );
  }

  /**
   * Calculate total healthcare costs in retirement
   */
  calculateHealthcareCosts(
    currentAge: number,
    retirementAge: number,
    lifeExpectancy: number = 85
  ): {
    totalEstimate: number;
    annualAverage: number;
    preMedicare: number;
    duringMedicare: number;
  } {
    return medicareCalculator.calculateTotalHealthcareCosts(
      currentAge,
      retirementAge,
      lifeExpectancy
    );
  }

  /**
   * Calculate HSA benefits for retirement
   */
  calculateHSA(
    currentBalance: number,
    annualContribution: number,
    employerContribution: number,
    currentAge: number,
    retirementAge: number
  ): {
    projectedBalance: number;
    taxSavings: number;
    medicareQualifiedExpenses: number;
  } {
    return medicareCalculator.calculateHSA(
      currentBalance,
      annualContribution,
      employerContribution,
      currentAge,
      retirementAge
    );
  }
}

export const usRetirementService = new USRetirementService();