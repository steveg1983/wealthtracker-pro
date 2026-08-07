import { describe, expect, it } from 'vitest';
import {
  BANK_ACCOUNT_NUMBER_LENGTH,
  CARD_LAST_FOUR_LENGTH,
  formatSortCode,
  hasMoreThanLastFour,
  keepLastFour,
  nextAccountNumberValue
} from './accountNumberInput';

describe('formatSortCode', () => {
  it('groups digits as XX-XX-XX while they are typed', () => {
    expect(formatSortCode('1')).toBe('1');
    expect(formatSortCode('12')).toBe('12');
    expect(formatSortCode('1234')).toBe('12-34');
    expect(formatSortCode('123456')).toBe('12-34-56');
  });

  it('ignores anything that is not a digit, including its own dashes', () => {
    expect(formatSortCode('12-34-56')).toBe('12-34-56');
    expect(formatSortCode('ab12cd34ef56')).toBe('12-34-56');
  });
});

describe('nextAccountNumberValue', () => {
  it('caps a bank account number at its real length', () => {
    expect(nextAccountNumberValue('123456789012', false)).toBe('12345678');
    expect(nextAccountNumberValue('12345678', false)).toHaveLength(BANK_ACCOUNT_NUMBER_LENGTH);
  });

  it('keeps every digit of a card number rather than truncating to the first four', () => {
    // The whole point of the card field: a pasted 16-digit number must not be
    // silently cut down to '4929', which is both wrong and the wrong four.
    expect(nextAccountNumberValue('4929123456789012', true)).toBe('4929123456789012');
  });

  it('strips spaces and dashes from a pasted card number', () => {
    expect(nextAccountNumberValue('4929 1234 5678 9012', true)).toBe('4929123456789012');
  });
});

describe('hasMoreThanLastFour', () => {
  it('is false for four digits or fewer', () => {
    expect(hasMoreThanLastFour('')).toBe(false);
    expect(hasMoreThanLastFour('9'.repeat(CARD_LAST_FOUR_LENGTH))).toBe(false);
  });

  it('is true once a full card number has been entered', () => {
    expect(hasMoreThanLastFour('4929123456789012')).toBe(true);
  });
});

describe('keepLastFour', () => {
  it('keeps the LAST four digits, which are the ones the bank feed publishes', () => {
    expect(keepLastFour('4929123456789012')).toBe('9012');
    expect(keepLastFour('4929 1234 5678 9012')).toBe('9012');
  });

  it('leaves a value that is already short enough alone', () => {
    expect(keepLastFour('9012')).toBe('9012');
    expect(keepLastFour('12')).toBe('12');
  });
});
