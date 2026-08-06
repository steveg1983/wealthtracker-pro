import { describe, it, expect } from 'vitest';
import { findStrandedTransfers, findUnmatchedSplitLegs, resolveAdjustmentCategory } from './strandedTransfers';
import { sweepTransferPairs } from './transferSweep';
import type { Category, Transaction, TransactionSplit } from '../types';

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-07-10'),
  amount: -100,
  description: 'Transfer (Online)',
  category: '',
  accountId: 'acc-a',
  type: 'expense',
  ...over,
});

const cat = (over: Partial<Category> & { id: string; name: string }): Category => ({
  type: 'both',
  level: 'detail',
  ...over,
});

const CATEGORIES: Category[] = [
  cat({ id: 'cat-dental', name: 'Dental', type: 'expense', parentId: 'sub-health' }),
  cat({ id: 'cat-groceries', name: 'Groceries', type: 'expense', parentId: 'sub-food' }),
  cat({
    id: 'revaluation-adjustment',
    name: 'Account Adjustment',
    parentId: 'type-revaluation',
    isRevaluationCategory: true,
  }),
  cat({ id: 'transfer-acc-b', name: 'To/From Savings', isTransferCategory: true, accountId: 'acc-b' }),
];

describe('resolveAdjustmentCategory', () => {
  it('prefers the revaluation-flagged Account Adjustment leaf', () => {
    const resolved = resolveAdjustmentCategory([
      cat({ id: 'legacy', name: 'Account Adjustments', parentId: 'sub-adjustments' }),
      ...CATEGORIES,
    ]);
    expect(resolved?.id).toBe('revaluation-adjustment');
  });

  it('falls back to the exact name when no category carries the flag', () => {
    const resolved = resolveAdjustmentCategory([
      cat({ id: 'legacy', name: 'Account Adjustments', parentId: 'sub-adjustments' }),
    ]);
    expect(resolved?.id).toBe('legacy');
  });

  it('never resolves a transfer category, a type-level root, or a soft-deleted one', () => {
    expect(resolveAdjustmentCategory([
      cat({ id: 'x', name: 'Account Adjustment', isTransferCategory: true, accountId: 'acc-a' }),
    ])).toBeNull();
    expect(resolveAdjustmentCategory([
      cat({ id: 'x', name: 'Account Adjustment', level: 'type', isRevaluationCategory: true }),
    ])).toBeNull();
    expect(resolveAdjustmentCategory([
      cat({ id: 'x', name: 'Account Adjustment', isRevaluationCategory: true, isActive: false }),
    ])).toBeNull();
  });

  it('returns null when the user simply has no such category — never invents one', () => {
    expect(resolveAdjustmentCategory([cat({ id: 'cat-dental', name: 'Dental' })])).toBeNull();
  });
});

describe('findStrandedTransfers — population', () => {
  it('ignores rows the clean sweep can already pair', () => {
    const transactions = [
      txn({ id: 'out', amount: -500 }),
      txn({ id: 'in', amount: 500, accountId: 'acc-b', type: 'income' }),
    ];
    // The pair is clean, so neither side is stranded…
    expect(sweepTransferPairs(transactions, { onlyUncategorised: true }).suggestions).toHaveLength(1);
    expect(findStrandedTransfers(transactions, CATEGORIES).findings).toHaveLength(0);
  });

  it('accepts the caller\'s already-computed sweep suggestions', () => {
    const transactions = [
      txn({ id: 'out', amount: -500 }),
      txn({ id: 'in', amount: 500, accountId: 'acc-b', type: 'income' }),
    ];
    const suggestions = sweepTransferPairs(transactions, { onlyUncategorised: true }).suggestions;
    const { findings, scanned } = findStrandedTransfers(transactions, CATEGORIES, {
      sweepSuggestions: suggestions,
    });
    expect(findings).toHaveLength(0);
    expect(scanned).toBe(0);
  });

  it('ignores categorised, linked, split, transfer-typed, zero and archived rows', () => {
    const { scanned } = findStrandedTransfers([
      txn({ id: 'filed', category: 'cat-groceries' }),
      txn({ id: 'linked', linkedTransferId: 'somewhere' }),
      txn({ id: 'split', isSplit: true }),
      txn({ id: 'typed', type: 'transfer' }),
      txn({ id: 'zero', amount: 0 }),
      txn({ id: 'archived', archived: true }),
      txn({ id: 'live' }),
    ], CATEGORIES);
    expect(scanned).toBe(1);
  });

  it('treats a dangling category id as uncategorised', () => {
    const { scanned } = findStrandedTransfers([txn({ id: 'gone', category: 'deleted-cat' })], CATEGORIES);
    expect(scanned).toBe(1);
  });
});

