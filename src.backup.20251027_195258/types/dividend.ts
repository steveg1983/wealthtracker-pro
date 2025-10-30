// Type definitions for dividend service saved data

export interface SavedDividend {
  id: string;
  investmentId: string;
  accountId: string;
  symbol: string;
  amount: number;
  amountPerShare: number;
  shares: number;
  currency: string;
  paymentDate: string;
  exDividendDate: string;
  recordDate?: string;
  declarationDate?: string;
  frequency: string;
  type: string;
  taxWithheld?: number;
  reinvested: boolean;
  reinvestmentPrice?: number;
  reinvestmentShares?: number;
  notes?: string;
}