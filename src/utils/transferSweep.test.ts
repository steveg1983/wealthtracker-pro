import { describe, it, expect } from 'vitest';
import { sweepTransferPairs } from './transferSweep';
import type { Transaction } from '../types';

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-07-10'),
  amount: -100,
  description: 'Transfer',
  category: '',
  accountId: 'acc-a',
  type: 'expense',
  ...over,
});

describe('sweepTransferPairs', () => {
  it('pairs equal-and-opposite rows across accounts, orienting out/in', () => {
    const { suggestions } = sweepTransferPairs([
      txn({ id: 'out', amount: -500, accountId: 'acc-a', description: 'Transfer to 5755' }),
      txn({ id: 'in', amount: 500, accountId: 'acc-b', type: 'income', description: 'Faster payment received' }),
    ]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].outgoing.id).toBe('out');
    expect(suggestions[0].incoming.id).toBe('in');
    expect(suggestions[0].daysApart).toBe(0);
  });

  it('never pairs within the same account', () => {
    const { suggestions } = sweepTransferPairs([
      txn({ id: 'a', amount: -500, accountId: 'acc-a' }),
      txn({ id: 'b', amount: 500, accountId: 'acc-a', type: 'income' }),
    ]);
    expect(suggestions).toHaveLength(0);
  });

  it('respects the date window', () => {
    const near = sweepTransferPairs([
      txn({ id: 'a', amount: -500, date: new Date('2026-07-10') }),
      txn({ id: 'b', amount: 500, accountId: 'acc-b', type: 'income', date: new Date('2026-07-13') }),
    ]);
    expect(near.suggestions).toHaveLength(1);

    const far = sweepTransferPairs([
      txn({ id: 'a', amount: -500, date: new Date('2026-07-10') }),
      txn({ id: 'b', amount: 500, accountId: 'acc-b', type: 'income', date: new Date('2026-07-20') }),
    ]);
    expect(far.suggestions).toHaveLength(0);
  });

  it('skips already-linked, split, transfer-typed and zero rows', () => {
    const { suggestions, scanned } = sweepTransferPairs([
      txn({ id: 'linked', amount: -500, linkedTransferId: 'x' }),
      txn({ id: 'split', amount: -500, isSplit: true }),
      txn({ id: 'transfer', amount: -500, type: 'transfer' }),
      txn({ id: 'zero', amount: 0 }),
      txn({ id: 'match', amount: 500, accountId: 'acc-b', type: 'income' }),
    ]);
    expect(scanned).toBe(1);           // only 'match' is eligible
    expect(suggestions).toHaveLength(0); // and it has no partner
  });

  it('uses each row at most once — three candidates yield one pair, not three', () => {
    const { suggestions } = sweepTransferPairs([
      txn({ id: 'out', amount: -100, accountId: 'acc-a' }),
      txn({ id: 'in1', amount: 100, accountId: 'acc-b', type: 'income' }),
      txn({ id: 'in2', amount: 100, accountId: 'acc-c', type: 'income' }),
    ]);
    expect(suggestions).toHaveLength(1);
    expect(['in1', 'in2']).toContain(suggestions[0].incoming.id);
  });

  it('flags ambiguity when two candidates are equally good', () => {
    const { suggestions } = sweepTransferPairs([
      txn({ id: 'out', amount: -100, accountId: 'acc-a', description: 'Transfer' }),
      txn({ id: 'in1', amount: 100, accountId: 'acc-b', type: 'income', description: 'Transfer' }),
      txn({ id: 'in2', amount: 100, accountId: 'acc-c', type: 'income', description: 'Transfer' }),
    ]);
    expect(suggestions[0].ambiguous).toBe(true);
  });

  it('closest date wins over description similarity', () => {
    const { suggestions } = sweepTransferPairs([
      txn({ id: 'out', amount: -100, accountId: 'acc-a', date: new Date('2026-07-10'), description: 'Transfer to savings' }),
      txn({ id: 'far-exact', amount: 100, accountId: 'acc-b', type: 'income', date: new Date('2026-07-13'), description: 'Transfer to savings' }),
      txn({ id: 'near', amount: 100, accountId: 'acc-c', type: 'income', date: new Date('2026-07-10'), description: 'FPS credit' }),
    ]);
    expect(suggestions[0].incoming.id).toBe('near');
  });

  it('onlyUncategorised skips rows that carry a real category', () => {
    const categoryIds = new Set(['cat-groceries']);
    const { suggestions } = sweepTransferPairs([
      txn({ id: 'out', amount: -100, category: 'cat-groceries' }),
      txn({ id: 'in', amount: 100, accountId: 'acc-b', type: 'income' }),
    ], { onlyUncategorised: true, categoryIds });
    expect(suggestions).toHaveLength(0);

    // A dangling category id still counts as uncategorised.
    const dangling = sweepTransferPairs([
      txn({ id: 'out', amount: -100, category: 'gone' }),
      txn({ id: 'in', amount: 100, accountId: 'acc-b', type: 'income' }),
    ], { onlyUncategorised: true, categoryIds });
    expect(dangling.suggestions).toHaveLength(1);
  });
});
