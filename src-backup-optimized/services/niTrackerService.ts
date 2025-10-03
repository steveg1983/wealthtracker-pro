import Decimal from 'decimal.js';

export interface NIYear {
  year: string;
  status: 'paid' | 'credited' | 'gap' | 'future';
  contractedOut?: boolean;
}

export interface NITrackerData {
  birthYear: number;
  currentAge: number;
  workStartYear: number;
  statePensionAge: number;
  years: NIYear[];
  voluntaryContributions: {
    yearsToBuy: string[];
    currentCost: number;
  };
}

export interface NICalculationResults {
  qualifyingYears: number;
  gapYears: number;
  projectedYears: number;
  totalExpectedYears: number;
  weeklyPension: number;
  annualPension: number;
  percentageOfFull: number;
  canBuyYears: string[];
  costToBuyGaps: number;
  additionalPensionFromBuying: number;
}

// 2024-25 State Pension rates
export const STATE_PENSION_2024 = {
  fullWeekly: 221.20,  // £221.20 per week for 2024-25
  fullAnnual: 11502.40, // £11,502.40 per year
  minYearsForAny: 10,
  fullYears: 35,
  voluntaryContributionCost: 907.40 // £17.45 per week × 52 weeks for 2024-25
};

/**
 * Service for managing National Insurance years tracking and State Pension calculations
 */
export class NITrackerService {
  /**
   * Get State Pension age based on birth year and gender
   */
  static getStatePensionAge(birthYear: number, gender: 'male' | 'female'): number {
    // Post-2020 rules (equalised for men and women)
    if (birthYear >= 1977) return 68;
    if (birthYear >= 1961) return 67;
    if (birthYear >= 1960) return 66;
    
    // Historical differences (simplified)
    if (gender === 'female' && birthYear < 1950) return 60;
    if (gender === 'male' && birthYear < 1954) return 65;
    
    // Transition period
    return 66;
  }

  /**
   * Generate NI years based on work history
   */
  static generateNIYears(
    workStartYear: number,
    currentYear: number,
    includeFutureYears: number = 5
  ): NIYear[] {
    const years: NIYear[] = [];
    const endYear = currentYear + includeFutureYears;
    
    for (let year = workStartYear; year <= endYear; year++) {
      const taxYear = `${year}-${(year + 1).toString().slice(2)}`;
      
      if (year <= currentYear) {
        // Past and current years - for demo, generate random gaps
        const isGap = Math.random() < 0.1; // 10% chance of gap
        years.push({
          year: taxYear,
          status: isGap ? 'gap' : 'paid',
          contractedOut: year < 2016 && Math.random() < 0.3 // 30% contracted out pre-2016
        });
      } else {
        // Future years
        years.push({
          year: taxYear,
          status: 'future'
        });
      }
    }
    
    return years;
  }

  /**
   * Calculate NI results and State Pension projections
   */
  static calculateResults(
    trackerData: NITrackerData,
    currentYear: number
  ): NICalculationResults {
    const qualifyingYears = trackerData.years.filter(y => 
      y.status === 'paid' || y.status === 'credited'
    ).length;
    
    const gapYears = trackerData.years.filter(y => y.status === 'gap').length;
    
    const yearsUntilPension = trackerData.statePensionAge - trackerData.currentAge;
    const projectedFutureYears = Math.max(0, Math.min(
      yearsUntilPension, 
      trackerData.years.filter(y => y.status === 'future').length
    ));
    
    const totalExpectedYears = qualifyingYears + projectedFutureYears;
    
    // Calculate pension amount
    let effectiveYears = Math.min(totalExpectedYears, STATE_PENSION_2024.fullYears);
    
    // Adjust for contracting out (simplified)
    const contractedOutYears = trackerData.years.filter(y => y.contractedOut).length;
    if (contractedOutYears > 0) {
      effectiveYears = Math.max(0, effectiveYears - (contractedOutYears * 0.2));
    }
    
    const weeklyPension = totalExpectedYears < STATE_PENSION_2024.minYearsForAny 
      ? 0 
      : (STATE_PENSION_2024.fullWeekly / STATE_PENSION_2024.fullYears) * effectiveYears;
    
    const annualPension = weeklyPension * 52;
    const percentageOfFull = (weeklyPension / STATE_PENSION_2024.fullWeekly) * 100;
    
    // Identify years that can be bought (last 6 years only)
    const sixYearsAgo = currentYear - 6;
    const canBuyYears = trackerData.years
      .filter(y => {
        const yearNum = parseInt(y.year.split('-')[0]);
        return y.status === 'gap' && yearNum >= sixYearsAgo && yearNum <= currentYear;
      })
      .map(y => y.year);
    
    const costToBuyGaps = canBuyYears.length * STATE_PENSION_2024.voluntaryContributionCost;
    
    // Calculate additional pension from buying gap years
    const newTotalYears = Math.min(
      qualifyingYears + canBuyYears.length + projectedFutureYears,
      STATE_PENSION_2024.fullYears
    );
    const newWeeklyPension = (STATE_PENSION_2024.fullWeekly / STATE_PENSION_2024.fullYears) * newTotalYears;
    const additionalWeekly = newWeeklyPension - weeklyPension;
    const additionalAnnual = additionalWeekly * 52;
    
    return {
      qualifyingYears,
      gapYears,
      projectedYears: projectedFutureYears,
      totalExpectedYears,
      weeklyPension,
      annualPension,
      percentageOfFull,
      canBuyYears,
      costToBuyGaps,
      additionalPensionFromBuying: additionalAnnual
    };
  }

  /**
   * Format currency for UK pounds
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Create default tracker data
   */
  static createDefaultTrackerData(currentYear: number): NITrackerData {
    const birthYear = 1970;
    const workStartYear = 1988;
    
    return {
      birthYear,
      currentAge: currentYear - birthYear,
      workStartYear,
      statePensionAge: 67,
      years: [],
      voluntaryContributions: {
        yearsToBuy: [],
        currentCost: STATE_PENSION_2024.voluntaryContributionCost
      }
    };
  }

  /**
   * Validate tracker data
   */
  static validateTrackerData(data: NITrackerData): boolean {
    if (data.birthYear < 1900 || data.birthYear > new Date().getFullYear()) {
      return false;
    }
    
    if (data.workStartYear < data.birthYear + 16) {
      return false; // Can't work before age 16
    }
    
    if (data.statePensionAge < 60 || data.statePensionAge > 70) {
      return false;
    }
    
    return true;
  }

  /**
   * Calculate payback period for voluntary contributions
   */
  static calculatePaybackPeriod(cost: number, additionalAnnualPension: number): number {
    if (additionalAnnualPension === 0) return Infinity;
    return new Decimal(cost).div(additionalAnnualPension).toNumber();
  }
}