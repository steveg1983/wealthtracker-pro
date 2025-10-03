/**
 * US Retirement Service Types
 * Type definitions for US retirement calculations
 */

export interface SocialSecurityCalculation {
  monthlyBenefit: number;
  annualBenefit: number;
  fullRetirementAge: number;
  claimingAge: number;
  reduction: number; // Percentage reduction if claiming early
  credits: number; // Number of quarters earned
  eligible: boolean;
  breakEvenAge?: number; // Age where early claiming catches up to FRA
}

export interface Retirement401kCalculation {
  employeeContribution: number;
  employerMatch: number;
  totalMonthlyContribution: number;
  annualContribution: number;
  projectedBalance: number;
  vestedAmount: number;
  taxDeferred: number;
  catchUpEligible: boolean;
  catchUpAmount?: number;
}

export interface IRACalculation {
  type: 'traditional' | 'roth';
  monthlyContribution: number;
  annualContribution: number;
  taxBenefit: number; // Deduction for traditional, or tax-free growth for Roth
  projectedBalance: number;
  deductible: boolean; // For traditional IRA
  phaseOut?: { // Income phase-out status
    percentage: number;
    reduced: boolean;
  };
}

export interface MedicareEstimate {
  eligibilityAge: number;
  partAPremium: number;
  partBPremium: number;
  partDPremium: number;
  totalMonthlyPremium: number;
  irmaaApplies: boolean; // Income-related adjustment
  adjustedPremium?: number;
}

export interface USRetirementProjection {
  socialSecurity: SocialSecurityCalculation;
  retirement401k?: Retirement401kCalculation;
  traditionalIRA?: IRACalculation;
  rothIRA?: IRACalculation;
  medicare: MedicareEstimate;
  totalRetirementIncome: {
    annual: number;
    monthly: number;
    afterTax: number;
  };
  requiredMinimumDistribution?: {
    age: number;
    amount: number;
    penalty: number;
  };
}

export interface RetirementProjectionParams {
  currentAge: number;
  retirementAge: number;
  birthYear: number;
  annualSalary: number;
  averageIndexedEarnings: number;
  yearsWorked: number;
  current401kBalance: number;
  employee401kRate: number;
  employer401kMatch: number;
  employer401kMatchLimit: number;
  iraType?: 'traditional' | 'roth';
  iraContribution: number;
  currentIRABalance: number;
  filingStatus: 'single' | 'married' | 'separate';
  socialSecurityClaimAge: number;
  growthRate?: number;
}

export interface OptimizationRecommendation {
  type: 'contribution' | 'claiming' | 'conversion' | 'allocation';
  title: string;
  description: string;
  impact: number; // Estimated dollar impact
  priority: 'high' | 'medium' | 'low';
  action: string;
}