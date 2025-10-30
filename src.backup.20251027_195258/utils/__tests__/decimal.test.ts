import { describe, it, expect } from 'vitest';
import {
  toDecimal,
  toNumber,
  toStorageNumber,
  sumDecimals,
  calculatePercentage,
  decimalsEqual,
} from '@wealthtracker/utils';

describe('Decimal Utilities', () => {
  describe('toDecimal', () => {
    it('converts numbers to Decimal', () => {
      const result = toDecimal(123.45);
      expect(result.toString()).toBe('123.45');
    });

    it('converts strings to Decimal', () => {
      const result = toDecimal('123.45');
      expect(result.toString()).toBe('123.45');
    });

    it('handles null and undefined', () => {
      expect(toDecimal(null).toString()).toBe('0');
      expect(toDecimal(undefined).toString()).toBe('0');
    });

    it('handles floating point precision correctly', () => {
      const result = toDecimal(0.1).plus(toDecimal(0.2));
      expect(result.toString()).toBe('0.3');
    });
  });

  describe('toNumber', () => {
    it('converts Decimal to number with 2 decimal places', () => {
      const decimal = toDecimal(123.456);
      expect(toNumber(decimal)).toBe(123.46);
    });

    it('rounds correctly', () => {
      const decimal = toDecimal(123.455);
      expect(toNumber(decimal)).toBe(123.46); // Rounds up
    });
  });

  describe('toStorageNumber', () => {
    it('rounds using ROUND_HALF_UP', () => {
      const decimal = toDecimal(123.445);
      expect(toStorageNumber(decimal)).toBe(123.45);
    });
  });

  describe('sumDecimals', () => {
    it('sums array of numbers', () => {
      const result = sumDecimals([1, 2, 3, 4, 5]);
      expect(result.toString()).toBe('15');
    });

    it('sums array of mixed types', () => {
      const result = sumDecimals([1, '2.5', toDecimal(3.5)]);
      expect(result.toString()).toBe('7');
    });

    it('handles empty array', () => {
      const result = sumDecimals([]);
      expect(result.toString()).toBe('0');
    });

    it('maintains precision', () => {
      const result = sumDecimals([0.1, 0.2, 0.3]);
      expect(result.toString()).toBe('0.6');
    });
  });

  describe('calculatePercentage', () => {
    it('calculates percentage correctly', () => {
      const result = calculatePercentage(200, 15);
      expect(result.toString()).toBe('30');
    });

    it('handles decimal percentages', () => {
      const result = calculatePercentage(100, 12.5);
      expect(result.toString()).toBe('12.5');
    });

    it('handles Decimal inputs', () => {
      const result = calculatePercentage(toDecimal(50), toDecimal(20));
      expect(result.toString()).toBe('10');
    });
  });

  describe('decimalsEqual', () => {
    it('returns true for equal values', () => {
      expect(decimalsEqual(123.45, 123.45)).toBe(true);
      expect(decimalsEqual(toDecimal(100), 100)).toBe(true);
    });

    it('returns false for different values', () => {
      expect(decimalsEqual(123.45, 123.461)).toBe(false);
    });

    it('uses tolerance for near-equal values', () => {
      expect(decimalsEqual(100, 100.009)).toBe(true); // Within 0.01 tolerance
      expect(decimalsEqual(100, 100.011)).toBe(false); // Outside tolerance
    });

    it('respects custom tolerance', () => {
      expect(decimalsEqual(100, 100.05, 0.1)).toBe(true);
      expect(decimalsEqual(100, 100.11, 0.1)).toBe(false);
    });
  });
});
