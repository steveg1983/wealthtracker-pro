/**
 * WHICH END THE PHONE OPENS ON.
 *
 * The owner, 29 Aug: sorting an account's register oldest-first put him on
 * 2008 and left eleven thousand rows between him and this month. The desktop
 * register never had the problem — it keeps the same order and scrolls to its
 * foot — but a list that loads downward from the top has no foot to scroll to,
 * so the phone had to learn to load from the other end.
 *
 * These pin WHICH ROWS EXIST, which is the half that decides whether the
 * newest is reachable at all. The scroll correction that keeps a reader's
 * place while older rows are added above them is a browser behaviour jsdom
 * does not model, and is called out in the component rather than asserted
 * here — pretending to test it would be worse than saying so.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InfiniteScrollTransactionList } from './InfiniteScrollTransactionList';
import type { Transaction } from '../types';

vi.mock('./SwipeableTransactionRow', () => ({
  SwipeableTransactionRow: ({ transaction }: { transaction: Transaction }) => (
    <div data-testid="row">{transaction.description}</div>
  )
}));

const ledger = (count: number): Transaction[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `t${i}`,
    // Oldest first, exactly as the register orders it: t0 is 2008, the last
    // one is this month.
    description: i === 0 ? 'OLDEST 2008' : i === count - 1 ? 'NEWEST TODAY' : `row ${i}`,
    amount: -1,
    date: new Date(2008, 0, 1 + i),
    accountId: 'a1',
    type: 'expense',
    category: undefined,
    cleared: false
  })) as unknown as Transaction[];

const renderList = (anchor: 'start' | 'end', count = 60) =>
  render(
    <InfiniteScrollTransactionList
      transactions={ledger(count)}
      accounts={[]}
      categories={[]}
      formatCurrency={(n) => `£${n}`}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onView={vi.fn()}
      emptyContent={<p>nothing</p>}
      itemsPerBatch={20}
      anchor={anchor}
    />
  );

describe('which end of a register the phone opens on', () => {
  it('opens on the NEWEST when the register is ordered oldest-first', () => {
    renderList('end');

    expect(screen.getByText('NEWEST TODAY')).toBeInTheDocument();
    // …and 2008 is NOT rendered, which is the whole complaint: it is fifty
    // rows away, not the first thing he meets.
    expect(screen.queryByText('OLDEST 2008')).not.toBeInTheDocument();
  });

  it('still opens on the first row for every other list', () => {
    renderList('start');

    expect(screen.getByText('OLDEST 2008')).toBeInTheDocument();
    expect(screen.queryByText('NEWEST TODAY')).not.toBeInTheDocument();
  });

  it('offers to load EARLIER rows, not "more", when it grows upward', () => {
    // The word matters: on an end-anchored list the next batch is older, and
    // "Load More" says nothing about which direction you are travelling.
    renderList('end');

    expect(screen.getByRole('button', { name: 'Load earlier' })).toBeInTheDocument();
  });

  it('shows the whole register when it fits, whichever end it is anchored to', () => {
    renderList('end', 5);

    expect(screen.getByText('OLDEST 2008')).toBeInTheDocument();
    expect(screen.getByText('NEWEST TODAY')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load earlier' })).not.toBeInTheDocument();
  });

  it('counts what is on screen out of the whole register either way', () => {
    renderList('end');

    expect(screen.getByText('Showing 20 of 60 transactions')).toBeInTheDocument();
  });
});
