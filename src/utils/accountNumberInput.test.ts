import { describe, expect, it } from 'vitest';
import {
  BANK_ACCOUNT_NUMBER_LENGTH,
  CARD_LAST_FOUR_LENGTH,
  accountNumberForStorage,
  formatCardNumberForDisplay,
  formatSortCode,
  hasMoreThanLastFour,
  isCardAccountType,
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

describe('isCardAccountType', () => {
  it('is true for a credit card and nothing else', () => {
    expect(isCardAccountType('credit')).toBe(true);
    expect(isCardAccountType('current')).toBe(false);
    // The database's own spelling of 'current' — still a bank account.
    expect(isCardAccountType('checking')).toBe(false);
    expect(isCardAccountType('savings')).toBe(false);
    expect(isCardAccountType('loan')).toBe(false);
    expect(isCardAccountType(undefined)).toBe(false);
  });
});

describe('accountNumberForStorage', () => {
  it('stores only the last 4 of a card, whatever it was handed', () => {
    expect(accountNumberForStorage('4929123456789012', true)).toBe('9012');
    expect(accountNumberForStorage('4929 1234 5678 9012', true)).toBe('9012');
    expect(accountNumberForStorage('4929-1234-5678-9012', true)).toBe('9012');
  });

  it('cannot be made to store more than 4 digits of a card', () => {
    // Every length a field could hold on its way to a 19-digit Maestro number.
    const pan = '4929123456789012345';
    for (let length = 1; length <= pan.length; length += 1) {
      const stored = accountNumberForStorage(pan.slice(0, length), true) ?? '';
      expect(stored.length).toBeLessThanOrEqual(CARD_LAST_FOUR_LENGTH);
    }
  });

  it('leaves a bank account number whole — 8 digits IS the number', () => {
    expect(accountNumberForStorage('12345678', false)).toBe('12345678');
    expect(accountNumberForStorage('12345678', false)).toHaveLength(BANK_ACCOUNT_NUMBER_LENGTH);
  });

  it('gives back undefined when there is nothing to store', () => {
    expect(accountNumberForStorage('', true)).toBeUndefined();
    expect(accountNumberForStorage('', false)).toBeUndefined();
    expect(accountNumberForStorage(undefined, true)).toBeUndefined();
    expect(accountNumberForStorage(undefined, false)).toBeUndefined();
    expect(accountNumberForStorage('   ', false)).toBeUndefined();
    // A card field holding punctuation alone has no digits worth keeping.
    expect(accountNumberForStorage('**** ****', true)).toBeUndefined();
  });

  it('keeps a short card entry as typed rather than padding it out', () => {
    expect(accountNumberForStorage('12', true)).toBe('12');
  });
});

describe('formatCardNumberForDisplay', () => {
  it('shows a stored last 4 as the card mask', () => {
    expect(formatCardNumberForDisplay('9012')).toBe('XXXX XXXX XXXX 9012');
  });

  it('reads a legacy value that carries its own mask characters', () => {
    expect(formatCardNumberForDisplay('****3456')).toBe('XXXX XXXX XXXX 3456');
  });

  it('shows only the last 4 of a row written before the rule existed', () => {
    expect(formatCardNumberForDisplay('4929123456789012')).toBe('XXXX XXXX XXXX 9012');
  });

  it('gives the caller nothing to render when there is no number', () => {
    expect(formatCardNumberForDisplay('')).toBe('');
    expect(formatCardNumberForDisplay(undefined)).toBe('');
    // Mask characters with no digits behind them are not a number either.
    expect(formatCardNumberForDisplay('****')).toBe('');
  });

  it('does not invent digits for a value shorter than four', () => {
    expect(formatCardNumberForDisplay('12')).toBe('12');
    expect(formatCardNumberForDisplay('7')).toBe('7');
  });
});
