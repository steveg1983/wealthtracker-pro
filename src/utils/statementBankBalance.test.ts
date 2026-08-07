import { describe, it, expect } from 'vitest';
import {
  formatStatementDay,
  isIsoDay,
  planStatementBankBalance,
  todayIsoDay,
  type BankBalanceRecord,
  type StatementBalance
} from './statementBankBalance';

const CONFIRMED = { destinationConfirmed: true } as const;
const UNCONFIRMED = { destinationConfirmed: false } as const;

const statement = (amount: number, dateAsOf: string): StatementBalance => ({ amount, dateAsOf });

const account = (overrides: Partial<BankBalanceRecord> = {}): BankBalanceRecord => ({
  bankBalance: null,
  bankBalanceDate: null,
  ...overrides
});

describe('planStatementBankBalance', () => {
  it('sets the bank balance from the statement, dated by the statement', () => {
    const outcome = planStatementBankBalance(statement(1234.56, '2026-03-31'), account(), CONFIRMED);

    expect(outcome).toEqual({
      kind: 'set',
      updates: { bankBalance: 1234.56, bankBalanceDate: '2026-03-31' },
      amount: 1234.56,
      dateAsOf: '2026-03-31'
    });
  });

  it('writes bankBalance and its date and NOTHING else', () => {
    const outcome = planStatementBankBalance(statement(500, '2026-03-31'), account(), CONFIRMED);

    // The whole safety argument: `balance` is the ledger the imported
    // transactions have already moved. Writing the statement total on top of
    // it would count the same money twice.
    if (outcome.kind !== 'set') throw new Error('expected a balance to be set');
    expect(Object.keys(outcome.updates).sort()).toEqual(['bankBalance', 'bankBalanceDate']);
    expect(Object.keys(outcome.updates)).not.toContain('balance');
  });

  it('replaces an older recorded balance', () => {
    const outcome = planStatementBankBalance(
      statement(900, '2026-03-31'),
      account({ bankBalance: 100, bankBalanceDate: '2026-02-28' }),
      CONFIRMED
    );

    expect(outcome.kind).toBe('set');
  });

  it('leaves a NEWER recorded balance alone, and says which one it kept', () => {
    // Catching up on paperwork: March's statement opened after November's.
    const outcome = planStatementBankBalance(
      statement(900, '2026-03-31'),
      account({ bankBalance: 4200, bankBalanceDate: '2026-11-30' }),
      CONFIRMED
    );

    expect(outcome).toEqual({ kind: 'stale', recordedDate: '2026-11-30', recordedBalance: 4200 });
  });

  it('re-importing the same statement settles on the same figure', () => {
    // Equal days write, so the result does not depend on the order files were
    // opened in.
    const outcome = planStatementBankBalance(
      statement(900, '2026-03-31'),
      account({ bankBalance: 900, bankBalanceDate: '2026-03-31' }),
      CONFIRMED
    );

    expect(outcome.kind).toBe('set');
  });

  it('writes over a balance whose date was never recorded', () => {
    // Pre-dates the bank_balance_date column: undatable, so unprotectable.
    const outcome = planStatementBankBalance(
      statement(900, '2026-03-31'),
      account({ bankBalance: 100, bankBalanceDate: null }),
      CONFIRMED
    );

    expect(outcome.kind).toBe('set');
  });

  it('does nothing when nobody confirmed which account the file belongs to', () => {
    const outcome = planStatementBankBalance(statement(900, '2026-03-31'), account(), UNCONFIRMED);

    expect(outcome).toEqual({ kind: 'none' });
  });

  it('does nothing when the file states no closing balance', () => {
    expect(planStatementBankBalance(undefined, account(), CONFIRMED)).toEqual({ kind: 'none' });
  });

  it('writes a closing balance of zero — absent and zero are not the same thing', () => {
    // Zero is falsy, and every "does the file state a balance?" test here has
    // to ask whether the BALANCE is absent, never whether the AMOUNT is truthy.
    // An account on a nightly two-way sweep to a linked savings account closes
    // at exactly 0.00 every day; skipping it would leave Reconciliation with
    // nothing to check against on the one account that always states its
    // position exactly.
    const outcome = planStatementBankBalance(statement(0, '2026-03-31'), account(), CONFIRMED);

    expect(outcome).toEqual({
      kind: 'set',
      updates: { bankBalance: 0, bankBalanceDate: '2026-03-31' },
      amount: 0,
      dateAsOf: '2026-03-31'
    });
  });

  it('does nothing when there is no account to write to', () => {
    expect(planStatementBankBalance(statement(900, '2026-03-31'), null, CONFIRMED))
      .toEqual({ kind: 'none' });
  });

  it('refuses a date it cannot compare', () => {
    // A day it cannot order is a day it cannot protect a newer figure from.
    expect(planStatementBankBalance(statement(900, '31/03/2026'), account(), CONFIRMED))
      .toEqual({ kind: 'none' });
    expect(planStatementBankBalance(statement(900, ''), account(), CONFIRMED))
      .toEqual({ kind: 'none' });
  });

  it('refuses an amount that is not a number', () => {
    expect(planStatementBankBalance(statement(Number.NaN, '2026-03-31'), account(), CONFIRMED))
      .toEqual({ kind: 'none' });
  });

  describe('credit cards', () => {
    it('keeps a card debt a debt — the statement sign is passed through, not negated', () => {
      // OFX signs a statement's balance in the same frame as the transactions
      // beside it: a card purchase is a negative TRNAMT, so a card with money
      // owing closes on a NEGATIVE ledger balance, which is how this app
      // stores a liability. TrueLayer's card API is the opposite and
      // cardNormalization negates it there; doing that here would turn a
      // £1,234.56 debt into £1,234.56 of assets.
      const outcome = planStatementBankBalance(
        statement(-1234.56, '2026-03-31'),
        account({ bankBalance: null, bankBalanceDate: null }),
        CONFIRMED
      );

      if (outcome.kind !== 'set') throw new Error('expected a balance to be set');
      expect(outcome.updates.bankBalance).toBe(-1234.56);
      expect(outcome.amount).toBeLessThan(0);
    });

    it('keeps a card that is in credit in credit', () => {
      // An overpaid or refunded card closes positive. Forcing the sign
      // negative "because cards are liabilities" would invent a debt.
      const outcome = planStatementBankBalance(statement(45.5, '2026-03-31'), account(), CONFIRMED);

      if (outcome.kind !== 'set') throw new Error('expected a balance to be set');
      expect(outcome.updates.bankBalance).toBe(45.5);
    });
  });

  describe('money never goes through a float', () => {
    it('rounds to the penny the account column holds', () => {
      const outcome = planStatementBankBalance(statement(0.1 + 0.2, '2026-03-31'), account(), CONFIRMED);

      if (outcome.kind !== 'set') throw new Error('expected a balance to be set');
      // 0.1 + 0.2 is 0.30000000000000004 as a double.
      expect(outcome.updates.bankBalance).toBe(0.3);
    });

    it('keeps a large statement balance exact to the penny', () => {
      const outcome = planStatementBankBalance(
        statement(99999999.99, '2026-03-31'),
        account(),
        CONFIRMED
      );

      if (outcome.kind !== 'set') throw new Error('expected a balance to be set');
      expect(outcome.updates.bankBalance).toBe(99999999.99);
    });
  });
});

