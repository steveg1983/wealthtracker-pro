import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import ReconciliationFinalizationModal from '../ReconciliationFinalizationModal';
import { deriveAdjustment } from '../../../utils/reconciliation';

describe('deriveAdjustment', () => {
  it('bank above cleared → income with a positive signed amount', () => {
    expect(deriveAdjustment(12.04, 12.04)).toEqual({ type: 'income', signedAmount: 12.04 });
  });

  it('bank below cleared → expense with a negative signed amount', () => {
    expect(deriveAdjustment(-12.04, 12.04)).toEqual({ type: 'expense', signedAmount: -12.04 });
  });

  it('normalises a user-entered negative amount to the difference direction', () => {
    // The direction comes from the difference, never from the entered sign.
    expect(deriveAdjustment(50, -20)).toEqual({ type: 'income', signedAmount: 20 });
    expect(deriveAdjustment(-50, -20)).toEqual({ type: 'expense', signedAmount: -20 });
  });

  it('passes through a null amount while still reporting the direction', () => {
    expect(deriveAdjustment(-5, null)).toEqual({ type: 'expense', signedAmount: null });
  });
});

describe('ReconciliationFinalizationModal', () => {
  const onClose = vi.fn();
  const onFinalize = vi.fn();
  const onCreateAdjustment = vi.fn();

  const renderModal = (props: { bankBalance: number | null; clearedBalance: number }) =>
    renderWithProviders(
      <ReconciliationFinalizationModal
        isOpen={true}
        bankBalance={props.bankBalance}
        clearedBalance={props.clearedBalance}
        onClose={onClose}
        onFinalize={onFinalize}
        onCreateAdjustment={onCreateAdjustment}
      />
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the balanced state and finalizes when difference is zero', () => {
    renderModal({ bankBalance: 100, clearedBalance: 100 });
    expect(screen.getByText('Account Balanced!')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Complete Reconciliation'));
    expect(onFinalize).toHaveBeenCalledTimes(1);
  });

  it('treats a sub-penny difference as balanced', () => {
    renderModal({ bankBalance: 100.001, clearedBalance: 100 });
    expect(screen.getByText('Account Balanced!')).toBeInTheDocument();
  });

  it('offers finalize-anyway when no bank balance is set', () => {
    renderModal({ bankBalance: null, clearedBalance: 100 });
    expect(screen.getByText('No Bank Balance Set')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Finalize Anyway'));
    expect(onFinalize).toHaveBeenCalledTimes(1);
  });

  it('pre-fills the adjustment amount with the remaining difference', () => {
    renderModal({ bankBalance: 87.96, clearedBalance: 100 });
    // difference = -12.04 → expense of 12.04
    const amountInput = screen.getByLabelText(/Amount/) as HTMLInputElement;
    expect(amountInput.value).toBe('12.04');
    expect(screen.getByText(/Amount \(Expense\)/)).toBeInTheDocument();
  });

  it('labels the adjustment as income when the bank balance is higher', () => {
    renderModal({ bankBalance: 150, clearedBalance: 100 });
    expect(screen.getByText(/Amount \(Income\)/)).toBeInTheDocument();
  });

  it('disables Create Adjustment until a category is chosen', () => {
    renderModal({ bankBalance: 87.96, clearedBalance: 100 });
    expect(screen.getByText('Create Adjustment')).toBeDisabled();
    expect(onCreateAdjustment).not.toHaveBeenCalled();
  });

  it('rejects a zero adjustment amount', () => {
    renderModal({ bankBalance: 87.96, clearedBalance: 100 });
    const amountInput = screen.getByLabelText(/Amount/);
    fireEvent.change(amountInput, { target: { value: '0' } });
    expect(screen.getByText('Enter an amount greater than zero.')).toBeInTheDocument();
    expect(screen.getByText('Create Adjustment')).toBeDisabled();
  });
});
