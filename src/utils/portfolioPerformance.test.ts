import { describe, it, expect } from 'vitest';
import { computePortfolioPerformance } from './portfolioPerformance';
import type { Account, Category, Transaction } from '../types';

/**
 * TWR and MWR over the ledger, the owner's semantics pinned one by one
 * (20 Aug): opening balances are money in on their effective date; transfers
 * across the scope boundary are flows — INCLUDING an external account paying
 * into the pair's cash sleeve; transfers between a pair's own accounts are
 * internal; revaluations, dividends and fees are performance.
 *
 * The headline spec is the owner's own worked example from the research
 * conversation, in figures he invented there: £1,000,000 in, £100,000
 * withdrawn mid-year, £1,120,000 at the end — gain +£220,000, MWR ≈ +23.1%,
 * TWR +23.67% given the mid-year valuation his walk implies.
 */

const CATEGORIES: Category[] = [
  { id: 'cat-reval', name: 'Account Adjustment', type: 'both', level: 'detail', isRevaluationCategory: true },
  { id: 'cat-div', name: 'Dividends', type: 'income', level: 'detail' },
];

const portfolio = (id: string, over: Partial<Account> = {}): Account => ({
  id, name: `Synthetic ${id}`, type: 'investment', balance: 0,
  currency: 'GBP', lastUpdated: new Date(2026, 0, 1), openingBalance: 0, isActive: true,
  ...over,
});

const EXTERNAL: Account = {
  id: 'acc-current', name: 'Synthetic Current', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date(2026, 0, 1), openingBalance: 0, isActive: true,
};

let nextId = 0;
const row = (
  accountId: string,
  date: string,
  amount: number,
  over: Partial<Transaction> = {}
): Transaction => ({
  id: `txn-${nextId++}`,
  accountId,
  date: new Date(`${date}T00:00:00Z`),
  amount,
  description: 'synthetic',
  category: '',
  type: amount >= 0 ? 'income' : 'expense',
  ...over,
});

const transferIn = (accountId: string, date: string, amount: number, from: string): Transaction =>
  row(accountId, date, amount, { type: 'transfer', transferAccountId: from, category: 'transfer-in' });
const transferOut = (accountId: string, date: string, amount: number, to: string): Transaction =>
  row(accountId, date, -Math.abs(amount), { type: 'transfer', transferAccountId: to, category: 'transfer-out' });
const revaluation = (accountId: string, date: string, amount: number): Transaction =>
  row(accountId, date, amount, { category: 'cat-reval', type: amount >= 0 ? 'income' : 'expense' });

const compute = (
  members: Account[],
  transactions: Transaction[],
  range: { from?: Date | null; to?: Date | null }
) => computePortfolioPerformance({
  memberAccounts: members,
  transactions,
  transactionSplits: [],
  categories: CATEGORIES,
  range,
  now: new Date('2026-01-01T00:00:00Z'),
});

const pct = (value: { toNumber(): number } | null): number => {
  if (value === null) throw new Error('expected a measurable return');
  return value.toNumber();
};

describe('computePortfolioPerformance — the owner\'s worked example', () => {
  const INV = portfolio('acc-inv');
  const LEDGER = [
    transferIn(INV.id, '2025-01-01', 1_000_000, EXTERNAL.id),
    revaluation(INV.id, '2025-04-01', 60_000),          // worth 1,060,000
    transferOut(INV.id, '2025-07-02', 100_000, EXTERNAL.id), // mid-year withdrawal
    revaluation(INV.id, '2025-11-01', 160_000),         // ends at 1,120,000
  ];
  const YEAR = { from: new Date('2025-01-01T00:00:00Z'), to: new Date('2026-01-01T00:00:00Z') };

  it('the £ gain is flow-adjusted: +220,000, never +120,000', () => {
    const perf = compute([INV], LEDGER, YEAR);
    expect(perf.endValue.toNumber()).toBe(1_120_000);
    expect(perf.moneyIn.toNumber()).toBe(1_000_000);
    expect(perf.moneyOut.toNumber()).toBe(100_000);
    expect(perf.gain.toNumber()).toBe(220_000);
  });

  it('TWR chains the growth between flows: +23.67% for this walk', () => {
    // 1,060,000/1,000,000 × 1,120,000/960,000 − 1 — the manager's figure,
    // needing the valuation at the withdrawal, which the ledger provides.
    const perf = compute([INV], LEDGER, YEAR);
    expect(pct(perf.twrPeriod)).toBeCloseTo(0.23667, 4);
  });

  it('MWR is the IRR of the flows: ≈ +23.1%, the investor\'s figure', () => {
    const perf = compute([INV], LEDGER, YEAR);
    expect(pct(perf.mwrPeriod)).toBeGreaterThan(0.225);
    expect(pct(perf.mwrPeriod)).toBeLessThan(0.235);
    // Not the naive +12% on the start, nor +24.4% on net contribution.
    expect(pct(perf.mwrPeriod)).not.toBeCloseTo(0.12, 2);
    expect(pct(perf.mwrPeriod)).not.toBeCloseTo(0.2444, 2);
  });
});