describe('isIsoDay', () => {
  it('accepts a calendar day and rejects anything else', () => {
    expect(isIsoDay('2026-03-31')).toBe(true);
    expect(isIsoDay('2026-3-31')).toBe(false);
    expect(isIsoDay('2026-03-31T00:00:00Z')).toBe(false);
    expect(isIsoDay(null)).toBe(false);
    expect(isIsoDay(undefined)).toBe(false);
  });
});

describe('todayIsoDay', () => {
  it('is the day where the user is, not the UTC day', () => {
    // 09:00 in Auckland (UTC+13) is still the previous day in UTC. Typing a
    // bank balance in the morning must not date it yesterday.
    const morningInAuckland = new Date(2026, 2, 31, 9, 0, 0);

    expect(todayIsoDay(morningInAuckland)).toBe('2026-03-31');
    expect(isIsoDay(todayIsoDay(morningInAuckland))).toBe(true);
  });

  it('pads single-digit months and days', () => {
    expect(todayIsoDay(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
  });
});

describe('formatStatementDay', () => {
  it('reads the day off the string rather than through a timezone', () => {
    // `new Date('2026-03-31')` is midnight UTC and renders as the 30th west of
    // Greenwich. A statement date shown a day out is one the user cannot find.
    expect(formatStatementDay('2026-03-31')).toBe('31 Mar 2026');
    expect(formatStatementDay('2026-01-01')).toBe('1 Jan 2026');
    expect(formatStatementDay('2026-12-25')).toBe('25 Dec 2026');
  });

  it('hands back anything it cannot read rather than inventing a date', () => {
    expect(formatStatementDay('not a date')).toBe('not a date');
    expect(formatStatementDay('2026-13-01')).toBe('2026-13-01');
  });
});
