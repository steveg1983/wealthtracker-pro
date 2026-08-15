/**
 * Payee cleanup — taking payees off the page, the owner's own design.
 *
 * His words: "I wanted the ability to highlight lines and press 'Rename
 * Selected' OR highlight lines, and basically press a button to 'discard from
 * list' and those ones I selected get a 'flag' never to be picked up by this
 * page again. I only seem to have 'Not the same merchant' and I think that
 * assumes ALL in the list are not the same merchant, whereas I am saying: some
 * could be, some could not, all could be, or none could be."
 *
 * So this is the third and widest of the screen's refusals, and what these
 * tests hold it to is the difference between it and the other two: it does not
 * hide a SUGGESTION, it takes the payees off the page — out of the list, out of
 * every suggestion, and out of every count on the screen — until the user says
 * otherwise. Everything else about it is the house rule the other two already
 * follow: No writes nothing, Yes is undoable from the foot of the page, and a
 * save that fails says so where the user is standing rather than pretending.
 *
 * Every payee, date and figure below is invented: this repo is public.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import PayeeCleanup from './PayeeCleanup';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { payeeHiddenDismissalKey } from '../../utils/suggestionDismissals';
import type { SuggestionDismissal, Transaction } from '../../types';

const toast = vi.hoisted(() => ({
  showToast: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
  showInfo: vi.fn(),
  dismissToast: vi.fn(),
}));

vi.mock('../../contexts/ToastContext', () => ({ useToast: () => toast }));

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) =>
      Number(amount) < 0
        ? `(£${Math.abs(Number(amount)).toFixed(2)})`
        : `£${Number(amount).toFixed(2)}`,
    displayCurrency: 'GBP',
    getCurrencySymbol: () => '£',
    convert: vi.fn(), convertAndFormat: vi.fn(), convertAndSum: vi.fn(),
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

/** Three references for one shop, and two payees that need no tidying at all. */
const FIRST = 'AMZNMKTPLACE*1X6DN8XF5 AMAZON.CO.UK';
const SECOND = 'AMZNMKTPLACE*3W9NN1HR5 AMAZON.CO.UK';
const THIRD = 'AMAZON.CO.UK*EI8DN58J5 AMAZON.CO.UK';
const REGISTER: Transaction[] = [
  txn({ id: 't1', description: FIRST }),
  txn({ id: 't2', description: SECOND }),
  txn({ id: 't3', description: THIRD }),
  txn({ id: 't4', description: 'BOOTS' }),
  txn({ id: 't5', description: 'TFR 4471982' }),
];

const dismissal = (
  kind: SuggestionDismissal['kind'], subjectKey: string
): SuggestionDismissal => ({
  id: `d-${subjectKey}`, kind, subjectKey, subjectIds: [], dismissedAt: new Date('2026-06-01'),
});

const tick = (description: string): void => {
  fireEvent.click(screen.getByLabelText(`Select ${description}`));
};

/**
 * Is this payee in the list at all? Asked through its checkbox rather than its
 * text, because a payee whose whole name is its merchant key — BOOTS — prints
 * twice in its own row, once under Payee and once under Looks like.
 */
const isListed = (description: string): boolean =>
  screen.queryByLabelText(`Select ${description}`) !== null;

const hideButton = (): HTMLElement =>
  screen.getByRole('button', { name: "Don't offer these again" });

const chip = (): HTMLElement => screen.getByRole('button', { name: /^AMAZON\.CO\.UK/ });
const noChip = (): HTMLElement | null => screen.queryByRole('button', { name: /^AMAZON\.CO\.UK/ });

const answerYes = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Yes — never offer it again' }));
};

const answerNo = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'No — just this once' }));
};

beforeEach(() => {
  toast.showSuccess.mockClear();
  toast.showError.mockClear();
});

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

