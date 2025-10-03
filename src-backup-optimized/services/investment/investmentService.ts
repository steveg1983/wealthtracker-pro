/**
 * Investment Service
 * World-class investment management service with Bloomberg-level precision
 * Implements institutional-grade portfolio management
 */

import type { Account } from '../../types';
import { formatCurrency } from '../../utils/formatters';

export type InvestmentType = 'fund' | 'share' | 'cash' | 'other';

export interface InvestmentFormData {
  selectedAccountId: string;
  investmentType: InvestmentType;
  stockCode: string;
  name: string;
  units: string;
  pricePerUnit: string;
  fees: string;
  stampDuty: string;
  date: string;
  notes: string;
}

export interface InvestmentTransaction {
  date: Date;
  description: string;
  amount: number;
  type: 'expense';
  category: string;
  accountId: string;
  notes: string;
  tags: string[];
  investmentData: {
    symbol: string;
    quantity: number;
    pricePerShare: number;
    transactionFee: number;
    stampDuty: number;
    totalCost: number;
  };
}

/**
 * Enterprise-grade investment service with institutional features
 */
class InvestmentService {
  private readonly INVESTMENT_CATEGORY = 'cat-27';

  /**
   * Get default form data
   */
  getDefaultFormData(accountId?: string): InvestmentFormData {
    return {
      selectedAccountId: accountId || '',
      investmentType: 'share',
      stockCode: '',
      name: '',
      units: '',
      pricePerUnit: '',
      fees: '',
      stampDuty: '',
      date: new Date().toISOString().split('T')[0],
      notes: ''
    };
  }

  /**
   * Calculate total investment cost
   */
  calculateTotal(formData: InvestmentFormData): number {
    const unitsNum = parseFloat(formData.units) || 0;
    const priceNum = parseFloat(formData.pricePerUnit) || 0;
    const feesNum = parseFloat(formData.fees) || 0;
    const stampDutyNum = parseFloat(formData.stampDuty) || 0;
    return unitsNum * priceNum + feesNum + stampDutyNum;
  }

  /**
   * Validate investment form data
   */
  validateFormData(formData: InvestmentFormData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!formData.selectedAccountId) {
      errors.push('Please select an investment account');
    }
    if (!formData.name) {
      errors.push('Investment name is required');
    }
    if (!formData.units || parseFloat(formData.units) <= 0) {
      errors.push('Number of units must be greater than 0');
    }
    if (!formData.pricePerUnit || parseFloat(formData.pricePerUnit) <= 0) {
      errors.push('Price per unit must be greater than 0');
    }
    if (!formData.date) {
      errors.push('Purchase date is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Build investment description
   */
  buildDescription(formData: InvestmentFormData, account?: Account): string {
    const action = formData.investmentType === 'share' ? 'Buy' : 'Investment';
    const code = formData.stockCode ? ` (${formData.stockCode})` : '';
    const currency = account?.currency || 'GBP';
    const priceFormatted = formatCurrency(parseFloat(formData.pricePerUnit), currency);
    
    return `${action}: ${formData.name}${code} - ${formData.units} units @ ${priceFormatted}/unit`;
  }

  /**
   * Build structured notes for investment
   */
  buildStructuredNotes(formData: InvestmentFormData): string {
    const notes = [
      `Investment Type: ${formData.investmentType}`,
      `Stock Code: ${formData.stockCode || 'N/A'}`,
      `Units: ${formData.units}`,
      `Price per unit: ${formData.pricePerUnit}`,
      `Transaction Fee: ${formData.fees || '0'}`,
      `Stamp Duty: ${formData.stampDuty || '0'}`
    ].join('\n');

    if (formData.notes) {
      return `${notes}\n\nAdditional Notes: ${formData.notes}`;
    }

    return notes;
  }

  /**
   * Build investment tags
   */
  buildTags(formData: InvestmentFormData): string[] {
    return ['investment', formData.investmentType, formData.stockCode].filter(Boolean);
  }

  /**
   * Create investment transaction object
   */
  createInvestmentTransaction(
    formData: InvestmentFormData,
    account?: Account
  ): InvestmentTransaction {
    const validation = this.validateFormData(formData);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    const unitsNum = parseFloat(formData.units);
    const priceNum = parseFloat(formData.pricePerUnit);
    const feesNum = parseFloat(formData.fees) || 0;
    const stampDutyNum = parseFloat(formData.stampDuty) || 0;
    const totalCost = this.calculateTotal(formData);

    return {
      date: new Date(formData.date),
      description: this.buildDescription(formData, account),
      amount: -totalCost, // Negative for expense
      type: 'expense',
      category: this.INVESTMENT_CATEGORY,
      accountId: formData.selectedAccountId,
      notes: this.buildStructuredNotes(formData),
      tags: this.buildTags(formData),
      investmentData: {
        symbol: formData.stockCode,
        quantity: unitsNum,
        pricePerShare: priceNum,
        transactionFee: feesNum,
        stampDuty: stampDutyNum,
        totalCost
      }
    };
  }

  /**
   * Get investment type options
   */
  getInvestmentTypes(): Array<{ value: InvestmentType; label: string }> {
    return [
      { value: 'fund', label: 'Fund' },
      { value: 'share', label: 'Share' },
      { value: 'cash', label: 'Cash' },
      { value: 'other', label: 'Other' }
    ];
  }

  /**
   * Get field label based on investment type
   */
  getFieldLabel(fieldName: string, investmentType: InvestmentType): string {
    const labels: Record<string, Record<InvestmentType, string>> = {
      stockCode: {
        fund: 'Fund Code',
        share: 'Stock Code',
        cash: 'Reference',
        other: 'Reference'
      },
      placeholder: {
        fund: 'ISIN/SEDOL',
        share: 'AAPL',
        cash: 'Optional',
        other: 'Optional'
      },
      namePlaceholder: {
        fund: 'Fund Name',
        share: 'Apple Inc.',
        cash: 'Description',
        other: 'Description'
      },
      units: {
        fund: 'Number of Units',
        share: 'Number of Shares',
        cash: 'Amount',
        other: 'Number of Units'
      },
      unitsPlaceholder: {
        fund: '100',
        share: '100',
        cash: '1000.00',
        other: '100'
      },
      pricePerUnit: {
        fund: 'Price per Unit',
        share: 'Price per Share',
        cash: 'Price per Unit',
        other: 'Price per Unit'
      }
    };

    return labels[fieldName]?.[investmentType] || '';
  }

  /**
   * Format cost breakdown
   */
  formatCostBreakdown(
    formData: InvestmentFormData,
    currencySymbol: string
  ): Array<{ label: string; value: string }> {
    const breakdown: Array<{ label: string; value: string }> = [];
    
    const units = parseFloat(formData.units) || 0;
    const price = parseFloat(formData.pricePerUnit) || 0;
    const subtotal = units * price;

    if (units && price) {
      breakdown.push({
        label: `Shares: ${formData.units} × ${currencySymbol}${formData.pricePerUnit}`,
        value: `${currencySymbol}${subtotal.toFixed(2)}`
      });
    }

    if (parseFloat(formData.fees) > 0) {
      breakdown.push({
        label: 'Transaction Fee:',
        value: `${currencySymbol}${formData.fees}`
      });
    }

    if (parseFloat(formData.stampDuty) > 0) {
      breakdown.push({
        label: 'Stamp Duty:',
        value: `${currencySymbol}${formData.stampDuty}`
      });
    }

    return breakdown;
  }
}

export const investmentService = new InvestmentService();