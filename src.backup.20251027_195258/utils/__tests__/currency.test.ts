import { describe, it, expect } from 'vitest';
import { 
  formatCurrency, 
  getCurrencySymbol, 
  parseCurrency,
  convertCurrency,
  getExchangeRate
} from '../currency';

describe('Currency Utilities', () => {
  describe('formatCurrency', () => {
    it('formats GBP correctly', () => {
      expect(formatCurrency(1234.56, 'GBP')).toBe('£1,234.56');
      expect(formatCurrency(0, 'GBP')).toBe('£0.00');
      expect(formatCurrency(-99.99, 'GBP')).toBe('-£99.99');
    });

    it('formats USD correctly', () => {
      expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
      expect(formatCurrency(0.01, 'USD')).toBe('$0.01');
    });

    it('formats EUR correctly', () => {
      expect(formatCurrency(1234.56, 'EUR')).toBe('€1,234.56');
      expect(formatCurrency(1000000, 'EUR')).toBe('€1,000,000.00');
    });

    it('rounds to 2 decimal places', () => {
      expect(formatCurrency(1234.567, 'GBP')).toBe('£1,234.57');
      expect(formatCurrency(1234.564, 'GBP')).toBe('£1,234.56');
    });

    it('handles large numbers', () => {
      expect(formatCurrency(1234567890.12, 'GBP')).toBe('£1,234,567,890.12');
    });

    it('handles very small numbers', () => {
      expect(formatCurrency(0.01, 'GBP')).toBe('£0.01');
      expect(formatCurrency(0.001, 'GBP')).toBe('£0.00');
    });
  });

  describe('getCurrencySymbol', () => {
    it('returns correct symbols', () => {
      expect(getCurrencySymbol('GBP')).toBe('£');
      expect(getCurrencySymbol('USD')).toBe('$');
      expect(getCurrencySymbol('EUR')).toBe('€');
    });

    it('returns currency code for unknown currencies', () => {
      expect(getCurrencySymbol('XYZ')).toBe('XYZ');
    });
  });

  describe('parseCurrency', () => {
    it('parses currency strings correctly', () => {
      expect(parseCurrency('£1,234.56')).toBe(1234.56);
      expect(parseCurrency('$1,234.56')).toBe(1234.56);
      expect(parseCurrency('€1,234.56')).toBe(1234.56);
    });

    it('handles negative values', () => {
      expect(parseCurrency('-£1,234.56')).toBe(-1234.56);
      expect(parseCurrency('£-1,234.56')).toBe(-1234.56);
    });

    it('handles values without currency symbols', () => {
      expect(parseCurrency('1234.56')).toBe(1234.56);
      expect(parseCurrency('1,234.56')).toBe(1234.56);
    });

    it('handles invalid input', () => {
      expect(parseCurrency('')).toBe(0);
      expect(parseCurrency('abc')).toBe(0);
      expect(parseCurrency('£')).toBe(0);
    });

    it('handles edge cases', () => {
      expect(parseCurrency('0')).toBe(0);
      expect(parseCurrency('£0.00')).toBe(0);
      expect(parseCurrency('.50')).toBe(0.5);
    });
  });

  describe('convertCurrency', () => {
    it('converts between currencies', () => {
      // USD to GBP = 1 / 1.25 = 0.8
      expect(convertCurrency(100, 'USD', 'GBP')).toBe(80);
      // EUR to GBP = 1 / 1.176470588 ≈ 0.85
      expect(convertCurrency(100, 'EUR', 'GBP')).toBeCloseTo(85, 0);
    });

    it('returns same value for same currency', () => {
      expect(convertCurrency(100, 'GBP', 'GBP')).toBe(100);
      expect(convertCurrency(100, 'USD', 'USD')).toBe(100);
    });

    it('handles zero amount', () => {
      expect(convertCurrency(0, 'USD', 'GBP')).toBe(0);
    });

    it('handles negative amounts', () => {
      expect(convertCurrency(-100, 'USD', 'GBP')).toBeCloseTo(-80, 1);
    });

    it('converts through GBP as base currency', () => {
      // USD to EUR should go through GBP
      // USD to GBP: 100 / 1.25 = 80
      // GBP to EUR: 80 * 1.176470588 = 94.12
      const usdToEur = convertCurrency(100, 'USD', 'EUR');
      expect(usdToEur).toBeCloseTo(94.12, 1);
    });
  });

  describe('getExchangeRate', () => {
    it('returns correct exchange rates to GBP', () => {
      expect(getExchangeRate('USD', 'GBP')).toBe(0.8); // 1 / 1.25
      expect(getExchangeRate('EUR', 'GBP')).toBeCloseTo(0.85, 2); // 1 / 1.176470588
      expect(getExchangeRate('GBP', 'GBP')).toBe(1);
    });

    it('calculates rates from GBP', () => {
      expect(getExchangeRate('GBP', 'USD')).toBe(1.25);
      expect(getExchangeRate('GBP', 'EUR')).toBeCloseTo(1.176470588, 6);
    });

    it('calculates cross rates', () => {
      // USD to EUR = (EUR rate) / (USD rate) = 1.176470588 / 1.25
      expect(getExchangeRate('USD', 'EUR')).toBeCloseTo(0.9412, 3);
    });
  });
});
