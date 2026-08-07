import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AddAccountModal from './AddAccountModal';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import { __resetAppContextValue, __setAppContextValue } from '../test/mocks/AppContextSupabase';
import type { Account } from '../types';

type NewAccountPayload = Omit<Account, 'id'> & { initialBalance?: number };

// Optional parameter on purpose: the context's own mock types addAccount as a
// no-arg callback, and a required parameter would not fit it.
const addAccount = vi.fn((account?: NewAccountPayload) =>
  Promise.resolve({ ...account, id: 'new-account' })
);

const lastPayload = (): NewAccountPayload | undefined => addAccount.mock.calls[0]?.[0];

const renderModal = () =>
  render(
    <PreferencesProvider>
      <AddAccountModal isOpen onClose={vi.fn()} />
    </PreferencesProvider>
  );

/** Fill in the name and balance the form requires, then choose Credit Card. */
const startACard = () => {
  fireEvent.change(screen.getByPlaceholderText('e.g., Main Checking Account'), {
    target: { value: 'Amex' }
  });
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '-250' } });
  fireEvent.click(screen.getByText('Credit Card'));
};

describe('AddAccountModal — a card is created holding its last 4 digits only', () => {
  beforeEach(() => {
    addAccount.mockClear();
    __setAppContextValue({ addAccount });
  });

  afterEach(() => {
    __resetAppContextValue();
  });

  it('stores the LAST four of a pasted card number, not the first', async () => {
    renderModal();
    startACard();

    fireEvent.change(screen.getByLabelText('Last four digits of the card number'), {
      target: { value: '4929 1234 5678 9012' }
    });
    fireEvent.click(screen.getByText('Add Account'));

    await waitFor(() => expect(addAccount).toHaveBeenCalledTimes(1));
    expect(lastPayload()?.accountNumber).toBe('9012');
  });

  it('keeps the whole number in the field so the right four can be taken', () => {
    renderModal();
    startACard();

    const field = screen.getByLabelText('Last four digits of the card number');
    fireEvent.change(field, { target: { value: '4929123456789012' } });

    // Capping the input would have left '4929' — the wrong four.
    expect(field).toHaveValue('4929123456789012');
  });

  it('tells the user what will be stored rather than offering them a choice', () => {
    renderModal();
    startACard();

    fireEvent.change(screen.getByLabelText('Last four digits of the card number'), {
      target: { value: '4929123456789012' }
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      'Saving will store 9012 and discard the rest.'
    );
  });

  it('leaves a bank account number whole', async () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('e.g., Main Checking Account'), {
      target: { value: 'HSBC Current' }
    });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Bank account number'), {
      target: { value: '12345678' }
    });
    fireEvent.click(screen.getByText('Add Account'));

    await waitFor(() => expect(addAccount).toHaveBeenCalledTimes(1));
    expect(lastPayload()?.accountNumber).toBe('12345678');
  });

  it('stores nothing at all when the card number is left blank', async () => {
    renderModal();
    startACard();

    fireEvent.click(screen.getByText('Add Account'));

    await waitFor(() => expect(addAccount).toHaveBeenCalledTimes(1));
    expect(lastPayload()?.accountNumber).toBeUndefined();
  });
});
