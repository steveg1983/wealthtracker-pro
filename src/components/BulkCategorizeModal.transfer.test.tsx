/**
 * BulkCategorizeModal — a payee that is a transfer.
 *
 * Owner, 31 Aug 2026: the "AMERICAN EXPRESS" rows in his partner's current
 * account are card payments, not spending, and the only route to saying so was
 * opening twenty-four transactions one at a time.
 *
 * What is pinned here is everything that could invent money: the ⇄ swaps the
 * question rather than filing a category, a row with nothing on the other side
 * is created without a question, a row that HAS something plausible over there
 * is never decided silently, and every way out of that queue — link, create
 * anyway, leave it, stop — is accounted for in the summary.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BulkCategorizeModal from './BulkCategorizeModal';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import type { Account, Category, Transaction } from '../types';

const CURRENT = 'acc-current';
const CARD = 'acc-card';
const EUROS = 'acc-euros';

const NAMES: Record<string, string> = {
  [CURRENT]: 'Current Account',
  [CARD]: 'Amex Card',
  [EUROS]: 'Holiday Euros',
};

const ACCOUNTS: Account[] = [
  { id: CURRENT, name: NAMES[CURRENT], type: 'current', balance: 0, currency: 'GBP', lastUpdated: new Date('2026-05-01') },
  { id: CARD, name: NAMES[CARD], type: 'credit', balance: 0, currency: 'GBP', lastUpdated: new Date('2026-05-01') },
  { id: EUROS, name: NAMES[EUROS], type: 'savings', balance: 0, currency: 'EUR', lastUpdated: new Date('2026-05-01') },
];

const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Food', type: 'expense', level: 'detail' },
];

const linkTransferPair = vi.fn();
const createTransferCounterpart = vi.fn();

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    dismissToast: vi.fn(),
  }),
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `£${Math.abs(Number(amount)).toFixed(2)}`,
    displayCurrency: 'GBP',
    getCurrencySymbol: () => '£',
    convert: vi.fn(),
    convertAndFormat: vi.fn(),
    convertAndSum: vi.fn(),
  }),
}));

vi.mock('../hooks/useAccountNames', () => ({
  useAccountNames: () => (id: string) => NAMES[id] ?? id,
}));

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-05-10'),
  amount: -250,
  description: 'AMERICAN EXPRESS',
  category: '',
  accountId: CURRENT,
  type: 'expense',
  ...over,
});

/** Two card payments a month apart, and nothing yet on the card. */
const PAYMENTS: Transaction[] = [
  txn({ id: 'pay-may', date: new Date('2026-05-10') }),
  txn({ id: 'pay-jun', date: new Date('2026-06-10') }),
];

/** The May payment as the card itself recorded it, worded its own way. */
const ON_THE_CARD: Transaction = txn({
  id: 'card-may',
  accountId: CARD,
  amount: 250,
  date: new Date('2026-05-11'),
  description: 'PAYMENT RECEIVED - THANK YOU',
});

const renderModal = (): void => {
  render(
    <MemoryRouter>
      <BulkCategorizeModal isOpen onClose={vi.fn()} />
    </MemoryRouter>
  );
};

/** Press the ⇄ beside a payee: the question becomes "where did it go?". */
const pressTransferToggle = (payee = 'AMERICAN EXPRESS'): void => {
  fireEvent.click(screen.getByRole('button', { name: `Transfer for ${payee}` }));
};

/** Name the account the money moved to, in the picker the ⇄ put there. */
const chooseAccount = (name: string): void => {
  fireEvent.click(screen.getByText('Transfer to…'));
  const listbox = screen.getByRole('listbox');
  fireEvent.click(within(listbox).getByText(name));
};

const apply = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /^Apply to/ }));
};

/**
 * The step on top, whichever it is.
 *
 * Found through a button rather than by name: every Modal in the app labels
 * itself with the same fixed id, so with two open the accessible name of the
 * inner one resolves to the outer one's title.
 */
const dialogAround = (buttonName: string | RegExp): HTMLElement => {
  const dialog = screen.getByRole('button', { name: buttonName }).closest('[role="dialog"]');
  if (!(dialog instanceof HTMLElement)) throw new Error('that step is not on screen');
  return dialog;
};

/**
 * The summary, as one string.
 *
 * Read off the whole list because each line is deliberately part figure and
 * part sentence ("<strong>2</strong> other sides created"), and a text matcher
 * only ever sees one text node of it at a time.
 */
const summaryText = async (): Promise<string> => {
  await screen.findByText('That is the lot');
  return within(dialogAround('Done')).getByRole('list').textContent ?? '';
};

beforeEach(() => {
  linkTransferPair.mockReset().mockResolvedValue({ a: {}, b: {} });
  createTransferCounterpart.mockReset().mockResolvedValue({ source: {}, counterpart: {} });
  __setAppContextValue({
    accounts: ACCOUNTS,
    categories: CATEGORIES,
    transactions: PAYMENTS,
    linkTransferPair,
    createTransferCounterpart,
  });
});

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

