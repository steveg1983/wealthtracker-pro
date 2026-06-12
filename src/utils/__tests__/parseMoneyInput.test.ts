import { describe, it, expect } from 'vitest';
import { parseMoneyInput } from '../decimal';

describe('parseMoneyInput', () => {
  describe('valid inputs', () => {
    it('parses plain integers', () => {
      expect(parseMoneyInput('100')).toBe(100);
      expect(parseMoneyInput('0')).toBe(0);
    });

    it('parses decimals', () => {
      expect(parseMoneyInput('12.34')).toBe(12.34);
      expect(parseMoneyInput('0.01')).toBe(0.01);
    });

    it('parses leading-dot decimals', () => {
      expect(parseMoneyInput('.5')).toBe(0.5);
      expect(parseMoneyInput('.50')).toBe(0.5);
    });

    it('parses negative amounts', () => {
      expect(parseMoneyInput('-100')).toBe(-100);
      expect(parseMoneyInput('-12.34')).toBe(-12.34);
      expect(parseMoneyInput('-.5')).toBe(-0.5);
    });

    it('strips currency symbols', () => {
      expect(parseMoneyInput('£100.50')).toBe(100.5);
      expect(parseMoneyInput('$99.99')).toBe(99.99);
      expect(parseMoneyInput('€42')).toBe(42);
    });

    it('strips thousands separators and whitespace', () => {
      expect(parseMoneyInput('1,234.56')).toBe(1234.56);
      expect(parseMoneyInput(' 1 000 ')).toBe(1000);
      expect(parseMoneyInput('£1,234,567.89')).toBe(1234567.89);
    });

    it('rounds to 2 decimal places HALF_UP', () => {
      expect(parseMoneyInput('12.345')).toBe(12.35);
      expect(parseMoneyInput('12.344')).toBe(12.34);
      expect(parseMoneyInput('0.005')).toBe(0.01);
    });

    it('avoids float artifacts on classic problem values', () => {
      // 0.1 + 0.2 style values parse exactly
      expect(parseMoneyInput('0.30')).toBe(0.3);
      expect(parseMoneyInput('1.10')).toBe(1.1);
    });

    it('accepts finite numbers directly', () => {
      expect(parseMoneyInput(42)).toBe(42);
      expect(parseMoneyInput(12.345)).toBe(12.35);
      expect(parseMoneyInput(-7)).toBe(-7);
      expect(parseMoneyInput(0)).toBe(0);
    });
  });

  describe('invalid inputs — strict where parseFloat is sloppy', () => {
    it('rejects trailing garbage that parseFloat accepts', () => {
      // parseFloat('12.34abc') === 12.34 — that silent acceptance is the bug
      expect(parseMoneyInput('12.34abc')).toBeNull();
      expect(parseMoneyInput('100x')).toBeNull();
    });

    it('rejects non-numeric strings', () => {
      expect(parseMoneyInput('abc')).toBeNull();
      expect(parseMoneyInput('twelve')).toBeNull();
    });

    it('rejects empty and symbol-only input', () => {
      expect(parseMoneyInput('')).toBeNull();
      expect(parseMoneyInput('   ')).toBeNull();
      expect(parseMoneyInput('£')).toBeNull();
      expect(parseMoneyInput('-')).toBeNull();
      expect(parseMoneyInput('.')).toBeNull();
    });

    it('rejects multiple decimal points', () => {
      expect(parseMoneyInput('1.2.3')).toBeNull();
    });

    it('rejects scientific notation', () => {
      expect(parseMoneyInput('1e5')).toBeNull();
    });

    it('rejects null, undefined, and non-finite numbers', () => {
      expect(parseMoneyInput(null)).toBeNull();
      expect(parseMoneyInput(undefined)).toBeNull();
      expect(parseMoneyInput(Number.NaN)).toBeNull();
      expect(parseMoneyInput(Number.POSITIVE_INFINITY)).toBeNull();
      expect(parseMoneyInput(Number.NEGATIVE_INFINITY)).toBeNull();
    });
  });
});
