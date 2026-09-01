/**
 * WHAT A PHONE CARD SAYS ITS ROW IS FILED AS.
 *
 * From a real phone, 1 Sep 2026: twelve correctly matched transfers, every one
 * of them showing an italic *Uncategorised* — while the desktop register, on
 * the same account and the same rows, read "Transfer > Current Account".
 *
 * The list built its own lookup, `new Map(categories.map(c => [c.id, c.name]))`,
 * and a transfer's category is the literal 'transfer-out', which is no
 * category's id. The miss then fell through to the card's "no category at all"
 * rendering, so a filed row was accused of being unfiled. The leaf-only map
 * lost the parent from every other row into the bargain.
 *
 * `createCategoryLabeller` is the register's own answer to exactly this, and
 * these pin that the phone half of the register now uses it: same rows, same
 * words, whichever viewport is looking. The real card is rendered rather than a
 * stub, because the thing that was wrong is what the card ends up printing.
 *
 * Every name and figure below is invented: this repo is public.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InfiniteScrollTransactionList } from './InfiniteScrollTransactionList';
import type { Account, Category, Transaction } from '../types';

const EVERYDAY: Account = {
  id: 'acc-everyday',
  name: 'Everyday Account',
  type: 'current',
  balance: 0,
  currency: 'GBP',
  lastUpdated: new Date('2026-06-02'),
};

const SAVINGS: Account = {
  id: 'acc-savings',
  name: 'Rainy Day Savings',
  type: 'savings',
  balance: 0,
  currency: 'GBP',
  lastUpdated: new Date('2026-06-02'),
};

const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Food', type: 'expense', level: 'sub' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'cat-food' },
];

const row = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'txn-1',
  date: new Date('2026-06-02'),
  description: 'Synthetic row',
  amount: -12.5,
  type: 'expense',
  category: 'cat-groceries',
  accountId: EVERYDAY.id,
  cleared: false,
  ...over,
});

const renderList = (transactions: Transaction[], accounts: Account[] = [EVERYDAY, SAVINGS]) =>
  render(
    <InfiniteScrollTransactionList
      transactions={transactions}
      accounts={accounts}
      categories={CATEGORIES}
      formatCurrency={(n) => `£${Math.abs(n).toFixed(2)}`}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onView={vi.fn()}
      emptyContent={<p>nothing</p>}
    />
  );

describe('the phone register names a transfer by where the money went', () => {
  it('reads "Transfer > <the other account>", as the desktop register does', () => {
    renderList([
      row({
        id: 'txn-transfer',
        description: 'Monthly sweep',
        type: 'transfer',
        // The literal the quick-add dock and the edit modal write. It is no
        // category's id, which is precisely why the old map missed it.
        category: 'transfer-out',
        transferAccountId: SAVINGS.id,
      }),
    ]);

    expect(screen.getByText(/Transfer > Rainy Day Savings/)).toBeInTheDocument();
    expect(screen.queryByText('Uncategorised')).not.toBeInTheDocument();
  });

  it('still says Uncategorised, in italics, for a row that genuinely has none', () => {
    renderList([row({ id: 'txn-unfiled', description: 'Not filed yet', category: '' })]);

    const unfiled = screen.getByText('Uncategorised');
    expect(unfiled).toBeInTheDocument();
    expect(unfiled.className).toContain('italic');
  });

  it('says the same for an id that resolves to nothing — the labeller answers nothing', () => {
    // A category deleted out from under the row. The labeller returns the
    // empty string rather than inventing a name from the id; on a card that
    // is the one sentence the line already has for having nothing to say.
    renderList([row({ id: 'txn-dangling', category: 'cat-that-went-away' })]);

    expect(screen.getByText('Uncategorised').className).toContain('italic');
  });

  it('shows the whole path, not the leaf the old map stopped at', () => {
    renderList([row()]);

    expect(screen.getByText(/Food > Groceries/)).toBeInTheDocument();
  });
});

describe('the account name on a card', () => {
  it('is left off when every row belongs to the same account', () => {
    // An account register: the name would be identical on every card, on the
    // one truncating line that already carries the date and the category.
    renderList([row(), row({ id: 'txn-2', description: 'Second row' })]);

    expect(screen.queryByText(/Everyday Account/)).not.toBeInTheDocument();
  });

  it('is said when the rows come from more than one account', () => {
    renderList([row(), row({ id: 'txn-2', description: 'Second row', accountId: SAVINGS.id })]);

    expect(screen.getByText(/Everyday Account/)).toBeInTheDocument();
    expect(screen.getByText(/Rainy Day Savings/)).toBeInTheDocument();
  });
});
