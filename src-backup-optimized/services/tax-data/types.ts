import type { Region } from '../../hooks/useRegionalSettings';

export interface TaxDataVersion {
  year: number | string; // 2024 for US, "2024/25" for UK
  lastUpdated: string;
  source: string;
  isActive: boolean;
  changeNotes?: string[];
}

export interface TaxUpdateNotification {
  id: string;
  region: Region;
  taxYear: string;
  changes: string[];
  effectiveDate: string;
  dismissed: boolean;
}

export interface TaxVerificationResult {
  status: 'valid' | 'invalid' | 'needs_update';
  lastVerified: Date;
  source: string;
  checksumValid: boolean;
  calculationsValid: boolean;
  officialSourceValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TaxTestCase {
  income: number;
  filingStatus?: 'single' | 'married' | 'separate' | 'head';
  expectedTax: number;
  expectedNI?: number;
  source: string;
  description: string;
}

export type UKTaxYear = '2024-25' | '2025-26';
export type USFilingStatus = 'single' | 'married' | 'separate' | 'head';

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface StandardDeduction {
  single: number;
  married: number;
  separate: number;
  head: number;
}

export interface TaxConstants {
  brackets: TaxBracket[];
  standardDeduction: StandardDeduction;
  personalAllowance?: number;
  upperEarningsLimit?: number;
  additionalRateThreshold?: number;
}

export interface TaxCalculationResult {
  taxableIncome: number;
  federalTax: number;
  stateTax?: number;
  socialSecurity?: number;
  medicare?: number;
  nationalInsurance?: number;
  totalTax: number;
  effectiveRate: number;
  marginalRate: number;
  breakdown: TaxBreakdown[];
}

export interface TaxBreakdown {
  bracket: string;
  income: number;
  rate: number;
  tax: number;
}

export interface TaxDataUpdate {
  region: Region;
  year: number | string;
  data: TaxConstants;
  source: string;
  effectiveDate: Date;
}

export interface TaxDataCache {
  US: Map<number, TaxConstants>;
  UK: Map<string, TaxConstants>;
  lastUpdated: Date;
  version: string;
}