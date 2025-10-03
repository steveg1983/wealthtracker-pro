// Type definitions for financial planning service saved data

export interface SavedRetirementPlan {
  id: string;
  name: string;
  currentAge: number;
  retirementAge: number;
  currentSavings: number;
  monthlyContribution: number;
  expectedReturn: number;
  inflationRate: number;
  targetRetirementIncome: number;
  createdAt: string;
  lastUpdated: string;
}

export interface SavedAmortizationEntry {
  paymentNumber: number;
  paymentDate: string;
  monthlyPayment: number;
  principalPayment: number;
  interestPayment: number;
  remainingBalance: number;
}

export interface SavedMortgageCalculation {
  id: string;
  loanAmount: number;
  interestRate: number;
  loanTermYears: number;
  monthlyPayment: number;
  totalInterest: number;
  totalCost: number;
  payoffDate: string;
  createdAt: string;
  amortizationSchedule: SavedAmortizationEntry[];
}

export interface SavedCollegePlan {
  id: string;
  childName: string;
  currentAge: number;
  collegeStartAge: number;
  currentSavings: number;
  monthlyContribution: number;
  expectedReturn: number;
  estimatedCost: number;
  inflationRate: number;
  createdAt: string;
}

export interface SavedDebtPlan {
  id: string;
  debtName: string;
  currentBalance: number;
  interestRate: number;
  minimumPayment: number;
  additionalPayment: number;
  strategy: 'minimum' | 'snowball' | 'avalanche';
  createdAt: string;
}

export interface SavedFinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentSavings: number;
  targetDate: string;
  monthlyContribution: number;
  priority: 'high' | 'medium' | 'low';
  category: string;
  isCompleted: boolean;
  createdAt: string;
}

export interface SavedInsuranceNeed {
  id: string;
  type: string;
  coverageAmount: number;
  monthlyPremium: number;
  provider: string;
  policyNumber?: string;
  startDate: string;
  endDate?: string;
  createdAt: string;
}