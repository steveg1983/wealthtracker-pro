import { useMemo } from 'react';
import { formatCurrency } from '../utils/currency';

// Cache for date formatting to avoid re-creating Date objects
const dateCache = new Map<string, string>();

export function useFormattedDate(date: Date | string, locale: string = 'en-US'): string {
  return useMemo(() => {
    const dateKey = `${date.toString()}_${locale}`;
    
    if (dateCache.has(dateKey)) {
      return dateCache.get(dateKey)!;
    }
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const formatted = dateObj.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    // Limit cache size to prevent memory issues
    if (dateCache.size > 1000) {
      const firstKey = dateCache.keys().next().value;
      if (firstKey !== undefined) {
        dateCache.delete(firstKey);
      }
    }
    
    dateCache.set(dateKey, formatted);
    return formatted;
  }, [date, locale]);
}

export function useFormattedCurrency(
  amount: number, 
  currency: string = 'USD'
): string {
  return useMemo(() => {
    return formatCurrency(amount, currency);
  }, [amount, currency]);
}

export function useFormattedDateTime(
  date: Date | string,
  locale: string = 'en-US',
  options?: Intl.DateTimeFormatOptions
): string {
  return useMemo(() => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString(locale, options);
  }, [date, locale, options]);
}

// Batch formatting for multiple values (useful in lists)
export function useBatchFormattedDates(
  dates: (Date | string)[],
  locale: string = 'en-US'
): string[] {
  return useMemo(() => {
    return dates.map(date => {
      const dateKey = `${date.toString()}_${locale}`;
      
      if (dateCache.has(dateKey)) {
        return dateCache.get(dateKey)!;
      }
      
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const formatted = dateObj.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      dateCache.set(dateKey, formatted);
      return formatted;
    });
  }, [dates, locale]);
}

export function useBatchFormattedCurrency(
  amounts: number[],
  currency: string = 'USD'
): string[] {
  return useMemo(() => {
    return amounts.map(amount => formatCurrency(amount, currency));
  }, [amounts, currency]);
}

// Memoized percentage formatting
export function useFormattedPercentage(
  value: number,
  decimals: number = 1,
  locale: string = 'en-US'
): string {
  return useMemo(() => {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value / 100);
  }, [value, decimals, locale]);
}

// Memoized number formatting
export function useFormattedNumber(
  value: number,
  decimals: number = 0,
  locale: string = 'en-US'
): string {
  return useMemo(() => {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  }, [value, decimals, locale]);
}