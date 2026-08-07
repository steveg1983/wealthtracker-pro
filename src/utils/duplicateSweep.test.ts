/**
 * The duplicate sweep's rules: one account at a time, detect widely, delete
 * narrowly, and never offer to delete a row that is holding something else
 * together.
 *
 * The scoring itself belongs to duplicateScan and is tested there; what is
 * pinned here is the part that makes a delete tool safe to point at real money.
 */

import { describe, it, expect } from 'vitest';
import {
  deleteBlockOf,
  deleteRefusalFor,
  findDuplicateCandidates,
  needsConfirmation,
  type DuplicateCandidate,
} from './duplicateSweep';
import type { Transaction } from '../types';

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-05-01'),
  amount: -49.99,
  description: 'TESCO STORES 3421',
  category: 'cat-food',
  accountId: 'acc-current',
  type: 'expense',
  ...over,
});

const keysOf = (candidates: ReturnType<typeof findDuplicateCandidates>): string[] =>
  candidates.map(c => [c.a.id, c.b.id].sort().join('+')).sort();

const oneOf = (candidates: DuplicateCandidate[]): DuplicateCandidate => {
  expect(candidates).toHaveLength(1);
  return candidates[0];
};

describe('findDuplicateCandidates', () => {
  it('finds the same payment recorded twice in one account', () => {
    const found = findDuplicateCandidates(
      [txn({ id: 'feed' }), txn({ id: 'import' })],
      { windowDays: 3 }
    );
    expect(keysOf(found)).toEqual(['feed+import']);
    expect(found[0].score).toBeGreaterThanOrEqual(80);
    expect(found[0].daysApart).toBe(0);
    expect(found[0].basis).toBe('description-agrees');
  });

  it('never offers two DIFFERENT amounts, however alike they otherwise read', () => {
    // The pair that shipped: same payee, one day apart, £24.99 against £36.95.
    // Under the weighted score that was 82 against a threshold of 80 — date and
    // description alone contributed 55 of it — so a 48% amount gap was offered
    // as a duplicate. The amount is a gate now, not 40% of an opinion.
    const found = findDuplicateCandidates(
      [
        txn({ id: 'a', amount: -24.99, description: 'APPLE.COM/BILL HOLLYHILL', date: new Date('2026-08-05') }),
        txn({ id: 'b', amount: -36.95, description: 'APPLE.COM/BILL HOLLYHILL', date: new Date('2026-08-04') }),
      ],
      { windowDays: 3 }
    );
    expect(found).toEqual([]);
  });

  it('still pairs rows that match to the penny', () => {
    const found = findDuplicateCandidates(
      [
        txn({ id: 'a', amount: -24.99, description: 'APPLE.COM/BILL HOLLYHILL', date: new Date('2026-08-05') }),
        txn({ id: 'b', amount: -24.99, description: 'APPLE.COM/BILL HOLLYHILL', date: new Date('2026-08-04') }),
      ],
      { windowDays: 3 }
    );
    expect(keysOf(found)).toEqual(['a+b']);
  });

  it('a penny apart is a different payment, not a duplicate', () => {
    const found = findDuplicateCandidates(
      [
        txn({ id: 'a', amount: -24.99 }),
        txn({ id: 'b', amount: -25.01 }),
      ],
      { windowDays: 3 }
    );
    expect(found).toEqual([]);
  });

  it('equal and OPPOSITE is not a duplicate — that is a transfer', () => {
    const found = findDuplicateCandidates(
      [txn({ id: 'out', amount: -24.99 }), txn({ id: 'in', amount: 24.99 })],
      { windowDays: 3 }
    );
    expect(found).toEqual([]);
  });

  it('never pairs rows in DIFFERENT accounts — that is a transfer, not a duplicate', () => {
    // Equal and opposite would be the transfer sweep's business; equal and
    // IDENTICAL across two accounts is still not one payment recorded twice.
    const found = findDuplicateCandidates(
      [txn({ id: 'here' }), txn({ id: 'there', accountId: 'acc-joint' })],
      { windowDays: 3 }
    );
    expect(found).toEqual([]);
  });

  it('respects the date window', () => {
    const rows = [txn({ id: 'first' }), txn({ id: 'later', date: new Date('2026-05-09') })];
    expect(findDuplicateCandidates(rows, { windowDays: 3 })).toEqual([]);
    expect(keysOf(findDuplicateCandidates(rows, { windowDays: 14 }))).toEqual(['first+later']);
  });

  it('leaves amounts that differ by real money alone', () => {
    const found = findDuplicateCandidates(
      [txn({ id: 'a', amount: -49.99 }), txn({ id: 'b', amount: -149.99 })],
      { windowDays: 3 }
    );
    expect(found).toEqual([]);
  });

  it('ignores archived rows — they are out of the register by choice', () => {
    const found = findDuplicateCandidates(
      [txn({ id: 'live' }), txn({ id: 'put-away', archived: true })],
      { windowDays: 3 }
    );
    expect(found).toEqual([]);
  });

  it('offers a three-way duplicate as pairs, each with both of its rows', () => {
    const found = findDuplicateCandidates(
      [txn({ id: 'one' }), txn({ id: 'two' }), txn({ id: 'three' })],
      { windowDays: 3 }
    );
    expect(keysOf(found)).toEqual(['one+three', 'one+two']);
  });
});

