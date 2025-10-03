import Decimal from 'decimal.js';

export interface MedicarePlan {
  partA: {
    premium: number;
    deductible: number;
    coverage: number; // 0 = none, 30 = 30-39 quarters, 40 = 40+ quarters
  };
  partB: {
    enrolled: boolean;
    income: number;
    filingStatus: 'single' | 'married_joint' | 'married_separate';
  };
  partD: {
    enrolled: boolean;
    planCost: number;
    income: number;
  };
  supplemental: {
    type: 'none' | 'medigap' | 'advantage';
    planCost: number;
  };
}

export interface MedicareCosts {
  partA: number;
  partB: number;
  partD: number;
  supplemental: number;
  total: number;
  annual: number;
}

// 2024 Medicare Part A costs from CMS
export const PART_A_2024 = {
  deductible: 1632,
  premiums: {
    0: 505,     // less than 30 quarters
    30: 278,    // 30-39 quarters  
    40: 0       // 40+ quarters (most people)
  },
  coinsurance: {
    days_61_90: 408,
    lifetime_reserve: 816,
    snf_21_100: 204
  }
};

// 2024 Medicare Part B costs from CMS
export const PART_B_2024 = {
  standard_premium: 174.70,
  deductible: 240,
  irmaa_brackets: {
    single: [
      { min: 0, max: 103000, premium: 174.70 },
      { min: 103000, max: 129000, premium: 244.60 },
      { min: 129000, max: 161000, premium: 349.40 },
      { min: 161000, max: 193000, premium: 454.20 },
      { min: 193000, max: 500000, premium: 559.00 },
      { min: 500000, max: Infinity, premium: 594.00 }
    ],
    married_joint: [
      { min: 0, max: 206000, premium: 174.70 },
      { min: 206000, max: 258000, premium: 244.60 },
      { min: 258000, max: 322000, premium: 349.40 },
      { min: 322000, max: 386000, premium: 454.20 },
      { min: 386000, max: 750000, premium: 559.00 },
      { min: 750000, max: Infinity, premium: 594.00 }
    ],
    married_separate: [
      { min: 0, max: 103000, premium: 174.70 },
      { min: 103000, max: 397000, premium: 559.00 },
      { min: 397000, max: Infinity, premium: 594.00 }
    ]
  }
};

// 2024 Medicare Part D costs from CMS
export const PART_D_2024 = {
  average_premium: 55.50,
  irmaa_brackets: {
    single: [
      { min: 0, max: 103000, adjustment: 0 },
      { min: 103000, max: 129000, adjustment: 12.90 },
      { min: 129000, max: 161000, adjustment: 33.30 },
      { min: 161000, max: 193000, adjustment: 53.80 },
      { min: 193000, max: 500000, adjustment: 74.20 },
      { min: 500000, max: Infinity, adjustment: 81.00 }
    ],
    married_joint: [
      { min: 0, max: 206000, adjustment: 0 },
      { min: 206000, max: 258000, adjustment: 12.90 },
      { min: 258000, max: 322000, adjustment: 33.30 },
      { min: 322000, max: 386000, adjustment: 53.80 },
      { min: 386000, max: 750000, adjustment: 74.20 },
      { min: 750000, max: Infinity, adjustment: 81.00 }
    ],
    married_separate: [
      { min: 0, max: 103000, adjustment: 0 },
      { min: 103000, max: 397000, adjustment: 74.20 },
      { min: 397000, max: Infinity, adjustment: 81.00 }
    ]
  }
};

/**
 * Service for Medicare cost calculations
 */
export class MedicareCalculationService {
  /**
   * Calculate Part B premium based on income
   */
  static calculatePartBPremium(income: number, filingStatus: string): number {
    const brackets = PART_B_2024.irmaa_brackets[filingStatus as keyof typeof PART_B_2024.irmaa_brackets];
    const bracket = brackets.find(b => income >= b.min && income < b.max);
    return bracket ? bracket.premium : PART_B_2024.standard_premium;
  }

  /**
   * Calculate Part D adjustment based on income
   */
  static calculatePartDAdjustment(income: number, filingStatus: string): number {
    const brackets = PART_D_2024.irmaa_brackets[filingStatus as keyof typeof PART_D_2024.irmaa_brackets];
    const bracket = brackets.find(b => income >= b.min && income < b.max);
    return bracket ? bracket.adjustment : 0;
  }

  /**
   * Calculate all Medicare costs
   */
  static calculateCosts(plan: MedicarePlan): MedicareCosts {
    const partAPremium = PART_A_2024.premiums[plan.partA.coverage as keyof typeof PART_A_2024.premiums] || 0;
    const partBPremium = plan.partB.enrolled ? 
      this.calculatePartBPremium(plan.partB.income, plan.partB.filingStatus) : 0;
    const partDAdjustment = plan.partD.enrolled ? 
      this.calculatePartDAdjustment(plan.partB.income, plan.partB.filingStatus) : 0;
    const partDTotal = plan.partD.enrolled ? plan.partD.planCost + partDAdjustment : 0;
    const supplementalCost = plan.supplemental.type !== 'none' ? plan.supplemental.planCost : 0;

    const monthlyTotal = new Decimal(partAPremium)
      .plus(partBPremium)
      .plus(partDTotal)
      .plus(supplementalCost)
      .toNumber();

    return {
      partA: partAPremium,
      partB: partBPremium,
      partD: partDTotal,
      supplemental: supplementalCost,
      total: monthlyTotal,
      annual: monthlyTotal * 12
    };
  }

  /**
   * Format currency for display
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
}

export const medicareCalculationService = new MedicareCalculationService();