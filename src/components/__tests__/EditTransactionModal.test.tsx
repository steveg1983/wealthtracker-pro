/**
 * EditTransactionModal Tests
 * Component rendering and user interactions
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import EditTransactionModal from '../EditTransactionModal';
import type { Account, Transaction } from '../../types';

describe('EditTransactionModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    transaction: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    renderWithProviders(<EditTransactionModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('validates form inputs', async () => {
    // Add validation tests
  });

  it('handles error states', () => {
    // Add error handling tests
  });

});

/**
 * THE AMOUNT'S COLOUR FOLLOWS WHERE THE MONEY GOES (owner, 17 Aug).
 *
 * The field holds MAGNITUDES for income/expense — the seed is Math.abs and the
 * Type toggle carries the direction — but the colour was derived from the
 * field's own sign, which after seeding is always positive. So every expense
 * opened wearing income green, for months, on a form whose Type toggle said
 * "Expense" in red two lines up. Every figure below is invented; the repo is
 * public.
 */
describe('EditTransactionModal — the amount wears the flow, not the field sign', () => {
  const ACCOUNT: Account = {
    id: 'acc-modal', name: 'Synthetic Current', type: 'current', balance: 0,
    currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
  };

  const EXPENSE: Transaction = {
    id: 'txn-modal-0', date: new Date(Date.UTC(2026, 0, 5)),
    description: 'Synthetic valuation move', amount: -650, type: 'expense',
    category: '', accountId: ACCOUNT.id, cleared: false,
  };

  const amountInput = (): HTMLInputElement => {
    const el = screen.getByPlaceholderText('0.00');
    if (!(el instanceof HTMLInputElement)) throw new Error('the amount is not an input');
    return el;
  };

  it('an expense opens red and unsigned — the type carries the sign, the colour agrees with it', () => {
    renderWithProviders(
      <EditTransactionModal isOpen onClose={vi.fn()} transaction={EXPENSE} />,
      { initialState: { accounts: [ACCOUNT], transactions: [EXPENSE] } }
    );

    // Magnitude in the field, exactly as Quick Add takes it…
    expect(amountInput().value).not.toContain('-');
    // …and the colour states the flow the Type toggle states: money OUT.
    expect(amountInput().className).toContain('text-red-600');
    expect(amountInput().className).not.toContain('text-green-600');
  });

  it('switching the type to Income flips the same figure to green', () => {
    renderWithProviders(
      <EditTransactionModal isOpen onClose={vi.fn()} transaction={EXPENSE} />,
      { initialState: { accounts: [ACCOUNT], transactions: [EXPENSE] } }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Income' }));

    expect(amountInput().className).toContain('text-green-600');
  });

  it('a typed minus is a reducing line, and flips the flow back', () => {
    renderWithProviders(
      <EditTransactionModal isOpen onClose={vi.fn()} transaction={EXPENSE} />,
      { initialState: { accounts: [ACCOUNT], transactions: [EXPENSE] } }
    );

    // Minus on an EXPENSE means money coming back (cashback, a refund line):
    // the flow is inward, so the colour is the income green.
    fireEvent.change(amountInput(), { target: { value: '-100' } });

    expect(amountInput().className).toContain('text-green-600');
  });
});

/**
 * EVERY GUEST CONTROL DECLARES WHAT IT IS (owner, 21 Aug).
 *
 * An untyped <button> inside a <form> is type="submit". The Notes editor's
 * toolbar and the attachments block are shared components that guest inside
 * this form, and their untyped buttons made NINE extra submitters — so tapping
 * Bold, or Attach, SAVED THE TRANSACTION AND CLOSED THE EDITOR. On a phone it
 * presented as "the page freezes and then kicks me back to the register":
 * the freeze was the save's await, the kick was the modal closing.
 *
 * The guard reads the rendered DOM rather than the source, so a NEW guest
 * component with the same flaw fails it too. Submitting is reserved for the
 * buttons that say Save.
 */
describe('EditTransactionModal — only the Save buttons may submit', () => {
  const ACCOUNT: Account = {
    id: 'acc-guard', name: 'Synthetic Current', type: 'current', balance: 0,
    currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
  };
  const ROW: Transaction = {
    id: 'txn-guard-0', date: new Date(Date.UTC(2026, 0, 5)),
    description: 'Synthetic row', amount: -12, type: 'expense',
    category: '', accountId: ACCOUNT.id, cleared: false,
  };

  it('every submit-typed button in the form is a Save action', () => {
    renderWithProviders(
      <EditTransactionModal isOpen onClose={vi.fn()} transaction={ROW} />,
      { initialState: { accounts: [ACCOUNT], transactions: [ROW] } }
    );

    const form = screen.getByRole('dialog').querySelector('form');
    if (!form) throw new Error('the editor did not render its form');

    const strays = Array.from(form.querySelectorAll('button'))
      .filter((b): b is HTMLButtonElement => b instanceof HTMLButtonElement)
      .filter(b => b.type === 'submit')
      .filter(b => !/save/i.test(`${b.textContent ?? ''} ${b.title}`));

    expect(
      strays.map(b => b.title || b.getAttribute('aria-label') || b.textContent?.trim() || '(unnamed)')
    ).toEqual([]);
  });

  it('tapping a Notes toolbar control edits the note — it does not close the editor', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <EditTransactionModal isOpen onClose={onClose} transaction={ROW} />,
      { initialState: { accounts: [ACCOUNT], transactions: [ROW] } }
    );

    fireEvent.click(screen.getByTitle('Bold'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
