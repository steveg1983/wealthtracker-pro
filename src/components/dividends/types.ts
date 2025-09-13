import type { Dividend, DividendSummary, DividendProjection } from '../../services/dividendService';
import type { Investment } from '../../types';

export interface DividendTrackerProps {
  accountId?: string;
  investmentId?: string;
}

export interface DividendModalProps {
  dividend: Dividend | null;
  symbols: string[];
  onSave: (dividend: Partial<Dividend>) => void;
  onClose: () => void;
}

export type DateRange = 'ytd' | '1y' | '3y' | 'all';

export interface DividendFormData {
  symbol: string;
  amount: number;
  amountPerShare: number;
  paymentDate: Date;
  exDividendDate: Date;
  recordDate?: Date;
  declarationDate?: Date;
  frequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | 'special';
  type: 'regular' | 'special' | 'qualified' | 'non-qualified' | 'return-of-capital';
  taxWithheld: number;
  reinvested: boolean;
  reinvestmentPrice: number;
  reinvestmentShares: number;
  notes: string;
}

export type { Dividend, DividendSummary, DividendProjection, Investment };