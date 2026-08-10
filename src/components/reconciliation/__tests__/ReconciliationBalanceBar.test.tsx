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
  const onConfirmBalance = vi.fn();
  const onBalanceEdited = vi.fn();

  const renderBar = (
    bankBalance: number | null,
    extra: Partial<React.ComponentProps<typeof ReconciliationBalanceBar>> = {}
  ) =>
    renderWithProviders(
      <ReconciliationBalanceBar
        bankBalance={bankBalance}
        accountBalance={250}
        clearedBalance={200}
        onBankBalanceChange={onBankBalanceChange}
        onConfirmBalance={onConfirmBalance}
        onBalanceEdited={onBalanceEdited}
        {...extra}
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

  describe('confirming the figure', () => {
    it('offers Confirm against a figure, and says what is at stake until then', () => {
      renderBar(220);
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
      expect(
        screen.getByText(/Confirm the bank balance to finish\. Until you do, your marks stay a working list/)
      ).toBeInTheDocument();
    });

    it('offers Confirm against £0.00, which is a balance like any other', () => {
      renderBar(0);
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
      expect(onConfirmBalance).toHaveBeenCalledWith(0);
    });

    it('says so once confirmed, and stops asking', () => {
      renderBar(220, { balanceConfirmed: true });
      expect(screen.getByText('Confirmed')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
      expect(screen.queryByText(/Confirm the bank balance to finish/)).not.toBeInTheDocument();
    });

    it('reports an edit so the confirmation can lapse', () => {
      renderBar(220, { balanceConfirmed: true });
      openEditor();
      fireEvent.change(screen.getByLabelText('Bank balance'), { target: { value: '221' } });
      expect(onBalanceEdited).toHaveBeenCalled();
    });

    it('Enter records the typed figure AND confirms it', () => {
      renderBar(220);
      openEditor();
      const input = screen.getByLabelText('Bank balance');
      fireEvent.change(input, { target: { value: '199.99' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onBankBalanceChange).toHaveBeenCalledWith(199.99);
      expect(onConfirmBalance).toHaveBeenCalledWith(199.99);
    });

    it('shows last time’s two facts when both are known', () => {
      renderBar(220, {
        lastReconciledDate: new Date('2026-04-30'),
        lastReconciledBalance: 180.4,
      });
      expect(screen.getByText(/Last reconciled: 30\/04\/2026 · ending balance £180\.40/)).toBeInTheDocument();
    });

    it('says nothing about last time when only the date is known', () => {
      // A date with no figure is a claim nobody can check.
      renderBar(220, { lastReconciledDate: new Date('2026-04-30') });
      expect(screen.queryByText(/Last reconciled/)).not.toBeInTheDocument();
    });

    it('names the right consequence for Remove when a last balance would take over', () => {
      renderBar(220, { lastReconciledBalance: 180.4 });
      openEditor();
      expect(
        screen.getByRole('button', {
          name: /Difference falls back to the balance your last reconciliation ended on/
        })
      ).toBeInTheDocument();
    });
  });
});
