import { describe, it, expect } from 'vitest';
import {
  formatMoneyForDisplay,
  reflectsEmittedValue,
  sanitizeMoneyKeystroke,
  stripGrouping
} from '../moneyInput';

describe('formatMoneyForDisplay', () => {
  it('groups thousands and pads to two decimals', () => {
    expect(formatMoneyForDisplay('1000000')).toBe('1,000,000.00');
    expect(formatMoneyForDisplay(1000000)).toBe('1,000,000.00');
    expect(formatMoneyForDisplay('1234.5')).toBe('1,234.50');
    expect(formatMoneyForDisplay('118200')).toBe('118,200.00');
    expect(formatMoneyForDisplay('999')).toBe('999.00');
  });

  it('keeps the sign and groups negatives', () => {
    expect(formatMoneyForDisplay('-1000000')).toBe('-1,000,000.00');
    expect(formatMoneyForDisplay(-2500.5)).toBe('-2,500.50');
  });

  it('rounds half up to the requested precision', () => {
    expect(formatMoneyForDisplay('1000.005')).toBe('1,000.01');
    expect(formatMoneyForDisplay('1234.567', 0)).toBe('1,235');
    expect(formatMoneyForDisplay('1.23456', 4)).toBe('1.2346');
  });

  it('accepts an already formatted or symbol-prefixed value', () => {
    expect(formatMoneyForDisplay('1,000,000')).toBe('1,000,000.00');
    expect(formatMoneyForDisplay('£1,234.56')).toBe('1,234.56');
  });

  it('renders blank input as blank', () => {
    expect(formatMoneyForDisplay('')).toBe('');
    expect(formatMoneyForDisplay('   ')).toBe('');
    expect(formatMoneyForDisplay(null)).toBe('');
    expect(formatMoneyForDisplay(undefined)).toBe('');
    expect(formatMoneyForDisplay(Number.NaN)).toBe('');
  });

  it('hands back anything that is not a plain amount rather than destroying it', () => {
    expect(formatMoneyForDisplay('12.')).toBe('12.');
    expect(formatMoneyForDisplay('-')).toBe('-');
    expect(formatMoneyForDisplay('abc')).toBe('abc');
  });
});

describe('sanitizeMoneyKeystroke', () => {
  it('drops letters, symbols and stray signs', () => {
    expect(sanitizeMoneyKeystroke('1a2b3')).toBe('123');
    expect(sanitizeMoneyKeystroke('£1,234.56')).toBe('1,234.56');
    expect(sanitizeMoneyKeystroke('1e5')).toBe('15');
    expect(sanitizeMoneyKeystroke('-50')).toBe('50');
  });

  it('keeps a leading minus when negatives are allowed', () => {
    expect(sanitizeMoneyKeystroke('-50', { allowNegative: true })).toBe('-50');
    expect(sanitizeMoneyKeystroke('5-0', { allowNegative: true })).toBe('50');
  });

  it('caps the fraction and folds extra decimal points', () => {
    expect(sanitizeMoneyKeystroke('12.345')).toBe('12.34');
    expect(sanitizeMoneyKeystroke('12.3.4')).toBe('12.34');
    expect(sanitizeMoneyKeystroke('12.34', { decimals: 0 })).toBe('12');
    expect(sanitizeMoneyKeystroke('1.2345', { decimals: 4 })).toBe('1.2345');
  });

  it('leaves a half-typed amount alone', () => {
    expect(sanitizeMoneyKeystroke('12.')).toBe('12.');
    expect(sanitizeMoneyKeystroke('')).toBe('');
  });
});

describe('stripGrouping', () => {
  it('removes only the separators', () => {
    expect(stripGrouping('1,000,000.00')).toBe('1000000.00');
    expect(stripGrouping('-1,234.50')).toBe('-1234.50');
    expect(stripGrouping('')).toBe('');
  });
});

describe('reflectsEmittedValue', () => {
  it('compares string state exactly', () => {
    expect(reflectsEmittedValue('1000', '1000')).toBe(true);
    expect(reflectsEmittedValue('', '1000')).toBe(false);
  });

  it('compares number state through the money parser', () => {
    expect(reflectsEmittedValue(1000, '1000')).toBe(true);
    expect(reflectsEmittedValue(1000.5, '1000.50')).toBe(true);
    expect(reflectsEmittedValue(0, '1000')).toBe(false);
  });

  it('cannot judge a half-typed amount, so it keeps the draft', () => {
    expect(reflectsEmittedValue(0, '12.')).toBe(true);
    expect(reflectsEmittedValue(0, '')).toBe(true);
    expect(reflectsEmittedValue(null, '1000')).toBe(false);
  });
});
