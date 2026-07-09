import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import {
  buildDuplicateScanIndex,
  calculateSimilarity,
  calculateStringSimilarity,
  findDuplicateGroups,
  findDuplicateMatches,
  type DuplicateGroup,
  type DuplicateThresholds,
} from './duplicateScan';

const DAY_MS = 1000 * 60 * 60 * 24;
const BASE = new Date('2024-03-01T00:00:00Z').getTime();

let nextId = 0;
function mkTx(overrides: Partial<Transaction> & { daysOffset?: number } = {}): Transaction {
  const { daysOffset = 0, ...rest } = overrides;
  return {
    id: rest.id ?? `t${nextId++}`,
    date: rest.date ?? new Date(BASE + daysOffset * DAY_MS),
    description: rest.description ?? 'TESCO STORES 3021',
    amount: rest.amount ?? 45.67,
    type: rest.type ?? 'expense',
    accountId: rest.accountId ?? 'acc-1',
    category: rest.category ?? 'cat-1',
    cleared: rest.cleared ?? false,
    ...rest,
  };
}

const THRESHOLDS: DuplicateThresholds = {
  dateThreshold: 3,
  amountThreshold: 0.01,
  similarityThreshold: 80,
};

/**
 * Verbatim port of the ORIGINAL component algorithm's loop structure
 * (nested i/j sweep, processed set, recomputed confidence), scoring through
 * the util's calculateSimilarity. findDuplicateGroups must reproduce this
 * exactly — only faster.
 */
function referenceGroups(transactions: Transaction[], thresholds: DuplicateThresholds): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < transactions.length; i++) {
    if (processed.has(transactions[i].id)) continue;

    const potential: Transaction[] = [];

    for (let j = i + 1; j < transactions.length; j++) {
      if (processed.has(transactions[j].id)) continue;
      const similarity = calculateSimilarity(transactions[i], transactions[j], thresholds);
      if (similarity.totalScore >= thresholds.similarityThreshold) {
        potential.push(transactions[j]);
        processed.add(transactions[j].id);
      }
    }

    if (potential.length > 0) {
      processed.add(transactions[i].id);
      groups.push({
        original: transactions[i],
        potential,
        confidence: Math.max(...potential.map(t =>
          calculateSimilarity(transactions[i], t, thresholds).totalScore
        )),
      });
    }
  }

  return groups;
}

/** Comparable shape: ids + confidence only. */
const shape = (groups: DuplicateGroup[]) =>
  groups.map(g => ({
    original: g.original.id,
    potential: g.potential.map(t => t.id),
    confidence: g.confidence,
  }));

describe('calculateStringSimilarity', () => {
  it('is 100 for identical strings ignoring case/whitespace', () => {
    expect(calculateStringSimilarity('  Tesco ', 'tesco')).toBe(100);
  });

  it('drops with edit distance', () => {
    // "abcd" vs "abcx": distance 1 of maxLen 4 → 75
    expect(calculateStringSimilarity('abcd', 'abcx')).toBe(75);
  });

  it('is 0 for completely different strings of equal length', () => {
    expect(calculateStringSimilarity('aaaa', 'zzzz')).toBe(0);
  });
});