describe('findStrandedTransfers — 1. duplicate suspect', () => {
  const duplicatePair = (over: Partial<Transaction> = {}): Transaction[] => [
    txn({ id: 'stranded', amount: -250, description: 'Transfer to 5755', ...over }),
    txn({ id: 'linked-copy', amount: -250, description: 'Transfer to 5755', type: 'transfer', linkedTransferId: 'far-side' }),
    txn({ id: 'far-side', amount: 250, accountId: 'acc-b', type: 'transfer', linkedTransferId: 'linked-copy' }),
  ];

  it('flags the spare copy of a same-account, same-day, same-amount leg', () => {
    const { findings } = findStrandedTransfers(duplicatePair(), CATEGORIES);
    expect(findings).toHaveLength(1);
    const finding = findings[0];
    expect(finding.kind).toBe('duplicate');
    expect(finding.row.id).toBe('stranded');
    if (finding.kind !== 'duplicate') throw new Error('expected a duplicate finding');
    expect(finding.duplicateOf.id).toBe('linked-copy');
    expect(finding.descriptionScore).toBe(100);
  });

  it('needs the same SIGN, not just the same magnitude', () => {
    const { findings } = findStrandedTransfers([
      txn({ id: 'stranded', amount: -250, description: 'Transfer to 5755' }),
      txn({ id: 'opposite-same-account', amount: 250, description: 'Transfer to 5755', type: 'transfer', linkedTransferId: 'x' }),
    ], CATEGORIES);
    expect(findings.find(f => f.kind === 'duplicate')).toBeUndefined();
  });

  it('needs the same day', () => {
    const rows = duplicatePair({ date: new Date('2026-07-11') });
    const { findings } = findStrandedTransfers(rows, CATEGORIES);
    expect(findings.find(f => f.kind === 'duplicate')).toBeUndefined();
  });

  it('needs a near-identical description', () => {
    const { findings } = findStrandedTransfers([
      txn({ id: 'stranded', amount: -250, description: 'Transfer to 5755' }),
      txn({ id: 'other', amount: -250, description: 'Waitrose Petrol Station', type: 'transfer', linkedTransferId: 'x' }),
    ], CATEGORIES);
    expect(findings.find(f => f.kind === 'duplicate')).toBeUndefined();
  });

  it('outranks every other finding for the same row', () => {
    const { findings } = findStrandedTransfers([
      ...duplicatePair(),
      // A free, uncategorised opposite in another account would otherwise make
      // this a claimed/categorised twin — the duplicate reading wins.
      txn({ id: 'free-opposite', amount: 250, accountId: 'acc-c', type: 'income', category: 'cat-groceries' }),
    ], CATEGORIES);
    expect(findings.filter(f => f.row.id === 'stranded').map(f => f.kind)).toEqual(['duplicate']);
  });
});