describe('computePortfolioPerformance — the boundary, exactly as the owner stated it', () => {
  const INV = portfolio('acc-inv');
  const SLEEVE = portfolio('acc-sleeve', { type: 'current', parentAccountId: 'acc-inv' });

  it('an external account paying into the pair\'s CASH SLEEVE is a contribution', () => {
    const perf = compute([INV, SLEEVE], [
      transferIn(SLEEVE.id, '2025-03-01', 50_000, EXTERNAL.id),
    ], { from: new Date('2025-01-01T00:00:00Z'), to: new Date('2026-01-01T00:00:00Z') });
    expect(perf.moneyIn.toNumber()).toBe(50_000);
    expect(perf.gain.toNumber()).toBe(0);
  });

  it('a transfer between the pair\'s own accounts is internal — no flow, no gain', () => {
    const perf = compute([INV, SLEEVE], [
      transferIn(INV.id, '2025-02-01', 100_000, EXTERNAL.id),
      transferOut(SLEEVE.id, '2025-03-01', 20_000, INV.id),
      transferIn(INV.id, '2025-03-01', 20_000, SLEEVE.id),
    ], { from: new Date('2025-01-01T00:00:00Z'), to: new Date('2026-01-01T00:00:00Z') });
    expect(perf.moneyIn.toNumber()).toBe(100_000);
    expect(perf.moneyOut.toNumber()).toBe(0);
    expect(perf.gain.toNumber()).toBe(0);
    expect(perf.flowCount).toBe(1);
  });

  it('an opening balance is money in, on its effective date', () => {
    const OPENED = portfolio('acc-opened', {
      openingBalance: 250_000, openingBalanceDate: new Date('2025-06-01T00:00:00Z'),
    });
    const perf = compute([OPENED], [], {
      from: new Date('2025-01-01T00:00:00Z'), to: new Date('2026-01-01T00:00:00Z'),
    });
    expect(perf.moneyIn.toNumber()).toBe(250_000);
    expect(perf.endValue.toNumber()).toBe(250_000);
    expect(perf.gain.toNumber()).toBe(0);
    // Money that only arrived mid-year has earned nothing yet: 0%, not null.
    // (MWR by bisection converges on zero rather than landing exactly there.)
    expect(pct(perf.twrPeriod)).toBe(0);
    expect(pct(perf.mwrPeriod)).toBeCloseTo(0, 8);
  });

  it('dividends and revaluations are performance, never flows', () => {
    const INV2 = portfolio('acc-inv2');
    const perf = compute([INV2], [
      transferIn(INV2.id, '2025-01-01', 10_000, EXTERNAL.id),
      row(INV2.id, '2025-06-01', 400, { category: 'cat-div', type: 'income' }),
      revaluation(INV2.id, '2025-09-01', 600),
    ], { from: new Date('2025-01-01T00:00:00Z'), to: new Date('2026-01-01T00:00:00Z') });
    expect(perf.moneyIn.toNumber()).toBe(10_000);
    expect(perf.gain.toNumber()).toBe(1_000);
    expect(pct(perf.twrPeriod)).toBeCloseTo(0.1, 6);
  });
});

describe('computePortfolioPerformance — windows and edges', () => {
  const INV = portfolio('acc-inv');

  it('a window starting mid-history opens at the value already there, and only its own flows count', () => {
    const perf = compute([INV], [
      transferIn(INV.id, '2024-01-01', 500_000, EXTERNAL.id),
      revaluation(INV.id, '2024-06-01', 50_000),
      revaluation(INV.id, '2025-06-01', 55_000),
    ], { from: new Date('2025-01-01T00:00:00Z'), to: new Date('2026-01-01T00:00:00Z') });
    expect(perf.startValue.toNumber()).toBe(550_000);
    expect(perf.moneyIn.toNumber()).toBe(0);
    expect(perf.gain.toNumber()).toBe(55_000);
    expect(pct(perf.twrPeriod)).toBeCloseTo(0.1, 6);
    expect(pct(perf.mwrPeriod)).toBeCloseTo(0.1, 3);
  });

  it('a never-funded scope measures nothing — null, not 0%', () => {
    const perf = compute([INV], [], {
      from: new Date('2025-01-01T00:00:00Z'), to: new Date('2026-01-01T00:00:00Z'),
    });
    expect(perf.twrPeriod).toBeNull();
    expect(perf.mwrPeriod).toBeNull();
    expect(perf.gain.toNumber()).toBe(0);
  });

  it('funded, grown, then fully withdrawn: the chain measured while money was at work stands', () => {
    const perf = compute([INV], [
      transferIn(INV.id, '2025-01-01', 100_000, EXTERNAL.id),
      revaluation(INV.id, '2025-03-01', 10_000),
      transferOut(INV.id, '2025-06-01', 110_000, EXTERNAL.id),
    ], { from: new Date('2025-01-01T00:00:00Z'), to: new Date('2026-01-01T00:00:00Z') });
    expect(perf.endValue.toNumber()).toBe(0);
    expect(perf.gain.toNumber()).toBe(10_000);
    expect(pct(perf.twrPeriod)).toBeCloseTo(0.1, 6);
  });

  it('the annualised pair: MWR is annual by construction; TWR annualises from the window', () => {
    const perf = compute([INV], [
      transferIn(INV.id, '2025-01-01', 100_000, EXTERNAL.id),
      revaluation(INV.id, '2025-12-01', 21_000),
    ], { from: new Date('2025-01-01T00:00:00Z'), to: new Date('2026-01-01T00:00:00Z') });
    expect(pct(perf.twrPeriod)).toBeCloseTo(0.21, 6);
    const annual = pct(perf.twrAnnualised);
    expect(annual).toBeGreaterThan(0.208);
    expect(annual).toBeLessThan(0.213);
  });
});
