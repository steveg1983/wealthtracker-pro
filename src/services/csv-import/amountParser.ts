import { toDecimal } from '../../utils/decimal';
import type { DecimalInstance } from '../../types/decimal-types';

/**
 * Amount parsing utilities
 * Handles currency symbols, different number formats, and credit/debit columns
 */
export class AmountParser {
  private readonly currencySymbols = ['£', '$', '€', '¥', '₹', '₽', 'kr', 'R', 'C$', 'A$'];

  /**
   * Parse amount with currency symbol handling
   */
  parseAmount(value: string | number): number {
    if (typeof value === 'number') {
      return value;
    }

    if (!value || value.trim() === '') {
      return 0;
    }

    // Remove currency symbols and spaces
    let cleaned = value;
    for (const symbol of this.currencySymbols) {
      cleaned = cleaned.replace(new RegExp(`\\${symbol}`, 'g'), '');
    }
    cleaned = cleaned.replace(/[\s,]/g, '');
    
    // Handle parentheses for negative amounts (accounting format)
    const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
    if (isNegative) {
      cleaned = cleaned.slice(1, -1);
    }
    
    // Handle minus sign
    const hasMinusSign = cleaned.startsWith('-');
    if (hasMinusSign) {
      cleaned = cleaned.slice(1);
    }
    
    // Handle European decimal format (1.234,56)
    if (cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) {
      return 0;
    }
    
    return (isNegative || hasMinusSign) ? -parsed : parsed;
  }

  /**
   * Parse separate debit/credit columns
   */
  parseDebitCredit(debit: string, credit: string): number {
    const debitAmount = this.parseAmount(debit);
    const creditAmount = this.parseAmount(credit);
    
    // Debit is negative (expense), credit is positive (income)
    if (debitAmount !== 0) {
      return -Math.abs(debitAmount);
    }
    if (creditAmount !== 0) {
      return Math.abs(creditAmount);
    }
    return 0;
  }

  /**
   * Detect amount format from sample values
   */
  detectFormat(samples: string[]): {
    hasParentheses: boolean;
    hasCurrencySymbol: boolean;
    currencySymbol: string | null;
    decimalSeparator: '.' | ',';
    thousandsSeparator: ',' | '.' | ' ' | '';
  } {
    let hasParentheses = false;
    let hasCurrencySymbol = false;
    let currencySymbol: string | null = null;
    let decimalSeparator: '.' | ',' = '.';
    let thousandsSeparator: ',' | '.' | ' ' | '' = ',';

    for (const sample of samples.filter(s => s && s.trim() !== '')) {
      // Check for parentheses
      if (sample.includes('(') && sample.includes(')')) {
        hasParentheses = true;
      }

      // Check for currency symbols
      for (const symbol of this.currencySymbols) {
        if (sample.includes(symbol)) {
          hasCurrencySymbol = true;
          currencySymbol = symbol;
          break;
        }
      }

      // Detect decimal and thousands separators
      if (sample.includes(',') && sample.includes('.')) {
        const commaIndex = sample.lastIndexOf(',');
        const dotIndex = sample.lastIndexOf('.');
        
        if (commaIndex > dotIndex) {
          // European format: 1.234,56
          decimalSeparator = ',';
          thousandsSeparator = '.';
        } else {
          // US format: 1,234.56
          decimalSeparator = '.';
          thousandsSeparator = ',';
        }
      }
    }

    return {
      hasParentheses,
      hasCurrencySymbol,
      currencySymbol,
      decimalSeparator,
      thousandsSeparator
    };
  }

  /**
   * Format amount for display
   */
  formatAmount(amount: number, currencySymbol: string = '$'): string {
    const decimal = toDecimal(amount);
    const isNegative = decimal.isNegative();
    const absolute = decimal.abs();
    
    const formatted = absolute.toFixed(2);
    const withCommas = formatted.replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
    
    return isNegative ? 
      `-${currencySymbol}${withCommas}` : 
      `${currencySymbol}${withCommas}`;
  }
}

export const amountParser = new AmountParser();