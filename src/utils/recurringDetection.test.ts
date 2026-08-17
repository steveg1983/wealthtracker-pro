import { describe, it, expect } from 'vitest';
import { detectRecurring, normalisePayeeKey, MIN_PAYMENTS } from './recurringDetection';

/**
 * The detection's honesty rules, instrumented (Design handover 17 Aug §2):
 * the evidence IS the confidence, irregular says so in words, a habit is not
 * a subscription, and stopped is a statement rather than an absence.
 *
 * Every payee, date and figure invented — the repo is public.
 */

const NOW = new Date(2026, 7, 17);

const D = (y: number, m: number, d: number): Date => new Date(y, m - 1, d);

let nextId = 0;
const expense = (description: string, amount: number, date: Date, accountId = 'acc-1') => ({
  id: `t-${nextId++}`,
  accountId,
  description,
  amount: -Math.abs(amount),
  date,
  type: 'expense' as const,
});

/** A monthly run: same figure on the same day-of-month. */
const monthlyRun = (description: string, amount: number, from: Date, months: number) =>
  Array.from({ length: months }, (_, i) =>
    expense(description, amount, D(from.getFullYear(), from.getMonth() + 1 + i, from.getDate())));

describe('detectRecurring — what qualifies', () => {
  it('finds a monthly subscription and states its evidence', () => {
    const rows = monthlyRun('FLIXWATCH.COM 4029', 7.99, D(2025, 9, 3), 12);
    const [found] = detectRecurring(rows, NOW);

    expect(found).toBeDefined();
    expect(found.cadence).toBe('monthly');
    expect(found.count).toBe(12);
    expect(found.amount.toNumber()).toBe(7.99);
    // ×12 exactly — Decimal, not float drift.
    expect(found.annualEquivalent.toNumber()).toBe(95.88);
    expect(found.firstDate).toEqual(D(2025, 9, 3));
    expect(found.lastDate).toEqual(D(2026, 8, 3));
    expect(found.stopped).toBe(false);
    // Next expected ≈ one rhythm on from the last payment.
    expect(found.nextExpected?.getMonth()).toBe(8); // September
  });

  it(`needs ${MIN_PAYMENTS} qualifying payments — two of anything is a coincidence`, () => {
    const rows = monthlyRun('GYMBOX', 25, D(2026, 6, 1), 2);
    expect(detectRecurring(rows, NOW)).toHaveLength(0);
  });

  it('a shop with a different figure every visit is a habit, not a commitment', () => {
    // Weekly rhythm, but no two consecutive amounts agree → no sustained run.
    const rows = [31.42, 58.1, 24.99, 47.05, 39.6, 52.75].map((amount, i) =>
      expense('MIDTOWN GROCER', amount, D(2026, 6, 1 + i * 7)));
    expect(detectRecurring(rows, NOW)).toHaveLength(0);
  });

  it('reference numbers do not split one payee into many', () => {
    const rows = [
      expense('STREAMCO 1001', 9.5, D(2026, 5, 10)),
      expense('STREAMCO 2002', 9.5, D(2026, 6, 10)),
      expense('STREAMCO 3003', 9.5, D(2026, 7, 10)),
    ];
    const found = detectRecurring(rows, NOW);
    expect(found).toHaveLength(1);
    expect(found[0].count).toBe(3);
  });

  it('transfers never qualify — a standing order to savings is not a commitment to anyone else', () => {
    const rows = monthlyRun('To Savings', 200, D(2026, 1, 1), 8)
      .map(row => ({ ...row, type: 'transfer' as const }));
    expect(detectRecurring(rows, NOW)).toHaveLength(0);
  });

  it('same-day duplicates are not a rhythm', () => {
    const day = D(2026, 7, 1);
    const rows = [
      expense('SPLIT BILL', 10, day),
      expense('SPLIT BILL', 10, day),
      expense('SPLIT BILL', 10, day),
    ];
    expect(detectRecurring(rows, NOW)).toHaveLength(0);
  });
});

