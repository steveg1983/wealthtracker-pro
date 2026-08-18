import { describe, it, expect } from 'vitest';
import {
  detectRecurring,
  normalisePayeeKey,
  recurringDirectionOf,
  MIN_PAYMENTS,
} from './recurringDetection';

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
const expense = (
  description: string,
  amount: number,
  date: Date,
  accountId = 'acc-1',
  category?: string
) => ({
  id: `t-${nextId++}`,
  accountId,
  description,
  amount: -Math.abs(amount),
  date,
  type: 'expense' as const,
  category,
});

/** A monthly run: same figure on the same day-of-month. */
const monthlyRun = (
  description: string,
  amount: number,
  from: Date,
  months: number,
  category?: string
) =>
  Array.from({ length: months }, (_, i) =>
    expense(description, amount, D(from.getFullYear(), from.getMonth() + 1 + i, from.getDate()), 'acc-1', category));

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

describe('detectRecurring — a renamed payee is still one commitment', () => {
  /**
   * The owner's own case (18 Aug): a maintenance payment running for years
   * under one wording, re-labelled longer by the bank mid-stream — same
   * account, figure, category and day-of-month. Payees invented; the shape
   * is his.
   */
  const rename = () => [
    ...monthlyRun('ACME LTD', 250, D(2025, 9, 3), 8, 'cat-maintenance'),      // to Apr 2026
    ...monthlyRun('ACME LTD PROPERTY MAINT', 250, D(2026, 5, 3), 4, 'cat-maintenance'), // May–Aug
  ];

  it('stitches the two labels into ONE pattern with the whole history', () => {
    const found = detectRecurring(rename(), NOW);
    expect(found).toHaveLength(1);
    const [d] = found;
    expect(d.count).toBe(12);
    expect(d.firstDate).toEqual(D(2025, 9, 3));
    expect(d.lastDate).toEqual(D(2026, 8, 3));
    expect(d.stopped).toBe(false);
    expect(d.cadence).toBe('monthly');
    // The newest label is the identity the reader recognises…
    expect(d.description).toBe('ACME LTD PROPERTY MAINT');
    // …and the evidence names where the earlier payments lived.
    expect(d.formerLabels).toEqual(['ACME LTD']);
    // A verdict stored under EITHER label finds this pattern.
    expect(d.payeeKeys).toEqual([
      normalisePayeeKey('ACME LTD PROPERTY MAINT'),
      normalisePayeeKey('ACME LTD'),
    ]);
  });

  it('the stitched-away label does not also appear as a stopped pattern', () => {
    const found = detectRecurring(rename(), NOW);
    expect(found.filter(d => d.stopped)).toHaveLength(0);
  });

  it('a verdict given under the OLD label still vouches the stitched pattern', () => {
    const oldKey = normalisePayeeKey('ACME LTD');
    const [d] = detectRecurring(rename(), NOW, {
      isVouched: (_account, _direction, payeeKey) => payeeKey === oldKey,
    });
    expect(d).toBeDefined();
    expect(d.payeeKeys).toContain(oldKey);
  });

  it('two unrelated payees that merely share a figure and category never stitch', () => {
    // One subscription cancelled, another started next month at the same
    // price, same broad category — different wording, so two patterns.
    const rows = [
      ...monthlyRun('FLIXWATCH.COM', 9.99, D(2025, 9, 3), 8, 'cat-subs'),
      ...monthlyRun('MOUSEHOUSE PLUS', 9.99, D(2026, 5, 3), 4, 'cat-subs'),
    ];
    const found = detectRecurring(rows, NOW);
    expect(found).toHaveLength(2);
    expect(found.every(d => d.formerLabels.length === 0)).toBe(true);
  });

  it('a different category at the joint blocks the stitch', () => {
    const rows = [
      ...monthlyRun('ACME LTD', 250, D(2025, 9, 3), 8, 'cat-maintenance'),
      ...monthlyRun('ACME LTD PROPERTY MAINT', 250, D(2026, 5, 3), 4, 'cat-insurance'),
    ];
    expect(detectRecurring(rows, NOW)).toHaveLength(2);
  });

  it('a gap where the rhythm paused between the labels blocks the stitch', () => {
    const rows = [
      ...monthlyRun('ACME LTD', 250, D(2025, 6, 3), 6, 'cat-maintenance'),   // to Nov 2025
      ...monthlyRun('ACME LTD PROPERTY MAINT', 250, D(2026, 5, 3), 4, 'cat-maintenance'), // 6-month hole
    ];
    const found = detectRecurring(rows, NOW);
    expect(found).toHaveLength(2);
  });

  it('overlapping labels are two payees, not a rename', () => {
    const rows = [
      ...monthlyRun('ACME LTD', 250, D(2025, 9, 3), 12, 'cat-maintenance'),
      ...monthlyRun('ACME LTD PROPERTY MAINT', 250, D(2026, 5, 10), 4, 'cat-maintenance'),
    ];
    const found = detectRecurring(rows, NOW);
    expect(found).toHaveLength(2);
  });

  it('a twice-renamed payee stitches the whole chain', () => {
    const rows = [
      ...monthlyRun('ACME', 250, D(2025, 5, 3), 4, 'cat-maintenance'),               // to Aug 2025
      ...monthlyRun('ACME LTD', 250, D(2025, 9, 3), 8, 'cat-maintenance'),           // to Apr 2026
      ...monthlyRun('ACME LTD PROPERTY MAINT', 250, D(2026, 5, 3), 4, 'cat-maintenance'),
    ];
    const found = detectRecurring(rows, NOW);
    expect(found).toHaveLength(1);
    expect(found[0].count).toBe(16);
    expect(found[0].formerLabels).toEqual(['ACME', 'ACME LTD']);
  });
});

