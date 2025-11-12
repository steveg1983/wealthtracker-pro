/**
 * useCurrencyDecimal Hook Tests
 * Comprehensive tests for the currency decimal formatting and conversion hook
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { useCurrencyDecimal } from './useCurrencyDecimal';
import { toDecimal } from '../utils/decimal';
import { formatDecimal as formatDecimalHelper } from '../utils/decimal-format';

// Mock the PreferencesContext
vi.mock('../contexts/PreferencesContext', () => ({
  usePreferences: vi.fn(() => ({
    currency: 'USD'
  }))
}));

// Mock the currency-decimal utilities
vi.mock('../utils/currency-decimal', () => ({
  formatCurrency: vi.fn((amount, currency) => {
    const value = typeof amount === 'object' && typeof (amount as any).toNumber === 'function'
      ? (amount as any).toNumber()
      : Number(amount);
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£';
    if (Number.isNaN(value)) {
      return `${symbol}NaN`;
    }
    if (!Number.isFinite(value)) {
      return `${symbol}${value}`;
    }
    const formatted = formatDecimalHelper(Math.abs(value), 2, { group: false });
    return value < 0 ? `${symbol}-${formatted}` : `${symbol}${formatted}`;
  }),
  getCurrencySymbol: vi.fn((currency) => {
    switch (currency) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'GBP': return '£';
      default: return currency;
    }
  }),
  convertCurrency: vi.fn(async (amount, from, to) => {
    // Mock conversion rates
    const rates: Record<string, Record<string, number>> = {
      USD: { EUR: 0.85, GBP: 0.73 },
      EUR: { USD: 1.18, GBP: 0.86 },
      GBP: { USD: 1.37, EUR: 1.16 }
    };
    
    if (from === to) return toDecimal(amount);
    
    const value = typeof amount === 'object' && amount.toNumber ? amount.toNumber() : amount;
    const rate = rates[from]?.[to] || 1;
    return toDecimal(value * rate);
  }),
  convertMultipleCurrencies: vi.fn(async (amounts, targetCurrency) => {
    // Mock conversion of multiple currencies
    let total = toDecimal(0);
    for (const item of amounts) {
      const value = typeof item.amount === 'object' && item.amount.toNumber ? item.amount.toNumber() : item.amount;
      if (item.currency === targetCurrency) {
        total = total.plus(value);
      } else {
        // Simple mock conversion
        const rates: Record<string, Record<string, number>> = {
          USD: { EUR: 0.85, GBP: 0.73 },
          EUR: { USD: 1.18, GBP: 0.86 },
          GBP: { USD: 1.37, EUR: 1.16 }
        };
        const rate = rates[item.currency]?.[targetCurrency] || 1;
        total = total.plus(value * rate);
      }
    }
    return total;
  })
}));

describe('useCurrencyDecimal', () => {
  let mockUsePreferences: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset preferences to USD
    const preferencesModule = await import('../contexts/PreferencesContext');
    mockUsePreferences = vi.mocked(preferencesModule.usePreferences);
    mockUsePreferences.mockReturnValue({ currency: 'USD' } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('basic rendering', () => {
    it('returns all expected functions and values', () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      expect(result.current).toHaveProperty('formatCurrency');
      expect(result.current).toHaveProperty('convertAndFormat');
      expect(result.current).toHaveProperty('convert');
      expect(result.current).toHaveProperty('convertAndSum');
      expect(result.current).toHaveProperty('displayCurrency');
      expect(result.current).toHaveProperty('getCurrencySymbol');
      
      expect(typeof result.current.formatCurrency).toBe('function');
      expect(typeof result.current.convertAndFormat).toBe('function');
      expect(typeof result.current.convert).toBe('function');
      expect(typeof result.current.convertAndSum).toBe('function');
      expect(typeof result.current.getCurrencySymbol).toBe('function');
    });

    it('uses the currency from preferences', () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      expect(result.current.displayCurrency).toBe('USD');
    });
  });

  describe('formatCurrency', () => {
    it('formats a number amount', () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const formatted = result.current.formatCurrency(100);
      expect(formatted).toBe('$100.00');
    });

    it('formats a Decimal amount', () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const amount = toDecimal(250.50);
      const formatted = result.current.formatCurrency(amount);
      expect(formatted).toBe('$250.50');
    });

    it('formats with explicit currency', () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const formatted = result.current.formatCurrency(100, 'EUR');
      expect(formatted).toBe('€100.00');
    });

    it('handles zero amounts', () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const formatted = result.current.formatCurrency(0);
      expect(formatted).toBe('$0.00');
    });

    it('handles negative amounts', () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const formatted = result.current.formatCurrency(-50);
      expect(formatted).toBe('$-50.00');
    });

    it('handles very large amounts', () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const formatted = result.current.formatCurrency(1000000);
      expect(formatted).toBe('$1000000.00');
    });
  });

  describe('getCurrencySymbol', () => {
    it('returns correct symbol for USD', () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      expect(result.current.getCurrencySymbol('USD')).toBe('$');
    });

    it('returns correct symbol for EUR', () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      expect(result.current.getCurrencySymbol('EUR')).toBe('€');
    });

    it('returns correct symbol for GBP', () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      expect(result.current.getCurrencySymbol('GBP')).toBe('£');
    });

    it('returns currency code for unknown currencies', () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      expect(result.current.getCurrencySymbol('JPY')).toBe('JPY');
    });
  });

  describe('convertAndFormat', () => {
    it('formats without conversion when currency matches', async () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const formatted = await result.current.convertAndFormat(100, 'USD');
      expect(formatted).toBe('$100.00');
    });

    it('converts and formats from EUR to USD', async () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const formatted = await result.current.convertAndFormat(100, 'EUR');
      expect(formatted).toBe('$118.00'); // 100 EUR * 1.18 = 118 USD
    });

    it('converts and formats from GBP to USD', async () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const formatted = await result.current.convertAndFormat(100, 'GBP');
      expect(formatted).toBe('$137.00'); // 100 GBP * 1.37 = 137 USD
    });

    it('handles conversion errors gracefully', async () => {
      const { convertCurrency } = await import('../utils/currency-decimal');
      vi.mocked(convertCurrency).mockRejectedValueOnce(new Error('Conversion failed'));
      
      const { result } = renderHook(() => useCurrencyDecimal());
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const formatted = await result.current.convertAndFormat(100, 'EUR');
      expect(formatted).toBe('€100.00 (!)'); // Shows original currency with warning
      expect(consoleSpy).toHaveBeenCalledWith('Currency conversion error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('handles Decimal amounts', async () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const amount = toDecimal(100);
      const formatted = await result.current.convertAndFormat(amount, 'EUR');
      expect(formatted).toBe('$118.00');
    });
  });

  describe('convert', () => {
    it('returns same amount when currency matches', async () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const converted = await result.current.convert(100, 'USD');
      expect(converted.toNumber()).toBe(100);
    });

    it('converts from EUR to USD', async () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const converted = await result.current.convert(100, 'EUR');
      expect(converted.toNumber()).toBe(118); // 100 EUR * 1.18
    });

    it('converts from GBP to USD', async () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const converted = await result.current.convert(100, 'GBP');
      expect(converted.toNumber()).toBe(137); // 100 GBP * 1.37
    });

    it('handles conversion errors by returning original amount', async () => {
      const { convertCurrency } = await import('../utils/currency-decimal');
      vi.mocked(convertCurrency).mockRejectedValueOnce(new Error('Conversion failed'));
      
      const { result } = renderHook(() => useCurrencyDecimal());
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const converted = await result.current.convert(100, 'EUR');
      expect(converted.toNumber()).toBe(100); // Returns original amount
      expect(consoleSpy).toHaveBeenCalledWith('Currency conversion error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('handles Decimal input', async () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const amount = toDecimal(100);
      const converted = await result.current.convert(amount, 'EUR');
      expect(converted.toNumber()).toBe(118);
    });
  });

  describe('convertAndSum', () => {
    it('sums amounts in the same currency', async () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const amounts = [
        { amount: 100, currency: 'USD' },
        { amount: 200, currency: 'USD' },
        { amount: 50, currency: 'USD' }
      ];
      
      const total = await result.current.convertAndSum(amounts);
      expect(total.toNumber()).toBe(350);
    });

    it('converts and sums mixed currencies', async () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const amounts = [
        { amount: 100, currency: 'USD' },    // 100 USD
        { amount: 100, currency: 'EUR' },    // 100 * 1.18 = 118 USD
        { amount: 100, currency: 'GBP' }     // 100 * 1.37 = 137 USD
      ];
      
      const total = await result.current.convertAndSum(amounts);
      expect(total.toNumber()).toBe(355); // 100 + 118 + 137
    });

    it('handles Decimal amounts', async () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const amounts = [
        { amount: toDecimal(100), currency: 'USD' },
        { amount: toDecimal(200), currency: 'USD' }
      ];
      
      const total = await result.current.convertAndSum(amounts);
      expect(total.toNumber()).toBe(300);
    });

    it('handles empty array', async () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const total = await result.current.convertAndSum([]);
      expect(total.toNumber()).toBe(0);
    });

    it('handles conversion errors by summing without conversion', async () => {
      const { convertMultipleCurrencies } = await import('../utils/currency-decimal');
      vi.mocked(convertMultipleCurrencies).mockRejectedValueOnce(new Error('Conversion failed'));
      
      const { result } = renderHook(() => useCurrencyDecimal());
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const amounts = [
        { amount: 100, currency: 'USD' },
        { amount: 200, currency: 'EUR' }
      ];
      
      const total = await result.current.convertAndSum(amounts);
      expect(total.toNumber()).toBe(300); // Just sums without conversion
      expect(consoleSpy).toHaveBeenCalledWith('Currency conversion error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('currency preference changes', () => {
    it('updates functions when currency preference changes', () => {
      // Start with USD
      mockUsePreferences.mockReturnValue({ currency: 'USD' } as any);
      
      const { result, rerender } = renderHook(() => useCurrencyDecimal());
      
      expect(result.current.displayCurrency).toBe('USD');
      const firstFormat = result.current.formatCurrency(100);
      expect(firstFormat).toBe('$100.00');
      
      // Change to EUR
      mockUsePreferences.mockReturnValue({ currency: 'EUR' } as any);
      rerender();
      
      expect(result.current.displayCurrency).toBe('EUR');
      const secondFormat = result.current.formatCurrency(100);
      expect(secondFormat).toBe('€100.00');
      
      // Reset back to USD
      mockUsePreferences.mockReturnValue({ currency: 'USD' } as any);
    });
  });

  describe('memoization', () => {
    it('memoizes returned object when dependencies do not change', () => {
      const { result, rerender } = renderHook(() => useCurrencyDecimal());
      
      const firstResult = result.current;
      rerender();
      const secondResult = result.current;
      
      expect(firstResult).toBe(secondResult);
    });

    it('returns new object when currency preference changes', () => {
      mockUsePreferences.mockReturnValue({ currency: 'USD' } as any);
      const { result, rerender } = renderHook(() => useCurrencyDecimal());
      
      const firstResult = result.current;
      
      // Change currency
      mockUsePreferences.mockReturnValue({ currency: 'EUR' } as any);
      rerender();
      
      const secondResult = result.current;
      
      expect(firstResult).not.toBe(secondResult);
    });
  });

  describe('edge cases', () => {
    it('handles fractional cents', () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const formatted = result.current.formatCurrency(10.999);
      expect(formatted).toBe('$11.00');
    });

    it('handles extremely small amounts', () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const formatted = result.current.formatCurrency(0.001);
      expect(formatted).toBe('$0.00');
    });

    it('handles null currency gracefully', () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      // TypeScript would normally prevent this, but testing runtime behavior
      const formatted = result.current.formatCurrency(100, null as any);
      expect(formatted).toBeDefined();
    });

    it('handles mixed Decimal and number amounts in convertAndSum', async () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const amounts = [
        { amount: toDecimal(100), currency: 'USD' },
        { amount: 200, currency: 'USD' },
        { amount: toDecimal(50.50), currency: 'USD' }
      ];
      
      const total = await result.current.convertAndSum(amounts);
      expect(total.toNumber()).toBe(350.50);
    });
  });

  describe('real-world scenarios', () => {
    it('handles shopping cart with multiple currencies', async () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const cartItems = [
        { amount: 29.99, currency: 'USD' },    // US item: 29.99
        { amount: 24.99, currency: 'EUR' },    // EU item: 24.99 * 1.18 = 29.49 USD
        { amount: 19.99, currency: 'GBP' },    // UK item: 19.99 * 1.37 = 27.39 USD
      ];
      
      const total = await result.current.convertAndSum(cartItems);
      const formatted = result.current.formatCurrency(total);
      
      expect(total.toNumber()).toBeCloseTo(86.87, 1); // 29.99 + 29.49 + 27.39
      expect(formatted).toBe('$86.86'); // Actual rounding result
    });

    it('handles investment portfolio values', async () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      const holdings = [
        { amount: toDecimal(10000), currency: 'USD' },  // 10000
        { amount: toDecimal(5000), currency: 'EUR' },   // 5000 * 1.18 = 5900
        { amount: toDecimal(3000), currency: 'GBP' }    // 3000 * 1.37 = 4110
      ];
      
      const totalValue = await result.current.convertAndSum(holdings);
      const formatted = result.current.formatCurrency(totalValue);
      
      expect(totalValue.toNumber()).toBe(20010); // 10000 + 5900 + 4110
      expect(formatted).toBe('$20010.00');
    });

    it('handles expense tracking across currencies', async () => {
      const { result } = renderHook(() => useCurrencyDecimal());
      
      // Travel expenses in different currencies
      const expenses = [
        { amount: 150, currency: 'EUR' },    // Hotel: 150 * 1.18 = 177
        { amount: 50, currency: 'GBP' },     // Dinner: 50 * 1.37 = 68.5
        { amount: 30, currency: 'USD' }      // Taxi: 30
      ];
      
      const total = await result.current.convertAndSum(expenses);
      expect(total.toNumber()).toBe(275.5); // 177 + 68.5 + 30
    });
  });
});
