/**
 * 401(k) Retirement Calculator Service
 * Business logic for 401k calculations and projections
 */

export interface Contribution401k {
  employeeContribution: number;
  employerMatch: number;
  totalAnnualContribution: number;
  taxSavings: number;
  netCost: number;
  projectedBalance: number;
}

export interface Retirement401kFormData {
  annualSalary: number;
  currentAge: number;
  retirementAge: number;
  currentBalance: number;
  contributionPercent: number;
  employerMatchPercent: number;
  employerMatchLimit: number;
  expectedReturn: number;
  taxRate: number;
}

class Retirement401kService {
  // IRS 2024 limits
  private readonly CONTRIBUTION_LIMIT_2024 = 23000;
  private readonly CATCH_UP_LIMIT = 7500;

  /**
   * Get maximum contribution based on age
   */
  getMaxContribution(age: number): number {
    const isEligibleForCatchUp = age >= 50;
    return this.CONTRIBUTION_LIMIT_2024 + (isEligibleForCatchUp ? this.CATCH_UP_LIMIT : 0);
  }

  /**
   * Check if eligible for catch-up contributions
   */
  isEligibleForCatchUp(age: number): boolean {
    return age >= 50;
  }

  /**
   * Get contribution limits
   */
  getContributionLimits() {
    return {
      regular: this.CONTRIBUTION_LIMIT_2024,
      catchUp: this.CATCH_UP_LIMIT
    };
  }

  /**
   * Calculate 401k contributions and projections
   */
  calculateContribution(formData: Retirement401kFormData): Contribution401k {
    const { 
      annualSalary, 
      contributionPercent, 
      employerMatchPercent, 
      employerMatchLimit,
      currentBalance,
      currentAge,
      retirementAge,
      expectedReturn,
      taxRate
    } = formData;

    const maxContribution = this.getMaxContribution(currentAge);

    // Calculate employee contribution
    const employeeContribution = Math.min(
      (annualSalary * contributionPercent) / 100,
      maxContribution
    );

    // Calculate employer match
    const effectiveMatchPercent = Math.min(contributionPercent, employerMatchLimit);
    const employerMatch = (annualSalary * effectiveMatchPercent * employerMatchPercent) / 10000;

    // Total annual contribution
    const totalAnnualContribution = employeeContribution + employerMatch;

    // Tax savings (traditional 401k)
    const taxSavings = employeeContribution * (taxRate / 100);

    // Net cost to employee (after tax savings)
    const netCost = employeeContribution - taxSavings;

    // Project future balance
    const projectedBalance = this.projectFutureBalance(
      currentBalance,
      totalAnnualContribution,
      currentAge,
      retirementAge,
      expectedReturn
    );

    return {
      employeeContribution,
      employerMatch,
      totalAnnualContribution,
      taxSavings,
      netCost,
      projectedBalance
    };
  }

  /**
   * Project future balance with compound interest
   */
  private projectFutureBalance(
    currentBalance: number,
    annualContribution: number,
    currentAge: number,
    retirementAge: number,
    expectedReturn: number
  ): number {
    const yearsToRetirement = retirementAge - currentAge;
    const monthlyContribution = annualContribution / 12;
    const monthlyReturn = expectedReturn / 100 / 12;
    const months = yearsToRetirement * 12;

    // Future value with compound interest
    const futureValue = currentBalance * Math.pow(1 + monthlyReturn, months) +
      monthlyContribution * ((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn);

    return futureValue;
  }

  /**
   * Get employer match description
   */
  getMatchDescription(employerMatchPercent: number, employerMatchLimit: number): string {
    return `${employerMatchPercent}% match on first ${employerMatchLimit}% of salary`;
  }

  /**
   * Calculate effective match rate
   */
  getEffectiveMatchRate(
    contributionPercent: number,
    employerMatchPercent: number,
    employerMatchLimit: number
  ): number {
    if (contributionPercent >= employerMatchLimit) {
      return (employerMatchLimit * employerMatchPercent) / 100;
    }
    return (contributionPercent * employerMatchPercent) / 100;
  }

  /**
   * Check if contributing below match limit
   */
  isBelowMatchLimit(contributionPercent: number, employerMatchLimit: number): boolean {
    return contributionPercent < employerMatchLimit;
  }

  /**
   * Calculate lost employer match
   */
  calculateLostMatch(
    annualSalary: number,
    contributionPercent: number,
    employerMatchPercent: number,
    employerMatchLimit: number
  ): number {
    if (contributionPercent >= employerMatchLimit) {
      return 0;
    }
    
    return (annualSalary * (employerMatchLimit - contributionPercent) * employerMatchPercent) / 10000;
  }

  /**
   * Get default form values
   */
  getDefaultFormData(): Retirement401kFormData {
    return {
      annualSalary: 75000,
      currentAge: 30,
      retirementAge: 65,
      currentBalance: 25000,
      contributionPercent: 6,
      employerMatchPercent: 50,
      employerMatchLimit: 6,
      expectedReturn: 7,
      taxRate: 22
    };
  }

  /**
   * Validate form data
   */
  validateFormData(formData: Retirement401kFormData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (formData.annualSalary < 0) {
      errors.push('Annual salary must be positive');
    }

    if (formData.contributionPercent < 0 || formData.contributionPercent > 100) {
      errors.push('Contribution percentage must be between 0 and 100');
    }

    if (formData.currentAge >= formData.retirementAge) {
      errors.push('Retirement age must be greater than current age');
    }

    if (formData.expectedReturn < 0 || formData.expectedReturn > 20) {
      errors.push('Expected return should be between 0% and 20%');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Alias for getDefaultFormData for backward compatibility
   */
  getInitialFormData(): Retirement401kFormData {
    return this.getDefaultFormData();
  }

  /**
   * Check if leaving money on the table (not getting full employer match)
   */
  isLeavingMoneyOnTable(contributionPercent: number, employerMatchLimit: number): boolean {
    return this.isBelowMatchLimit(contributionPercent, employerMatchLimit);
  }

  /**
   * Get contribution recommendation
   */
  getContributionRecommendation(
    contributionPercent: number,
    employerMatchLimit: number,
    maxContribution: number,
    annualSalary: number
  ): string {
    if (contributionPercent < employerMatchLimit) {
      return `Consider increasing to at least ${employerMatchLimit}% to get full employer match`;
    }
    
    const maxPercent = (maxContribution / annualSalary) * 100;
    if (contributionPercent < maxPercent) {
      return `You could contribute up to ${maxPercent.toFixed(1)}% to maximize tax benefits`;
    }
    
    return 'You are maximizing your 401(k) contribution!';
  }
}

export const retirement401kService = new Retirement401kService();