describe('detectRecurring — a payee the user vouched for is read leniently', () => {
  const vouchAll = { isVouched: () => true };

  it('varying amounts at a vouched payee are a pattern; unvouched they are a habit', () => {
    // A retainer whose figure moves — no two consecutive amounts agree —
    // on a monthly rhythm.
    const rows = [280, 310, 265, 290, 305, 275].map((amount, i) =>
      expense('HOME CARE SERVICES', amount, D(2026, 2 + i, 3)));

    expect(detectRecurring(rows, NOW)).toHaveLength(0);

    const [d] = detectRecurring(rows, NOW, vouchAll);
    expect(d).toBeDefined();
    expect(d.relaxed).toBe(true);
    expect(d.count).toBe(6);
    expect(d.cadence).toBe('monthly');
    // The figure shown is simply the latest payment's…
    expect(d.amount.toNumber()).toBe(275);
    // …and no price change is invented between unsustained figures.
    expect(d.priceChange).toBeNull();
  });

  it('two payments are enough once vouched — but still classified honestly', () => {
    const rows = [
      expense('HOME CARE SERVICES', 280, D(2026, 6, 3)),
      expense('HOME CARE SERVICES', 295, D(2026, 7, 3)),
    ];
    expect(detectRecurring(rows, NOW)).toHaveLength(0);
    const [d] = detectRecurring(rows, NOW, vouchAll);
    expect(d).toBeDefined();
    expect(d.count).toBe(2);
    expect(d.cadence).toBe('monthly');
  });

  it('one payment shows nothing, vouched or not — a rhythm needs two points', () => {
    const rows = [expense('HOME CARE SERVICES', 280, D(2026, 7, 3))];
    expect(detectRecurring(rows, NOW, vouchAll)).toHaveLength(0);
  });

  it('a vouched payee whose runs already qualify keeps the strict reading and its price change', () => {
    const rows = [
      ...monthlyRun('FLIXWATCH.COM', 10.99, D(2025, 9, 3), 6),
      ...monthlyRun('FLIXWATCH.COM', 12.99, D(2026, 3, 3), 6),
    ];
    const [d] = detectRecurring(rows, NOW, vouchAll);
    expect(d.relaxed).toBe(false);
    expect(d.priceChange).not.toBeNull();
  });
});

describe('recurringDirectionOf', () => {
  it('matches the grouping: negative is out, positive is in', () => {
    expect(recurringDirectionOf(-9.99)).toBe('out');
    expect(recurringDirectionOf(1200)).toBe('in');
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