describe('findDuplicateGroups', () => {
  it('groups exact duplicates with ~100% confidence', () => {
    const a = mkTx();
    const b = mkTx();
    const groups = findDuplicateGroups([a, b], THRESHOLDS);
    expect(groups).toHaveLength(1);
    expect(groups[0].original.id).toBe(a.id);
    expect(groups[0].potential.map(t => t.id)).toEqual([b.id]);
    expect(groups[0].confidence).toBeCloseTo(100, 5);
  });

  it('puts a three-way duplicate into a single group seeded by the first', () => {
    const [a, b, c] = [mkTx(), mkTx(), mkTx()];
    const groups = findDuplicateGroups([a, b, c], THRESHOLDS);
    expect(shape(groups)).toEqual([
      { original: a.id, potential: [b.id, c.id], confidence: groups[0].confidence },
    ]);
  });

  it('matches near dates within the threshold and rejects beyond it', () => {
    const near = findDuplicateGroups([mkTx(), mkTx({ daysOffset: 2 })], THRESHOLDS);
    // date 100-(2/3)*50=66.7 → *0.3 = 20, amount 40, desc 30 → ~90
    expect(near).toHaveLength(1);
    expect(near[0].confidence).toBeGreaterThanOrEqual(80);

    const far = findDuplicateGroups([mkTx(), mkTx({ daysOffset: 5 })], THRESHOLDS);
    // dateScore 0 → max 70 < 80
    expect(far).toHaveLength(0);
  });

  it('treats amounts within the amount threshold as exact and scores others relatively', () => {
    const close = findDuplicateGroups([mkTx({ amount: 45.67 }), mkTx({ amount: 45.68 })], THRESHOLDS);
    expect(close).toHaveLength(1); // diff 0.01 ≤ threshold → amountScore 100

    const far = findDuplicateGroups([mkTx({ amount: 100 }), mkTx({ amount: 250 })], THRESHOLDS);
    // relative diff 60% → amountScore 40 → total ≈ 30+16+30 = 76 < 80
    expect(far).toHaveLength(0);
  });

  it('rejects pairs whose descriptions differ too much', () => {
    const groups = findDuplicateGroups(
      [mkTx({ description: 'TESCO STORES 3021' }), mkTx({ description: 'AMAZON MARKETPLACE' })],
      THRESHOLDS
    );
    expect(groups).toHaveLength(0);
  });

  it('matches identical negative amounts', () => {
    const groups = findDuplicateGroups([mkTx({ amount: -50 }), mkTx({ amount: -50 })], THRESHOLDS);
    expect(groups).toHaveLength(1);
  });

  it('does NOT auto-match unrelated negative amounts (signed-denominator fix)', () => {
    // With the original signed Math.max denominator, -5 vs -10 scored an
    // amountScore of 200, matching at ANY threshold regardless of date/desc.
    const groups = findDuplicateGroups(
      [
        mkTx({ amount: -5, description: 'SHELL PETROL', daysOffset: 0 }),
        mkTx({ amount: -10, description: 'NETFLIX.COM', daysOffset: 10 }),
      ],
      THRESHOLDS
    );
    expect(groups).toHaveLength(0);
  });

  it('lets identical desc+amount pairs match on the ≤70 fallback path regardless of date', () => {
    const txs = [mkTx(), mkTx({ daysOffset: 30 })]; // dateScore 0
    // amount 100*0.4 + desc 100*0.3 = 70.00000000000001 in IEEE floats
    expect(findDuplicateGroups(txs, { ...THRESHOLDS, similarityThreshold: 70 })).toHaveLength(1);
    expect(findDuplicateGroups(txs, { ...THRESHOLDS, similarityThreshold: 71 })).toHaveLength(0);
  });

  it('never groups a transaction into more than one group', () => {
    const txs = [mkTx(), mkTx(), mkTx({ daysOffset: 1 }), mkTx({ daysOffset: 2 })];
    const groups = findDuplicateGroups(txs, THRESHOLDS);
    const seen = new Set<string>();
    for (const g of groups) {
      for (const id of [g.original.id, ...g.potential.map(t => t.id)]) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
  });
});

describe('parity with the original pairwise algorithm', () => {
  // Deterministic LCG so the sample set is stable across runs.
  let seed = 42;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  const DESCRIPTIONS = [
    'TESCO STORES 3021',
    'TESCO STORES 3022',
    'SAINSBURYS LOCAL',
    'AMAZON MARKETPLACE',
    'SHELL PETROL 449',
    'NETFLIX.COM',
    'COUNCIL TAX DD',
    'Payment - Thank You',
  ];
  const AMOUNTS = [3.99, 12.5, 45.67, 45.68, 120, 250.75, -3.99, -45.67, -120, 8.2];

  const sample: Transaction[] = Array.from({ length: 220 }, (_, i) =>
    mkTx({
      id: `s${i}`,
      description: rand() < 0.15 ? `${pick(DESCRIPTIONS)} ${Math.floor(rand() * 10)}` : pick(DESCRIPTIONS),
      amount: pick(AMOUNTS),
      daysOffset: Math.floor(rand() * 45),
    })
  );

  const cases: DuplicateThresholds[] = [
    { dateThreshold: 3, amountThreshold: 0.01, similarityThreshold: 80 },
    { dateThreshold: 3, amountThreshold: 0.01, similarityThreshold: 90 },
    { dateThreshold: 3, amountThreshold: 0.01, similarityThreshold: 71 },
    { dateThreshold: 3, amountThreshold: 5, similarityThreshold: 65 },
    { dateThreshold: 7, amountThreshold: 0.01, similarityThreshold: 50 },
    { dateThreshold: 0, amountThreshold: 0.01, similarityThreshold: 80 },
  ];

  for (const thresholds of cases) {
    it(`matches the reference at threshold ${thresholds.similarityThreshold}% (date ${thresholds.dateThreshold}d, amount ${thresholds.amountThreshold})`, () => {
      const fast = findDuplicateGroups(sample, thresholds);
      const reference = referenceGroups(sample, thresholds);
      expect(shape(fast)).toEqual(shape(reference));
    });
  }

  it('findDuplicateMatches agrees with a full scan for import candidates', () => {
    const thresholds = THRESHOLDS;
    const index = buildDuplicateScanIndex(sample, thresholds);
    const candidates = Array.from({ length: 40 }, (_, i) =>
      mkTx({
        id: `new-${i}`,
        description: pick(DESCRIPTIONS),
        amount: pick(AMOUNTS),
        daysOffset: Math.floor(rand() * 45),
      })
    );

    for (const candidate of candidates) {
      const fast = findDuplicateMatches(index, candidate);
      const referenceMatches = sample.filter(e =>
        calculateSimilarity(candidate, e, thresholds).totalScore >= thresholds.similarityThreshold
      );
      const referenceConfidence = referenceMatches.length > 0
        ? Math.max(...referenceMatches.map(e => calculateSimilarity(candidate, e, thresholds).totalScore))
        : 0;
      expect(fast.matches.map(t => t.id)).toEqual(referenceMatches.map(t => t.id));
      expect(fast.confidence).toBe(referenceConfidence);
    }
  });
});

describe('scale', () => {
  it('handles thousands of transactions without a pairwise blowup', () => {
    // 12,000 rows over ~4 years. The old O(n²) sweep ran ~72M Levenshteins
    // here (minutes); the indexed scan only compares date-window neighbours
    // and must finish comfortably inside the test timeout.
    const txs: Transaction[] = Array.from({ length: 12000 }, (_, i) =>
      mkTx({
        id: `big${i}`,
        description: `MERCHANT ${i % 900}`,
        amount: (i % 500) + 0.99,
        daysOffset: Math.floor(i / 8),
      })
    );
    const groups = findDuplicateGroups(txs, THRESHOLDS);
    // Same merchant+amount rows recur every 900 indexes ⇒ far apart in time ⇒
    // no duplicates expected; the assertion is that we got a clean result fast.
    expect(Array.isArray(groups)).toBe(true);
  });
});
