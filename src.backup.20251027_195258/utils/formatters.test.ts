/**
 * Formatters Tests
 * Tests for currency, number, and compact number formatting utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatCurrency, formatNumber, formatCompactNumber } from './formatters';
import { formatDecimalFixed } from '@wealthtracker/utils';

describe('Formatters', () => {
  beforeEach(() => {
    // Mock toLocaleString to ensure consistent test results
    vi.spyOn(Number.prototype, 'toLocaleString').mockImplementation(function(locales, options) {
      // Simulate en-GB formatting
      const num = this as number;
      
      if (options?.minimumFractionDigits === 2 && options?.maximumFractionDigits === 2) {
        const formatted = formatDecimalFixed(Math.abs(num), 2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return num < 0 ? `-${formatted}` : formatted;
      }
      
      const formatted = Math.abs(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return num < 0 ? `-${formatted}` : formatted;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('formatCurrency', () => {
    it('formats GBP currency by default', () => {
      const result = formatCurrency(1234.56);
      expect(result).toBe('£1,234.56');
    });

    it('formats USD currency correctly', () => {
      const result = formatCurrency(1234.56, 'USD');
      expect(result).toBe('$1,234.56');
    });

    it('formats EUR currency correctly', () => {
      const result = formatCurrency(1234.56, 'EUR');
      expect(result).toBe('€1,234.56');
    });

    it('formats JPY currency correctly', () => {
      const result = formatCurrency(1234.56, 'JPY');
      expect(result).toBe('¥1,234.56');
    });

    it('handles zero amounts', () => {
      const result = formatCurrency(0);
      expect(result).toBe('£0.00');
    });

    it('handles negative amounts correctly', () => {
      const result = formatCurrency(-1234.56);
      expect(result).toBe('-£1,234.56');
    });

    it('formats very large amounts', () => {
      const result = formatCurrency(1234567890.12);
      expect(result).toBe('£1,234,567,890.12');
    });

    it('formats very small amounts', () => {
      const result = formatCurrency(0.01);
      expect(result).toBe('£0.01');
    });

    it('handles decimal precision correctly', () => {
      const result = formatCurrency(1234.5);
      expect(result).toBe('£1,234.50');
    });

    it('rounds to 2 decimal places', () => {
      const result = formatCurrency(1234.567);
      expect(result).toBe('£1,234.57');
    });

    it('handles edge case with no decimal part', () => {
      const result = formatCurrency(1000);
      expect(result).toBe('£1,000.00');
    });

    it('handles all supported currency codes', () => {
      expect(formatCurrency(100, 'GBP')).toBe('£100.00');
      expect(formatCurrency(100, 'USD')).toBe('$100.00');
      expect(formatCurrency(100, 'EUR')).toBe('€100.00');
    });

    it('handles unknown currency codes', () => {
      const result = formatCurrency(100, 'gbp');
      expect(result).toBe('gbp100.00'); // Unknown codes are used as-is
    });

    it('handles empty currency parameter', () => {
      const result = formatCurrency(100, '');
      expect(result).toBe('100.00'); // Empty string results in no symbol
    });
  });

  describe('formatNumber', () => {
    it('formats positive numbers with 2 decimal places', () => {
      const result = formatNumber(1234.56);
      expect(result).toBe('1,234.56');
    });

    it('formats negative numbers', () => {
      const result = formatNumber(-1234.56);
      expect(result).toBe('-1,234.56');
    });

    it('formats zero', () => {
      const result = formatNumber(0);
      expect(result).toBe('0.00');
    });

    it('adds trailing zeros for whole numbers', () => {
      const result = formatNumber(1000);
      expect(result).toBe('1,000.00');
    });

    it('formats single decimal places', () => {
      const result = formatNumber(123.5);
      expect(result).toBe('123.50');
    });

    it('rounds to 2 decimal places', () => {
      const result = formatNumber(123.567);
      expect(result).toBe('123.57');
    });

    it('handles very large numbers', () => {
      const result = formatNumber(9876543210.99);
      expect(result).toBe('9,876,543,210.99');
    });

    it('handles very small positive numbers', () => {
      const result = formatNumber(0.01);
      expect(result).toBe('0.01');
    });

    it('handles very small negative numbers', () => {
      const result = formatNumber(-0.01);
      expect(result).toBe('-0.01');
    });

    it('formats numbers with many decimal places', () => {
      const result = formatNumber(123.123456789);
      expect(result).toBe('123.12');
    });

    it('handles edge case of NaN', () => {
      const result = formatNumber(NaN);
      expect(result).toBe('NaN');
    });

    it('handles edge case of Infinity', () => {
      const result = formatNumber(Infinity);
      expect(result).toBe('Infinity');
    });

    it('handles edge case of negative Infinity', () => {
      const result = formatNumber(-Infinity);
      expect(result).toBe('-Infinity');
    });
  });

  describe('formatCompactNumber', () => {
    it('formats millions with M suffix', () => {
      const result = formatCompactNumber(1234567);
      expect(result).toBe('1.2M');
    });

    it('formats thousands with K suffix', () => {
      const result = formatCompactNumber(1234);
      expect(result).toBe('1.2K');
    });

    it('uses formatNumber for numbers under 1000', () => {
      const result = formatCompactNumber(999);
      expect(result).toBe('999.00');
    });

    it('formats exactly 1 million', () => {
      const result = formatCompactNumber(1000000);
      expect(result).toBe('1.0M');
    });

    it('formats exactly 1 thousand', () => {
      const result = formatCompactNumber(1000);
      expect(result).toBe('1.0K');
    });

    it('rounds to 1 decimal place for millions', () => {
      const result = formatCompactNumber(1234567890);
      expect(result).toBe('1234.6M');
    });

    it('rounds to 1 decimal place for thousands', () => {
      const result = formatCompactNumber(1567);
      expect(result).toBe('1.6K');
    });

    it('handles zero', () => {
      const result = formatCompactNumber(0);
      expect(result).toBe('0.00');
    });

    it('handles negative millions (falls through to formatNumber)', () => {
      const result = formatCompactNumber(-2500000);
      expect(result).toBe('-2,500,000.00'); // Negative numbers don't match >= condition
    });

    it('handles negative thousands (falls through to formatNumber)', () => {
      const result = formatCompactNumber(-1500);
      expect(result).toBe('-1,500.00'); // Negative numbers don't match >= condition
    });

    it('handles negative small numbers', () => {
      const result = formatCompactNumber(-500);
      expect(result).toBe('-500.00');
    });

    it('formats boundary cases correctly', () => {
      expect(formatCompactNumber(999.99)).toBe('999.99'); // Under 1K - uses formatNumber
      expect(formatCompactNumber(1000.1)).toBe('1.0K'); // Just over 1K
      expect(formatCompactNumber(999999)).toBe('1000.0K'); // Just under 1M
      expect(formatCompactNumber(1000000.1)).toBe('1.0M'); // Just over 1M
    });

    it('handles very large numbers', () => {
      const result = formatCompactNumber(9876543210000);
      expect(result).toBe('9876543.2M');
    });

    it('formats decimal inputs correctly for millions', () => {
      const result = formatCompactNumber(1500000.5);
      expect(result).toBe('1.5M');
    });

    it('formats decimal inputs correctly for thousands', () => {
      const result = formatCompactNumber(1500.7);
      expect(result).toBe('1.5K');
    });

    it('handles rounding edge cases in millions', () => {
      expect(formatCompactNumber(1450000)).toBe('1.4M'); // rounding 1.45M down to 1.4M
      expect(formatCompactNumber(1460000)).toBe('1.5M'); // rounding 1.46M up to 1.5M
    });

    it('handles rounding edge cases in thousands', () => {
      expect(formatCompactNumber(1450)).toBe('1.4K'); // rounding 1.45K down to 1.4K
      expect(formatCompactNumber(1460)).toBe('1.5K'); // rounding 1.46K up to 1.5K
    });

    it('preserves precision for edge values', () => {
      expect(formatCompactNumber(1000000)).toBe('1.0M');
      expect(formatCompactNumber(1000)).toBe('1.0K');
      expect(formatCompactNumber(999)).toBe('999.00');
    });

    it('handles fractional millions correctly', () => {
      expect(formatCompactNumber(1100000)).toBe('1.1M');
      expect(formatCompactNumber(1010000)).toBe('1.0M');
      expect(formatCompactNumber(1001000)).toBe('1.0M');
    });

    it('handles fractional thousands correctly', () => {
      expect(formatCompactNumber(1100)).toBe('1.1K');
      expect(formatCompactNumber(1010)).toBe('1.0K');
      expect(formatCompactNumber(1001)).toBe('1.0K');
    });

    it('handles special number values', () => {
      // NaN fails the >= comparisons and falls through to formatNumber
      expect(formatCompactNumber(NaN)).toBe('NaN');
      // Infinity >= 1000000 is true, so it gets M suffix: (Infinity / 1000000) rounded to one decimal + 'M'
      expect(formatCompactNumber(Infinity)).toBe('InfinityM'); 
      // -Infinity < 1000000, so falls through to formatNumber
      expect(formatCompactNumber(-Infinity)).toBe('-Infinity'); 
    });
  });

  describe('integration tests', () => {
    it('maintains consistency between formatNumber and compact formatting for small numbers', () => {
      const smallNumber = 500;
      const formatted = formatNumber(smallNumber);
      const compact = formatCompactNumber(smallNumber);
      expect(compact).toBe(formatted);
    });

    it('handles currency formatting with all number ranges', () => {
      const amounts = [0, 999, 1000, 1234, 999999, 1000000, 1234567];
      
      amounts.forEach(amount => {
        const currency = formatCurrency(amount);
        const compact = formatCompactNumber(amount);
        
        // Currency should always include symbol
        expect(currency).toMatch(/^[£$€]/);
        
        // Compact should handle large numbers efficiently
        if (amount >= 1000000) {
          expect(compact).toMatch(/M$/);
        } else if (amount >= 1000) {
          expect(compact).toMatch(/K$/);
        }
      });
    });

    it('handles negative numbers consistently across all formatters', () => {
      const negativeAmount = -1234567;
      
      const currency = formatCurrency(negativeAmount);
      const number = formatNumber(negativeAmount);
      const compact = formatCompactNumber(negativeAmount);
      
      // Currency should preserve negative sign
      expect(currency).toBe('-£1,234,567.00');
      
      // Number should preserve negative
      expect(number).toBe('-1,234,567.00');
      
      // Compact falls through to formatNumber for negative values
      expect(compact).toBe('-1,234,567.00');
    });

    it('maintains precision requirements across formatters', () => {
      const testValue = 1234.5678;
      
      const currency = formatCurrency(testValue);
      const number = formatNumber(testValue);
      const compact = formatCompactNumber(testValue);
      
      // All should round to appropriate precision
      expect(currency).toBe('£1,234.57');
      expect(number).toBe('1,234.57');
      expect(compact).toBe('1.2K');
    });
  });

  describe('error handling and edge cases', () => {
    // Note: The formatter functions are not designed to handle null/undefined gracefully
    // They expect valid number inputs as per their TypeScript signatures

    it('handles string input that can be coerced to number', () => {
      expect(() => formatCurrency(Number("123.45"))).not.toThrow();
      expect(() => formatNumber(Number("123.45"))).not.toThrow();
      expect(() => formatCompactNumber(Number("123.45"))).not.toThrow();
    });

    it('handles very large numbers without overflow', () => {
      const largeNumber = Number.MAX_SAFE_INTEGER;
      
      expect(() => formatCurrency(largeNumber)).not.toThrow();
      expect(() => formatNumber(largeNumber)).not.toThrow();
      expect(() => formatCompactNumber(largeNumber)).not.toThrow();
    });

    it('handles very small numbers near zero', () => {
      const smallNumber = Number.MIN_VALUE;
      
      expect(() => formatCurrency(smallNumber)).not.toThrow();
      expect(() => formatNumber(smallNumber)).not.toThrow();
      expect(() => formatCompactNumber(smallNumber)).not.toThrow();
    });

    it('handles locale-specific formatting correctly', () => {
      const amount = 1234.56;
      
      // Should use en-GB locale formatting
      expect(formatCurrency(amount)).toMatch(/1,234\.56/);
      expect(formatNumber(amount)).toMatch(/1,234\.56/);
    });
  });
});