describe('findStrandedTransfers — 2. claimed twin', () => {
  /**
   * The real case: a JOINT −£200 leg wrongly linked to a car-hire refund four
   * days away, while the true same-day +£200 twin sits stranded.
   */
  const claimedCase = (): Transaction[] => [
    txn({ id: 'stranded', amount: 200, accountId: 'acc-joint', type: 'income', date: new Date('2026-05-01'), description: 'Transfer from 5755' }),
    txn({
      id: 'counterpart', amount: -200, accountId: 'acc-current', type: 'transfer',
      date: new Date('2026-05-01'), description: 'Transfer (Online)', linkedTransferId: 'wrong-partner',
    }),
    txn({
      id: 'wrong-partner', amount: 200, accountId: 'acc-credit', type: 'transfer',
      date: new Date('2026-05-05'), description: 'Europcar refund', linkedTransferId: 'counterpart',
    }),
  ];

  it('flags the stranded row when it is strictly closer than the current partner', () => {
    const { findings } = findStrandedTransfers(claimedCase(), CATEGORIES);
    expect(findings).toHaveLength(1);
    const finding = findings[0];
    if (finding.kind !== 'claimed') throw new Error('expected a claimed-twin finding');
    expect(finding.row.id).toBe('stranded');
    expect(finding.counterpart.id).toBe('counterpart');
    expect(finding.currentPartner.id).toBe('wrong-partner');
    expect(finding.daysApart).toBe(0);
    expect(finding.partnerDaysApart).toBe(4);
    expect(finding.wonOnDescription).toBe(false);
  });

  it('refuses an equal match — only a STRICTLY better one is evidence of a mistake', () => {
    const rows = claimedCase();
    // Both candidates now sit four days from the counterpart, and neither
    // wording breaks the tie (this row no longer reads like a transfer).
    rows[0] = { ...rows[0], date: new Date('2026-05-05'), description: 'Cheque paid in' };
    const { findings } = findStrandedTransfers(rows, CATEGORIES);
    expect(findings.find(f => f.kind === 'claimed')).toBeUndefined();
  });

  it('breaks a dead heat on transfer-shaped wording only', () => {
    const rows = claimedCase();
    rows[0] = { ...rows[0], date: new Date('2026-05-05'), description: 'Transfer from 5755' };
    const won = findStrandedTransfers(rows, CATEGORIES).findings[0];
    if (won.kind !== 'claimed') throw new Error('expected a claimed-twin finding');
    expect(won.wonOnDescription).toBe(true);

    // …and never when the current partner reads like a transfer too.
    rows[2] = { ...rows[2], description: 'Transfer (Online) 1234 & 5678' };
    expect(findStrandedTransfers(rows, CATEGORIES).findings.find(f => f.kind === 'claimed')).toBeUndefined();
  });

  it('says nothing when the counterpart is a transfer with nobody to strand', () => {
    const rows = claimedCase();
    // An unlinked typed transfer: re-pairing it strands no one, so this
    // finding — whose whole point is the displaced partner — does not apply.
    const { findings } = findStrandedTransfers([
      rows[0],
      { ...rows[1], linkedTransferId: undefined },
    ], CATEGORIES);
    expect(findings.find(f => f.kind === 'claimed')).toBeUndefined();
  });

  it('never proposes a re-pair that would touch a split row', () => {
    const rows = claimedCase();
    expect(findStrandedTransfers(
      [rows[0], rows[1], { ...rows[2], isSplit: true }],
      CATEGORIES
    ).findings.find(f => f.kind === 'claimed')).toBeUndefined();

    expect(findStrandedTransfers(
      [rows[0], { ...rows[1], linkedTransferSplitId: 'split-line' }, rows[2]],
      CATEGORIES
    ).findings.find(f => f.kind === 'claimed')).toBeUndefined();
  });

  it('stays inside the date window and outside the row\'s own account', () => {
    const rows = claimedCase();
    expect(findStrandedTransfers(
      [{ ...rows[0], date: new Date('2026-05-20') }, rows[1], rows[2]],
      CATEGORIES
    ).findings.find(f => f.kind === 'claimed')).toBeUndefined();

    expect(findStrandedTransfers(
      [{ ...rows[0], accountId: 'acc-current' }, rows[1], rows[2]],
      CATEGORIES
    ).findings.find(f => f.kind === 'claimed')).toBeUndefined();
  });

  it('picks the closest counterpart when several are claimed', () => {
    const rows = [
      ...claimedCase(),
      txn({
        id: 'counterpart-far', amount: -200, accountId: 'acc-other', type: 'transfer',
        date: new Date('2026-05-03'), description: 'Transfer (Online)', linkedTransferId: 'far-partner',
      }),
      txn({
        id: 'far-partner', amount: 200, accountId: 'acc-credit2', type: 'transfer',
        date: new Date('2026-04-29'), description: 'Something else', linkedTransferId: 'counterpart-far',
      }),
    ];
    const finding = findStrandedTransfers(rows, CATEGORIES).findings[0];
    if (finding.kind !== 'claimed') throw new Error('expected a claimed-twin finding');
    expect(finding.counterpart.id).toBe('counterpart');
  });
});