/**
 * The five shapes a real re-import left behind, with invented wording and
 * figures. Every pair is one payment recorded twice in ONE account; not one of
 * them has the same description on both sides. Three were truncated by whatever
 * wrote them, one was written by a different system, and one was renamed by
 * hand to something its owner would recognise a year later.
 */
const PAIR_SHAPES = [
  {
    id: 'truncated-tail',
    first: 'Sweep Transfer from account 5566',
    second: 'Sweep Transfer from account 55667788',
    amount: 9876.54,
  },
  {
    id: 'reference-appended',
    first: 'Direct Debit - STREAMCO',
    second: 'Direct Debit - STREAMCO  00110022330044',
    amount: -63.2,
  },
  {
    id: 'reference-extended',
    first: 'Direct Debit - TELCO LTD  447',
    second: 'Direct Debit - TELCO LTD  447221900-00007',
    amount: -77.45,
  },
  {
    id: 'name-reordered',
    first: 'SAMPLE PERSON A',
    second: 'Standing Order to MISS A SAMPLE - A SAMPLE',
    amount: -2500,
  },
  {
    id: 'renamed-payee',
    first: 'Nadia',
    second: 'Immediate Faster Payment (Online) to B EXAMPLE 07-FEB-2027',
    amount: -410,
  },
];

describe('findDuplicateCandidates — detecting through an edited description', () => {
  it('finds every one of the five real shapes, in one sweep', () => {
    // THE BUG. Scoring description similarity into the total and demanding 80
    // meant the description had to supply 33 of the 100 on its own, so the two
    // pairs whose wording was rewritten rather than truncated were invisible —
    // and rewriting a payee's name is the commonest edit anyone makes to their
    // own register.
    const rows = PAIR_SHAPES.flatMap(shape => [
      txn({ id: `${shape.id}-a`, amount: shape.amount, description: shape.first }),
      txn({ id: `${shape.id}-b`, amount: shape.amount, description: shape.second }),
    ]);

    expect(keysOf(findDuplicateCandidates(rows, { windowDays: 3 }))).toEqual(
      PAIR_SHAPES.map(shape => `${shape.id}-a+${shape.id}-b`).sort()
    );
  });

  it('finds a pair with NOT ONE WORD in common — and calls it evidence, not proof', () => {
    // The headline case. "Nadia" against the bank's own wording shares nothing
    // at all, so no description rule of any kind could ever have reached it.
    // Same account, same day, same money to the penny is what remains, and it
    // is enough to SHOW the pair — never enough to delete one unasked.
    const renamed = txn({ id: 'renamed', amount: -410, description: 'Nadia' });
    const asTheBankWroteIt = txn({
      id: 'as-imported',
      amount: -410,
      description: 'Immediate Faster Payment (Online) to B EXAMPLE 07-FEB-2027',
    });

    const found = oneOf(findDuplicateCandidates([renamed, asTheBankWroteIt], { windowDays: 3 }));

    expect(keysOf([found])).toEqual(['as-imported+renamed']);
    expect(found.basis).toBe('amount-and-date');
    expect(found.descriptionOverlap).toBe(0);
    expect(found.daysApart).toBe(0);
    // Found DESPITE scoring nowhere near the bar a delete still has to clear.
    expect(found.score).toBeLessThan(80);

    expect(needsConfirmation(found)).toBe(true);
    expect(deleteRefusalFor(found, renamed, false)).toBe('not-confirmed');
    expect(deleteRefusalFor(found, asTheBankWroteIt, false)).toBe('not-confirmed');
    expect(deleteRefusalFor(found, renamed, true)).toBeNull();
  });

  it('reports the wider rule separately from the pairs whose wording agrees', () => {
    const found = findDuplicateCandidates(
      [
        txn({ id: 'feed', amount: -63.2, description: 'Direct Debit - STREAMCO' }),
        txn({ id: 'file', amount: -63.2, description: 'Direct Debit - STREAMCO  00110022330044' }),
        txn({ id: 'renamed', amount: -410, description: 'Nadia' }),
        txn({
          id: 'as-imported',
          amount: -410,
          description: 'Immediate Faster Payment (Online) to B EXAMPLE 07-FEB-2027',
        }),
      ],
      { windowDays: 3 }
    );

    const byKey = new Map(found.map(c => [[c.a.id, c.b.id].sort().join('+'), c.basis]));
    expect(byKey.get('feed+file')).toBe('description-agrees');
    expect(byKey.get('as-imported+renamed')).toBe('amount-and-date');
  });

  it('leaves the rows the first tier paired off out of the second', () => {
    // Two rows read alike and pair on wording; the third is the same money on
    // the same day but worded differently. It is NOT argued about twice in one
    // run — settle the pair in front of you, run it again, and it comes up.
    const found = findDuplicateCandidates(
      [
        txn({ id: 'feed' }),
        txn({ id: 'import' }),
        txn({ id: 'renamed', description: 'Nadia' }),
      ],
      { windowDays: 3 }
    );
    expect(keysOf(found)).toEqual(['feed+import']);
  });
});

