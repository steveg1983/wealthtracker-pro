import { describe, it, expect } from 'vitest';
import {
  findAccountByOfxIdentifiers,
  planAccountDetailsBackfill,
  readOfxAccountIdentifiers,
  type OfxAccountIdentifiers
} from './ofxAccountIdentifiers';
import type { Account } from '../types';

const bankStatement = (overrides: Partial<OfxAccountIdentifiers> = {}): OfxAccountIdentifiers => ({
  accountId: '12345678',
  bankId: '123456',
  isCreditCardStatement: false,
  ...overrides
});

const cardStatement = (overrides: Partial<OfxAccountIdentifiers> = {}): OfxAccountIdentifiers => ({
  accountId: '4929123456789012',
  isCreditCardStatement: true,
  ...overrides
});

const account = (overrides: Partial<Account> = {}): Account => ({
  id: 'acc1',
  name: 'Current Account',
  type: 'current',
  balance: 0,
  currency: 'GBP',
  lastUpdated: new Date('2026-01-01'),
  ...overrides
});

describe('readOfxAccountIdentifiers', () => {
  it('reads a sort code and an 8-digit account number', () => {
    expect(readOfxAccountIdentifiers(bankStatement())).toEqual({
      sortCode: '12-34-56',
      accountNumber: '12345678',
      cardLastFour: '5678'
    });
  });

  it('splits an ACCTID that carries the sort code in front of the account number', () => {
    const values = readOfxAccountIdentifiers(bankStatement({ accountId: '12345687654321' }));
    expect(values.accountNumber).toBe('87654321');
    expect(values.sortCode).toBe('12-34-56');
  });

  it('refuses an account number it cannot recognise rather than guessing 8 digits', () => {
    // 12 digits with no sort code in front: could be anything.
    expect(readOfxAccountIdentifiers(bankStatement({ accountId: '987654321098' })).accountNumber)
      .toBeUndefined();
  });

  it('ignores a sort code that is not a full 6 digits', () => {
    expect(readOfxAccountIdentifiers(bankStatement({ bankId: '1234' })).sortCode).toBeUndefined();
  });

  it('never derives an account number from a card statement', () => {
    const values = readOfxAccountIdentifiers(cardStatement());
    expect(values.accountNumber).toBeUndefined();
    expect(values.cardLastFour).toBe('9012');
  });
});

