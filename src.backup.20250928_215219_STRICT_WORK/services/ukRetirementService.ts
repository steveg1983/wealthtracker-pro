import { Decimal } from 'decimal.js';
import ukRetirementConstants from '../data/uk-retirement-constants-2025-26.json';
import { taxDataService } from './taxDataService';

export interface UKStatePensionCalculation {
  weeklyAmount: number;
  annualAmount: number;
  qualifyingYears: number;
  yearsToFullPension: number;
  pensionAge: number;
  isFullPension: boolean;
  deferralOptions?: {
    weeksDeferral: number;
    increasedWeekly: number;
    increasedAnnual: number;
  };
}

export interface WorkplacePensionCalculation {
  employeeContribution: number;
  employerContribution: number;
  totalMonthlyContribution: number;
  taxRelief: number;
  netCost: number;
  projectedPot: number;
  qualifyingEarnings: number;
}

export interface ISAProjection {
  type: 'standard' | 'lifetime';
  annualContribution: number;
  governmentBonus?: number;
  projectedValue: number;
  taxSaved: number;
}

export interface UKRetirementProjection {
  statePension: UKStatePensionCalculation;
  workplacePension?: WorkplacePensionCalculation;
  personalPension?: {
    currentValue: number;
    monthlyContribution: number;
    taxRelief: number;
    projectedValue: number;
  };
  isa?: ISAProjection;
  totalRetirementIncome: {
    annual: number;
    monthly: number;
    weekly: number;
  };
  taxOnRetirement: {
    incomeTax: number;
    effectiveRate: number;
    netIncome: number;
  };
}

class UKRetirementService {
  private constants = ukRetirementConstants;

  /**
   * Calculate State Pension based on qualifying years
   */
  calculateStatePension(
    qualifyingYears: number,
    birthYear: number,
    deferYears: number = 0
  ): UKStatePensionCalculation {
    const fullPension = this.constants.statePension.fullNewStatePension;
    const minYears = this.constants.statePension.qualifyingYears.minimum;
    const fullYears = this.constants.statePension.qualifyingYears.fullPension;
    
    // Calculate pension age based on birth year
    const pensionAge = this.getStatePensionAge(birthYear);
    
    // Calculate base pension amount
    let weeklyAmount = 0;
    let isFullPension = false;
    
    if (qualifyingYears >= fullYears) {
      weeklyAmount = fullPension.weekly;
      isFullPension = true;
    } else if (qualifyingYears >= minYears) {
      // Pro-rata calculation
      weeklyAmount = new Decimal(fullPension.weekly)
        .mul(qualifyingYears)
        .div(fullYears)
        .toNumber();
    }
    
    // Apply deferral increase if applicable
    let deferralOptions;
    if (deferYears > 0) {
      const weeksDeferred = deferYears * 52;
      const increaseRate = this.constants.statePension.deferral.increasePerWeek;
      const totalIncrease = new Decimal(1).plus(
        new Decimal(increaseRate).mul(weeksDeferred)
      );
      
      const increasedWeekly = new Decimal(weeklyAmount).mul(totalIncrease).toNumber();
      deferralOptions = {
        weeksDeferral: weeksDeferred,
        increasedWeekly,
        increasedAnnual: increasedWeekly * 52
      };
    }
    
    return {
      weeklyAmount,
      annualAmount: weeklyAmount * 52,
      qualifyingYears,
      yearsToFullPension: Math.max(0, fullYears - qualifyingYears),
      pensionAge,
      isFullPension,
      deferralOptions
    };
  }

  /**
   * Get State Pension age based on birth year
   */
  private getStatePensionAge(birthYear: number): number {
    const ages = this.constants.statePension.pensionAge;
    
    if (birthYear <= 1954) return ages.born1954OrEarlier;
    if (birthYear === 1955) return ages.born1955;
    if (birthYear === 1956) return ages.born1956;
    if (birthYear === 1957) return ages.born1957;
    if (birthYear === 1958) return ages.born1958;
    if (birthYear === 1959) return ages.born1959;
    return ages.born1960OrLater;
  }

