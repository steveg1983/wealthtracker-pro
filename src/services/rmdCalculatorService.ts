import Decimal from 'decimal.js';

export interface RMDCalculation {
  age: number;
  accountBalance: number;
  accountType: '401k' | 'traditionalIRA' | 'sepIRA' | 'simpleIRA' | '403b' | '457b';
  birthYear: number;
  spouseBeneficiary: boolean;
  spouseAge?: number;
  stillWorking: boolean;
}

export interface RMDResults {
  rmdAmount: number;
  distributionFactor: number;
  rmdAge: number;
  firstRMDDeadline: string;
  annualDeadline: string;
  penalty: number;
  taxEstimate: number;
  projections: Array<{ age: number; balance: number; rmd: number }>;
}

/**
 * Service for calculating Required Minimum Distributions (RMDs)
 */
export class RMDCalculatorService {
  // IRS Uniform Lifetime Table (Publication 590-B)
  // Updated for 2022 and later (SECURE Act changes)
  private static readonly UNIFORM_LIFETIME_TABLE: Record<number, number> = {
    72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6,
    76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
    80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
    84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
    88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5,
    92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
    96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8,
    100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2,
    104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1,
    108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4,
    112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9,
    116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3,
    120: 2.0 // 120 and older
  };

  /**
   * Determine RMD age based on birth year (SECURE Act 2.0)
   */
  static getRMDAge(birthYear: number): number {
    if (birthYear <= 1950) return 72;
    if (birthYear >= 1951 && birthYear <= 1959) return 73;
    return 75; // Born 1960 or later
  }

  /**
   * Get distribution factor based on age and beneficiary status
   */
  static getDistributionFactor(
    age: number, 
    spouseBeneficiary: boolean, 
    spouseAge?: number
  ): number {
    // If spouse is sole beneficiary and more than 10 years younger, use Joint Life Table
    if (spouseBeneficiary && spouseAge && (age - spouseAge) > 10) {
      // Simplified calculation - in practice would use full Joint Life Table
      const ageDiff = age - spouseAge;
      return this.UNIFORM_LIFETIME_TABLE[age] + (ageDiff - 10) * 0.5; // Approximate
    }
    
    // Use Uniform Lifetime Table for most cases
    if (age >= 120) return this.UNIFORM_LIFETIME_TABLE[120];
    return this.UNIFORM_LIFETIME_TABLE[age] || 27.4;
  }

  /**
   * Check if still working exemption applies
   */
  static isStillWorkingExempt(
    stillWorking: boolean,
    accountType: string
  ): boolean {
    return stillWorking && (accountType === '401k' || accountType === '403b');
  }

  /**
   * Calculate RMD amount
   */
  static calculateRMD(
    accountBalance: number,
    distributionFactor: number
  ): number {
    return new Decimal(accountBalance).dividedBy(distributionFactor).toNumber();
  }

  /**
   * Calculate penalty for missed RMD
   */
  static calculatePenalty(rmdAmount: number): number {
    // 25% of RMD not taken (SECURE Act 2.0), reduced to 10% if corrected within 2 years
    return new Decimal(rmdAmount).times(0.25).toNumber();
  }

  /**
   * Estimate taxes on RMD
   */
  static estimateTaxes(rmdAmount: number, taxRate: number = 0.22): number {
    return new Decimal(rmdAmount).times(taxRate).toNumber();
  }

  /**
   * Get first RMD deadline
   */
  static getFirstRMDDeadline(
    birthYear: number,
    currentAge: number,
    rmdAge: number,
    currentYear: number
  ): string {
    const firstRMDYear = birthYear + rmdAge;
    return currentAge === rmdAge 
      ? `April 1, ${firstRMDYear + 1}` 
      : `December 31, ${currentYear}`;
  }

  /**
   * Generate multi-year RMD projections
   */
  static generateProjections(
    calculation: RMDCalculation,
    rmdAge: number,
    years: number = 10,
    growthRate: number = 0.05
  ): Array<{ age: number; balance: number; rmd: number }> {
    const projections: Array<{ age: number; balance: number; rmd: number }> = [];
    let projectedBalance = calculation.accountBalance;
    const currentAge = calculation.age;

    for (let i = 0; i < years; i++) {
      const projectedAge = currentAge + i;
      if (projectedAge >= rmdAge) {
        const projectedFactor = this.getDistributionFactor(
          projectedAge,
          calculation.spouseBeneficiary,
          calculation.spouseAge ? calculation.spouseAge + i : undefined
        );
        const projectedRMD = projectedBalance / projectedFactor;
        
        projections.push({
          age: projectedAge,
          balance: projectedBalance,
          rmd: projectedRMD
        });

        // Update balance for next year (growth minus RMD)
        projectedBalance = (projectedBalance - projectedRMD) * (1 + growthRate);
      }
    }

    return projections;
  }

  /**
   * Calculate complete RMD results
   */
  static calculateResults(
    calculation: RMDCalculation,
    currentYear: number
  ): RMDResults {
    const rmdAge = this.getRMDAge(calculation.birthYear);
    const currentAge = calculation.age;
    
    // Check if RMD is required
    if (currentAge < rmdAge) {
      return {
        rmdAmount: 0,
        distributionFactor: 0,
        rmdAge,
        firstRMDDeadline: `April 1, ${calculation.birthYear + rmdAge + 1}`,
        annualDeadline: 'December 31',
        penalty: 0,
        taxEstimate: 0,
        projections: []
      };
    }

    // Check still working exemption
    if (this.isStillWorkingExempt(calculation.stillWorking, calculation.accountType)) {
      return {
        rmdAmount: 0,
        distributionFactor: 0,
        rmdAge,
        firstRMDDeadline: 'April 1 of year after retirement',
        annualDeadline: 'December 31',
        penalty: 0,
        taxEstimate: 0,
        projections: []
      };
    }

    // Calculate distribution factor
    const factor = this.getDistributionFactor(
      currentAge,
      calculation.spouseBeneficiary,
      calculation.spouseAge
    );

    // Calculate RMD amount
    const rmdAmount = this.calculateRMD(calculation.accountBalance, factor);

    // Calculate penalty and taxes
    const penalty = this.calculatePenalty(rmdAmount);
    const taxEstimate = this.estimateTaxes(rmdAmount);

    // Get deadlines
    const firstRMDDeadline = this.getFirstRMDDeadline(
      calculation.birthYear,
      currentAge,
      rmdAge,
      currentYear
    );

    // Generate projections
    const projections = this.generateProjections(calculation, rmdAge);

    return {
      rmdAmount,
      distributionFactor: factor,
      rmdAge,
      firstRMDDeadline,
      annualDeadline: 'December 31',
      penalty,
      taxEstimate,
      projections
    };
  }

  /**
   * Get account type options
   */
  static getAccountTypes() {
    return [
      { value: 'traditionalIRA', label: 'Traditional IRA' },
      { value: '401k', label: '401(k)' },
      { value: '403b', label: '403(b)' },
      { value: '457b', label: '457(b)' },
      { value: 'sepIRA', label: 'SEP IRA' },
      { value: 'simpleIRA', label: 'SIMPLE IRA' }
    ];
  }
}

export const rmdCalculatorService = new RMDCalculatorService();