describe('findStrandedTransfers — 3. categorised twin', () => {
  const categorisedCase = (): Transaction[] => [
    txn({ id: 'stranded', amount: -180, accountId: 'acc-current', date: new Date('2026-06-02'), description: 'Transfer (Online)' }),
    txn({
      id: 'twin', amount: 180, accountId: 'acc-credit', type: 'income',
      date: new Date('2026-06-03'), description: 'Bupa Dental', category: 'cat-dental',
    }),
  ];

  it('flags an opposite that carries a real category, naming it', () => {
    const { findings } = findStrandedTransfers(categorisedCase(), CATEGORIES);
    expect(findings).toHaveLength(1);
    const finding = findings[0];
    if (finding.kind !== 'categorised') throw new Error('expected a categorised-twin finding');
    expect(finding.counterpart.id).toBe('twin');
    expect(finding.counterpartCategoryName).toBe('Dental');
    expect(finding.daysApart).toBe(1);
  });

  it('does not count a transfer category or an unassigned bucket as somebody\'s filing', () => {
    const rows = categorisedCase();
    expect(findStrandedTransfers(
      [rows[0], { ...rows[1], category: 'transfer-acc-b' }],
      CATEGORIES
    ).findings.find(f => f.kind === 'categorised')).toBeUndefined();

    const withBucket: Category[] = [
      ...CATEGORIES,
      cat({ id: 'cat-unassigned', name: 'Unassigned', isUnassignedBucket: true }),
    ];
    expect(findStrandedTransfers(
      [rows[0], { ...rows[1], category: 'cat-unassigned' }],
      withBucket
    ).findings.find(f => f.kind === 'categorised')).toBeUndefined();
  });

  it('yields to the claimed-twin reading when the twin is also taken', () => {
    const rows = categorisedCase();
    const { findings } = findStrandedTransfers([
      rows[0],
      { ...rows[1], type: 'transfer', linkedTransferId: 'elsewhere', date: new Date('2026-06-02') },
      txn({ id: 'elsewhere', amount: -180, accountId: 'acc-x', type: 'transfer', date: new Date('2026-06-06'), linkedTransferId: 'twin', description: 'Boots' }),
    ], CATEGORIES);
    expect(findings.map(f => f.kind)).toEqual(['claimed']);
  });
});

