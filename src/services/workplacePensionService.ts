export interface PensionContribution {
  employeeContribution: number;
  employerContribution: number;
  taxRelief: number;
  totalAnnualContribution: number;
  netCost: number;
  projectedPot: number;
  annualPension: number;
}

export interface PensionFormData {
  annualSalary: number;
  currentAge: number;
  retirementAge: number;
  currentPot: number;
  employeePercent: number;
  employerPercent: number;
  expectedReturn: number;
  taxRate: number;
  salaryExchange: boolean;
  qualifyingEarnings: boolean;
}

/**
 * Service for workplace pension calculations
 */
export class WorkplacePensionService {
  // UK 2024/25 qualifying earnings band
  static readonly LOWER_EARNINGS_LIMIT = 6240;
  static readonly UPPER_EARNINGS_LIMIT = 50270;
  static readonly ANNUAL_ALLOWANCE = 60000; // 2024/25 pension annual allowance
  static readonly LIFETIME_ALLOWANCE_ABOLISHED = true; // Abolished from April 2024

  /**
   * Calculate pensionable earnings based on salary and qualifying earnings band
   */
  static calculatePensionableEarnings(
    annualSalary: number,
    qualifyingEarnings: boolean
  ): number {
    if (!qualifyingEarnings) {
      return annualSalary;
    }

    // Only earnings between lower and upper limits count
    if (annualSalary > this.UPPER_EARNINGS_LIMIT) {
      return this.UPPER_EARNINGS_LIMIT - this.LOWER_EARNINGS_LIMIT;
    } else if (annualSalary > this.LOWER_EARNINGS_LIMIT) {
      return annualSalary - this.LOWER_EARNINGS_LIMIT;
    } else {
      return 0;
    }
  }

  /**
   * Calculate tax relief based on contribution method
   */
  static calculateTaxRelief(
    employeeContribution: number,
    taxRate: number,
    salaryExchange: boolean
  ): { taxRelief: number; netCost: number } {
    let taxRelief = 0;
    let netCost = employeeContribution;

    if (salaryExchange) {
      // Salary sacrifice - save on NI as well (12% for basic rate)
      const niSaving = employeeContribution * 0.12;
      taxRelief = (employeeContribution * taxRate / 100) + niSaving;
      netCost = employeeContribution - taxRelief;
    } else {
      // Relief at source - basic rate relief added to pension
      taxRelief = employeeContribution * 0.25; // 20% relief = 25% uplift
      netCost = employeeContribution; // But you pay full amount from net pay
    }

    return { taxRelief, netCost };
  }

  /**
   * Project future pension value
   */
  static projectFutureValue(
    currentPot: number,
    monthlyContribution: number,
    expectedReturn: number,
    yearsToRetirement: number
  ): number {
    const monthlyReturn = expectedReturn / 100 / 12;
    const months = yearsToRetirement * 12;

    // Future value with compound interest
    return currentPot * Math.pow(1 + monthlyReturn, months) +
      monthlyContribution * ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn);
  }

  /**
   * Calculate pension contributions and projections
   */
  static calculatePension(formData: PensionFormData): PensionContribution {
    const { 
      annualSalary, 
      employeePercent, 
      employerPercent,
      currentPot,
      currentAge,
      retirementAge,
      expectedReturn,
      taxRate,
      salaryExchange,
      qualifyingEarnings
    } = formData;

    // Calculate pensionable earnings
    const pensionableEarnings = this.calculatePensionableEarnings(
      annualSalary,
      qualifyingEarnings
    );

    // Calculate contributions
    const employeeContribution = (pensionableEarnings * employeePercent) / 100;
    const employerContribution = (pensionableEarnings * employerPercent) / 100;

    // Calculate tax relief
    const { taxRelief, netCost } = this.calculateTaxRelief(
      employeeContribution,
      taxRate,
      salaryExchange
    );

    // Total annual contribution (including tax relief for non-salary sacrifice)
    const totalAnnualContribution = employeeContribution + employerContribution + 
      (salaryExchange ? 0 : taxRelief);

    // Check against annual allowance
    const effectiveContribution = Math.min(totalAnnualContribution, this.ANNUAL_ALLOWANCE);

    // Project future value
    const yearsToRetirement = retirementAge - currentAge;
    const monthlyContribution = effectiveContribution / 12;
    
    const projectedPot = this.projectFutureValue(
      currentPot,
      monthlyContribution,
      expectedReturn,
      yearsToRetirement
    );

    // Estimate annual pension (using 4% withdrawal or annuity rate of ~5%)
    const annualPension = projectedPot * 0.05;

    return {
      employeeContribution,
      employerContribution,
      taxRelief,
      totalAnnualContribution: effectiveContribution,
      netCost,
      projectedPot,
      annualPension
    };
  }

  /**
   * Check if eligible for auto-enrollment
   */
  static isAutoEnrollmentEligible(
    annualSalary: number,
    currentAge: number,
    retirementAge: number
  ): boolean {
    return annualSalary >= 10000 && 
           currentAge >= 22 && 
           currentAge < retirementAge;
  }

  /**
   * Check if contributions meet minimum requirements
   */
  static meetsMinimumContribution(
    employeePercent: number,
    employerPercent: number
  ): boolean {
    const totalContribution = employeePercent + employerPercent;
    return totalContribution >= 8 && employerPercent >= 3;
  }
}

export const workplacePensionService = new WorkplacePensionService();