import { describe, it, expect } from 'vitest';
import { findTransferCandidates, transferCategoryFor } from './transferMatch';
import type { Transaction, Category } from '../types';

const txn = (over: Partial<Transaction>): Transaction => ({
  id: 'x',
  date: new Date('2026-06-10'),
  description: 'TRANSFER TO 5755',
  amount: -500,
  type: 'expense',
  accountId: 'acc-a',
  category: '',
  cleared: false,
  ...over,
}) as Transaction;

// The row being filed as a transfer: £500 out of account A on 10 June.
const source = txn({ id: 'src' });

describe('findTransferCandidates', () => {
  it('finds the exact-opposite row in the target account within the window', () => {
    const other = txn({
      id: 'match',
      accountId: 'acc-b',
      amount: 500,
      type: 'income',
      description: 'FASTER PAYMENT RECEIVED',
      date: new Date('2026-06-12'),
    });
    const result = findTransferCandidates([source, other], source, 'acc-b');
    expect(result).toHaveLength(1);
    expect(result[0].transaction.id).toBe('match');
    expect(result[0].daysApart).toBe(2);
  });

  it('requires the amount to be EXACTLY the negation', () => {
    const near = txn({ id: 'near', accountId: 'acc-b', amount: 500.01, date: new Date('2026-06-10') });
    const sameSign = txn({ id: 'same', accountId: 'acc-b', amount: -500, date: new Date('2026-06-10') });
    expect(findTransferCandidates([near, sameSign], source, 'acc-b')).toHaveLength(0);
  });

  it('rejects rows outside the date window', () => {
    const late = txn({ id: 'late', accountId: 'acc-b', amount: 500, date: new Date('2026-06-20') });
    expect(findTransferCandidates([late], source, 'acc-b')).toHaveLength(0);
    // …but a custom window can reach it
    expect(findTransferCandidates([late], source, 'acc-b', 30)).toHaveLength(1);
  });

  it('skips split parents, already-linked rows, other accounts, and the source itself', () => {
    const split = txn({ id: 's1', accountId: 'acc-b', amount: 500, isSplit: true });
    const linked = txn({ id: 's2', accountId: 'acc-b', amount: 500, linkedTransferId: 'elsewhere' });
    const wrongAccount = txn({ id: 's3', accountId: 'acc-c', amount: 500 });
    const self = txn({ id: 'src', accountId: 'acc-b', amount: 500 });
    expect(findTransferCandidates([split, linked, wrongAccount, self], source, 'acc-b')).toHaveLength(0);
  });

  it('never matches zero-amount transactions', () => {
    const zeroSource = txn({ id: 'z', amount: 0 });
    const zeroOther = txn({ id: 'z2', accountId: 'acc-b', amount: 0 });
    expect(findTransferCandidates([zeroOther], zeroSource, 'acc-b')).toHaveLength(0);
  });

  it('ranks by date proximity, then description similarity', () => {
    const sameDayDifferentDesc = txn({
      id: 'day0-far', accountId: 'acc-b', amount: 500,
      date: new Date('2026-06-10'), description: 'CHEQUE PAID IN',
    });
    const sameDaySimilarDesc = txn({
      id: 'day0-near', accountId: 'acc-b', amount: 500,
      date: new Date('2026-06-10'), description: 'TRANSFER TO 5755',
    });
    const nextDay = txn({
      id: 'day1', accountId: 'acc-b', amount: 500, date: new Date('2026-06-11'),
    });
    const result = findTransferCandidates(
      [nextDay, sameDayDifferentDesc, sameDaySimilarDesc], source, 'acc-b'
    );
    expect(result.map(c => c.transaction.id)).toEqual(['day0-near', 'day0-far', 'day1']);
  });
});

describe('transferCategoryFor', () => {
  const categories: Category[] = [
    { id: 'c1', name: 'Groceries', type: 'expense', level: 'detail' },
    { id: 'c2', name: 'To/From Savings', type: 'both', level: 'detail', isTransferCategory: true, accountId: 'acc-b' },
  ];

  it('finds the account-managed transfer category', () => {
    expect(transferCategoryFor(categories, 'acc-b')?.id).toBe('c2');
  });

  it('returns undefined for accounts without one', () => {
    expect(transferCategoryFor(categories, 'acc-z')).toBeUndefined();
  });
});
