import { describe, expect, it } from 'vitest';
import {
  BANK_ACCOUNT_NUMBER_LENGTH,
  CARD_LAST_FOUR_LENGTH,
  accountNumberForStorage,
  accountNumberUpdateForStorage,
  formatCardNumberForDisplay,
  formatSortCode,
  hasMoreThanLastFour,
  isCardAccountType,
  isCardAccountTypeValue,
  keepLastFour,
  linkedAccountNumberForStorage,
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

describe('isCardAccountTypeValue', () => {
  it('answers the same question for a value that never went through the types', () => {
    // What a `type` column reads back as, and what a request body carries.
    expect(isCardAccountTypeValue('credit')).toBe(true);
    expect(isCardAccountTypeValue('checking')).toBe(false);
    expect(isCardAccountTypeValue(undefined)).toBe(false);
    expect(isCardAccountTypeValue(null)).toBe(false);
    expect(isCardAccountTypeValue(7)).toBe(false);
    expect(isCardAccountTypeValue({ type: 'credit' })).toBe(false);
  });
});

describe('accountNumberUpdateForStorage', () => {
  const pan = '1111222233334444';

  it('cuts a card number down when the STORED type says card', () => {
    // The importer's shape: an account number and nothing else.
    expect(accountNumberUpdateForStorage({ accountNumber: pan }, 'credit'))
      .toEqual({ accountNumber: '4444' });
  });

  it('leaves a bank account number whole — 8 digits IS the number', () => {
    expect(accountNumberUpdateForStorage({ accountNumber: '12345678' }, 'checking'))
      .toEqual({ accountNumber: '12345678' });
  });

  it('follows the type in the payload when it carries one', () => {
    // Switching an account to Credit Card and setting its number in the same
    // save is a card write, whatever the row used to be.
    expect(accountNumberUpdateForStorage({ type: 'credit', accountNumber: pan }, 'checking'))
      .toEqual({ type: 'credit', accountNumber: '4444' });

    // And the reverse: a card being turned into a current account keeps the
    // number the payload declares as a bank one.
    expect(accountNumberUpdateForStorage({ type: 'current', accountNumber: '12345678' }, 'credit'))
      .toEqual({ type: 'current', accountNumber: '12345678' });
  });

  it('leaves an update that does not touch the account number alone', () => {
    // Absent means "not being written" — this must never blank a stored number
    // nobody asked to change.
    const updates = { name: 'Renamed', balance: 12 };
    expect(accountNumberUpdateForStorage(updates, 'credit')).toBe(updates);
  });

  it('carries every other field through untouched', () => {
    expect(accountNumberUpdateForStorage(
      { name: 'Renamed', sortCode: null, accountNumber: pan },
      'credit'
    )).toEqual({ name: 'Renamed', sortCode: null, accountNumber: '4444' });
  });

  it('cannot be made to keep more than 4 digits of a card', () => {
    const longestPan = '1111222233334444555';
    for (let length = 1; length <= longestPan.length; length += 1) {
      const guarded = accountNumberUpdateForStorage(
        { accountNumber: longestPan.slice(0, length) },
        'credit'
      );
      expect(guarded.accountNumber?.length ?? 0).toBeLessThanOrEqual(CARD_LAST_FOUR_LENGTH);
    }
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

describe('linkedAccountNumberForStorage', () => {
  const pan = '1111222233334444';

  it('trusts the STORED account type, not the request body', () => {
    // The client says nothing about cards; the row being linked to is one.
    expect(linkedAccountNumberForStorage(pan, false, 'credit')).toBe('4444');
  });

  it('trusts the request body only in the direction that truncates', () => {
    // A number from the cards surface is a card number whatever the local row
    // is called…
    expect(linkedAccountNumberForStorage(pan, true, 'checking')).toBe('4444');
    // …but a client claiming "not a card" cannot unlock a card row.
    expect(linkedAccountNumberForStorage(pan, false, 'credit')).toBe('4444');
  });

  it('leaves a bank account number whole — 8 digits IS the number', () => {
    expect(linkedAccountNumberForStorage('12345678', false, 'checking')).toBe('12345678');
    expect(linkedAccountNumberForStorage('12345678', false, undefined)).toBe('12345678');
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