describe('findDuplicateCandidates — what the wider rule refuses to do', () => {
  it('still will not pair two different amounts, however close they look', () => {
    // The pair that shipped, run past BOTH rules: the wider one buckets by
    // exact pence, so a 48% gap does not even reach the comparison.
    const found = findDuplicateCandidates(
      [
        txn({ id: 'a', amount: -24.99, description: 'Renamed by hand' }),
        txn({ id: 'b', amount: -36.95, description: 'CARD PAYMENT 4409' }),
      ],
      { windowDays: 3 }
    );
    expect(found).toEqual([]);
  });

  it('will not pair amounts one penny apart', () => {
    const found = findDuplicateCandidates(
      [
        txn({ id: 'a', amount: -24.99, description: 'Renamed by hand' }),
        txn({ id: 'b', amount: -25, description: 'CARD PAYMENT 4409' }),
      ],
      { windowDays: 3 }
    );
    expect(found).toEqual([]);
  });

  it('will not pair equal and OPPOSITE amounts — the sign is part of the money', () => {
    const found = findDuplicateCandidates(
      [
        txn({ id: 'out', amount: -410, description: 'Nadia' }),
        txn({ id: 'in', amount: 410, description: 'Immediate Faster Payment (Online) from B' }),
      ],
      { windowDays: 3 }
    );
    expect(found).toEqual([]);
  });

  it('never reaches across accounts — that is a transfer, not a duplicate', () => {
    const found = findDuplicateCandidates(
      [
        txn({ id: 'here', amount: -410, description: 'Nadia' }),
        txn({ id: 'there', accountId: 'acc-joint', amount: -410, description: 'Standing Order' }),
      ],
      { windowDays: 3 }
    );
    expect(found).toEqual([]);
  });

  it('honours the date window it was given', () => {
    const rows = [
      txn({ id: 'first', amount: -410, description: 'Nadia' }),
      txn({
        id: 'later',
        amount: -410,
        date: new Date('2026-05-09'),
        description: 'Immediate Faster Payment (Online) to B EXAMPLE',
      }),
    ];
    expect(findDuplicateCandidates(rows, { windowDays: 3 })).toEqual([]);
    expect(keysOf(findDuplicateCandidates(rows, { windowDays: 14 }))).toEqual(['first+later']);
  });

  it('flags only half of a set of equal payments — two coffees are two coffees', () => {
    // Four £3.20 rows on one day, all worded differently. Matching is strictly
    // 1:1, so at most two pairs come back: a rule that paired everything with
    // everything would offer six and invite the loss of real spending.
    const rows = ['CAFE ONE', 'Coffee', 'KIOSK 88', 'Morning cup'].map((description, i) =>
      txn({ id: `cup-${i}`, amount: -3.2, description })
    );
    const found = findDuplicateCandidates(rows, { windowDays: 3 });

    expect(found).toHaveLength(2);
    expect(new Set(found.flatMap(c => [c.a.id, c.b.id])).size).toBe(4);
  });

  it('ignores archived rows in the wider rule too', () => {
    const found = findDuplicateCandidates(
      [
        txn({ id: 'live', amount: -410, description: 'Nadia' }),
        txn({ id: 'put-away', amount: -410, description: 'Standing Order', archived: true }),
      ],
      { windowDays: 3 }
    );
    expect(found).toEqual([]);
  });

  it('says nothing about two rows it could never offer to delete', () => {
    // Two transfer legs of the same size a day apart is what a regular saver's
    // register looks like. Neither can be deleted and their wording proves
    // nothing, so there is no offer to make and nothing worth saying.
    const found = findDuplicateCandidates(
      [
        txn({ id: 'leg-a', amount: -500, description: 'Transfer out', linkedTransferId: 'far-a' }),
        txn({
          id: 'leg-b',
          amount: -500,
          date: new Date('2026-05-02'),
          description: 'Standing Order to SAVINGS',
          linkedTransferId: 'far-b',
        }),
      ],
      { windowDays: 3 }
    );
    expect(found).toEqual([]);
  });

  it('still offers a blocked row when the other copy CAN go', () => {
    // The leg is not consumed by a partner it could never be judged against:
    // it keeps looking, and pairs with the row that is actually deletable.
    const found = findDuplicateCandidates(
      [
        txn({ id: 'leg-a', amount: -500, description: 'Transfer out', linkedTransferId: 'far-a' }),
        txn({
          id: 'leg-b',
          amount: -500,
          date: new Date('2026-05-02'),
          description: 'Standing Order to SAVINGS',
          linkedTransferId: 'far-b',
        }),
        txn({ id: 'plain', amount: -500, date: new Date('2026-05-03'), description: 'Nadia' }),
      ],
      { windowDays: 3 }
    );
    expect(keysOf(found)).toEqual(['leg-a+plain']);
  });
});

