import { useCallback, useMemo } from 'react';
import { usePreferences } from '../contexts/PreferencesContext';
import { 
  convertCurrency, 
  convertMultipleCurrencies, 
  formatCurrency as formatCurrencyDecimal,
  getCurrencySymbol 
} from '../utils/currency-decimal';
import type { DecimalInstance } from '../utils/decimal';
import { toDecimal } from '../utils/decimal';
import { lazyLogger as logger } from '../services/serviceFactory';

export function useCurrencyDecimal(): {
  formatCurrency: (amount: DecimalInstance | number, originalCurrency?: string) => string;
  convertAndFormat: (amount: DecimalInstance | number, fromCurrency: string) => Promise<string>;
  convert: (amount: DecimalInstance | number, fromCurrency: string) => Promise<DecimalInstance>;
  convertAndSum: (amounts: Array<{ amount: DecimalInstance | number; currency: string }>) => Promise<DecimalInstance>;
  displayCurrency: string;
  getCurrencySymbol: (currency: string) => string;
} {
  const { currency: displayCurrency } = usePreferences();

  // Format amount in display currency (accepts Decimal or number)
  const formatCurrency = useCallback((amount: DecimalInstance | number, originalCurrency?: string) => {
    const currencyToUse = originalCurrency || displayCurrency;
    return formatCurrencyDecimal(amount, currencyToUse);
  }, [displayCurrency]);

  // Convert and format amount from one currency to display currency
  const convertAndFormat = useCallback(async (amount: DecimalInstance | number, fromCurrency: string) => {
    if (fromCurrency === displayCurrency) {
      return formatCurrency(amount, displayCurrency);
    }

    try {
      const converted = await convertCurrency(amount, fromCurrency, displayCurrency);
      return formatCurrency(converted, displayCurrency);
    } catch (error) {
      logger.error('Currency conversion error:', error);
      return formatCurrency(amount, fromCurrency) + ' (!)';
    }
  }, [displayCurrency, formatCurrency]);

  // Convert amount to display currency (returns Decimal)
  const convert = useCallback(async (amount: DecimalInstance | number, fromCurrency: string): Promise<DecimalInstance> => {
    if (fromCurrency === displayCurrency) {
      return toDecimal(amount);
    }

    try {
      return await convertCurrency(amount, fromCurrency, displayCurrency);
    } catch (error) {
      logger.error('Currency conversion error:', error);
      return toDecimal(amount);
    }
  }, [displayCurrency]);

  // Convert multiple amounts to display currency and sum them
  const convertAndSum = useCallback(async (amounts: Array<{ amount: DecimalInstance | number; currency: string }>): Promise<DecimalInstance> => {
    try {
      const total = await convertMultipleCurrencies(amounts, displayCurrency);
      return total;
    } catch (error) {
      logger.error('Currency conversion error:', error);
      // Fallback: just sum amounts without conversion
      return amounts.reduce((sum, item) => sum.plus(item.amount), toDecimal(0));
    }
  }, [displayCurrency]);

  return useMemo(() => ({
    formatCurrency,
    convertAndFormat,
    convert,
    convertAndSum,
    displayCurrency,
    getCurrencySymbol
  }), [formatCurrency, convertAndFormat, convert, convertAndSum, displayCurrency]);
}