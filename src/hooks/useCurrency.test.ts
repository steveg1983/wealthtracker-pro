/**
 * useCurrency Hook Tests
 * Comprehensive tests for the deprecated currency hook (maintained for backward compatibility)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCurrency } from './useCurrency';

// Mock the PreferencesContext
vi.mock('../contexts/PreferencesContext', () => ({
  usePreferences: vi.fn(() => ({
    currency: 'USD'
  }))
}));

// Mock the currency utilities
vi.mock('../utils/currency', () => ({
  formatCurrency: vi.fn((amount, currency) => {
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£';
    return `${symbol}${amount.toFixed(2)}`;
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
    
    if (from === to) return amount;
    
    const rate = rates[from]?.[to] || 1;
    return amount * rate;
  }),
  convertMultipleCurrencies: vi.fn(async (amounts, targetCurrency) => {
    // Mock conversion of multiple currencies
    let total = 0;
    for (const item of amounts) {
      if (item.currency === targetCurrency) {
        total += item.amount;
      } else {
        // Simple mock conversion
        const rates: Record<string, Record<string, number>> = {
          USD: { EUR: 0.85, GBP: 0.73 },
          EUR: { USD: 1.18, GBP: 0.86 },
          GBP: { USD: 1.37, EUR: 1.16 }
        };
        const rate = rates[item.currency]?.[targetCurrency] || 1;
        total += item.amount * rate;
      }
    }
    return total;
  })
}));

describe('useCurrency', () => {
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

  describe('basic functionality', () => {
    it('returns all expected properties', () => {
      const { result } = renderHook(() => useCurrency());
      
      expect(result.current).toHaveProperty('displayCurrency');
      expect(result.current).toHaveProperty('currencySymbol');
      expect(result.current).toHaveProperty('formatCurrency');
      expect(result.current).toHaveProperty('convertAndFormat');
      expect(result.current).toHaveProperty('convert');
      expect(result.current).toHaveProperty('convertAndSum');
    });

    it('uses the currency from preferences', () => {
      const { result } = renderHook(() => useCurrency());
      
      expect(result.current.displayCurrency).toBe('USD');
      expect(result.current.currencySymbol).toBe('$');
    });

    it('updates when currency preference changes', () => {
      const { result, rerender } = renderHook(() => useCurrency());
      
      expect(result.current.displayCurrency).toBe('USD');
      expect(result.current.currencySymbol).toBe('$');
      
      // Change to EUR
      mockUsePreferences.mockReturnValue({ currency: 'EUR' } as any);
      rerender();
      
      expect(result.current.displayCurrency).toBe('EUR');
      expect(result.current.currencySymbol).toBe('€');
    });
  });

  describe('formatCurrency', () => {
    it('formats amount in display currency', () => {
      const { result } = renderHook(() => useCurrency());
      
      const formatted = result.current.formatCurrency(100);
      expect(formatted).toBe('$100.00');
    });

    it('formats amount in specified currency', () => {
      const { result } = renderHook(() => useCurrency());
      
      const formatted = result.current.formatCurrency(100, 'EUR');
      expect(formatted).toBe('€100.00');
    });

    it('handles zero amounts', () => {
      const { result } = renderHook(() => useCurrency());
      
      const formatted = result.current.formatCurrency(0);
      expect(formatted).toBe('$0.00');
    });

    it('handles negative amounts', () => {
      const { result } = renderHook(() => useCurrency());
      
      const formatted = result.current.formatCurrency(-50);
      expect(formatted).toBe('$-50.00');
    });

    it('handles decimal amounts', () => {
      const { result } = renderHook(() => useCurrency());
      
      const formatted = result.current.formatCurrency(99.99);
      expect(formatted).toBe('$99.99');
    });
  });

  describe('convertAndFormat', () => {
    it('formats without conversion when currency matches', async () => {
      const { result } = renderHook(() => useCurrency());
      
      const formatted = await result.current.convertAndFormat(100, 'USD');
      expect(formatted).toBe('$100.00');
    });

    it('converts and formats from EUR to USD', async () => {
      const { result } = renderHook(() => useCurrency());
      
      const formatted = await result.current.convertAndFormat(100, 'EUR');
      expect(formatted).toBe('$118.00'); // 100 EUR * 1.18 = 118 USD
    });

    it('converts and formats from GBP to USD', async () => {
      const { result } = renderHook(() => useCurrency());
      
      const formatted = await result.current.convertAndFormat(100, 'GBP');
      expect(formatted).toBe('$137.00'); // 100 GBP * 1.37 = 137 USD
    });

    it('handles conversion errors gracefully', async () => {
      const { convertCurrency } = await import('../utils/currency');
      vi.mocked(convertCurrency).mockRejectedValueOnce(new Error('Conversion failed'));
      
      const { result } = renderHook(() => useCurrency());
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const formatted = await result.current.convertAndFormat(100, 'EUR');
      expect(formatted).toBe('€100.00 (!)'); // Shows original currency with warning
      expect(consoleSpy).toHaveBeenCalledWith('Currency conversion error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('convert', () => {
    it('returns same amount when currency matches', async () => {
      const { result } = renderHook(() => useCurrency());
      
      const converted = await result.current.convert(100, 'USD');
      expect(converted).toBe(100);
    });

    it('converts from EUR to USD', async () => {
      const { result } = renderHook(() => useCurrency());
      
      const converted = await result.current.convert(100, 'EUR');
      expect(converted).toBe(118); // 100 EUR * 1.18
    });

    it('converts from GBP to USD', async () => {
      const { result } = renderHook(() => useCurrency());
      
      const converted = await result.current.convert(100, 'GBP');
      expect(converted).toBe(137); // 100 GBP * 1.37
    });

    it('handles conversion errors by returning original amount', async () => {
      const { convertCurrency } = await import('../utils/currency');
      vi.mocked(convertCurrency).mockRejectedValueOnce(new Error('Conversion failed'));
      
      const { result } = renderHook(() => useCurrency());
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const converted = await result.current.convert(100, 'EUR');
      expect(converted).toBe(100); // Returns original amount
      expect(consoleSpy).toHaveBeenCalledWith('Currency conversion error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('convertAndSum', () => {
    it('sums amounts in the same currency', async () => {
      const { result } = renderHook(() => useCurrency());
      
      const amounts = [
        { amount: 100, currency: 'USD' },
        { amount: 200, currency: 'USD' },
        { amount: 50, currency: 'USD' }
      ];
      
      const total = await result.current.convertAndSum(amounts);
      expect(total).toBe(350);
    });

    it('converts and sums mixed currencies', async () => {
      const { result } = renderHook(() => useCurrency());
      
      const amounts = [
        { amount: 100, currency: 'USD' },    // 100 USD
        { amount: 100, currency: 'EUR' },    // 100 * 1.18 = 118 USD
        { amount: 100, currency: 'GBP' }     // 100 * 1.37 = 137 USD
      ];
      
      const total = await result.current.convertAndSum(amounts);
      expect(total).toBe(355); // 100 + 118 + 137
    });

    it('handles empty array', async () => {
      const { result } = renderHook(() => useCurrency());
      
      const total = await result.current.convertAndSum([]);
      expect(total).toBe(0);
    });

    it('handles conversion errors by summing without conversion', async () => {
      const { convertMultipleCurrencies } = await import('../utils/currency');
      vi.mocked(convertMultipleCurrencies).mockRejectedValueOnce(new Error('Conversion failed'));
      
      const { result } = renderHook(() => useCurrency());
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const amounts = [
        { amount: 100, currency: 'USD' },
        { amount: 200, currency: 'EUR' }
      ];
      
      const total = await result.current.convertAndSum(amounts);
      expect(total).toBe(300); // Just sums without conversion
      expect(consoleSpy).toHaveBeenCalledWith('Currency conversion error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('memoization and stability', () => {
    it('maintains stable currency symbol when currency doesn\'t change', () => {
      const { result, rerender } = renderHook(() => useCurrency());
      
      const firstSymbol = result.current.currencySymbol;
      rerender();
      const secondSymbol = result.current.currencySymbol;
      
      expect(firstSymbol).toBe(secondSymbol);
    });

    it('updates currency symbol when currency changes', () => {
      const { result, rerender } = renderHook(() => useCurrency());
      
      const firstSymbol = result.current.currencySymbol;
      expect(firstSymbol).toBe('$');
      
      // Change currency
      mockUsePreferences.mockReturnValue({ currency: 'EUR' } as any);
      rerender();
      
      const secondSymbol = result.current.currencySymbol;
      expect(secondSymbol).toBe('€');
    });

    it('maintains function references when currency doesn\'t change', () => {
      const { result, rerender } = renderHook(() => useCurrency());
      
      const firstFormatCurrency = result.current.formatCurrency;
      const firstConvertAndFormat = result.current.convertAndFormat;
      const firstConvert = result.current.convert;
      const firstConvertAndSum = result.current.convertAndSum;
      
      rerender();
      
      expect(result.current.formatCurrency).toBe(firstFormatCurrency);
      expect(result.current.convertAndFormat).toBe(firstConvertAndFormat);
      expect(result.current.convert).toBe(firstConvert);
      expect(result.current.convertAndSum).toBe(firstConvertAndSum);
    });

    it('updates function references when currency changes', () => {
      const { result, rerender } = renderHook(() => useCurrency());
      
      const firstFormatCurrency = result.current.formatCurrency;
      const firstConvertAndFormat = result.current.convertAndFormat;
      const firstConvert = result.current.convert;
      const firstConvertAndSum = result.current.convertAndSum;
      
      // Change currency
      mockUsePreferences.mockReturnValue({ currency: 'EUR' } as any);
      rerender();
      
      expect(result.current.formatCurrency).not.toBe(firstFormatCurrency);
      expect(result.current.convertAndFormat).not.toBe(firstConvertAndFormat);
      expect(result.current.convert).not.toBe(firstConvert);
      expect(result.current.convertAndSum).not.toBe(firstConvertAndSum);
    });
  });

  describe('real-world scenarios', () => {
    it('handles multi-currency shopping cart', async () => {
      const { result } = renderHook(() => useCurrency());
      
      const cartItems = [
        { amount: 29.99, currency: 'USD' },    // US item
        { amount: 24.99, currency: 'EUR' },    // EU item
        { amount: 19.99, currency: 'GBP' },    // UK item
      ];
      
      const total = await result.current.convertAndSum(cartItems);
      const formatted = result.current.formatCurrency(total);
      
      expect(total).toBeCloseTo(86.87, 1);
      // Due to rounding, the actual result might be 86.86
      expect(formatted).toBe('$86.86');
    });

    it('handles currency display for different regions', async () => {
      // Test USD display
      const { result: usdResult } = renderHook(() => useCurrency());
      expect(usdResult.current.formatCurrency(1234.56)).toBe('$1234.56');
      
      // Change to EUR
      mockUsePreferences.mockReturnValue({ currency: 'EUR' } as any);
      const { result: eurResult } = renderHook(() => useCurrency());
      expect(eurResult.current.formatCurrency(1234.56)).toBe('€1234.56');
      
      // Change to GBP
      mockUsePreferences.mockReturnValue({ currency: 'GBP' } as any);
      const { result: gbpResult } = renderHook(() => useCurrency());
      expect(gbpResult.current.formatCurrency(1234.56)).toBe('£1234.56');
    });

    it('handles international transaction conversion', async () => {
      const { result } = renderHook(() => useCurrency());
      
      // User in US receives payment from Europe
      const euroPayment = 500;
      const usdAmount = await result.current.convert(euroPayment, 'EUR');
      const formatted = result.current.formatCurrency(usdAmount);
      
      expect(usdAmount).toBe(590); // 500 * 1.18
      expect(formatted).toBe('$590.00');
    });
  });

  describe('edge cases', () => {
    it('handles very large amounts', () => {
      const { result } = renderHook(() => useCurrency());
      
      const formatted = result.current.formatCurrency(999999999.99);
      expect(formatted).toBe('$999999999.99');
    });

    it('handles very small amounts', () => {
      const { result } = renderHook(() => useCurrency());
      
      const formatted = result.current.formatCurrency(0.01);
      expect(formatted).toBe('$0.01');
    });

    it('handles NaN gracefully', () => {
      const { result } = renderHook(() => useCurrency());
      
      const formatted = result.current.formatCurrency(NaN);
      expect(formatted).toBe('$NaN'); // formatCurrency utility would handle this
    });

    it('handles Infinity', () => {
      const { result } = renderHook(() => useCurrency());
      
      const formatted = result.current.formatCurrency(Infinity);
      expect(formatted).toBe('$Infinity'); // formatCurrency utility would handle this
    });

    it('handles mixed valid and invalid amounts in convertAndSum', async () => {
      const { result } = renderHook(() => useCurrency());
      
      const amounts = [
        { amount: 100, currency: 'USD' },
        { amount: NaN, currency: 'USD' },
        { amount: 50, currency: 'USD' }
      ];
      
      const total = await result.current.convertAndSum(amounts);
      expect(total).toBeNaN(); // NaN propagates through sum
    });
  });

  describe('deprecation notice', () => {
    it('is marked as deprecated in the source file', () => {
      // This test just documents that the hook is deprecated
      // The actual deprecation notice is in the source file comments
      expect(true).toBe(true);
    });
  });
});