describe('Payee cleanup — the bulk action is the selection, and only the selection', () => {
  it('is offered beside Rename selected and does nothing until something is ticked', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    expect(hideButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rename selected…' })).toBeDisabled();

    tick('BOOTS');
    expect(hideButton()).toBeEnabled();
  });

  it('records one refusal per ticked payee, and none for the ones left alone', async () => {
    const dismissSuggestion = vi.fn(async () => {});
    __setAppContextValue({ transactions: REGISTER, dismissSuggestion });
    render(<PayeeCleanup />);

    tick(THIRD);
    tick('BOOTS');
    fireEvent.click(hideButton());
    answerYes();

    await waitFor(() => expect(dismissSuggestion).toHaveBeenCalledTimes(2));
    // Per payee, so each is undone on its own — and with no transaction ids,
    // because the refusal is about wording that outlives any particular row.
    expect(dismissSuggestion).toHaveBeenCalledWith(
      'payee-hidden', payeeHiddenDismissalKey(THIRD), []
    );
    expect(dismissSuggestion).toHaveBeenCalledWith(
      'payee-hidden', payeeHiddenDismissalKey('BOOTS'), []
    );
    expect(dismissSuggestion).not.toHaveBeenCalledWith(
      'payee-hidden', payeeHiddenDismissalKey(FIRST), []
    );
  });

  it('answering No changes nothing that is written down', async () => {
    const dismissSuggestion = vi.fn(async () => {});
    __setAppContextValue({ transactions: REGISTER, dismissSuggestion });
    render(<PayeeCleanup />);

    tick('BOOTS');
    fireEvent.click(hideButton());
    answerNo();

    // Off the page for this sitting — that much is this sitting's decision
    // either way — and nothing saved.
    await waitFor(() => expect(isListed('BOOTS')).toBe(false));
    expect(dismissSuggestion).not.toHaveBeenCalled();
  });
});

describe('Payee cleanup — a hidden payee is hidden from everything on the page', () => {
  it('takes it out of the list, the suggestion and every count at once', async () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    expect(screen.getByText('Showing 5 of 5 payees')).toBeInTheDocument();
    expect(chip()).toHaveTextContent('3 payees · 3 transactions');

    tick(THIRD);
    fireEvent.click(hideButton());
    answerYes();

    // The row is gone…
    await waitFor(() => expect(screen.queryByText(THIRD)).not.toBeInTheDocument());
    // …and so is its weight in the suggestion above, which is the difference
    // between this and "Leave out": that one leaves the payee in the list.
    expect(chip()).toHaveTextContent('2 payees · 2 transactions');
    expect(screen.getByText('Showing 4 of 4 payees')).toBeInTheDocument();
    // The others are untouched: some could be, some could not.
    expect(screen.getByText(FIRST)).toBeInTheDocument();
    expect(screen.getByText(SECOND)).toBeInTheDocument();
    // And the page says where they went rather than leaving a silent gap.
    expect(screen.getByText(/1 hidden/)).toBeInTheDocument();
  });

  it('stops offering a suggestion once too few payees are left to merge', async () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    tick(THIRD);
    tick(SECOND);
    fireEvent.click(hideButton());
    answerYes();

    // One payee is not a cleanup: the guess has nothing left to offer.
    await waitFor(() => expect(noChip()).not.toBeInTheDocument());
    expect(screen.getByText(FIRST)).toBeInTheDocument();
    expect(screen.getByText('Showing 3 of 3 payees')).toBeInTheDocument();
  });

  it('never lists a payee hidden on a previous visit', () => {
    __setAppContextValue({
      transactions: REGISTER,
      suggestionDismissals: [dismissal('payee-hidden', payeeHiddenDismissalKey(THIRD))],
    });
    render(<PayeeCleanup />);

    expect(screen.queryByText(THIRD)).not.toBeInTheDocument();
    expect(screen.getByText('Showing 4 of 4 payees')).toBeInTheDocument();
    expect(chip()).toHaveTextContent('2 payees · 2 transactions');
  });

  it('cannot be renamed by a Select all shown that came after it', () => {
    __setAppContextValue({
      transactions: REGISTER,
      suggestionDismissals: [dismissal('payee-hidden', payeeHiddenDismissalKey(THIRD))],
    });
    render(<PayeeCleanup />);

    fireEvent.click(screen.getByRole('button', { name: 'Select all shown (4)' }));

    // Four, not five: a rename can only ever touch payees the user can see.
    expect(screen.getByText('4 selected · 4 transactions')).toBeInTheDocument();
  });
});