describe('Categorise by payee — the ⇄ toggle', () => {
  it('swaps the category picker for an account picker, and back again', () => {
    renderModal();
    expect(screen.getByText('Choose a category…')).toBeInTheDocument();

    pressTransferToggle();

    expect(screen.queryByText('Choose a category…')).not.toBeInTheDocument();
    expect(screen.getByText('Transfer to…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Transfer for AMERICAN EXPRESS' }))
      .toHaveAttribute('aria-pressed', 'true');

    pressTransferToggle();

    expect(screen.getByText('Choose a category…')).toBeInTheDocument();
    expect(screen.queryByText('Transfer to…')).not.toBeInTheDocument();
  });

  it('never offers an account the payee’s own rows already sit in', () => {
    renderModal();
    pressTransferToggle();
    fireEvent.click(screen.getByText('Transfer to…'));

    const options = within(screen.getByRole('listbox')).getAllByRole('option').map(o => o.textContent);
    expect(options).toContain('Amex Card');
    expect(options).not.toContain('Current Account');
  });

  it('counts a named account as ready, exactly as a category is', () => {
    renderModal();
    pressTransferToggle();
    expect(screen.getByText(/0 payees ready/)).toBeInTheDocument();

    chooseAccount('Amex Card');

    expect(screen.getByText(/1 payee ready — 2 transactions, 2 of them as transfers/))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply to 2 transactions' })).toBeInTheDocument();
  });

  it('refuses a currency boundary on the row, before anything is pressed', () => {
    renderModal();
    pressTransferToggle();
    fireEvent.click(screen.getByText('Transfer to…'));
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Holiday Euros'));

    expect(screen.getByText(/counts in another currency/)).toBeInTheDocument();
    expect(screen.getByText(/0 payees ready/)).toBeInTheDocument();
  });
});

describe('Categorise by payee — applying transfers', () => {
  it('creates the other side outright when the account holds nothing like it', async () => {
    renderModal();
    pressTransferToggle();
    chooseAccount('Amex Card');
    apply();

    expect(await summaryText()).toContain('2 other sides created');
    expect(createTransferCounterpart.mock.calls).toEqual([
      ['pay-may', CARD],
      ['pay-jun', CARD],
    ]);
    expect(linkTransferPair).not.toHaveBeenCalled();
  });

  it('asks about the row already over there, and links it when told to', async () => {
    __setAppContextValue({ transactions: [...PAYMENTS, ON_THE_CARD] });
    renderModal();
    pressTransferToggle();
    chooseAccount('Amex Card');
    apply();

    // The June payment had nothing matching it, so it was made without asking.
    expect(await screen.findByRole('button', { name: 'Link these' })).toBeInTheDocument();
    expect(createTransferCounterpart.mock.calls).toEqual([['pay-jun', CARD]]);
    const question = dialogAround('Link these');
    expect(within(question).getByText('Is this already in Amex Card?')).toBeInTheDocument();
    expect(within(question).getByText('PAYMENT RECEIVED - THANK YOU')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Link these' }));

    const summary = await summaryText();
    expect(summary).toContain('1 other side created');
    expect(summary).toContain('1 joined to a row that was already there');
    expect(linkTransferPair.mock.calls).toEqual([['pay-may', 'card-may']]);
    expect(createTransferCounterpart).toHaveBeenCalledTimes(1);
  });

  it('writes a second row when told to create the other side regardless', async () => {
    __setAppContextValue({ transactions: [...PAYMENTS, ON_THE_CARD] });
    renderModal();
    pressTransferToggle();
    chooseAccount('Amex Card');
    apply();

    fireEvent.click(await screen.findByRole('button', { name: 'Create the other side anyway' }));

    expect(await summaryText()).toContain('2 other sides created');
    expect(linkTransferPair).not.toHaveBeenCalled();
    expect(createTransferCounterpart.mock.calls).toEqual([
      ['pay-jun', CARD],
      ['pay-may', CARD],
    ]);
  });

  it('leaves a row exactly as it was, and says so in the summary', async () => {
    __setAppContextValue({ transactions: [...PAYMENTS, ON_THE_CARD] });
    renderModal();
    pressTransferToggle();
    chooseAccount('Amex Card');
    apply();

    fireEvent.click(await screen.findByRole('button', { name: 'Leave this one' }));

    expect(await summaryText()).toContain('1 left exactly as it was');
    expect(linkTransferPair).not.toHaveBeenCalled();
    expect(createTransferCounterpart).toHaveBeenCalledTimes(1);
  });

  it('keeps what is already done when the user stops asking', async () => {
    __setAppContextValue({ transactions: [...PAYMENTS, ON_THE_CARD] });
    renderModal();
    pressTransferToggle();
    chooseAccount('Amex Card');
    apply();

    fireEvent.click(await screen.findByRole('button', { name: /^Stop asking/ }));

    // The outright creation stands; the question that was open is left alone.
    const summary = await summaryText();
    expect(summary).toContain('1 other side created');
    expect(summary).toContain('1 left exactly as it was');
  });

  it('reports a write that failed instead of counting it as done', async () => {
    createTransferCounterpart.mockRejectedValue(new Error('the target account refused'));
    renderModal();
    pressTransferToggle();
    chooseAccount('Amex Card');
    apply();

    const summary = await summaryText();
    expect(summary).toContain('2 could not be applied');
    expect(summary).not.toContain('other sides created');
  });
});