describe('findStrandedTransfers — 4. one-sided', () => {
  it('flags a transfer-shaped row with no opposite anywhere', () => {
    const { findings } = findStrandedTransfers([
      txn({ id: 'lonely', amount: -75, description: 'Transfer (Online) 1234 & 5678' }),
      txn({ id: 'unrelated', amount: -40, accountId: 'acc-b', description: 'Tesco' }),
    ], CATEGORIES);
    expect(findings.map(f => f.kind)).toEqual(['one-sided']);
    expect(findings[0].row.id).toBe('lonely');
  });

  it('never offers the adjustment filing to an ordinary merchant row', () => {
    const { findings } = findStrandedTransfers([
      txn({ id: 'shop', amount: -12.5, description: 'Waitrose Petrol Station' }),
    ], CATEGORIES);
    expect(findings).toHaveLength(0);
  });

  it('is not one-sided when an opposite exists but is unavailable', () => {
    // Archived, linked, filed — it is still the other side of this money, so
    // the row is emphatically not "one-sided".
    const opposites: Partial<Transaction>[] = [
      { archived: true },
      { linkedTransferId: 'someone', type: 'transfer' },
      { category: 'cat-groceries' },
    ];
    for (const over of opposites) {
      const { findings } = findStrandedTransfers([
        txn({ id: 'lonely', amount: -75, description: 'Transfer (Online)' }),
        txn({ id: 'opposite', amount: 75, accountId: 'acc-b', type: 'income', description: 'x', ...over }),
      ], CATEGORIES);
      expect(findings.find(f => f.kind === 'one-sided')).toBeUndefined();
    }
  });

  it('counts an opposite in the SAME account too', () => {
    const { findings } = findStrandedTransfers([
      txn({ id: 'lonely', amount: -75, description: 'Transfer (Online)' }),
      txn({ id: 'same-account-opposite', amount: 75, type: 'income', description: 'Refund' }),
    ], CATEGORIES);
    expect(findings.find(f => f.kind === 'one-sided')).toBeUndefined();
  });

  it('respects the date window when looking for an opposite', () => {
    const { findings } = findStrandedTransfers([
      txn({ id: 'lonely', amount: -75, date: new Date('2026-07-10'), description: 'Transfer (Online)' }),
      txn({ id: 'much-later', amount: 75, accountId: 'acc-b', type: 'income', date: new Date('2026-08-10'), description: 'Salary' }),
    ], CATEGORIES);
    expect(findings.map(f => f.row.id)).toEqual(['lonely']);
  });
});

describe('findStrandedTransfers — ordering and determinism', () => {
  it('lists oldest first and re-runs identically', () => {
    const transactions = [
      txn({ id: 'b', amount: -75, date: new Date('2026-07-12'), description: 'Transfer (Online)' }),
      txn({ id: 'a', amount: -30, date: new Date('2026-07-01'), description: 'Sweep to savings' }),
      txn({ id: 'c', amount: -20, date: new Date('2026-07-20'), description: 'TO/FROM Joint' }),
    ];
    const first = findStrandedTransfers(transactions, CATEGORIES).findings.map(f => f.row.id);
    const second = findStrandedTransfers([...transactions].reverse(), CATEGORIES).findings.map(f => f.row.id);
    expect(first).toEqual(['a', 'b', 'c']);
    expect(second).toEqual(first);
  });

  it('gives every row at most one finding', () => {
    const { findings } = findStrandedTransfers([
      txn({ id: 'stranded', amount: -200, date: new Date('2026-05-01') }),
      txn({ id: 'twin-a', amount: 200, accountId: 'acc-b', type: 'income', date: new Date('2026-05-01'), category: 'cat-dental' }),
      txn({ id: 'twin-b', amount: 200, accountId: 'acc-c', type: 'income', date: new Date('2026-05-02'), category: 'cat-groceries' }),
    ], CATEGORIES);
    expect(findings.filter(f => f.row.id === 'stranded')).toHaveLength(1);
  });
});

/**
 * Unmatched split legs — the one-sided family, for a LINE.
 *
 * Every case here ends in a SENTENCE and nothing else: there is no action, by
 * design (see findUnmatchedSplitLegs), so what these tests pin is that the app
 * never says something it cannot know — "nothing matches" only when nothing
 * does, and the precise obstacle when there is one.
 */
