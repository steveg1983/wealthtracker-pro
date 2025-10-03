export interface IRAComparison {
  traditional: {
    contributionAmount: number;
    taxDeductionNow: number;
    netCostNow: number;
    projectedBalance: number;
    taxesOnWithdrawal: number;
    netWithdrawal: number;
    effectiveTaxRate: number;
    canDeduct: boolean;
    deductionPhaseOutAmount: number;
  };
  roth: {
    contributionAmount: number;
    taxPaidNow: number;
    netCostNow: number;
    projectedBalance: number;
    taxesOnWithdrawal: number;
    netWithdrawal: number;
    effectiveTaxRate: number;
    canContribute: boolean;
    contributionPhaseOutAmount: number;
  };
  recommendation: 'traditional' | 'roth' | 'both';
  difference: number;
}

export interface IRAFormData {
  currentAge: number;
  retirementAge: number;
  annualContribution: number;
  currentBalance: number;
  expectedReturn: number;
  currentIncome: number;
  retirementIncome: number;
  filingStatus: 'single' | 'married' | 'marriedSeparate';
  currentTaxRate: number;
  retirementTaxRate: number;
  hasWorkplacePlan: boolean;
  spouseHasWorkplacePlan: boolean;
}

export const DEFAULT_FORM_DATA: IRAFormData = {
  currentAge: 35,
  retirementAge: 65,
  annualContribution: 7000,
  currentBalance: 0,
  expectedReturn: 7,
  currentIncome: 75000,
  retirementIncome: 60000,
  filingStatus: 'single',
  currentTaxRate: 22,
  retirementTaxRate: 12,
  hasWorkplacePlan: false,
  spouseHasWorkplacePlan: false
};

// 2024 IRS limits (verified from official sources)
export const IRA_LIMITS = {
  CONTRIBUTION_LIMIT: 7000,
  CATCH_UP_LIMIT: 1000, // age 50+
  CATCH_UP_AGE: 50
};

// 2024 Roth IRA income phase-out ranges (official IRS)
export const ROTH_PHASE_OUT = {
  single: { start: 146000, end: 161000 },
  married: { start: 230000, end: 240000 },
  marriedSeparate: { start: 0, end: 10000 }
};

// 2024 Traditional IRA deduction phase-out ranges (official IRS)
export const TRADITIONAL_PHASE_OUT = {
  single: { start: 77000, end: 87000 },
  married: { start: 123000, end: 143000 }, // when contributor has workplace plan
  marriedSpouseOnly: { start: 230000, end: 240000 } // when only spouse has plan
};