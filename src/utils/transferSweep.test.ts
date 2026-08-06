import { describe, it, expect } from 'vitest';
import { sweepTransferPairs } from './transferSweep';
import type { Transaction, TransactionSplit } from '../types';

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-07-10'),
  amount: -100,
  description: 'Transfer',
  category: '',
  accountId: 'acc-a',
  type: 'expense',
  ...over,
});

const line = (over: Partial<TransactionSplit> & { id: string }): TransactionSplit => ({
  transactionId: 'repayment',
  category: 'cat-x',
  amount: 30000,
  sortOrder: 1,
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

/**
 * The owner's case, which whole-transaction matching cannot see: £35,000
 * arrives, £30,000 of it settles a loan (a transfer LINE) and £5,000 is
 * interest. The parent is £35,000 and the row waiting in the loan account is
 * £30,000 — nothing about the two ROWS matches; the LINE and that row match
 * exactly.
 */
describe('sweepTransferPairs — split line legs', () => {
  const PARENT: Transaction = txn({
    id: 'repayment',
    accountId: 'acc-current',
    amount: 35000,
    type: 'income',
    description: 'Repaid in full',
    isSplit: true,
  });

  /** The £30,000 leg: a target, no counterpart yet. */
  const LEG = line({ id: 'leg', amount: 30000, transferAccountId: 'acc-loan' });
  const INTEREST = line({ id: 'interest', amount: 5000, sortOrder: 2 });

  const LOAN_ROW: Transaction = txn({
    id: 'loan-row',
    accountId: 'acc-loan',
    amount: -30000,
    description: 'Repaid in full',
  });

  const sweep = (
    transactions: Transaction[],
    splits: TransactionSplit[] = [LEG, INTEREST]
  ) => sweepTransferPairs(transactions, { splits });

  it('matches the LINE to the free row in the account it names', () => {
    const { suggestions, legSuggestions, legsScanned } = sweep([PARENT, LOAN_ROW]);

    // The parent is a split, so the whole-transaction pass cannot see any of
    // this — which is exactly why the line pass exists.
    expect(suggestions).toHaveLength(0);
    expect(legsScanned).toBe(1);
    expect(legSuggestions).toHaveLength(1);
    expect(legSuggestions[0]).toMatchObject({
      daysApart: 0,
      ambiguous: false,
    });
    expect(legSuggestions[0].split.id).toBe('leg');
    expect(legSuggestions[0].parent.id).toBe('repayment');
    expect(legSuggestions[0].candidate.id).toBe('loan-row');
  });

  it('offers nothing without the splits — the pass is opt-in', () => {
    const { legSuggestions, legsScanned } = sweepTransferPairs([PARENT, LOAN_ROW]);
    expect(legsScanned).toBe(0);
    expect(legSuggestions).toEqual([]);
  });

  it.each([
    ['the row is in a different account', txn({ id: 'loan-row', accountId: 'acc-isa', amount: -30000 })],
    ['the amount is a penny out', txn({ id: 'loan-row', accountId: 'acc-loan', amount: -29999.99 })],
    ['the amount is the PARENT\'s, not the line\'s', txn({ id: 'loan-row', accountId: 'acc-loan', amount: -35000 })],
    ['the row is outside the window', txn({ id: 'loan-row', accountId: 'acc-loan', amount: -30000, date: new Date('2026-07-20') })],
    ['the row is already linked', txn({ id: 'loan-row', accountId: 'acc-loan', amount: -30000, linkedTransferId: 'somebody' })],
    ['the row is already some other line\'s opposite', txn({ id: 'loan-row', accountId: 'acc-loan', amount: -30000, linkedTransferSplitId: 'other-line' })],
    ['the row is typed as a transfer', txn({ id: 'loan-row', accountId: 'acc-loan', amount: -30000, type: 'transfer' })],
    ['the row is itself a split', txn({ id: 'loan-row', accountId: 'acc-loan', amount: -30000, isSplit: true })],
    ['the row is archived', txn({ id: 'loan-row', accountId: 'acc-loan', amount: -30000, archived: true })],
  ])('offers nothing when %s', (_case, candidate) => {
    expect(sweep([PARENT, candidate]).legSuggestions).toEqual([]);
  });

  it('offers nothing for a line that is already linked, or has no target', () => {
    const linked = sweep([PARENT, LOAN_ROW], [{ ...LEG, linkedTransferId: 'counterpart' }, INTEREST]);
    expect(linked.legsScanned).toBe(0);
    expect(linked.legSuggestions).toEqual([]);

    const noTarget = sweep([PARENT, LOAN_ROW], [{ ...LEG, transferAccountId: undefined }, INTEREST]);
    expect(noTarget.legSuggestions).toEqual([]);
  });

  it('offers nothing when the split parent is archived or missing', () => {
    expect(sweep([{ ...PARENT, archived: true }, LOAN_ROW]).legSuggestions).toEqual([]);
    expect(sweep([LOAN_ROW]).legSuggestions).toEqual([]);
  });

  it('respects onlyUncategorised exactly as the whole-transaction pass does', () => {
    const categoryIds = new Set(['cat-loan-repayment']);
    const filed = sweepTransferPairs(
      [PARENT, { ...LOAN_ROW, category: 'cat-loan-repayment' }],
      { splits: [LEG, INTEREST], onlyUncategorised: true, categoryIds }
    );
    expect(filed.legSuggestions).toEqual([]);

    const free = sweepTransferPairs(
      [PARENT, LOAN_ROW],
      { splits: [LEG, INTEREST], onlyUncategorised: true, categoryIds }
    );
    expect(free.legSuggestions).toHaveLength(1);
  });

  it('flags ambiguity when two rows match the line equally well', () => {
    const { legSuggestions } = sweep([
      PARENT,
      LOAN_ROW,
      txn({ id: 'loan-row-twin', accountId: 'acc-loan', amount: -30000, description: 'Repaid in full' }),
    ]);
    expect(legSuggestions).toHaveLength(1);
    expect(legSuggestions[0].ambiguous).toBe(true);
  });

  it('flags ambiguity when two LINES compete for the same row', () => {
    const second: Transaction = txn({
      id: 'repayment-2', accountId: 'acc-current', amount: 35000,
      type: 'income', description: 'Repaid in full', isSplit: true,
    });
    const { legSuggestions } = sweep(
      [PARENT, second, LOAN_ROW],
      [LEG, INTEREST, line({ id: 'leg-2', transactionId: 'repayment-2', amount: 30000, transferAccountId: 'acc-loan' })]
    );

    // One row, two lines: the row is used once, and the match it made is
    // flagged rather than presented as obvious.
    expect(legSuggestions).toHaveLength(1);
    expect(legSuggestions[0].ambiguous).toBe(true);
  });

  it('uses a row at most once across BOTH passes, and never at a pair\'s expense', () => {
    // The loan row could serve either the whole-transaction pair or the line.
    // The pair pass runs first and keeps it; the line is simply not offered.
    const history = [
      PARENT,
      LOAN_ROW,
      txn({ id: 'plain-out', accountId: 'acc-isa', amount: 30000, type: 'income', description: 'Repaid in full' }),
    ];
    const { suggestions, legSuggestions } = sweep(history);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].outgoing.id).toBe('loan-row');
    expect(suggestions[0].incoming.id).toBe('plain-out');
    expect(legSuggestions).toEqual([]);
  });

  it('leaves every whole-transaction suggestion byte-identical', () => {
    // The additivity proof: the same history swept with and without the split
    // lines must produce the SAME pairs, in the same order, with the same
    // orientation, days apart, score and ambiguity.
    const history = [
      PARENT,
      LOAN_ROW,
      txn({ id: 'pair-out', accountId: 'acc-a', amount: -500, date: new Date('2026-06-01') }),
      txn({ id: 'pair-in', accountId: 'acc-b', amount: 500, type: 'income', date: new Date('2026-06-02') }),
      txn({ id: 'pair-out-2', accountId: 'acc-b', amount: -75.5, date: new Date('2026-06-10') }),
      txn({ id: 'pair-in-2', accountId: 'acc-c', amount: 75.5, type: 'income', date: new Date('2026-06-10') }),
    ];

    const before = sweepTransferPairs(history);
    const after = sweepTransferPairs(history, { splits: [LEG, INTEREST] });

    expect(after.suggestions).toEqual(before.suggestions);
    expect(after.scanned).toBe(before.scanned);
    expect(after.legSuggestions).toHaveLength(1);
    expect(before.legSuggestions).toEqual([]);
  });
});
