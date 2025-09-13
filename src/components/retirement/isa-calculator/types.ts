export interface ISACalculation {
  cashISA: {
    contribution: number;
    interestRate: number;
    projectedValue: number;
    taxSaved: number;
  };
  stocksISA: {
    contribution: number;
    expectedReturn: number;
    projectedValue: number;
    taxSaved: number;
  };
  lifetimeISA: {
    contribution: number;
    governmentBonus: number;
    totalContribution: number;
    projectedValue: number;
    earlyWithdrawalPenalty: number;
    netAfterPenalty: number;
    canUseForHome: boolean;
  };
  totalUsed: number;
  remainingAllowance: number;
  recommendation: string;
}

export interface ISAFormData {
  currentAge: number;
  retirementAge: number;
  totalToInvest: number;
  cashISAAmount: number;
  stocksISAAmount: number;
  lifetimeISAAmount: number;
  cashInterestRate: number;
  stocksExpectedReturn: number;
  currentTaxRate: number;
  buyingFirstHome: boolean;
  homePurchaseYear: number;
  homePrice: number;
  existingISABalance: number;
}

export const DEFAULT_FORM_DATA: ISAFormData = {
  currentAge: 30,
  retirementAge: 60,
  totalToInvest: 20000,
  cashISAAmount: 5000,
  stocksISAAmount: 11000,
  lifetimeISAAmount: 4000,
  cashInterestRate: 4.5,
  stocksExpectedReturn: 7,
  currentTaxRate: 20, // Basic rate
  buyingFirstHome: true,
  homePurchaseYear: 2,
  homePrice: 350000,
  existingISABalance: 0
};

// 2024-25 ISA limits (verified from official sources)
export const ISA_LIMITS = {
  ISA_ANNUAL_LIMIT: 20000,
  LIFETIME_ISA_LIMIT: 4000,
  LIFETIME_ISA_BONUS_RATE: 0.25, // 25% government bonus
  LIFETIME_ISA_MAX_BONUS: 1000, // Maximum £1,000 bonus per year
  LIFETIME_ISA_HOME_LIMIT: 450000, // Property price limit for first home
  LIFETIME_ISA_MIN_AGE: 18,
  LIFETIME_ISA_MAX_AGE: 39, // Can't open after 40
  LIFETIME_ISA_MAX_CONTRIBUTION_AGE: 50,
  LIFETIME_ISA_WITHDRAWAL_AGE: 60,
  LIFETIME_ISA_PENALTY_RATE: 0.25, // 25% penalty for early withdrawal
  JUNIOR_ISA_LIMIT: 9000 // For reference
};