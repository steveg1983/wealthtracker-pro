import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import ReconciliationTransactionList from '../ReconciliationTransactionList';
import type { Transaction } from '../../../types';

/**
 * Marking is a HOLDING state. These tests hold that line at the list: the marks
 * are made without ceremony, they say "C" and not "R", and a reconciliation
 * that was finished is not undone by a click here.
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
    expect(screen.getByTitle('Unmark this transaction')).toHaveTextContent('C');
    expect(screen.getByTitle(/Reconciled in a finished reconciliation/)).toHaveTextContent('R');
  });

  it('will not unmark a row a finished reconciliation committed', () => {
    renderList([...transactions, aReconciledRow()]);
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
    // marks has no business reaching back into settled statements.
    renderList([...transactions, aReconciledRow()]);
    fireEvent.click(screen.getByText('Unmark all'));
    expect(onBulkSetCleared).toHaveBeenCalledWith(['tx-marked'], false);
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

  it('reports only the filtered subset when a filter is active', () => {
    renderList();
    fireEvent.click(screen.getByText('Unmarked'));
    // Save & Next must walk only what the user currently sees.
    expect(onVisibleOrderChange).toHaveBeenLastCalledWith(['tx-unmarked']);
  });

  it('"Marked" shows the working set only — what Finalize would commit', () => {
    renderList([...transactions, aReconciledRow()]);
    fireEvent.click(screen.getByText('Marked'));
    expect(onVisibleOrderChange).toHaveBeenLastCalledWith(['tx-marked']);
  });
});
