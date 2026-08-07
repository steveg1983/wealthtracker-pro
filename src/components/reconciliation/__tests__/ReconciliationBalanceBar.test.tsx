import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import ReconciliationBalanceBar from '../ReconciliationBalanceBar';

/**
 * The bank balance is the only figure on this bar a person can type, and until
 * now it was write-only: once any number existed there was no way back to "no
 * bank balance" and a Difference of N/A. These tests hold the way back open.
 */
describe('ReconciliationBalanceBar', () => {
  const onBankBalanceChange = vi.fn();

  const renderBar = (bankBalance: number | null) =>
    renderWithProviders(
      <ReconciliationBalanceBar
        bankBalance={bankBalance}
        accountBalance={250}
        clearedBalance={200}
        onBankBalanceChange={onBankBalanceChange}
      />
    );

  const openEditor = (): void => {
    fireEvent.click(screen.getByTitle('Click to change or remove'));
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the difference against a recorded bank balance', () => {
    renderBar(220);
    expect(screen.getByText('Difference')).toBeInTheDocument();
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();
  });

  it('shows N/A and an invitation to type one when there is no bank balance', () => {
    renderBar(null);
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getByText('Enter balance')).toBeInTheDocument();
  });

  it('reports a removal as null, not as a number', () => {
    renderBar(220);
    openEditor();
    fireEvent.click(screen.getByRole('button', { name: /Remove the bank balance/ }));

    expect(onBankBalanceChange).toHaveBeenCalledTimes(1);
    expect(onBankBalanceChange).toHaveBeenCalledWith(null);
  });

  it('names the consequence of removing rather than counting anything', () => {
    renderBar(220);
    openEditor();
    expect(
      screen.getByRole('button', {
        name: 'Remove the bank balance. Difference goes back to N/A until you enter another.'
      })
    ).toBeInTheDocument();
  });

  it('falls straight back to N/A on removal, before the write has landed', () => {
    // The prop still says 220 — the parent has not saved yet. The bar must
    // already show the state the user asked for, or the click looks ignored.
    renderBar(220);
    openEditor();
    fireEvent.click(screen.getByRole('button', { name: /Remove the bank balance/ }));

    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getByText('Enter balance')).toBeInTheDocument();
  });

  it('offers no removal until there is something to remove', () => {
    renderBar(null);
    fireEvent.click(screen.getByText('Enter balance'));
    expect(screen.queryByRole('button', { name: /Remove the bank balance/ })).not.toBeInTheDocument();
  });

  it('keeps the editor open while focus moves onto Remove', () => {
    renderBar(220);
    openEditor();
    const input = screen.getByLabelText('Bank balance');
    const remove = screen.getByRole('button', { name: /Remove the bank balance/ });

    fireEvent.blur(input, { relatedTarget: remove });

    expect(screen.getByRole('button', { name: /Remove the bank balance/ })).toBeInTheDocument();
    expect(onBankBalanceChange).not.toHaveBeenCalled();
  });

  it('leaves the recorded figure alone when the field is emptied and abandoned', () => {
    // Emptying the box is not removing: that is what Remove is for.
    renderBar(220);
    openEditor();
    const input = screen.getByLabelText('Bank balance');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(onBankBalanceChange).not.toHaveBeenCalled();
    expect(screen.getByTitle('Click to change or remove')).toBeInTheDocument();
  });

  it('still writes an ordinary edit as a number', () => {
    renderBar(220);
    openEditor();
    const input = screen.getByLabelText('Bank balance');
    fireEvent.change(input, { target: { value: '180.55' } });
    fireEvent.blur(input);

    expect(onBankBalanceChange).toHaveBeenCalledWith(180.55);
  });

  it('accepts a negative balance for an overdrawn account', () => {
    renderBar(null);
    fireEvent.click(screen.getByText('Enter balance'));
    const input = screen.getByLabelText('Bank balance');
    fireEvent.change(input, { target: { value: '-42.10' } });
    fireEvent.blur(input);

    expect(onBankBalanceChange).toHaveBeenCalledWith(-42.1);
  });
});
