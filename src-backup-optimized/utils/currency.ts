/**
 * Currency Utilities - Simple currency formatting and parsing functions
 *
 * Features:
 * - Currency formatting
 * - Currency parsing
 * - Decimal handling
 * - Locale support
 * - Symbol handling
 */

import { Decimal } from 'decimal.js';

export interface CurrencyOptions {
  currency?: string;
  locale?: string;
  precision?: number;
  showSymbol?: boolean;
  showCode?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

// Default currency settings
export const DEFAULT_CURRENCY = 'GBP';
export const DEFAULT_LOCALE = 'en-GB';

// Common currency symbols
export const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'CHF',
  CNY: '¥',
  INR: '₹'
};

// Format amount as currency
export function formatCurrency(
  amount: number | string | Decimal,
  options: CurrencyOptions = {}
): string {
  const {
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_LOCALE,
    precision = 2,
    showSymbol = true,
    showCode = false,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2
  } = options;

  try {
    // Convert to Decimal for precise calculations
    const decimal = amount instanceof Decimal ? amount : new Decimal(amount);
    const numericValue = decimal.toNumber();

    // Handle special cases
    if (!isFinite(numericValue)) {
      return showSymbol ? `${CURRENCY_SYMBOLS[currency] || currency} 0.00` : '0.00';
    }

    // Format using Intl.NumberFormat for proper localization
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits,
      maximumFractionDigits
    });

    let formatted = formatter.format(numericValue);

    // Handle symbol/code preferences
    if (!showSymbol && !showCode) {
      // Remove currency symbol/code
      formatted = formatted.replace(/[£$€¥₹]/, '').replace(/[A-Z]{3}/, '').trim();
    } else if (showCode && !showSymbol) {
      // Replace symbol with code
      const symbol = CURRENCY_SYMBOLS[currency];
      if (symbol) {
        formatted = formatted.replace(symbol, currency);
      }
    }

    return formatted;
  } catch (error) {
    console.warn('Error formatting currency:', error);
    return showSymbol ? `${CURRENCY_SYMBOLS[currency] || currency} 0.00` : '0.00';
  }
}

// Parse currency string to number
export function parseCurrency(value: string, currency = DEFAULT_CURRENCY): number {
  if (!value || typeof value !== 'string') {
    return 0;
  }

  try {
    // Remove currency symbols and codes
    let cleaned = value
      .replace(/[£$€¥₹]/g, '')
      .replace(/[A-Z]{3}/g, '')
      .replace(/,/g, '') // Remove thousands separators
      .trim();

    // Handle negative values
    const isNegative = cleaned.includes('-') || cleaned.includes('(');
    cleaned = cleaned.replace(/[-()]/g, '');

    // Parse to number
    const parsed = parseFloat(cleaned);

    if (isNaN(parsed)) {
      return 0;
    }

    return isNegative ? -parsed : parsed;
  } catch (error) {
    console.warn('Error parsing currency:', error);
    return 0;
  }
}

// Format currency with sign (+ for positive, - for negative)
export function formatCurrencyWithSign(
  amount: number | string | Decimal,
  options: CurrencyOptions = {}
): string {
  const decimal = amount instanceof Decimal ? amount : new Decimal(amount);
  const formatted = formatCurrency(decimal, options);

  if (decimal.isPositive() && !decimal.isZero()) {
    return `+${formatted}`;
  }

  return formatted;
}

// Format currency for display in transactions (with color classes)
export function formatTransactionAmount(
  amount: number | string | Decimal,
  options: CurrencyOptions = {}
): { formatted: string; className: string; isPositive: boolean } {
  const decimal = amount instanceof Decimal ? amount : new Decimal(amount);
  const isPositive = decimal.isPositive();
  const isZero = decimal.isZero();

  const formatted = formatCurrencyWithSign(decimal, options);

  let className = '';
  if (!isZero) {
    className = isPositive ? 'text-green-600' : 'text-red-600';
  }

  return {
    formatted,
    className,
    isPositive
  };
}

// Get currency symbol
export function getCurrencySymbol(currency = DEFAULT_CURRENCY): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

// Validate currency amount
export function isValidCurrencyAmount(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  try {
    const parsed = parseCurrency(value);
    return !isNaN(parsed) && isFinite(parsed);
  } catch {
    return false;
  }
}

// Convert between currencies (simplified - would need real exchange rates)
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  exchangeRate?: number
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Mock exchange rates - in real app, this would fetch from an API
  const mockRates: Record<string, Record<string, number>> = {
    GBP: { USD: 1.27, EUR: 1.17, JPY: 188.5 },
    USD: { GBP: 0.79, EUR: 0.92, JPY: 148.3 },
    EUR: { GBP: 0.86, USD: 1.09, JPY: 161.2 }
  };

  const rate = exchangeRate || mockRates[fromCurrency]?.[toCurrency] || 1;
  return amount * rate;
}

// Format currency for input fields (no currency symbol)
export function formatCurrencyForInput(amount: number | string): string {
  try {
    const decimal = new Decimal(amount);
    return decimal.toFixed(2);
  } catch {
    return '0.00';
  }
}

// Round currency to standard precision
export function roundCurrency(amount: number | string | Decimal): Decimal {
  const decimal = amount instanceof Decimal ? amount : new Decimal(amount);
  return decimal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

// Calculate percentage change
export function calculatePercentageChange(
  oldAmount: number | string | Decimal,
  newAmount: number | string | Decimal
): { percentage: number; formatted: string; isIncrease: boolean } {
  const oldDecimal = oldAmount instanceof Decimal ? oldAmount : new Decimal(oldAmount);
  const newDecimal = newAmount instanceof Decimal ? newAmount : new Decimal(newAmount);

  if (oldDecimal.isZero()) {
    return {
      percentage: 0,
      formatted: '0%',
      isIncrease: false
    };
  }

  const change = newDecimal.minus(oldDecimal);
  const percentage = change.dividedBy(oldDecimal.abs()).times(100);
  const isIncrease = change.isPositive();

  return {
    percentage: percentage.toNumber(),
    formatted: `${isIncrease ? '+' : ''}${percentage.toFixed(1)}%`,
    isIncrease
  };
}

// Default export with common functions
export default {
  formatCurrency,
  parseCurrency,
  formatCurrencyWithSign,
  formatTransactionAmount,
  getCurrencySymbol,
  isValidCurrencyAmount,
  convertCurrency,
  formatCurrencyForInput,
  roundCurrency,
  calculatePercentageChange
};