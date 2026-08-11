import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import ReconciliationTransactionList from '../ReconciliationTransactionList';
import type { Transaction } from '../../../types';

/**
 * Marking is a HOLDING state. These tests hold that line at the list: the marks
 * are made without ceremony, they say "C" and not "R", a reconciliation that
 * was finished is not undone by a click here — and, since the working filter
 * landed, a marked row STAYS in the list it was marked in.
 *
 * Every name and figure here is invented: this repo is public.
 */
const transactions: Transaction[] = [
  {
    id: 'tx-unmarked',
    date: new Date('2026-01-10'),
    amount: -25.5,
    description: 'Corner Cafe',
    category: '',
    accountId: 'acc-1',
    type: 'expense',
    cleared: false,
    reconciled: false,
  },
  {
    id: 'tx-marked',
    date: new Date('2026-01-11'),
    amount: 100,
    description: 'Monthly Pay',
    category: '',
    accountId: 'acc-1',
    type: 'income',
    cleared: true,
    reconciled: false,
  },
];

const aReconciledRow = (): Transaction => ({
  id: 'tx-reconciled',
  date: new Date('2026-01-12'),
  amount: -12,
  description: 'Settled Last Month',
  category: '',
  accountId: 'acc-1',
  type: 'expense',
  cleared: true,
  reconciled: true,
});

