export interface Contribution401k {
  employeeContribution: number;
  employerMatch: number;
  totalAnnualContribution: number;
  taxSavings: number;
  netCost: number;
  projectedBalance: number;
  isEligibleForCatchUp: boolean;
  maxContribution: number;
  matchDescription: string;
  effectiveMatchRate: number;
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

export interface IrsLimits {
  regularLimit: number;
  catchUpLimit: number;
  year: number;
}