  /**
   * Calculate workplace pension contributions and projections
   */
  calculateWorkplacePension(
    annualSalary: number,
    employeeRate: number = 0.05,
    employerRate: number = 0.03,
    currentAge: number,
    retirementAge: number,
    currentPot: number = 0,
    growthRate: number = 0.05
  ): WorkplacePensionCalculation {
    const autoEnroll = this.constants.workplacePension.autoEnrollment;
    
    // Calculate qualifying earnings
    const qualifyingEarnings = Math.min(
      Math.max(0, annualSalary - autoEnroll.qualifyingEarnings.lower),
      autoEnroll.qualifyingEarnings.upper - autoEnroll.qualifyingEarnings.lower
    );
    
    // Calculate contributions on qualifying earnings
    const employeeContribution = new Decimal(qualifyingEarnings)
      .mul(employeeRate)
      .div(12)
      .toNumber();
    
    const employerContribution = new Decimal(qualifyingEarnings)
      .mul(employerRate)
      .div(12)
      .toNumber();
    
    // Calculate tax relief (basic rate assumed, should check actual rate)
    const taxRelief = new Decimal(employeeContribution)
      .mul(this.constants.workplacePension.taxRelief.basicRate)
      .toNumber();
    
    const totalMonthlyContribution = employeeContribution + employerContribution + taxRelief;
    const netCost = employeeContribution - taxRelief;
    
    // Project future value
    const yearsToRetirement = retirementAge - currentAge;
    const monthsToRetirement = yearsToRetirement * 12;
    const monthlyGrowth = growthRate / 12;
    
    // Future value of current pot
    const currentPotFV = new Decimal(currentPot)
      .mul(new Decimal(1 + monthlyGrowth).pow(monthsToRetirement));
    
    // Future value of monthly contributions
    const contributionsFV = new Decimal(totalMonthlyContribution)
      .mul(new Decimal(1 + monthlyGrowth).pow(monthsToRetirement).minus(1))
      .div(monthlyGrowth);
    
    const projectedPot = currentPotFV.plus(contributionsFV).toNumber();
    
    return {
      employeeContribution,
      employerContribution,
      totalMonthlyContribution,
      taxRelief,
      netCost,
      projectedPot,
      qualifyingEarnings
    };
  }

  /**
   * Calculate ISA projections with tax benefits
   */
  calculateISAProjection(
    type: 'standard' | 'lifetime',
    annualContribution: number,
    currentAge: number,
    targetAge: number,
    currentValue: number = 0,
    growthRate: number = 0.05,
    marginalTaxRate: number = 0.20
  ): ISAProjection {
    const isaLimits = this.constants.isa;
    
    // Cap contribution at annual limit
    const actualContribution = Math.min(
      annualContribution,
      type === 'lifetime' ? isaLimits.lifetimeISA.annualLimit : isaLimits.annual.total
    );
    
    // Calculate government bonus for Lifetime ISA
    let governmentBonus = 0;
    if (type === 'lifetime' && currentAge < 40) {
      governmentBonus = actualContribution * isaLimits.lifetimeISA.governmentBonus;
      governmentBonus = Math.min(governmentBonus, isaLimits.lifetimeISA.maximumBonus);
    }
    
    const totalAnnualContribution = actualContribution + governmentBonus;
    const yearsToTarget = targetAge - currentAge;
    
    // Calculate future value
    const futureValue = this.calculateCompoundGrowth(
      currentValue,
      totalAnnualContribution,
      growthRate,
      yearsToTarget
    );
    
    // Calculate tax saved (what would have been paid on equivalent taxable investment)
    const totalContributed = actualContribution * yearsToTarget + currentValue;
    const totalGrowth = futureValue - totalContributed - (governmentBonus * yearsToTarget);
    const taxSaved = new Decimal(totalGrowth).mul(marginalTaxRate).toNumber();
    
    return {
      type,
      annualContribution: actualContribution,
      governmentBonus: type === 'lifetime' ? governmentBonus : undefined,
      projectedValue: futureValue,
      taxSaved
    };
  }

  /**
   * Calculate personal/SIPP pension projections
   */
  calculatePersonalPension(
    monthlyContribution: number,
    currentValue: number,
    currentAge: number,
    retirementAge: number,
    growthRate: number = 0.05,
    marginalTaxRate: number = 0.20
  ): any {
    // Annual allowance check
    const annualContribution = monthlyContribution * 12;
    const maxAllowance = this.constants.personalPension.annualAllowance;
    
    const actualAnnualContribution = Math.min(annualContribution, maxAllowance);
    const actualMonthlyContribution = actualAnnualContribution / 12;
    
    // Calculate tax relief
    const taxRelief = new Decimal(actualMonthlyContribution)
      .mul(marginalTaxRate)
      .toNumber();
    
    const totalMonthlyContribution = actualMonthlyContribution + taxRelief;
    const yearsToRetirement = retirementAge - currentAge;
    
    // Project future value
    const projectedValue = this.calculateCompoundGrowth(
      currentValue,
      totalMonthlyContribution * 12,
      growthRate,
      yearsToRetirement
    );
    
    return {
      currentValue,
      monthlyContribution: actualMonthlyContribution,
      taxRelief: taxRelief * 12, // Annual tax relief
      projectedValue,
      taxFreeAmount: projectedValue * this.constants.personalPension.taxFreeAmount,
      taxableAmount: projectedValue * (1 - this.constants.personalPension.taxFreeAmount)
    };
  }

