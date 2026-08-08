/**
 * Payee cleanup — refusals that stick.
 *
 * The owner's complaint, in his words: "if you go through and you do not want
 * them the same for whatever good reason, they will continue to pop up in the
 * suggestions so we need to be able to completely disregard a line or multiple
 * lines." These pin both granularities — a whole suggested merchant and a
 * single payee inside one — plus the two things that keep it from being a
 * one-way door: No writes nothing, and every Yes can be undone from the list at
 * the foot of the page.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import PayeeCleanup from './PayeeCleanup';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import {
  payeeLineDismissalKey,
  payeeMerchantDismissalKey,
} from '../../utils/suggestionDismissals';
import type { SuggestionDismissal, Transaction } from '../../types';

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    dismissToast: vi.fn(),
  }),
}));

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `£${Math.abs(amount).toFixed(2)}`,
    displayCurrency: 'GBP',
    getCurrencySymbol: () => '£',
    convert: vi.fn(),
    convertAndFormat: vi.fn(),
    convertAndSum: vi.fn(),
  }),
}));

const txn = (over: Partial<Transaction> & { id: string; description: string }): Transaction => ({
  date: new Date('2026-03-01'),
  amount: -10,
  category: 'cat-1',
  accountId: 'acc-1',
  type: 'expense',
  ...over,
});

/** Three references for one shop, and a payee that needs no tidying at all. */
const REFERENCE = 'AMAZON.CO.UK*EI8DN58J5 AMAZON.CO.UK';
const REGISTER: Transaction[] = [
  txn({ id: 't1', description: 'AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK' }),
  txn({ id: 't2', description: 'AMZNMKTPLACE*3W9NN1HR5 AMAZON.CO.UK' }),
  txn({ id: 't3', description: REFERENCE }),
  txn({ id: 't4', description: 'BOOTS' }),
];

const MERCHANT_KEY = payeeMerchantDismissalKey('AMAZON.CO.UK');
const LINE_KEY = payeeLineDismissalKey('AMAZON.CO.UK', REFERENCE);

const dismissal = (
  kind: SuggestionDismissal['kind'], subjectKey: string
): SuggestionDismissal => ({
  id: `d-${subjectKey}`, kind, subjectKey, subjectIds: [], dismissedAt: new Date('2026-06-01'),
});

const chip = (): HTMLElement => screen.getByRole('button', { name: /^AMAZON\.CO\.UK/ });
const noChip = (): HTMLElement | null => screen.queryByRole('button', { name: /^AMAZON\.CO\.UK/ });

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

describe('Payee cleanup — refusing a whole suggested merchant', () => {
  it('offers the refusal only once the payees behind the guess are on screen', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    // Nothing to refuse until a suggestion is picked: the decision needs the
    // payees in front of you.
    expect(screen.queryByRole('button', { name: 'Not the same merchant' })).not.toBeInTheDocument();

    fireEvent.click(chip());
    expect(screen.getByRole('button', { name: 'Not the same merchant' })).toBeInTheDocument();
  });

  it('answering No changes nothing that is written down', async () => {
    const dismissSuggestion = vi.fn(async () => {});
    __setAppContextValue({ transactions: REGISTER, dismissSuggestion });
    render(<PayeeCleanup />);

    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('button', { name: 'Not the same merchant' }));
    fireEvent.click(screen.getByRole('button', { name: 'No — just this once' }));

    // Gone for this sitting — the answer either way — and nothing saved.
    await waitFor(() => expect(noChip()).not.toBeInTheDocument());
    expect(dismissSuggestion).not.toHaveBeenCalled();
  });

  it('answering Yes records it against the merchant, with no rows attached', async () => {
    const dismissSuggestion = vi.fn(async () => {});
    __setAppContextValue({ transactions: REGISTER, dismissSuggestion });
    render(<PayeeCleanup />);

    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('button', { name: 'Not the same merchant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes — never offer it again' }));

    await waitFor(() => expect(dismissSuggestion).toHaveBeenCalledTimes(1));
    // No subject ids: this refusal is about payee text, and has to outlive the
    // rows it was drawn from — a re-import brings the same wording back.
    expect(dismissSuggestion).toHaveBeenCalledWith('payee-merchant', MERCHANT_KEY, []);
  });

  it('never offers a merchant that was refused on a previous visit', () => {
    __setAppContextValue({
      transactions: REGISTER,
      suggestionDismissals: [dismissal('payee-merchant', MERCHANT_KEY)],
    });
    render(<PayeeCleanup />);

    expect(noChip()).not.toBeInTheDocument();
    // The payees themselves are untouched and still listed: a refusal hides a
    // suggestion, never a payee.
    expect(screen.getByText(REFERENCE)).toBeInTheDocument();
  });

  it('holds the suggestions back until the refusals have been read', () => {
    __setAppContextValue({
      transactions: REGISTER,
      suggestionDismissalsStatus: 'loading',
    });
    render(<PayeeCleanup />);

    expect(noChip()).not.toBeInTheDocument();
    expect(screen.getByText('Checking which of these you have already refused…')).toBeInTheDocument();
  });
});

