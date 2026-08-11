/**
 * THE RELEASE RULE, and the pair delete that leans on it.
 *
 * The law these tests hold the code to: a transfer must have another side or it
 * is not a transfer. Deleting one leg is the last path that could leave a row
 * on the wrong side of that, because the stores themselves take only the LINK
 * off the survivor — Postgres by ON DELETE SET NULL, browser storage by hand,
 * the local core explicitly and on purpose. Everything below is about what the
 * app does with the row that is left.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  deleteTransferPair,
  releaseTypeFor,
  releaseUpdatesFor,
  survivorsOfDeletedLeg,
  NO_SURVIVORS,
  type DeleteTransactionOutcome,
} from './transferSurvivorRelease';
import { computeIncomeExpense } from './incomeExpense';
import type { Category, Transaction } from '../types';

const leg = (overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'accountId'>): Transaction => ({
  date: new Date('2027-03-04'),
  description: 'Standing order',
  amount: -240.55,
  type: 'transfer',
  category: 'tofrom-savings',
  cleared: false,
  ...overrides,
});

const OUT = leg({
  id: 'leg-out',
  accountId: 'acc-current',
  transferAccountId: 'acc-savings',
  linkedTransferId: 'leg-in',
});

const IN = leg({
  id: 'leg-in',
  accountId: 'acc-savings',
  amount: 240.55,
  category: 'tofrom-current',
  transferAccountId: 'acc-current',
  linkedTransferId: 'leg-out',
});

describe('releaseTypeFor — the money decides, nothing else', () => {
  it('types money out as an expense and money in as income', () => {
    expect(releaseTypeFor(-240.55)).toBe('expense');
    expect(releaseTypeFor(240.55)).toBe('income');
  });

  it('follows repoint_transfer on zero: `WHEN amount < 0 THEN expense ELSE income`', () => {
    // A zero-amount transfer is refused everywhere it could be created, so this
    // tie is only ever reached by data from somewhere else. It is pinned so the
    // release and the re-point cannot answer it differently.
    expect(releaseTypeFor(0)).toBe('income');
  });

  it('reads the sign through Decimal, so a float artefact cannot flip it', () => {
    // 0.1 + 0.2 - 0.3 is 5.55e-17 in binary floating point: positive, and
    // rightly typed income. The point is that the test states which side of
    // zero the code must agree with, not that it should round it away.
    expect(releaseTypeFor(0.1 + 0.2 - 0.3)).toBe('income');
    expect(releaseTypeFor(-(0.1 + 0.2 - 0.3))).toBe('expense');
  });
});

describe('releaseUpdatesFor — the same five fields the re-point release writes', () => {
  it('clears the transfer filing and re-types by direction', () => {
    // Verbatim the disposition of repoint_transfer(… 'release') and its browser
    // mirror: same fields, same values, so a user who has met one has met both.
    expect(releaseUpdatesFor(IN)).toEqual({
      type: 'income',
      category: '',
      categoryConfirmed: true,
      needsReview: true,
      transferAccountId: '',
    });
    expect(releaseUpdatesFor(OUT).type).toBe('expense');
  });

  it('sends empty strings, never undefined, for the two cleared columns', () => {
    // The update RPC clears a column when the key is present and empty and
    // IGNORES absent keys. `undefined` would serialise the key away and leave
    // the To/From category exactly where it was — which is the bug this whole
    // stream exists to close.
    const updates = releaseUpdatesFor(OUT);
    expect(Object.hasOwn(updates, 'category')).toBe(true);
    expect(Object.hasOwn(updates, 'transferAccountId')).toBe(true);
    expect(updates.category).toBe('');
    expect(updates.transferAccountId).toBe('');
  });

  it('touches no amount, so a release can never move money', () => {
    expect(Object.keys(releaseUpdatesFor(OUT))).not.toContain('amount');
  });
});

describe('survivorsOfDeletedLeg', () => {
  it('finds the row pointing at the one about to go', () => {
    expect(survivorsOfDeletedLeg('leg-in', [OUT, IN]).map(t => t.id)).toEqual(['leg-out']);
    expect(survivorsOfDeletedLeg('leg-out', [OUT, IN]).map(t => t.id)).toEqual(['leg-in']);
  });

  it('finds nothing for an ordinary row', () => {
    const shopping = leg({ id: 'shop', accountId: 'acc-current', type: 'expense', category: 'food',
      transferAccountId: undefined, linkedTransferId: undefined });
    expect(survivorsOfDeletedLeg('shop', [shopping])).toEqual([]);
  });

  it('finds BOTH when imported history has two rows pointing at one leg', () => {
    // linked_transfer_id is not unique in the schema. A rule that fixed one and
    // silently ignored the other would be a rule with a hole in it.
    const twin = leg({ ...OUT, id: 'leg-out-twin' });
    expect(survivorsOfDeletedLeg('leg-in', [OUT, twin, IN]).map(t => t.id))
      .toEqual(['leg-out', 'leg-out-twin']);
  });

  it('leaves a SPLIT PARENT alone — its filing lives in its lines', () => {
    // The same exclusion findMismatchedTransferFilings makes, so the measure
    // and the cure cannot disagree about which rows the law is about.
    const splitSurvivor = leg({ ...OUT, isSplit: true });
    expect(survivorsOfDeletedLeg('leg-in', [splitSurvivor, IN])).toEqual([]);
  });

  it('does NOT excuse a row whose counterpart was a line of the split being deleted', () => {
    // The split parent is going; this ordinary row has just lost its other side
    // like any other, and needs releasing like any other.
    const facingALine = leg({ id: 'faces-line', accountId: 'acc-current', linkedTransferId: 'the-split',
      linkedTransferSplitId: 'line-3' });
    expect(survivorsOfDeletedLeg('the-split', [facingALine]).map(t => t.id)).toEqual(['faces-line']);
  });
});

/**
 * WHERE THE RELEASED ROW LANDS.
 *
 * The claim in the dialog is that the survivor ends up somewhere the user will
 * see it. This proves the claim against the classifier every report and the
 * review band are built on, rather than against a hand-written idea of it.
 */