describe('findUnmatchedSplitLegs', () => {
  const PARENT: Transaction = txn({
    id: 'repayment', accountId: 'acc-a', amount: 35000, type: 'income',
    description: 'Repaid in full', isSplit: true, date: new Date('2026-07-10'),
  });

  const leg = (over: Partial<TransactionSplit> = {}): TransactionSplit => ({
    id: 'leg', transactionId: 'repayment', category: 'cat-groceries',
    amount: 30000, sortOrder: 1, transferAccountId: 'acc-b', ...over,
  });

  const opposite = (over: Partial<Transaction> = {}): Transaction =>
    txn({ id: 'over-there', accountId: 'acc-b', amount: -30000, description: 'Repaid in full', ...over });

  it('says nothing matches when the account really is empty', () => {
    const { findings, scanned } = findUnmatchedSplitLegs([PARENT], [leg()], CATEGORIES);
    expect(scanned).toBe(1);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: 'unmatched-leg', reason: 'nothing-matches', target: 'acc-b' });
    expect(findings[0].split.id).toBe('leg');
    expect(findings[0].parent.id).toBe('repayment');
  });

  it('reports nothing at all for a leg the sweep can match', () => {
    const { findings, scanned } = findUnmatchedSplitLegs([PARENT, opposite()], [leg()], CATEGORIES);
    expect(scanned).toBe(0);
    expect(findings).toEqual([]);
  });

  it('reports nothing for a linked leg — it has its other side', () => {
    const { findings } = findUnmatchedSplitLegs(
      [PARENT], [leg({ linkedTransferId: 'counterpart' })], CATEGORIES
    );
    expect(findings).toEqual([]);
  });

  it.each([
    ['linked', { linkedTransferId: 'someone', type: 'transfer' as const }],
    ['split', { isSplit: true }],
    ['archived', { archived: true }],
  ])('names the obstacle when the matching row is %s', (reason, over) => {
    const { findings } = findUnmatchedSplitLegs([PARENT, opposite(over)], [leg()], CATEGORIES);
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toBe(reason);
    expect(findings[0].parent.id).toBe('repayment');
  });

  it('names the category when the matching row is filed under one', () => {
    const { findings } = findUnmatchedSplitLegs(
      [PARENT, opposite({ category: 'cat-dental' })], [leg()], CATEGORIES
    );
    expect(findings).toHaveLength(1);
    const [finding] = findings;
    expect(finding.reason).toBe('filed');
    if (finding.reason !== 'filed') throw new Error('expected a filed finding');
    expect(finding.blockerCategoryName).toBe('Dental');
    expect(finding.blocker.id).toBe('over-there');
  });

  it('says "taken" when the row it wanted went to another match', () => {
    // Two lines want the same £30,000 row. One gets it; the other is told why
    // it did not, rather than being told the loan account is empty.
    const second: Transaction = txn({
      id: 'repayment-2', accountId: 'acc-a', amount: 35000, type: 'income',
      description: 'Repaid in full', isSplit: true, date: new Date('2026-07-10'),
    });
    const { findings } = findUnmatchedSplitLegs(
      [PARENT, second, opposite()],
      [leg(), leg({ id: 'leg-2', transactionId: 'repayment-2' })],
      CATEGORIES
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toBe('taken');
  });

  it('ignores a leg whose parent is archived, missing, or points at its own account', () => {
    expect(findUnmatchedSplitLegs([{ ...PARENT, archived: true }], [leg()], CATEGORIES).findings).toEqual([]);
    expect(findUnmatchedSplitLegs([], [leg()], CATEGORIES).findings).toEqual([]);
    expect(findUnmatchedSplitLegs([PARENT], [leg({ transferAccountId: 'acc-a' })], CATEGORIES).findings).toEqual([]);
  });

  it('respects the date window before calling a row the obstacle', () => {
    const { findings } = findUnmatchedSplitLegs(
      [PARENT, opposite({ date: new Date('2026-08-10'), archived: true })], [leg()], CATEGORIES
    );
    expect(findings[0].reason).toBe('nothing-matches');
  });

  it('lists oldest first and re-runs identically', () => {
    const older: Transaction = txn({
      id: 'older', accountId: 'acc-a', amount: 100, type: 'income',
      isSplit: true, date: new Date('2026-01-05'),
    });
    const transactions = [PARENT, older];
    const splits = [leg(), leg({ id: 'leg-older', transactionId: 'older', amount: 60 })];

    const first = findUnmatchedSplitLegs(transactions, splits, CATEGORIES).findings.map(f => f.split.id);
    const second = findUnmatchedSplitLegs(
      [...transactions].reverse(), [...splits].reverse(), CATEGORIES
    ).findings.map(f => f.split.id);
    expect(first).toEqual(['leg-older', 'leg']);
    expect(second).toEqual(first);
  });
});
