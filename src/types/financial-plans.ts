/**
 * TypeScript types for Financial Planning database tables
 * Generated: 2025-09-02
 */

import type { JsonObject } from './common';

export interface FinancialPlan {
  id: string;
  user_id: string;
  plan_type: 'retirement' | 'mortgage' | 'investment' | 'tax' | 'insurance' | 'education' | 'networth';
  name: string;
  description?: string;
  data: JsonObject; // JSONB data
  region: string;
  currency: string;
  is_active: boolean;
  is_favorite: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MortgageCalculation {
  id: string;
  user_id: string;
  financial_plan_id?: string;
  
  // Property Details
  property_price: number;
  down_payment: number;
  loan_amount: number;
  
  // Mortgage Terms  
  interest_rate: number;
  term_years: number;
  mortgage_type: string;
  
  // Regional Details
  region: 'UK' | 'US';
  state_county?: string;
  
  // Calculator Type
  calculation_type: 'standard' | 'helpToBuy' | 'sharedOwnership' | 'remortgage' | 'affordability' | 'arm';
  
  // Results
  monthly_payment: number;
  total_interest: number;
  results: JsonObject; // JSONB results
  
  // Additional costs
  stamp_duty?: number;
  pmi_amount?: number;
  property_tax?: number;
  
  created_at: Date;
  updated_at: Date;
}

export interface RetirementPlan {
  id: string;
  user_id: string;
  financial_plan_id?: string;
  
  // Personal Details
  current_age: number;
  retirement_age: number;
  life_expectancy: number;
  
  // Income Details
  current_income: number;
  desired_replacement_ratio: number;
  
  // Savings Details
  current_savings: number;
  monthly_contribution: number;
  employer_match: number;
  
  // Assumptions
  expected_return: number;
  inflation_rate: number;
  
  // Regional Details
  region: string;
  plan_type: string;
  
  // Results
  results: JsonObject;
  
  created_at: Date;
  updated_at: Date;
}

export interface InvestmentPlan {
  id: string;
  user_id: string;
  financial_plan_id?: string;
  
  // Portfolio Details
  total_value: number;
  target_allocation: Record<string, number>;
  current_allocation: Record<string, number>;
  
  // Risk Profile
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
  time_horizon?: number;
  
  // Holdings
  holdings?: JsonObject;
  
  // Analysis Results
  expected_return?: number;
  volatility?: number;
  sharpe_ratio?: number;
  
  // ESG Scoring
  esg_score?: number;
  
  results: JsonObject;
  
  created_at: Date;
  updated_at: Date;
}

export interface SavedCalculation {
  id: string;
  user_id: string;
  
  calculator_type: string;
  calculation_name?: string;
  
  // Input parameters and results
  inputs: JsonObject;
  results: JsonObject;
  
  // Metadata
  region?: string;
  currency: string;
  tags?: string[];
  
  is_favorite: boolean;
  
  created_at: Date;
  updated_at: Date;
}

// Create/Update types (without auto-generated fields)
export type FinancialPlanCreate = Omit<FinancialPlan, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type FinancialPlanUpdate = Partial<Omit<FinancialPlan, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export type MortgageCalculationCreate = Omit<MortgageCalculation, 'id' | 'created_at' | 'updated_at'>;
export type MortgageCalculationUpdate = Partial<Omit<MortgageCalculation, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export type RetirementPlanCreate = Omit<RetirementPlan, 'id' | 'created_at' | 'updated_at'>;
export type RetirementPlanUpdate = Partial<Omit<RetirementPlan, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export type InvestmentPlanCreate = Omit<InvestmentPlan, 'id' | 'created_at' | 'updated_at'>;
export type InvestmentPlanUpdate = Partial<Omit<InvestmentPlan, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export type SavedCalculationCreate = Omit<SavedCalculation, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type SavedCalculationUpdate = Partial<Omit<SavedCalculation, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

// Query result types
export interface MortgageCalculationWithPlan extends MortgageCalculation {
  financial_plan?: FinancialPlan;
}

export interface RetirementPlanWithPlan extends RetirementPlan {
  financial_plan?: FinancialPlan;
}

export interface InvestmentPlanWithPlan extends InvestmentPlan {
  financial_plan?: FinancialPlan;
}

// API Response types
export interface FinancialPlanResponse {
  success: boolean;
  data?: FinancialPlan | FinancialPlan[];
  error?: string;
  message?: string;
}

export interface MortgageCalculationResponse {
  success: boolean;
  data?: MortgageCalculation | MortgageCalculation[];
  error?: string;
  message?: string;
}

// Search/Filter types
export interface FinancialPlanFilters {
  plan_type?: FinancialPlan['plan_type'];
  region?: string;
  is_active?: boolean;
  is_favorite?: boolean;
  search?: string; // Search in name/description
}

export interface MortgageCalculationFilters {
  calculation_type?: MortgageCalculation['calculation_type'];
  region?: 'UK' | 'US';
  property_price_min?: number;
  property_price_max?: number;
  created_after?: Date;
  created_before?: Date;
}

// Export all types
export * from './index';