describe('a released survivor lands in the review band', () => {
  const CATEGORIES: Category[] = [
    { id: 'tofrom-savings', name: 'To/From Savings', type: 'both', level: 'detail', isTransferCategory: true, accountId: 'acc-savings' },
    { id: 'tofrom-current', name: 'To/From Current', type: 'both', level: 'detail', isTransferCategory: true, accountId: 'acc-current' },
  ];

  const applyRelease = (row: Transaction): Transaction => {
    const { linkedTransferId: _link, ...rest } = row;
    return { ...rest, ...releaseUpdatesFor(row) };
  };

  it('counts as neither income nor spending while it is still filed as a transfer', () => {
    // The state a delete leaves behind if nothing releases it: unlinked, still
    // typed transfer, still filed under To/From. Every report drops it.
    const { linkedTransferId: _link, ...unreleased } = IN;
    const before = computeIncomeExpense([unreleased as Transaction], [], CATEGORIES);

    expect(before.uncategorizedRows).toHaveLength(0);
    expect(before.income.toNumber()).toBe(0);
    expect(before.expenses.toNumber()).toBe(0);
  });

  it('appears in the uncategorised rows once released, in both directions', () => {
    const releasedIn = computeIncomeExpense([applyRelease(IN)], [], CATEGORIES);
    expect(releasedIn.uncategorizedRows.map(r => r.id)).toEqual(['leg-in']);
    expect(releasedIn.uncategorizedIn.toNumber()).toBe(240.55);

    const releasedOut = computeIncomeExpense([applyRelease(OUT)], [], CATEGORIES);
    expect(releasedOut.uncategorizedRows.map(r => r.id)).toEqual(['leg-out']);
    expect(releasedOut.uncategorizedOut.toNumber()).toBe(240.55);
  });

  it('is not counted as income or spending either — it is unfiled, not filed wrongly', () => {
    const released = computeIncomeExpense([applyRelease(IN)], [], CATEGORIES);
    expect(released.income.toNumber()).toBe(0);
    expect(released.expenses.toNumber()).toBe(0);
  });
});

