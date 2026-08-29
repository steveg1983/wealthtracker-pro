/**
 * The evidence a budget is set against — pinned.
 *
 * Two readings of "last 12 months" (the owner named both, 29 Aug 2026), what
 * counts as spending, and the twin arithmetic that lets someone type either
 * figure. Every name and amount is invented: this repo is public.
 */

import { describe, it, expect } from 'vitest';
import {
  groupSubtotals,
  spendWindow,
  summariseCategorySpend,
  twinOf,
} from './categorySpendSummary';
import type { Category, Transaction, TransactionSplit } from '../types';

const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type' },
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isTransferCategory: true },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-shop', name: 'Food Shopping', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'det-dining', name: 'Dining Out', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'grp-home', name: 'Household', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-energy', name: 'Gas & Electricity', type: 'expense', level: 'detail', parentId: 'grp-home' },
  { id: 'det-salary', name: 'Net Pay', type: 'income', level: 'detail', parentId: 'type-income' },
  { id: 'transfer-out', name: 'Transfer Out', type: 'both', level: 'detail', parentId: 'type-transfer', isTransferCategory: true },
];

const txn = (over: Partial<Transaction> & { id: string; date: string }): Transaction => ({
  accountId: 'acc-1',
  description: 'Synthetic row',
  amount: -50,
  type: 'expense',
  category: 'det-shop',
  ...over,
  date: new Date(over.date),
});

/** Fixed "now": Saturday 29 August 2026, mid-month on purpose. */
const NOW = new Date(2026, 7, 29);

describe('spendWindow', () => {
  it('full-months ends at the last COMPLETE month — the owner\'s reading', () => {
    // 29 Aug: August has not finished, so it is out; the year is Aug 2025 to
    // Jul 2026 inclusive. Counting a part-month would read every category low
    // by however much of August is left.
    expect(spendWindow('full-months', NOW)).toEqual({
      kind: 'full-months', from: '2025-08-01', to: '2026-07-31',
    });
  });

  it('to-yesterday is the rolling year ending yesterday — today is a part-day too', () => {
    expect(spendWindow('to-yesterday', NOW)).toEqual({
      kind: 'to-yesterday', from: '2025-08-29', to: '2026-08-28',
    });
  });

  it('full-months on the FIRST of a month still ends with the month just gone', () => {
    expect(spendWindow('full-months', new Date(2026, 0, 1))).toEqual({
      kind: 'full-months', from: '2025-01-01', to: '2025-12-31',
    });
  });
});

describe('summariseCategorySpend — what counts', () => {
  const rows: Transaction[] = [
    txn({ id: 'a', date: '2025-09-10', amount: -120 }),
    txn({ id: 'b', date: '2026-03-04', amount: -80 }),
    txn({ id: 'c', date: '2026-07-31', amount: -100 }),       // last day, in
    txn({ id: 'd', date: '2026-08-02', amount: -400 }),       // this month, OUT of full-months
    txn({ id: 'e', date: '2025-07-31', amount: -999 }),       // day before the window
    txn({ id: 'f', date: '2026-02-02', amount: 6000, type: 'income', category: 'det-salary' }),
    txn({ id: 'g', date: '2026-02-03', amount: -500, type: 'transfer', category: 'transfer-out' }),
  ];

  it('sums the window\'s expenses per category and nothing else', () => {
    const s = summariseCategorySpend(rows, [], CATEGORIES, { now: NOW });
    expect(s.byCategory.get('det-shop')?.annual.toNumber()).toBe(300); // 120+80+100
    // Income and transfers never appear, whatever their amount.
    expect(s.byCategory.has('det-salary')).toBe(false);
    expect(s.byCategory.has('transfer-out')).toBe(false);
  });

  it('gives the monthly figure as exactly a twelfth of the year', () => {
    const s = summariseCategorySpend(rows, [], CATEGORIES, { now: NOW });
    expect(s.byCategory.get('det-shop')?.monthly.toNumber()).toBe(25); // 300 / 12
  });

  it('the window choice changes what is counted, visibly', () => {
    const rolling = summariseCategorySpend(rows, [], CATEGORIES, { kind: 'to-yesterday', now: NOW });
    // August's £400 joins; July 2025's £999 was already out of both.
    expect(rolling.byCategory.get('det-shop')?.annual.toNumber()).toBe(700);
  });

  it('leaves a category with no spending OUT of the map rather than in it at zero', () => {
    const s = summariseCategorySpend(rows, [], CATEGORIES, { now: NOW });
    expect(s.byCategory.has('det-energy')).toBe(false);
  });

  it('counts the rows behind each figure — one freak charge should be visible as one', () => {
    const s = summariseCategorySpend(rows, [], CATEGORIES, { now: NOW });
    expect(s.byCategory.get('det-shop')?.rows).toBe(3);
  });
});