describe('detectRecurring — the price change', () => {
  it('a new sustained figure is reported with its date and annual impact', () => {
    const rows = [
      ...monthlyRun('FLIXWATCH.COM', 10.99, D(2025, 9, 3), 6),
      ...monthlyRun('FLIXWATCH.COM', 12.99, D(2026, 3, 3), 6),
    ];
    const [found] = detectRecurring(rows, NOW);

    expect(found.amount.toNumber()).toBe(12.99);
    expect(found.priceChange).not.toBeNull();
    expect(found.priceChange?.from.toNumber()).toBe(10.99);
    expect(found.priceChange?.to.toNumber()).toBe(12.99);
    expect(found.priceChange?.when).toEqual(D(2026, 3, 3));
    // +£2.00 a month is +£24.00 a year — the handover's own example shape.
    expect(found.priceChange?.annualDelta.toNumber()).toBe(24);
  });

  it('a one-off odd amount drops out without inventing a price change', () => {
    const rows = [
      ...monthlyRun('FLIXWATCH.COM', 10.99, D(2025, 11, 3), 4),
      expense('FLIXWATCH.COM', 3.5, D(2026, 3, 15)), // a partial-month top-up
      ...monthlyRun('FLIXWATCH.COM', 10.99, D(2026, 4, 3), 4),
    ];
    const [found] = detectRecurring(rows, NOW);

    expect(found.count).toBe(8); // the top-up is not part of the pattern
    expect(found.priceChange).toBeNull();
    expect(found.amount.toNumber()).toBe(10.99);
  });
});

describe('detectRecurring — cadence honesty', () => {
  it('a weekly figure annualises at 52', () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      expense('LUNCH CLUB', 5, D(2026, 5, 1 + i * 7)));
    const [found] = detectRecurring(rows, NOW);
    expect(found.cadence).toBe('weekly');
    expect(found.annualEquivalent.toNumber()).toBe(260);
  });

  it('an in-between rhythm is IRREGULAR and says so in words, never rounded to monthly', () => {
    // Every 5 weeks — the handover's own example of what must not say "monthly".
    const rows = Array.from({ length: 5 }, (_, i) =>
      expense('FIVE WEEK CLUB', 20, new Date(D(2026, 1, 1).getTime() + i * 35 * 86_400_000)));
    const [found] = detectRecurring(rows, NOW);
    expect(found.cadence).toBe('irregular');
    expect(found.cadenceLabel).toBe('roughly every 5 weeks');
  });

  it('a rhythm the dates do not hold to is not called regular', () => {
    // Same amount, but gaps of 7, 30 and 90 days: no honest cadence word fits.
    const base = D(2026, 1, 1).getTime();
    const offsets = [0, 7, 37, 127, 134];
    const rows = offsets.map(days =>
      expense('SOMETIMES CLUB', 15, new Date(base + days * 86_400_000)));
    const [found] = detectRecurring(rows, NOW);
    expect(found.cadence).toBe('irregular');
  });
});

describe('detectRecurring — stopped is a band, not an absence', () => {
  it('silence past two rhythms marks the pattern stopped, with no next expected', () => {
    const rows = monthlyRun('OLD PAPER', 6.5, D(2025, 6, 1), 6); // last: Nov 2025
    const [found] = detectRecurring(rows, NOW);
    expect(found.stopped).toBe(true);
    expect(found.nextExpected).toBeNull();
    expect(found.lastDate).toEqual(D(2025, 11, 1));
  });

  it('a payment a few days late is NOT pronounced dead', () => {
    // Last paid 20 days ago on a monthly rhythm — inside two rhythms.
    const rows = monthlyRun('STILL RUNNING', 9.99, D(2025, 12, 28), 8); // last: Jul 28
    const [found] = detectRecurring(rows, NOW);
    expect(found.stopped).toBe(false);
  });
});

describe('normalisePayeeKey', () => {
  it('collapses digits and punctuation to the payee identity', () => {
    expect(normalisePayeeKey('NETFLIX.COM 4029')).toBe(normalisePayeeKey('netflix com 5817'));
  });

  it('an all-digit description keeps its raw form rather than collapsing to nothing', () => {
    expect(normalisePayeeKey('40291234')).toBe('40291234');
  });
});
