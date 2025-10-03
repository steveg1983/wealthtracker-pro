/**
 * Comprehensive tests for decimal money operations
 * Following CLAUDE_WORKFILE.md Phase 1 requirement for money/parsers/formatters testing
 */

import { describe, it, expect } from 'vitest';
import { toDecimal } from '../decimal';
import type { DecimalInstance } from '../decimal';

describe('Decimal Money Operations', () => {
  describe('toDecimal conversion', () => {
    it('converts number to decimal correctly', () => {
      const result = toDecimal(123.45);
      expect(result.toNumber()).toBe(123.45);
    });

    it('converts string to decimal correctly', () => {
      const result = toDecimal('123.45');
      expect(result.toNumber()).toBe(123.45);
    });

    it('handles zero values correctly', () => {
      expect(toDecimal(0).toNumber()).toBe(0);
      expect(toDecimal('0').toNumber()).toBe(0);
    });

    it('handles negative values correctly', () => {
      expect(toDecimal(-123.45).toNumber()).toBe(-123.45);
      expect(toDecimal('-123.45').toNumber()).toBe(-123.45);
    });

    it('handles large numbers without precision loss', () => {
      const largeNumber = 999999999999.99;
      const result = toDecimal(largeNumber);
      expect(result.toNumber()).toBe(largeNumber);
    });
  });

  describe('Financial calculations', () => {
    it('performs addition without floating point errors', () => {
      const a = toDecimal(0.1);
      const b = toDecimal(0.2);
      const result = a.plus(b);
      expect(result.toNumber()).toBe(0.3);
    });

    it('performs subtraction accurately', () => {
      const a = toDecimal(1.0);
      const b = toDecimal(0.9);
      const result = a.minus(b);
      expect(result.toNumber()).toBe(0.1);
    });

    it('handles currency calculations correctly', () => {
      const price = toDecimal(19.99);
      const quantity = toDecimal(3);
      const total = price.times(quantity);
      expect(total.toNumber()).toBe(59.97);
    });

    it('handles percentage calculations correctly', () => {
      const amount = toDecimal(1000);
      const percentage = toDecimal(15); // 15%
      const result = amount.times(percentage).dividedBy(100);
      expect(result.toNumber()).toBe(150);
    });
  });

  describe('Comparison operations', () => {
    it('compares decimal values correctly', () => {
      const a = toDecimal(100);
      const b = toDecimal(200);

      expect(a.lessThan(b)).toBe(true);
      expect(b.greaterThan(a)).toBe(true);
      expect(a.equals(toDecimal(100))).toBe(true);
    });

    it('handles precision in comparisons', () => {
      const a = toDecimal(0.1).plus(toDecimal(0.2));
      const b = toDecimal(0.3);
      expect(a.equals(b)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('handles invalid string inputs gracefully', () => {
      expect(() => toDecimal('invalid')).not.toThrow();
      expect(toDecimal('invalid').toNumber()).toBeNaN();
    });

    it('handles very small numbers correctly', () => {
      const small = toDecimal(0.000001);
      expect(small.toNumber()).toBe(0.000001);
    });
  });
});