describe('deleteTransferPair', () => {
  const ok = (): Promise<DeleteTransactionOutcome> => Promise.resolve(NO_SURVIVORS);

  it('deletes the leg the user was looking at FIRST, then the other side', () => {
    const order: string[] = [];
    const deleteTransaction = vi.fn(async (id: string) => { order.push(id); return NO_SURVIVORS; });

    return deleteTransferPair(OUT, IN, 'Savings', { deleteTransaction }).then(result => {
      expect(result).toEqual({ kind: 'both-deleted' });
      // The row they pointed at goes first: if only one delete can happen, the
      // one that happens should be the one they asked for.
      expect(order).toEqual(['leg-out', 'leg-in']);
    });
  });

  it('deletes NOTHING when the first delete fails, and says so', async () => {
    const boom = new Error('network down');
    const deleteTransaction = vi.fn(async () => { throw boom; });

    const result = await deleteTransferPair(OUT, IN, 'Savings', { deleteTransaction });

    expect(result).toEqual({ kind: 'nothing-deleted', error: boom });
    expect(deleteTransaction).toHaveBeenCalledTimes(1);
  });

  it('reports WHICH side survived and that it was released, when the second fails', async () => {
    const boom = new Error('conflict');
    const deleteTransaction = vi.fn(async (id: string) => {
      if (id === 'leg-in') throw boom;
      // Deleting the first leg released the second — this is what the first
      // call hands back, and what the report must be read from.
      return { survivors: [{ transactionId: 'leg-in', accountId: 'acc-savings', released: true }] };
    });

    const result = await deleteTransferPair(OUT, IN, 'Savings', { deleteTransaction });

    expect(result.kind).toBe('one-deleted');
    if (result.kind !== 'one-deleted') throw new Error('unreachable');
    expect(result.error).toBe(boom);
    expect(result.message).toContain('“Standing order” was deleted');
    expect(result.message).toContain('in Savings');
    // The +240.55 leg is what survived, so it is a deposit, and it is no
    // longer a transfer — which is exactly where the user should go looking.
    expect(result.message).toMatch(/no longer a transfer/);
    expect(result.message).toMatch(/uncategorised deposit/);
    expect(result.message).toMatch(/still counted in that account’s balance/);
  });

  it('tells the truth when the survivor was NOT released either', async () => {
    // Both writes failed. Saying "it is now an uncategorised deposit" here
    // would send the user looking for a row that does not exist in that shape.
    const deleteTransaction = vi.fn(async (id: string) => {
      if (id === 'leg-in') throw new Error('conflict');
      return { survivors: [{ transactionId: 'leg-in', accountId: 'acc-savings', released: false }] };
    });

    const result = await deleteTransferPair(OUT, IN, 'Savings', { deleteTransaction });

    if (result.kind !== 'one-deleted') throw new Error('expected one-deleted');
    expect(result.message).toMatch(/still marked as a transfer with nothing on the other side/);
    expect(result.message).not.toMatch(/uncategorised/);
  });

  it('names the account it faced when the account has no name to print', async () => {
    const deleteTransaction = vi.fn(async (id: string) => {
      if (id === 'leg-in') throw new Error('conflict');
      return { survivors: [{ transactionId: 'leg-in', accountId: 'acc-savings', released: true }] };
    });

    const result = await deleteTransferPair(OUT, IN, undefined, { deleteTransaction });

    if (result.kind !== 'one-deleted') throw new Error('expected one-deleted');
    expect(result.message).toContain('in the account it faced');
    expect(result.message).not.toContain('undefined');
  });

  it('does not claim a release it was never told about', async () => {
    // An outcome with no survivor entry for that id means nobody reported one:
    // the conservative reading is "not released", because the message that
    // follows is what the user will act on.
    const deleteTransaction = vi.fn(async (id: string) => {
      if (id === 'leg-in') throw new Error('conflict');
      return NO_SURVIVORS;
    });

    const result = await deleteTransferPair(OUT, IN, 'Savings', { deleteTransaction });

    if (result.kind !== 'one-deleted') throw new Error('expected one-deleted');
    expect(result.message).toMatch(/still marked as a transfer/);
  });

  it('passes both ids through untouched', async () => {
    const deleteTransaction = vi.fn(ok);
    await deleteTransferPair(OUT, IN, 'Savings', { deleteTransaction });
    expect(deleteTransaction).toHaveBeenNthCalledWith(1, 'leg-out');
    expect(deleteTransaction).toHaveBeenNthCalledWith(2, 'leg-in');
  });
});
