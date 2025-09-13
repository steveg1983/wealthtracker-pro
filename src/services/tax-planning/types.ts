/**
 * Tax Planning Types
 * Type definitions for tax planning functionality
 */

import type { DecimalInstance } from '../../types/decimal-types';

export interface TaxCategory {
  id: string;
  name: string;
  description: string;
  deductible: boolean;
  form?: string;
  maxDeduction?: DecimalInstance;
}

export interface TaxDeduction {
  id: string;
  categoryId: string;
  description: string;
  amount: DecimalInstance;
  date: Date;
  transactionIds: string[];
  documentation?: string;
}

export interface TaxEstimate {
  income: DecimalInstance;
  deductions: DecimalInstance;
  taxableIncome: DecimalInstance;
  estimatedTax: DecimalInstance;
  effectiveRate: number;
  marginalRate: number;
  quarterlyPayments?: DecimalInstance[];
}

export interface TaxDocument {
  id: string;
  type: 'W2' | '1099' | '1098' | 'receipt' | 'other';
  description: string;
  year: number;
  uploadDate: Date;
  fileName?: string;
  relatedTransactions?: string[];
}

export interface TaxReport {
  year: number;
  summary: TaxEstimate;
  deductions: TaxDeduction[];
  capitalGains: CapitalGain[];
  optimizations: TaxOptimization[]; 
  generatedDate: Date;
}

export interface TaxOptimization {
  id: string;
  title: string;
  description: string;
  potentialSavings: DecimalInstance;
  deadline?: Date;
  actionRequired: string;
  category: 'retirement' | 'charitable' | 'business' | 'investment' | 'other';
}

export interface CapitalGain {
  investmentId: string;
  investmentName: string;
  purchaseDate: Date;
  saleDate?: Date;
  costBasis: DecimalInstance;
  currentValue: DecimalInstance;
  gain: DecimalInstance;
  type: 'short-term' | 'long-term' | 'unrealized';
  taxRate: number;
  estimatedTax: DecimalInstance;
}

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface TaxConfiguration {
  year: number;
  standardDeduction: DecimalInstance;
  brackets: TaxBracket[];
  limits: {
    retirement401k: DecimalInstance;
    retirementIRA: DecimalInstance;
    hsaIndividual: DecimalInstance;
    hsaFamily: DecimalInstance;
    saltDeduction: DecimalInstance;
  };
  rates: {
    longTermCapitalGains: number;
    shortTermCapitalGains: number;
    socialSecurity: number;
    medicare: number;
  };
}