  /**
   * Calculate complete UK retirement projection
   */
  calculateFullRetirementProjection(params: {
    currentAge: number;
    retirementAge: number;
    birthYear: number;
    qualifyingYears: number;
    annualSalary: number;
    currentPensionPot: number;
    monthlyPensionContribution: number;
    isaContribution: number;
    isaType: 'standard' | 'lifetime';
    currentISAValue: number;
    growthRate?: number;
  }): UKRetirementProjection {
    const {
      currentAge,
      retirementAge,
      birthYear,
      qualifyingYears,
      annualSalary,
      currentPensionPot,
      monthlyPensionContribution,
      isaContribution,
      isaType,
      currentISAValue,
      growthRate = 0.05
    } = params;
    
    // Calculate State Pension
    const statePension = this.calculateStatePension(qualifyingYears, birthYear);
    
    // Calculate Workplace Pension (if employed)
    let workplacePension;
    if (annualSalary > 0) {
      workplacePension = this.calculateWorkplacePension(
        annualSalary,
        0.05, // Default employee rate
        0.03, // Default employer rate
        currentAge,
        retirementAge,
        currentPensionPot,
        growthRate
      );
    }
    
    // Calculate Personal Pension
    let personalPension;
    if (monthlyPensionContribution > 0) {
      personalPension = this.calculatePersonalPension(
        monthlyPensionContribution,
        currentPensionPot,
        currentAge,
        retirementAge,
        growthRate
      );
    }
    
    // Calculate ISA
    let isa;
    if (isaContribution > 0) {
      isa = this.calculateISAProjection(
        isaType,
        isaContribution,
        currentAge,
        retirementAge,
        currentISAValue,
        growthRate
      );
    }
    
    // Calculate total retirement income (using 4% withdrawal rate)
    const withdrawalRate = 0.04;
    let totalPot = 0;
    
    if (workplacePension) totalPot += workplacePension.projectedPot;
    if (personalPension) totalPot += personalPension.projectedValue;
    if (isa) totalPot += isa.projectedValue;
    
    const privateIncome = totalPot * withdrawalRate;
    const totalAnnualIncome = statePension.annualAmount + privateIncome;
    
    // Calculate tax on retirement income
    const taxResult = taxDataService.calculateTax(totalAnnualIncome, 'UK', {
      taxYear: '2025-26'
    });
    
    return {
      statePension,
      workplacePension,
      personalPension,
      isa,
      totalRetirementIncome: {
        annual: totalAnnualIncome,
        monthly: totalAnnualIncome / 12,
        weekly: totalAnnualIncome / 52
      },
      taxOnRetirement: {
        incomeTax: taxResult.incomeTax,
        effectiveRate: taxResult.effectiveRate,
        netIncome: totalAnnualIncome - taxResult.incomeTax
      }
    };
  }

  /**
   * Helper function for compound growth calculations
   */
  private calculateCompoundGrowth(
    currentValue: number,
    annualContribution: number,
    growthRate: number,
    years: number
  ): number {
    // FV = PV(1 + r)^n + PMT * [((1 + r)^n - 1) / r]
    const futureValueCurrent = new Decimal(currentValue)
      .mul(new Decimal(1 + growthRate).pow(years));
    
    const futureValueContributions = new Decimal(annualContribution)
      .mul(new Decimal(1 + growthRate).pow(years).minus(1))
      .div(growthRate);
    
    return futureValueCurrent.plus(futureValueContributions).toNumber();
  }

  /**
   * Calculate National Insurance contributions and credits
   */
  calculateNIContributions(annualIncome: number, selfEmployed: boolean = false): {
    weeklyContribution: number;
    annualContribution: number;
    creditsEarned: boolean;
  } {
    const ni = this.constants.nationalInsurance;
    
    if (selfEmployed) {
      // Class 2 and 4 for self-employed
      let annualContribution = 0;
      
      // Class 2 (flat rate if above small profits threshold)
      if (annualIncome > ni.class2.smallProfitsThreshold) {
        annualContribution += ni.class2.rate * 52;
      }
      
      // Class 4 (on profits)
      if (annualIncome > ni.class4.lowerProfitsLimit) {
        const taxableAmount = Math.min(
          annualIncome - ni.class4.lowerProfitsLimit,
          ni.class4.upperProfitsLimit - ni.class4.lowerProfitsLimit
        );
        annualContribution += taxableAmount * ni.class4.mainRate;
        
        // Additional rate on income above upper limit
        if (annualIncome > ni.class4.upperProfitsLimit) {
          annualContribution += (annualIncome - ni.class4.upperProfitsLimit) * ni.class4.additionalRate;
        }
      }
      
      return {
        weeklyContribution: annualContribution / 52,
        annualContribution,
        creditsEarned: annualIncome > ni.class2.smallProfitsThreshold
      };
    } else {
      // Class 1 for employed
      const result = taxDataService.calculateTax(annualIncome, 'UK', {
        taxYear: '2025-26'
      });
      
      return {
        weeklyContribution: result.nationalInsurance / 52,
        annualContribution: result.nationalInsurance,
        creditsEarned: annualIncome >= ni.class1.primaryThreshold
      };
    }
  }
}

export const ukRetirementService = new UKRetirementService();