describe('planAccountDetailsBackfill', () => {
  it('fills both details on a blank current account', () => {
    const plan = planAccountDetailsBackfill(bankStatement(), account());
    expect(plan).toEqual({
      updates: { sortCode: '12-34-56', accountNumber: '12345678' },
      summary: 'sort code 12-34-56 and account number ending 5678'
    });
  });

  it('never mentions a full account number in what it tells the user', () => {
    const plan = planAccountDetailsBackfill(bankStatement(), account());
    expect(plan?.summary).not.toContain('12345678');
  });

  it('leaves an account that already has both details completely alone', () => {
    const plan = planAccountDetailsBackfill(
      bankStatement(),
      account({ sortCode: '12-34-56', accountNumber: '12345678' })
    );
    expect(plan).toBeNull();
  });

  it('never overwrites a recorded detail with a different one', () => {
    const plan = planAccountDetailsBackfill(
      bankStatement(),
      account({ sortCode: '99-99-99', accountNumber: '11112222' })
    );
    expect(plan).toBeNull();
  });

  it('fills only the blank half when the recorded half agrees with the file', () => {
    const plan = planAccountDetailsBackfill(bankStatement(), account({ sortCode: '12-34-56' }));
    expect(plan).toEqual({
      updates: { accountNumber: '12345678' },
      summary: 'account number ending 5678'
    });
  });

  it('fills nothing when a recorded sort code contradicts the file, even though the account number is blank', () => {
    // The file is not this account's, so the blank field is not an invitation.
    const plan = planAccountDetailsBackfill(bankStatement(), account({ sortCode: '99-99-99' }));
    expect(plan).toBeNull();
  });

  it('stores only the last 4 digits of a card, and no sort code', () => {
    const plan = planAccountDetailsBackfill(cardStatement(), account({ type: 'credit' }));
    expect(plan).toEqual({
      updates: { accountNumber: '9012' },
      summary: 'card ending 9012'
    });
    expect(plan?.updates.sortCode).toBeUndefined();
  });

  it('never lets a full card number reach the stored value', () => {
    const plan = planAccountDetailsBackfill(cardStatement(), account({ type: 'credit' }));
    expect(plan?.updates.accountNumber).toHaveLength(4);
  });

  it('handles a card statement that already arrives masked', () => {
    const plan = planAccountDetailsBackfill(
      cardStatement({ accountId: 'XXXXXXXXXXXX3456' }),
      account({ type: 'credit' })
    );
    expect(plan?.updates.accountNumber).toBe('3456');
  });

  it('refuses to put a card statement onto a current account', () => {
    // <ACCTID> here may be a full PAN; the first 8 digits of one are not an
    // account number, they are the wrong half of a card number.
    expect(planAccountDetailsBackfill(cardStatement(), account())).toBeNull();
  });

  it('refuses to put a bank statement onto a credit account', () => {
    expect(planAccountDetailsBackfill(bankStatement(), account({ type: 'credit' }))).toBeNull();
  });

  it('treats the database spelling of a current account as one', () => {
    const plan = planAccountDetailsBackfill(bankStatement(), account({ type: 'checking' }));
    expect(plan?.updates).toEqual({ sortCode: '12-34-56', accountNumber: '12345678' });
  });

  it('fills nothing on account types that record no bank details', () => {
    for (const type of ['loan', 'investment', 'assets', 'other'] as const) {
      expect(planAccountDetailsBackfill(bankStatement(), account({ type }))).toBeNull();
    }
  });

  it('fills nothing when the file has no recognisable identifiers', () => {
    const plan = planAccountDetailsBackfill(
      bankStatement({ accountId: 'GB29NWBK', bankId: undefined }),
      account()
    );
    expect(plan).toBeNull();
  });

  it('treats a whitespace-only recorded value as blank', () => {
    const plan = planAccountDetailsBackfill(bankStatement(), account({ sortCode: '   ' }));
    expect(plan?.updates.sortCode).toBe('12-34-56');
  });
});

describe('findAccountByOfxIdentifiers', () => {
  const savings = account({ id: 'savings', name: 'Savings', type: 'savings' });

  it('matches the account whose recorded details are the file\'s', () => {
    const target = account({ id: 'target', sortCode: '12-34-56', accountNumber: '12345678' });
    expect(findAccountByOfxIdentifiers(bankStatement(), [savings, target])).toBe(target);
  });

  it('ignores formatting differences in the recorded sort code', () => {
    const target = account({ id: 'target', sortCode: '123456', accountNumber: '12345678' });
    expect(findAccountByOfxIdentifiers(bankStatement(), [target])).toBe(target);
  });

  it('does not match when the recorded sort code differs', () => {
    const target = account({ id: 'target', sortCode: '99-99-99', accountNumber: '12345678' });
    expect(findAccountByOfxIdentifiers(bankStatement(), [target])).toBeNull();
  });

  it('matches on account number alone when no sort code is recorded', () => {
    const target = account({ id: 'target', accountNumber: '12345678' });
    expect(findAccountByOfxIdentifiers(bankStatement(), [target])).toBe(target);
  });

  it('matches a card on its last 4 digits', () => {
    const card = account({ id: 'card', type: 'credit', accountNumber: '9012' });
    expect(findAccountByOfxIdentifiers(cardStatement(), [savings, card])).toBe(card);
  });

  it('refuses to choose between two accounts carrying the same identifiers', () => {
    const first = account({ id: 'a', accountNumber: '12345678' });
    const second = account({ id: 'b', accountNumber: '12345678' });
    expect(findAccountByOfxIdentifiers(bankStatement(), [first, second])).toBeNull();
  });

  it('returns null when no account records anything', () => {
    expect(findAccountByOfxIdentifiers(bankStatement(), [savings, account()])).toBeNull();
  });
});