describe('Payee cleanup — leaving one payee out of a suggestion', () => {
  const leaveOut = (): HTMLElement =>
    screen.getByRole('button', { name: `Leave out ${REFERENCE} from the AMAZON.CO.UK suggestion` });

  it('offers a payee-by-payee refusal for the picked suggestion only', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    expect(screen.queryAllByRole('button', { name: /^Leave out/ })).toHaveLength(0);

    fireEvent.click(chip());
    // One per payee in the suggestion — and none for BOOTS, which nobody has
    // proposed grouping with anything.
    expect(screen.getAllByRole('button', { name: /^Leave out/ })).toHaveLength(3);
    expect(
      screen.queryByRole('button', { name: /^Leave out BOOTS/ })
    ).not.toBeInTheDocument();
  });

  it('answering Yes records the payee and the merchant it was refused under', async () => {
    const dismissSuggestion = vi.fn(async () => {});
    __setAppContextValue({ transactions: REGISTER, dismissSuggestion });
    render(<PayeeCleanup />);

    fireEvent.click(chip());
    fireEvent.click(leaveOut());
    fireEvent.click(screen.getByRole('button', { name: 'Yes — never offer it again' }));

    await waitFor(() => expect(dismissSuggestion).toHaveBeenCalledTimes(1));
    expect(dismissSuggestion).toHaveBeenCalledWith('payee-line', LINE_KEY, []);
  });

  it('takes the refused payee out of the suggestion, counts and all', async () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    fireEvent.click(chip());
    expect(chip()).toHaveTextContent('3 payees · 3 transactions');

    fireEvent.click(leaveOut());
    fireEvent.click(screen.getByRole('button', { name: 'No — just this once' }));

    // The suggestion is still worth making, and what it says about itself is
    // true: two payees, two transactions.
    await waitFor(() => expect(chip()).toHaveTextContent('2 payees · 2 transactions'));
    expect(screen.getAllByRole('button', { name: /^Leave out/ })).toHaveLength(2);
    // The payee is still in the register, still on screen, and says where it
    // now stands rather than offering to leave out what is already left out.
    expect(screen.getByText(REFERENCE)).toBeInTheDocument();
    expect(screen.getByText('Left out')).toBeInTheDocument();
  });

  it('stops offering the suggestion once too few payees are left to merge', async () => {
    __setAppContextValue({
      transactions: REGISTER,
      suggestionDismissals: [
        dismissal('payee-line', LINE_KEY),
        dismissal('payee-line', payeeLineDismissalKey(
          'AMAZON.CO.UK', 'AMZNMKTPLACE*3W9NN1HR5 AMAZON.CO.UK'
        )),
      ],
    });
    render(<PayeeCleanup />);

    await waitFor(() => expect(noChip()).not.toBeInTheDocument());
    // One payee left is not a cleanup — but it is still a payee, still listed.
    expect(screen.getByText('AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK')).toBeInTheDocument();
  });
});

describe('Payee cleanup — undoing a refusal', () => {
  it('lists what was left out, describes it, and restores it on request', async () => {
    const restoreSuggestion = vi.fn(async () => {});
    __setAppContextValue({
      transactions: REGISTER,
      restoreSuggestion,
      suggestionDismissals: [
        dismissal('payee-merchant', MERCHANT_KEY),
        dismissal('payee-line', LINE_KEY),
      ],
    });
    render(<PayeeCleanup />);

    const section = screen.getByText('Dismissed suggestions').closest('section');
    expect(section).not.toBeNull();
    if (!section) throw new Error('no dismissed section');

    fireEvent.click(within(section).getByRole('button', { name: 'Show' }));
    expect(within(section).getByText('AMAZON.CO.UK')).toBeInTheDocument();
    expect(within(section).getByText('— and every payee under it')).toBeInTheDocument();
    expect(within(section).getByText('— kept out of AMAZON.CO.UK')).toBeInTheDocument();

    fireEvent.click(within(section).getAllByRole('button', { name: 'Restore' })[0]);
    await waitFor(() =>
      expect(restoreSuggestion).toHaveBeenCalledWith('payee-merchant', MERCHANT_KEY)
    );
  });

  it('says nothing at all when nothing has been left out', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    expect(screen.queryByText('Dismissed suggestions')).not.toBeInTheDocument();
  });
});