describe('deleteRefusalFor — the gate every delete has to pass', () => {
  const pairFoundByWording = (): DuplicateCandidate =>
    oneOf(findDuplicateCandidates([txn({ id: 'feed' }), txn({ id: 'import' })], { windowDays: 3 }));

  const pairFoundByMoneyAlone = (): DuplicateCandidate =>
    oneOf(findDuplicateCandidates(
      [
        txn({ id: 'renamed', amount: -410, description: 'Nadia' }),
        txn({
          id: 'as-imported',
          amount: -410,
          description: 'Immediate Faster Payment (Online) to B EXAMPLE 07-FEB-2027',
        }),
      ],
      { windowDays: 3 }
    ));

  it('lets a pair whose wording agrees through exactly as it always did', () => {
    const pair = pairFoundByWording();
    expect(needsConfirmation(pair)).toBe(false);
    // No new hoop: the confirmation the weaker tier needs is not asked of this
    // one, and was never asked of it before the weaker tier existed.
    expect(deleteRefusalFor(pair, pair.a, false)).toBeNull();
    expect(deleteRefusalFor(pair, pair.b, false)).toBeNull();
  });

  it('refuses a pair found only on money and date until someone says otherwise', () => {
    const pair = pairFoundByMoneyAlone();
    expect(deleteRefusalFor(pair, pair.a, false)).toBe('not-confirmed');
    expect(deleteRefusalFor(pair, pair.b, false)).toBe('not-confirmed');
  });

  it('refuses a row that is holding something together, confirmed or not', () => {
    // Confirmation is about which PAIR; it can never buy a row out of the
    // blocks that exist because deleting it would strand something else.
    const leg = txn({ id: 'leg', amount: -410, description: 'Nadia', linkedTransferId: 'far' });
    const pair: DuplicateCandidate = { ...pairFoundByMoneyAlone(), a: leg };
    expect(deleteRefusalFor(pair, leg, true)).toBe('linked-transfer');
    expect(deleteRefusalFor(pair, leg, false)).toBe('linked-transfer');
  });

  it('refuses a row that is not one of the two on offer', () => {
    // The confirmation is about THIS pair. A row that is not in it has not been
    // looked at by anybody, so it cannot borrow the answer.
    const pair = pairFoundByWording();
    expect(deleteRefusalFor(pair, txn({ id: 'someone-else' }), true)).toBe('not-one-of-the-pair');
  });
});

describe('deleteBlockOf', () => {
  it('lets an ordinary row go', () => {
    expect(deleteBlockOf(txn({ id: 'plain' }))).toBeNull();
  });

  it('refuses half of a linked transfer — the other side would be stranded', () => {
    expect(deleteBlockOf(txn({
      id: 'leg', type: 'transfer', linkedTransferId: 'other-leg', transferAccountId: 'acc-joint',
    }))).toBe('linked-transfer');
  });

  it('refuses the counterpart of a split LINE, and says so precisely', () => {
    // This row carries BOTH pointers (linkedTransferId names the split parent),
    // and the split-line reason is the one that tells the user what to do.
    expect(deleteBlockOf(txn({
      id: 'line-counterpart', type: 'transfer',
      linkedTransferId: 'split-parent', linkedTransferSplitId: 'line-1',
    }))).toBe('split-line-counterpart');
  });

  it('refuses a split parent — its lines, and any leg among them, go with it', () => {
    expect(deleteBlockOf(txn({ id: 'parent', isSplit: true }))).toBe('split-parent');
  });
});