describe('summariseCategorySpend — refunds, splits and unfiled money', () => {
  it('nets a refund off its category: the year cost what it cost', () => {
    const s = summariseCategorySpend([
      txn({ id: 'buy', date: '2026-01-10', amount: -200, category: 'det-dining' }),
      txn({ id: 'refund', date: '2026-01-20', amount: 40, type: 'income', category: 'det-dining' }),
    ], [], CATEGORIES, { now: NOW });
    expect(s.byCategory.get('det-dining')?.annual.toNumber()).toBe(160);
  });

  it('never reports negative spending — "you were paid to shop here" is not a budget', () => {
    const s = summariseCategorySpend([
      txn({ id: 'buy', date: '2026-01-10', amount: -50, category: 'det-dining' }),
      txn({ id: 'refund', date: '2026-01-20', amount: 300, type: 'income', category: 'det-dining' }),
    ], [], CATEGORIES, { now: NOW });
    expect(s.byCategory.get('det-dining')?.annual.toNumber()).toBe(0);
  });

  it('splits land in their own categories, not the parent\'s', () => {
    const parent = txn({ id: 'split', date: '2026-05-05', amount: -180, category: '', isSplit: true });
    const splits: TransactionSplit[] = [
      { id: 's1', transactionId: 'split', category: 'det-shop', amount: -120, sortOrder: 1 },
      { id: 's2', transactionId: 'split', category: 'det-dining', amount: -60, sortOrder: 2 },
    ];
    const s = summariseCategorySpend([parent], splits, CATEGORIES, { now: NOW });
    expect(s.byCategory.get('det-shop')?.annual.toNumber()).toBe(120);
    expect(s.byCategory.get('det-dining')?.annual.toNumber()).toBe(60);
  });

  it('counts unfiled spending separately, so the screen can say the figures are short', () => {
    const s = summariseCategorySpend([
      txn({ id: 'filed', date: '2026-04-01', amount: -100 }),
      txn({ id: 'unfiled', date: '2026-04-02', amount: -75, category: undefined }),
      txn({ id: 'unfiled-credit', date: '2026-04-03', amount: 20, type: 'income', category: undefined }),
    ], [], CATEGORIES, { now: NOW });

    expect(s.byCategory.get('det-shop')?.annual.toNumber()).toBe(100);
    expect(s.unfiled.toNumber()).toBe(75);   // the credit is not unfiled SPENDING
    expect(s.unfiledRows).toBe(1);
  });
});

describe('groupSubtotals — context for a leaf figure', () => {
  it('rolls leaves up to the group they sit under', () => {
    const s = summariseCategorySpend([
      txn({ id: 'a', date: '2026-01-05', amount: -300, category: 'det-shop' }),
      txn({ id: 'b', date: '2026-01-06', amount: -200, category: 'det-dining' }),
      txn({ id: 'c', date: '2026-01-07', amount: -150, category: 'det-energy' }),
    ], [], CATEGORIES, { now: NOW });

    const groups = groupSubtotals(s, CATEGORIES);
    expect(groups.get('grp-food')?.toNumber()).toBe(500);
    expect(groups.get('grp-home')?.toNumber()).toBe(150);
  });
});

describe('twinOf — type either figure, see the other', () => {
  it('a monthly budget states its year, and a yearly budget its month', () => {
    expect(twinOf(1600, 'monthly').toNumber()).toBe(19200);
    expect(twinOf(15000, 'yearly').toNumber()).toBe(1250);
  });

  it('keeps full precision rather than rounding into the stored figure', () => {
    // £1,000/yr is £83.33… a month: the screen rounds, the arithmetic does not,
    // so a twin typed back never drifts.
    expect(twinOf(1000, 'yearly').times(12).toNumber()).toBe(1000);
  });
});
