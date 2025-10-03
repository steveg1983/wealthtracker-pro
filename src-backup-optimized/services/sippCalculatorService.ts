import Decimal from 'decimal.js';

export interface SIPPProjection {
  age: number;
  year: number;
  contribution: number;
  taxRelief: number;
  employerContribution: number;
  growth: number;
  balance: number;
  cumulativeContributions: number;
  cumulativeTaxRelief: number;
}

export interface DrawdownScenario {
  rate: number;
  annualDrawdown: number;
  monthlyIncome: number;
  yearsItWillLast: number;
  sustainableToAge: number;
}

export interface DrawdownStrategy {
  type: 'percentage' | 'fixed' | 'dynamic';
  value: number;
  preserveCapital: boolean;
}

export interface SIPPInputs {
  currentAge: number;
  retirementAge: number;
  currentBalance: number;
  monthlyContribution: number;
  employerContribution: number;
  annualGrowthRate: number;
  inflationRate: number;
  taxBand: 'basic' | 'higher' | 'additional';
}

/**
 * Service for SIPP (Self-Invested Personal Pension) calculations
 */
export class SIPPCalculatorService {
  // UK tax relief rates
  static readonly TAX_RELIEF_RATES = {
    basic: 0.20,
    higher: 0.40,
    additional: 0.45
  };

  // Annual allowance for 2024/25
  static readonly ANNUAL_ALLOWANCE = 60000;
  static readonly LIFETIME_ALLOWANCE = 1073100; // Abolished but still relevant for some
  static readonly MINIMUM_PENSION_AGE = 55; // Rising to 57 in 2028
  static readonly TAX_FREE_PERCENTAGE = 0.25;
  static readonly RECOMMENDED_WITHDRAWAL_RATE = 4;

  /**
   * Get tax relief rate based on tax band
   */
  static getTaxReliefRate(taxBand: 'basic' | 'higher' | 'additional'): number {
    return this.TAX_RELIEF_RATES[taxBand];
  }

  /**
   * Calculate SIPP projection over years
   */
  static calculateProjection(inputs: SIPPInputs): SIPPProjection[] {
    const years = inputs.retirementAge - inputs.currentAge;
    if (years <= 0) return [];

    const projections: SIPPProjection[] = [];
    let balance = new Decimal(inputs.currentBalance);
    let cumulativeContributions = new Decimal(0);
    let cumulativeTaxRelief = new Decimal(0);
    const taxReliefRate = this.getTaxReliefRate(inputs.taxBand);

    for (let year = 1; year <= years; year++) {
      const age = inputs.currentAge + year;
      const yearlyContribution = new Decimal(inputs.monthlyContribution).times(12);
      const yearlyEmployerContribution = new Decimal(inputs.employerContribution).times(12);
      
      // Calculate tax relief (government adds this to your contribution)
      const grossContribution = yearlyContribution.div(1 - taxReliefRate);
      const taxRelief = grossContribution.minus(yearlyContribution);
      
      // Total annual contribution (capped at annual allowance)
      const totalContribution = Decimal.min(
        grossContribution.plus(yearlyEmployerContribution),
        this.ANNUAL_ALLOWANCE
      );
      
      // Apply growth
      const growth = balance.times(inputs.annualGrowthRate);
      balance = balance.plus(totalContribution).plus(growth);
      
      cumulativeContributions = cumulativeContributions.plus(yearlyContribution).plus(yearlyEmployerContribution);
      cumulativeTaxRelief = cumulativeTaxRelief.plus(taxRelief);
      
      projections.push({
        age,
        year: new Date().getFullYear() + year,
        contribution: yearlyContribution.toNumber(),
        taxRelief: taxRelief.toNumber(),
        employerContribution: yearlyEmployerContribution.toNumber(),
        growth: growth.toNumber(),
        balance: balance.toNumber(),
        cumulativeContributions: cumulativeContributions.toNumber(),
        cumulativeTaxRelief: cumulativeTaxRelief.toNumber()
      });
    }

    return projections;
  }

  /**
   * Calculate drawdown scenarios
   */
  static calculateDrawdownScenarios(
    finalBalance: number, 
    drawdownAge: number
  ): DrawdownScenario[] | null {
    if (finalBalance <= 0) return null;

    const scenarios: DrawdownScenario[] = [];
    const rates = [3, 4, 5, 6];
    
    for (const rate of rates) {
      const annualDrawdown = finalBalance * (rate / 100);
      const monthlyIncome = annualDrawdown / 12;
      const yearsItWillLast = rate === 0 ? Infinity : finalBalance / annualDrawdown;
      
      scenarios.push({
        rate,
        annualDrawdown,
        monthlyIncome,
        yearsItWillLast,
        sustainableToAge: drawdownAge + Math.floor(yearsItWillLast)
      });
    }
    
    return scenarios;
  }

  /**
   * Calculate tax-free lump sum and remaining for drawdown
   */
  static calculateTaxFreeAmounts(finalBalance: number): {
    taxFreeLumpSum: number;
    remainingForDrawdown: number;
  } {
    return {
      taxFreeLumpSum: finalBalance * this.TAX_FREE_PERCENTAGE,
      remainingForDrawdown: finalBalance * (1 - this.TAX_FREE_PERCENTAGE)
    };
  }

  /**
   * Check if can access pension now
   */
  static canAccessPension(currentAge: number): {
    canAccessNow: boolean;
    yearsUntilAccess: number;
  } {
    return {
      canAccessNow: currentAge >= this.MINIMUM_PENSION_AGE,
      yearsUntilAccess: Math.max(0, this.MINIMUM_PENSION_AGE - currentAge)
    };
  }

  /**
   * Check if annual allowance is exceeded
   */
  static isAnnualAllowanceExceeded(
    monthlyContribution: number,
    employerContribution: number
  ): boolean {
    const totalAnnual = (monthlyContribution * 12) + (employerContribution * 12);
    return totalAnnual > this.ANNUAL_ALLOWANCE;
  }

  /**
   * Get sustainable monthly income
   */
  static getSustainableMonthlyIncome(finalBalance: number): number {
    return (finalBalance * (this.RECOMMENDED_WITHDRAWAL_RATE / 100)) / 12;
  }
}