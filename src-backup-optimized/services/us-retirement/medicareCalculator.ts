/**
 * Medicare Calculator Module
 * Handles Medicare premium calculations and estimates
 */

import usRetirementConstants from '../../data/us-retirement-constants-2025.json';
import { US_FINANCIAL_CONSTANTS } from '../../constants/financial/us';
import type { MedicareEstimate } from './types';

export class MedicareCalculator {
  private constants = usRetirementConstants;
  private financialConstants = US_FINANCIAL_CONSTANTS;

  /**
   * Calculate Medicare premiums based on income
   */
  calculateMedicare(
    modifiedAdjustedGrossIncome: number,
    filingStatus: 'single' | 'married',
    age: number
  ): MedicareEstimate {
    const medicare = this.constants.medicare;
    const eligibilityAge = medicare.eligibilityAge;
    
    // Base premiums
    let partBPremium = medicare.partB.standardPremium;
    const partAPremium = medicare.partA.premium; // Usually $0 with 40 quarters
    const partDPremium = medicare.partD.averagePremium;
    
    // Apply IRMAA (Income-Related Monthly Adjustment Amount) for Part B
    let irmaaApplies = false;
    let adjustedPremium = partBPremium;
    
    if (age >= eligibilityAge) {
      const irmaaThresholds = medicare.partB.irmaa[filingStatus === 'married' ? 'married' : 'single'];
      
      for (const threshold of irmaaThresholds) {
        if (modifiedAdjustedGrossIncome >= threshold.income) {
          partBPremium = threshold.premium;
          irmaaApplies = true;
          adjustedPremium = threshold.premium;
        }
      }
    }
    
    const totalMonthlyPremium = partAPremium + partBPremium + partDPremium;
    
    return {
      eligibilityAge,
      partAPremium,
      partBPremium,
      partDPremium,
      totalMonthlyPremium,
      irmaaApplies,
      adjustedPremium: irmaaApplies ? adjustedPremium : undefined
    };
  }

  /**
   * Calculate Medicare Advantage (Part C) estimates
   */
  calculateMedicareAdvantage(
    zipCode: string,
    hasChronicConditions: boolean = false
  ): {
    averagePremium: number;
    outOfPocketMax: number;
    includesPrescriptionDrugs: boolean;
  } {
    // Simplified estimates - would need actual plan data
    const basePremium = hasChronicConditions ? 50 : 25;
    const outOfPocketMax = hasChronicConditions ? 7550 : 5000;
    
    return {
      averagePremium: basePremium,
      outOfPocketMax,
      includesPrescriptionDrugs: true
    };
  }

  /**
   * Calculate Medigap (Supplement) premiums
   */
  calculateMedigap(
    age: number,
    plan: 'A' | 'B' | 'C' | 'D' | 'F' | 'G' | 'K' | 'L' | 'M' | 'N',
    gender: 'male' | 'female',
    smoker: boolean = false
  ): number {
    // Base premium by plan (simplified)
    const basePremiums: { [key: string]: number } = {
      'A': 100, 'B': 140, 'C': 160, 'D': 150,
      'F': 180, 'G': 160, 'K': 80, 'L': 110,
      'M': 130, 'N': 140
    };
    
    let premium = basePremiums[plan] || 150;
    
    // Age adjustment
    if (age >= 65 && age < 70) {
      premium *= 1.0;
    } else if (age >= 70 && age < 75) {
      premium *= 1.15;
    } else if (age >= 75 && age < 80) {
      premium *= 1.30;
    } else if (age >= 80) {
      premium *= 1.45;
    }
    
    // Gender adjustment
    if (gender === 'female') {
      premium *= 0.95;
    }
    
    // Smoker adjustment
    if (smoker) {
      premium *= 1.25;
    }
    
    return Math.round(premium);
  }

  /**
   * Calculate total healthcare costs in retirement
   */
  calculateTotalHealthcareCosts(
    currentAge: number,
    retirementAge: number,
    lifeExpectancy: number = 85,
    inflationRate: number = 0.045
  ): {
    totalEstimate: number;
    annualAverage: number;
    preMedicare: number;
    duringMedicare: number;
  } {
    const medicareAge = 65;
    let preMedicare = 0;
    let duringMedicare = 0;
    
    // Pre-Medicare costs (if retiring before 65)
    if (retirementAge < medicareAge) {
      const yearsPre = medicareAge - retirementAge;
      const annualCost = 8000; // Average individual health insurance
      
      for (let i = 0; i < yearsPre; i++) {
        preMedicare += annualCost * Math.pow(1 + inflationRate, i);
      }
    }
    
    // Medicare costs
    const medicarYears = Math.max(0, lifeExpectancy - Math.max(medicareAge, retirementAge));
    const annualMedicareCost = 5000; // Average with premiums and out-of-pocket
    
    for (let i = 0; i < medicarYears; i++) {
      duringMedicare += annualMedicareCost * Math.pow(1 + inflationRate, i);
    }
    
    const totalEstimate = preMedicare + duringMedicare;
    const totalYears = lifeExpectancy - retirementAge;
    const annualAverage = totalYears > 0 ? totalEstimate / totalYears : 0;
    
    return {
      totalEstimate,
      annualAverage,
      preMedicare,
      duringMedicare
    };
  }

  /**
   * Calculate Health Savings Account (HSA) benefits
   */
  calculateHSA(
    currentBalance: number,
    annualContribution: number,
    employerContribution: number,
    currentAge: number,
    retirementAge: number,
    growthRate: number = 0.06
  ): {
    projectedBalance: number;
    taxSavings: number;
    medicareQualifiedExpenses: number;
  } {
    const limits = this.financialConstants.hsa.contributionLimit;
    const catchUpAge = 55;
    const catchUpAmount = 1000;
    
    let totalAnnualContribution = annualContribution + employerContribution;
    
    // Add catch-up if eligible
    if (currentAge >= catchUpAge) {
      totalAnnualContribution = Math.min(
        totalAnnualContribution + catchUpAmount,
        limits.family + catchUpAmount
      );
    } else {
      totalAnnualContribution = Math.min(totalAnnualContribution, limits.family);
    }
    
    // Project balance
    const years = retirementAge - currentAge;
    const futureValue = currentBalance * Math.pow(1 + growthRate, years) +
      totalAnnualContribution * ((Math.pow(1 + growthRate, years) - 1) / growthRate);
    
    // Tax savings (triple tax advantage)
    const marginalRate = 0.24; // Assume 24% bracket
    const taxSavings = totalAnnualContribution * years * marginalRate;
    
    // Estimated qualified medical expenses in retirement
    const medicareQualifiedExpenses = futureValue * 0.8; // Assume 80% for medical
    
    return {
      projectedBalance: futureValue,
      taxSavings,
      medicareQualifiedExpenses
    };
  }
}

export const medicareCalculator = new MedicareCalculator();