describe('ReconciliationTransactionList', () => {
  const onToggleCleared = vi.fn();
  const onBulkSetCleared = vi.fn();
  const onRowClick = vi.fn();
  const onAddTransaction = vi.fn();
  const onVisibleOrderChange = vi.fn();

  const renderList = (txns: Transaction[] = transactions) =>
    renderWithProviders(
      <ReconciliationTransactionList
        transactions={txns}
        categories={[]}
        openingBalance={0}
        onToggleCleared={onToggleCleared}
        onBulkSetCleared={onBulkSetCleared}
        onRowClick={onRowClick}
        onAddTransaction={onAddTransaction}
        onVisibleOrderChange={onVisibleOrderChange}
      />
    );

  /** The one view that shows rows a finished reconciliation committed. */
  const showAll = (): void => {
    fireEvent.click(screen.getByText('All'));
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clicking a row opens it for editing', () => {
    renderList();
    fireEvent.click(screen.getByText('Corner Cafe'));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0][0].id).toBe('tx-unmarked');
  });

  it('clicking the checkbox marks without opening the row', () => {
    renderList();
    fireEvent.click(screen.getByTitle('Mark this transaction'));
    expect(onToggleCleared).toHaveBeenCalledWith('tx-unmarked', true);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('clicking a marked checkbox unmarks it', () => {
    renderList();
    fireEvent.click(screen.getByTitle('Unmark this transaction'));
    expect(onToggleCleared).toHaveBeenCalledWith('tx-marked', false);
  });

  it('shows C against a mark and R against a finished reconciliation', () => {
    renderList([...transactions, aReconciledRow()]);
    showAll();
    expect(screen.getByTitle('Unmark this transaction')).toHaveTextContent('C');
    expect(screen.getByTitle(/Reconciled in a finished reconciliation/)).toHaveTextContent('R');
  });

  it('will not unmark a row a finished reconciliation committed', () => {
    renderList([...transactions, aReconciledRow()]);
    showAll();
    const committed = screen.getByTitle(/Reconciled in a finished reconciliation/);
    expect(committed).toBeDisabled();
    fireEvent.click(committed);
    expect(onToggleCleared).not.toHaveBeenCalled();
  });

  it('"Mark all" marks the visible unmarked rows with no confirmation popup', () => {
    // The popup is gone on purpose: marking is a working state that Finalize
    // commits and a second click undoes, so there was nothing to be sure about
    // — and the popup is what made "Mark all" feel like the reconciliation.
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderList();

    fireEvent.click(screen.getByText('Mark all'));

    expect(onBulkSetCleared).toHaveBeenCalledWith(['tx-unmarked'], true);
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('"Unmark all" unmarks the visible marked rows with no confirmation popup', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderList();

    fireEvent.click(screen.getByText('Unmark all'));

    expect(onBulkSetCleared).toHaveBeenCalledWith(['tx-marked'], false);
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('"Unmark all" leaves reconciled rows alone', () => {
    // One click can cover hundreds of rows. A bulk helper for this session's
    // marks has no business reaching back into settled statements — asserted
    // from the ONE view where a committed row is even on screen.
    renderList([...transactions, aReconciledRow()]);
    showAll();
    fireEvent.click(screen.getByText('Unmark all'));
    expect(onBulkSetCleared).toHaveBeenCalledWith(['tx-marked'], false);
  });

  it('"Mark all" leaves reconciled rows alone too', () => {
    // The mirror of the rule above, stated in the same shape: neither bulk
    // helper reaches into a finished reconciliation.
    renderList([...transactions, aReconciledRow()]);
    showAll();
    fireEvent.click(screen.getByText('Mark all'));
    expect(onBulkSetCleared).toHaveBeenCalledWith(['tx-unmarked'], true);
  });

  it('disables bulk buttons when they have nothing to act on', () => {
    renderList([transactions[1]]); // only a marked transaction visible
    expect(screen.getByText('Mark all')).toBeDisabled();
    expect(screen.getByText('Unmark all')).not.toBeDisabled();
  });

  it('shows an "Add category…" hint for uncategorised transactions', () => {
    renderList();
    expect(screen.getAllByText('Add category…').length).toBeGreaterThan(0);
  });

  it('wires the Add button', () => {
    renderList();
    fireEvent.click(screen.getByText('Add'));
    expect(onAddTransaction).toHaveBeenCalledTimes(1);
  });

  it('reports the visible order (date-sorted) for Save & Next navigation', () => {
    renderList();
    // Sorted by date ascending: the 10th before the 11th.
    expect(onVisibleOrderChange).toHaveBeenLastCalledWith(['tx-unmarked', 'tx-marked']);
  });

  it('reports only the filtered subset when the view changes', () => {
    // Save & Next must walk only what the user currently sees, whichever view
    // that is — the working list on open, everything once All is chosen.
    renderList([...transactions, aReconciledRow()]);
    expect(onVisibleOrderChange).toHaveBeenLastCalledWith(['tx-unmarked', 'tx-marked']);

    showAll();
    expect(onVisibleOrderChange).toHaveBeenLastCalledWith([
      'tx-unmarked', 'tx-marked', 'tx-reconciled',
    ]);
  });

  it('"Marked" shows the working set only — what Finalize would commit', () => {
    renderList([...transactions, aReconciledRow()]);
    fireEvent.click(screen.getByText('Marked'));
    expect(onVisibleOrderChange).toHaveBeenLastCalledWith(['tx-marked']);
  });
});

/**
 * The working list is everything not yet R.
 *
 * The owner's complaint, from live testing: "I press Mark all and the list I am
 * working empties itself." It emptied because the middle filter was 'Unmarked'
 * and a mark took the row out of it — so the screen said "done" while nothing
 * had been reconciled. A mark is progress THROUGH this list, not an exit from
 * it: the badge changes, the row stays, and only Finalize takes it away.
 */
describe('ReconciliationTransactionList — the working filter', () => {
  const onToggleCleared = vi.fn();
  const onBulkSetCleared = vi.fn();
  const onRowClick = vi.fn();
  const onAddTransaction = vi.fn();
  const onVisibleOrderChange = vi.fn();

  const renderList = (txns: Transaction[]) =>
    renderWithProviders(
      <ReconciliationTransactionList
        transactions={txns}
        categories={[]}
        openingBalance={0}
        onToggleCleared={onToggleCleared}
        onBulkSetCleared={onBulkSetCleared}
        onRowClick={onRowClick}
        onAddTransaction={onAddTransaction}
        onVisibleOrderChange={onVisibleOrderChange}
      />
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers three views, and the middle one is named for the work', () => {
    // "Outstanding" was the other candidate and was rejected: in bank
    // reconciliation an outstanding item is one that has NOT cleared, which is
    // the unmarked SUBSET of this view — the trade's word for a part, used as
    // the name of the whole.
    renderList(transactions);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('To reconcile')).toBeInTheDocument();
    expect(screen.getByText('Marked')).toBeInTheDocument();
    expect(screen.queryByText('Unmarked')).not.toBeInTheDocument();
    expect(screen.queryByText('Outstanding')).not.toBeInTheDocument();
  });

  it('opens on the work, not on the history', () => {
    // An account is opened here to reconcile it. The committed row is one
    // click away under "All" and nowhere in the way until then.
    renderList([...transactions, aReconciledRow()]);
    expect(screen.getByText('To reconcile')).toHaveAttribute('aria-pressed', 'true');
    expect(onVisibleOrderChange).toHaveBeenLastCalledWith(['tx-unmarked', 'tx-marked']);
    expect(screen.queryByText('Settled Last Month')).not.toBeInTheDocument();
  });

  it('HEADLINE: a marked row stays in the working list, wearing its C', () => {
    // Marking every row is what the owner pressed. The list must still hold
    // every one of them afterwards — with the badge changed, not the row gone.
    const { rerender } = renderList(transactions);
    fireEvent.click(screen.getByText('Mark all'));
    expect(onBulkSetCleared).toHaveBeenCalledWith(['tx-unmarked'], true);

    // The store answers: both rows are now marked, neither is reconciled.
    rerender(
      <ReconciliationTransactionList
        transactions={transactions.map(t => ({ ...t, cleared: true, reconciled: false }))}
        categories={[]}
        openingBalance={0}
        onToggleCleared={onToggleCleared}
        onBulkSetCleared={onBulkSetCleared}
        onRowClick={onRowClick}
        onAddTransaction={onAddTransaction}
        onVisibleOrderChange={onVisibleOrderChange}
      />
    );

    expect(screen.getByText('Corner Cafe')).toBeInTheDocument();
    expect(screen.getByText('Monthly Pay')).toBeInTheDocument();
    const marks = screen.getAllByTitle('Unmark this transaction');
    expect(marks).toHaveLength(2);
    marks.forEach(mark => expect(mark).toHaveTextContent('C'));
    // And the view is still the working view, still reporting both rows.
    expect(onVisibleOrderChange).toHaveBeenLastCalledWith(['tx-unmarked', 'tx-marked']);
  });

  it('drops a row only once a finished reconciliation has committed it', () => {
    // The other half of the rule: R is the exit, and the only exit.
    renderList([...transactions, aReconciledRow()]);
    expect(screen.queryByText('Settled Last Month')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('All'));
    expect(screen.getByText('Settled Last Month')).toBeInTheDocument();
  });

  it('says which emptiness it is when the work runs out', () => {
    // Everything reconciled: the account is finished, and saying "no
    // transactions found" would send the user hunting for rows nothing lost.
    renderList([aReconciledRow()]);
    expect(screen.getByText('Nothing left to reconcile on this account.')).toBeInTheDocument();
  });

  it('Unmark all in the working view puts the rows back to unticked, still in view', () => {
    // Its scope is unchanged — the visible marked rows — but under this filter
    // that no longer means "and then they vanish".
    const { rerender } = renderList(transactions);
    fireEvent.click(screen.getByText('Unmark all'));
    expect(onBulkSetCleared).toHaveBeenCalledWith(['tx-marked'], false);

    rerender(
      <ReconciliationTransactionList
        transactions={transactions.map(t => ({ ...t, cleared: false }))}
        categories={[]}
        openingBalance={0}
        onToggleCleared={onToggleCleared}
        onBulkSetCleared={onBulkSetCleared}
        onRowClick={onRowClick}
        onAddTransaction={onAddTransaction}
        onVisibleOrderChange={onVisibleOrderChange}
      />
    );

    expect(screen.getAllByTitle('Mark this transaction')).toHaveLength(2);
    expect(onVisibleOrderChange).toHaveBeenLastCalledWith(['tx-unmarked', 'tx-marked']);
  });

  it('the Marked view is still a strict narrowing of the work', () => {
    renderList([...transactions, aReconciledRow()]);
    fireEvent.click(screen.getByText('Marked'));

    expect(screen.getByText('Monthly Pay')).toBeInTheDocument();
    expect(screen.queryByText('Corner Cafe')).not.toBeInTheDocument();
    expect(screen.queryByText('Settled Last Month')).not.toBeInTheDocument();
    // Nothing unmarked is in view, so there is nothing for Mark all to do.
    expect(screen.getByText('Mark all')).toBeDisabled();
  });
});
