/**
 * A phone card can become the editor in place.
 *
 * The register hands the list the id of the row being edited and something
 * to draw there; the list draws that instead of the card, and every other
 * card as before. What the editor IS lives in MobileQuickEditCard; this pins
 * only the swap.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InfiniteScrollTransactionList } from './InfiniteScrollTransactionList';
import type { Account, Category, Transaction } from '../types';

const EVERYDAY: Account = {
  id: 'acc-everyday', name: 'Everyday Account', type: 'current', balance: 0, currency: 'GBP', lastUpdated: new Date('2026-06-02'),
};
const CATEGORIES: Category[] = [
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail' },
];
const row = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'txn-1', date: new Date('2026-06-02'), description: 'Synthetic row', amount: -12.5, type: 'expense',
  category: 'cat-groceries', accountId: EVERYDAY.id, cleared: false, ...over,
});

describe('the phone list draws the editor in place of the row being edited', () => {
  it('swaps only that card, leaves the others, and draws nothing extra when no row is being edited', () => {
    const rows = [row({ id: 'txn-1', description: 'FIRST ROW' }), row({ id: 'txn-2', description: 'SECOND ROW' })];
    const { rerender } = render(
      <InfiniteScrollTransactionList
        transactions={rows}
        accounts={[EVERYDAY]}
        categories={CATEGORIES}
        formatCurrency={(n) => `£${Math.abs(n).toFixed(2)}`}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onView={vi.fn()}
        emptyContent={<p>nothing</p>}
        editingId="txn-2"
        renderEditor={(t) => <div data-testid="editor-for">{t.description} — editing</div>}
      />
    );

    expect(screen.getByTestId('editor-for')).toHaveTextContent('SECOND ROW — editing');
    expect(screen.getByText('FIRST ROW')).toBeInTheDocument();
    // The card's own line for the edited row is gone — the editor stands there.
    expect(screen.queryByText('SECOND ROW')).not.toBeInTheDocument();

    rerender(
      <InfiniteScrollTransactionList
        transactions={rows}
        accounts={[EVERYDAY]}
        categories={CATEGORIES}
        formatCurrency={(n) => `£${Math.abs(n).toFixed(2)}`}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onView={vi.fn()}
        emptyContent={<p>nothing</p>}
        editingId={null}
        renderEditor={(t) => <div data-testid="editor-for">{t.description} — editing</div>}
      />
    );
    expect(screen.queryByTestId('editor-for')).not.toBeInTheDocument();
    expect(screen.getByText('SECOND ROW')).toBeInTheDocument();
  });
});
