import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AccountSettingsModal from './AccountSettingsModal';
import type { Account, AccountUpdate } from '../types';

/**
 * The CURRENCY field in Account Settings.
 *
 * The rule it enforces is not a UI preference: an account's currency says what
 * every stored figure in it MEANS, so changing it on an account with history
 * re-labels the whole register without touching a single number. It is
 * therefore shown always and editable only while the account is empty — the
 * rule Microsoft Money applies to the same field for the same reason.
 *
 * These render the real Modal and the real useModalForm; the only stand-in is
 * `onSave`, because what is under test is precisely WHAT reaches it.
 */

const account: Account = {
  id: 'acc-1',
  name: 'Everyday',
  type: 'current',
  balance: 1000,
  currency: 'GBP',
  lastUpdated: new Date('2026-01-01'),
};

function renderModal(props: Partial<React.ComponentProps<typeof AccountSettingsModal>> = {}) {
  const onSave = vi.fn<(id: string, updates: AccountUpdate) => Promise<void>>(
    () => Promise.resolve()
  );
  render(
    <AccountSettingsModal
      isOpen
      onClose={vi.fn()}
      account={account}
      onSave={onSave}
      {...props}
    />
  );
  return { onSave };
}

/** The Currency control when it is editable — a real select, by its label. */
const currencySelect = (): HTMLSelectElement | null =>
  screen.queryByLabelText<HTMLSelectElement>('Currency', { selector: 'select' });

describe('AccountSettingsModal — currency', () => {
  it('always shows the account currency, whatever the history', () => {
    renderModal({ hasTransactions: true });
    expect(screen.getByText('Currency')).toBeInTheDocument();
    // Named in full, and always with the code: the code is what the account
    // stores and what every export will show.
    expect(screen.getByText('£ British Pound (GBP)')).toBeInTheDocument();
  });

  it('offers the currency for editing while the account holds nothing', () => {
    renderModal({ hasTransactions: false });

    const select = currencySelect();
    expect(select).not.toBeNull();
    expect(select).toHaveValue('GBP');
    // The same three the creation form offers — one shared list, not two.
    expect(
      Array.from(select?.options ?? []).map(option => option.value)
    ).toEqual(['GBP', 'USD', 'EUR']);
  });

  it('locks the currency once the account has transactions, and says what changing it would do', () => {
    renderModal({ hasTransactions: true });

    expect(currencySelect()).toBeNull();
    // The consequence, not the count.
    expect(
      screen.getByText(/changing it now would leave every recorded figure at the same number while quietly re-labelling what that number is worth/i)
    ).toBeInTheDocument();
  });

  it('locks the currency when the caller could not establish whether there is history', () => {
    // The prop is omitted. "Cannot tell" must behave like "has history": a
    // read-only field on an empty account is a nuisance, an editable one on a
    // full account is a re-denomination.
    renderModal();
    expect(currencySelect()).toBeNull();
  });

  it('persists a changed currency through the ordinary save', async () => {
    const { onSave } = renderModal({ hasTransactions: false });

    const select = currencySelect();
    expect(select).not.toBeNull();
    fireEvent.change(select as HTMLSelectElement, { target: { value: 'USD' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toBe('acc-1');
    expect(onSave.mock.calls[0][1].currency).toBe('USD');
  });

  it('sends no currency at all when the field was locked', async () => {
    const { onSave } = renderModal({ hasTransactions: true });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    // Not "sends the unchanged value": an account that gains its first
    // transaction while this modal is open must not be re-denominated by a
    // save that was only ever meant to rename it.
    expect('currency' in onSave.mock.calls[0][1]).toBe(false);
  });

  it('keeps an unsupported stored currency in the list rather than silently swapping it', () => {
    // A restored backup or an MS Money import can hold anything. A select whose
    // value is absent from its own options displays the first option instead,
    // and saving that would re-denominate the account to GBP.
    renderModal({
      hasTransactions: false,
      account: { ...account, currency: 'JPY' },
    });

    const select = currencySelect();
    expect(select).toHaveValue('JPY');
    expect(
      Array.from(select?.options ?? []).map(option => option.value)
    ).toContain('JPY');
  });
});
