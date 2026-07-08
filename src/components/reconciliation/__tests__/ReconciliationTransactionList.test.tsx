import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import ReconciliationTransactionList from '../ReconciliationTransactionList';
import type { Transaction } from '../../../types';

const transactions: Transaction[] = [
  {
    id: 'tx-uncleared',
    date: new Date('2026-01-10'),
    amount: -25.5,
    description: 'Coffee Shop',
    category: '',
    accountId: 'acc-1',
    type: 'expense',
    cleared: false,
  },
  {
    id: 'tx-cleared',
    date: new Date('2026-01-11'),
    amount: 100,
    description: 'Salary Payment',
    category: '',
    accountId: 'acc-1',
    type: 'income',
    cleared: true,
  },
];

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

  // NOTE: no vi.restoreAllMocks() here — it would strip the global matchMedia
  // stub installed by the test setup and break every subsequent render.
  const spyConfirm = (answer: boolean) => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(answer);
    return spy;
  };

  it('clicking a row opens it for editing', () => {
    renderList();
    fireEvent.click(screen.getByText('Coffee Shop'));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0][0].id).toBe('tx-uncleared');
  });

  it('clicking the cleared checkbox toggles without opening the row', () => {
    renderList();
    fireEvent.click(screen.getByTitle('Mark as cleared'));
    expect(onToggleCleared).toHaveBeenCalledWith('tx-uncleared', true);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('clicking a cleared checkbox unmarks it', () => {
    renderList();
    fireEvent.click(screen.getByTitle('Mark as uncleared'));
    expect(onToggleCleared).toHaveBeenCalledWith('tx-cleared', false);
  });

  it('"Mark all cleared" bulk-clears visible uncleared transactions after confirm', () => {
    const spy = spyConfirm(true);
    renderList();
    fireEvent.click(screen.getByText('Mark all cleared'));
    expect(onBulkSetCleared).toHaveBeenCalledWith(['tx-uncleared'], true);
    spy.mockRestore();
  });

  it('"Unmark all" bulk-unclears visible cleared transactions after confirm', () => {
    const spy = spyConfirm(true);
    renderList();
    fireEvent.click(screen.getByText('Unmark all'));
    expect(onBulkSetCleared).toHaveBeenCalledWith(['tx-cleared'], false);
    spy.mockRestore();
  });

  it('does nothing when the bulk confirm is declined', () => {
    const spy = spyConfirm(false);
    renderList();
    fireEvent.click(screen.getByText('Mark all cleared'));
    expect(onBulkSetCleared).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('disables bulk buttons when they have nothing to act on', () => {
    renderList([transactions[1]]); // only a cleared transaction visible
    expect(screen.getByText('Mark all cleared')).toBeDisabled();
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
    expect(onVisibleOrderChange).toHaveBeenLastCalledWith(['tx-uncleared', 'tx-cleared']);
  });

  it('reports only the filtered subset when a filter is active', () => {
    renderList();
    fireEvent.click(screen.getByText('Uncleared'));
    // Save & Next must walk only what the user currently sees.
    expect(onVisibleOrderChange).toHaveBeenLastCalledWith(['tx-uncleared']);
  });
});