describe('Payee cleanup — hiding is undone from the foot of the page', () => {
  it('describes what was hidden and puts it back on request', async () => {
    const restoreSuggestion = vi.fn(async () => {
      __setAppContextValue({ suggestionDismissals: [] });
    });
    __setAppContextValue({
      transactions: REGISTER,
      restoreSuggestion,
      suggestionDismissals: [dismissal('payee-hidden', payeeHiddenDismissalKey(THIRD))],
    });
    render(<PayeeCleanup />);

    const section = screen.getByText('Dismissed suggestions').closest('section');
    if (!section) throw new Error('no dismissed section');

    fireEvent.click(within(section).getByRole('button', { name: 'Show' }));
    expect(within(section).getByText(THIRD)).toBeInTheDocument();
    // Which of the three refusals this was, and what undoing it will do —
    // said before the button is pressed.
    expect(
      within(section).getByText('— hidden from this page and from every suggestion on it')
    ).toBeInTheDocument();
    expect(within(section).getByText('Hidden from this page')).toBeInTheDocument();
    expect(within(section).getByText('Restore puts the payee back in the list')).toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: 'Restore' }));

    await waitFor(() =>
      expect(restoreSuggestion).toHaveBeenCalledWith(
        'payee-hidden', payeeHiddenDismissalKey(THIRD)
      )
    );
    // The round trip: the payee is back in the list, back in the suggestion,
    // and back in the counts.
    await waitFor(() => expect(screen.getByText(THIRD)).toBeInTheDocument());
    expect(screen.getByText('Showing 5 of 5 payees')).toBeInTheDocument();
    expect(chip()).toHaveTextContent('3 payees · 3 transactions');
  });

  it('brings back one hidden in this sitting, without a reload', async () => {
    const restoreSuggestion = vi.fn(async () => {
      __setAppContextValue({ suggestionDismissals: [] });
    });
    const dismissSuggestion = vi.fn(async (
      kind: SuggestionDismissal['kind'], subjectKey: string
    ) => {
      __setAppContextValue({ suggestionDismissals: [dismissal(kind, subjectKey)] });
    });
    __setAppContextValue({ transactions: REGISTER, dismissSuggestion, restoreSuggestion });
    render(<PayeeCleanup />);

    tick('BOOTS');
    fireEvent.click(hideButton());
    answerYes();
    await waitFor(() => expect(isListed('BOOTS')).toBe(false));

    const section = screen.getByText('Dismissed suggestions').closest('section');
    if (!section) throw new Error('no dismissed section');
    fireEvent.click(within(section).getByRole('button', { name: 'Show' }));
    fireEvent.click(within(section).getByRole('button', { name: 'Restore' }));

    // Restoring has to clear this sitting's copy of the refusal as well as the
    // saved one, or the page would go on hiding it until it was reloaded.
    await waitFor(() => expect(isListed('BOOTS')).toBe(true));
  });
});

describe('Payee cleanup — a refusal that could not be saved says so', () => {
  const REFUSAL = 'new row for relation "suggestion_dismissals" violates check constraint '
    + '"suggestion_dismissals_kind_known"';

  it('names the consequence on the page, in the database\'s own words', async () => {
    // The case that matters most: the migration widening the kind constraint
    // has not been applied, so every one of these inserts is rejected. The
    // payees have already left the list, so a screen that said nothing would
    // look exactly like a screen that had saved.
    const dismissSuggestion = vi.fn(async () => { throw new Error(REFUSAL); });
    __setAppContextValue({ transactions: REGISTER, dismissSuggestion });
    render(<PayeeCleanup />);

    tick(THIRD);
    tick('BOOTS');
    fireEvent.click(hideButton());
    answerYes();

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(
      'Nothing was saved, so they will be back in the list the next time this page opens.'
    );
    expect(banner).toHaveTextContent('suggestion_dismissals_kind_known');
    expect(toast.showSuccess).not.toHaveBeenCalled();
    expect(toast.showError).toHaveBeenCalled();
  });

  it('counts the ones that did save, and tries again with only the ones that did not', async () => {
    let refuseSecond = true;
    const dismissSuggestion = vi.fn(async (
      _kind: SuggestionDismissal['kind'], subjectKey: string
    ) => {
      if (refuseSecond && subjectKey === payeeHiddenDismissalKey('BOOTS')) {
        throw new Error(REFUSAL);
      }
    });
    __setAppContextValue({ transactions: REGISTER, dismissSuggestion });
    render(<PayeeCleanup />);

    tick(THIRD);
    tick('BOOTS');
    fireEvent.click(hideButton());
    answerYes();

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(
      '1 of 2 were saved. The other 1 were not, so they will be back the next time this page opens.'
    );

    refuseSecond = false;
    dismissSuggestion.mockClear();
    fireEvent.click(within(banner).getByRole('button', { name: 'Try again' }));

    // Only the one that failed — the other is already saved, and re-asking for
    // it would be a second write nobody asked for.
    await waitFor(() => expect(dismissSuggestion).toHaveBeenCalledTimes(1));
    expect(dismissSuggestion).toHaveBeenCalledWith(
      'payee-hidden', payeeHiddenDismissalKey('BOOTS'), []
    );
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(toast.showSuccess).toHaveBeenCalled();
  });
});
