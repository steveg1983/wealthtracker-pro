/**
 * @deprecated Use useCurrencyDecimal() instead for Decimal.js support
 * This hook is maintained for backward compatibility with components not yet migrated
 */

import { useCallback, useMemo } from 'react';
import { usePreferences } from '../contexts/PreferencesContext';
import { convertCurrency, convertMultipleCurrencies, formatCurrency as formatCurrencyUtil, getCurrencySymbol } from '../utils/currency';
import { logger } from '../services/loggingService';

export function useCurrency(): {
  displayCurrency: string;
  currencySymbol: string;
  formatCurrency: (amount: number, originalCurrency?: string) => string;
  convertAndFormat: (amount: number, fromCurrency: string) => Promise<string>;
  convert: (amount: number, fromCurrency: string) => Promise<number>;
  convertAndSum: (amounts: Array<{ amount: number; currency: string }>) => Promise<number>;
} {
  const { currency: displayCurrency } = usePreferences();

  // Format amount in display currency
  const formatCurrency = useCallback((amount: number, originalCurrency?: string) => {
    const currencyToUse = originalCurrency || displayCurrency;
    return formatCurrencyUtil(amount, currencyToUse);
  }, [displayCurrency]);

  // Convert and format amount from one currency to display currency
  const convertAndFormat = useCallback(async (amount: number, fromCurrency: string) => {
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

  // Convert amount to display currency (returns number)
  const convert = useCallback(async (amount: number, fromCurrency: string): Promise<number> => {
    if (fromCurrency === displayCurrency) {
      return amount;
    }

    try {
      return await convertCurrency(amount, fromCurrency, displayCurrency);
    } catch (error) {
      logger.error('Currency conversion error:', error);
      return amount;
    }
  }, [displayCurrency]);

  // Convert multiple amounts to display currency and sum them
  const convertAndSum = useCallback(async (amounts: Array<{ amount: number; currency: string }>): Promise<number> => {
    try {
      const total = await convertMultipleCurrencies(amounts, displayCurrency);
      return total;
    } catch (error) {
      logger.error('Currency conversion error:', error);
      // Fallback: just sum amounts without conversion
      return amounts.reduce((sum, { amount }) => sum + amount, 0);
    }
  }, [displayCurrency]);

  const currencySymbol = useMemo(() => getCurrencySymbol(displayCurrency), [displayCurrency]);

  return {
    displayCurrency,
    currencySymbol,
    formatCurrency,
    convertAndFormat,
    convert,
    convertAndSum,
  };
}