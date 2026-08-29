/**
 * Payee cleanup — how many suggestions there are, and what order they come in.
 *
 * The owner's report: "The list of 'These look like the same merchant' looks a
 * bit random, and when you tidy up one, the next appears, so I don't really
 * know how many different suggestions the system is making. Perhaps having the
 * total number showing somewhere, and perhaps have the payees in more of a
 * 'list' that you can scroll through, in alphabetical order at least… Or even
 * offer sort by alphabet or by transaction count?"
 *
 * Three separate faults in that, and this file holds each of them:
 *
 *   1. the page showed the top EIGHT suggestions and never said of how many, so
 *      refusing one silently promoted the ninth and the work looked endless;
 *   2. the eight were a wrapped row of chips rather than a list;
 *   3. the only order was by transaction count, which reads as no order at all
 *      when you are looking for a particular shop.
 *
 * The fixture is twelve merchants — more than the old cap, so a page that still
 * capped would fail the first test in this file — and it is built so that the
 * two orders are exact opposites: ALPHA has the FEWEST transactions and sorts
 * first by name, LIMA has the most and sorts last. Neither order can pass by
 * accident.
 *
 * Every payee, merchant and figure below is invented: this repo is public.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import PayeeCleanup from './PayeeCleanup';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { payeeMerchantDismissalKey } from '../../utils/suggestionDismissals';
import type { SuggestionDismissal, Transaction } from '../../types';

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(), showSuccess: vi.fn(), showError: vi.fn(),
    showWarning: vi.fn(), showInfo: vi.fn(), dismissToast: vi.fn(),
  }),
}));

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

/**
 * Twelve invented merchants, already in name order, so ALPHABETICAL below is
 * this list and the transaction order is its exact reverse.
 */
const MERCHANTS = [
  'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT',
  'GOLF', 'HOTEL', 'INDIA', 'JULIET', 'KILO', 'LIMA',
] as const;

const ALPHABETICAL = MERCHANTS.map(name => `${name}.CO.UK`);
const BY_TRANSACTIONS = [...ALPHABETICAL].reverse();

/** The transactions merchant `i` would tidy: two for ALPHA, thirteen for LIMA. */
const transactionsFor = (i: number): number => i + 2;

/**
 * Two payees per merchant, both plainly the same shop behind different card
 * references, and a lopsided split so the transaction counts are all distinct.
 */
const REGISTER: Transaction[] = MERCHANTS.flatMap((name, i) => {
  const key = `${name}.CO.UK`;
  const rows: Transaction[] = [];
  for (let n = 0; n < transactionsFor(i) - 1; n++) {
    rows.push({
      id: `${name}-a-${n}`, description: `REF*${i}A ${key}`, date: new Date('2026-03-01'),
      amount: -10, category: 'cat-1', accountId: 'acc-1', type: 'expense',
    });
  }
  rows.push({
    id: `${name}-b`, description: `REF*${i}B ${key}`, date: new Date('2026-04-01'),
    amount: -10, category: 'cat-1', accountId: 'acc-1', type: 'expense',
  });
  return rows;
});

/** 24 distinct payees across 90 transactions — restated so a fixture edit shows up. */
const TOTAL_PAYEES = 24;

const dismissal = (subjectKey: string): SuggestionDismissal => ({
  id: `d-${subjectKey}`, kind: 'payee-merchant', subjectKey, subjectIds: [],
  dismissedAt: new Date('2026-06-01'),
});

const suggestionList = (): HTMLElement =>
  screen.getByRole('list', { name: 'Suggested merchants' });

/**
 * The merchant names in the order they are on screen, top to bottom.
 *
 * Read from the row's first span rather than its accessible name, because the
 * name runs the merchant and its counts together and this has to be able to
 * tell `ALPHA.CO.UK` from `ALPHA.CO.UK2 payees`.
 */
const listedKeys = (): string[] =>
  within(suggestionList()).getAllByRole('button').map(button => {
    const name = button.querySelector('span');
    if (!(name instanceof HTMLElement)) throw new Error('a suggestion row has no merchant name');
    return name.textContent ?? '';
  });

const heading = (): HTMLElement =>
  screen.getByRole('heading', { name: /the same merchant$/ });

/** The whole suggestions card, for reading the sentence under the heading. */
const card = (): HTMLElement => {
  const el = heading().closest('div.bg-white');
  if (!(el instanceof HTMLElement)) throw new Error('no suggestions card');
  return el;
};

const orderBy = (label: 'A–Z' | 'Most transactions'): void => {
  fireEvent.click(screen.getByRole('button', { name: label }));
};

const rowFor = (key: string): HTMLElement =>
  within(suggestionList()).getByRole('button', { name: new RegExp(`^${key.replace(/\./g, '\\.')}`) });

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

describe('Payee cleanup — how many suggestions there are', () => {
  it('states the total in the heading, so the work has a visible end', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    expect(heading()).toHaveTextContent('12 groups look like the same merchant');
  });

  it('says what tidying them all would be worth, not just how many there are', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    expect(card().textContent).toContain('Tidying them all would give 24 payees 12 names.');
  });

  it('lists every one of them, not the top handful', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    // Twelve, which is more than the eight the page used to show — and the
    // four it used to drop are the SMALLEST, the ones a user would never have
    // known existed.
    expect(within(suggestionList()).getAllByRole('listitem')).toHaveLength(12);
    expect([...listedKeys()].sort()).toEqual([...ALPHABETICAL].sort());
  });

  it('keeps the list in a box that scrolls rather than growing down the page', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    // The bound is the whole reason every suggestion can be rendered: without
    // it a register with hundreds of them pushes the payee list, the buttons
    // and the dismissed section off the bottom of the screen.
    const list = suggestionList();
    expect(list.style.maxHeight).not.toBe('');
    expect(list).toHaveClass('overflow-y-auto');
  });

  it('claims no number until it knows which suggestions were already refused', () => {
    __setAppContextValue({ transactions: REGISTER, suggestionDismissalsStatus: 'loading' });
    render(<PayeeCleanup />);

    // A total that dropped from 12 to 11 the moment the refusals arrived would
    // be worse than no total: the user would have to watch it to trust it.
    expect(heading()).toHaveTextContent('These look like the same merchant');
    expect(heading().textContent).not.toMatch(/\d/);
    expect(card().textContent).not.toContain('Tidying them all');
  });

  it('says nothing at all when there is nothing to suggest', () => {
    // Zero counts render nothing — a heading that says "0 groups" is noise
    // dressed as information.
    __setAppContextValue({
      transactions: [{
        id: 't1', description: 'BOOTS', date: new Date('2026-03-01'), amount: -10,
        category: 'cat-1', accountId: 'acc-1', type: 'expense',
      }],
    });
    render(<PayeeCleanup />);

    expect(screen.queryByRole('heading', { name: /the same merchant$/ })).not.toBeInTheDocument();
  });
});

describe('Payee cleanup — the total tells the truth about the filters', () => {
  it('does not count a merchant refused on an earlier visit', () => {
    __setAppContextValue({
      transactions: REGISTER,
      suggestionDismissals: [dismissal(payeeMerchantDismissalKey('LIMA.CO.UK'))],
    });
    render(<PayeeCleanup />);

    expect(heading()).toHaveTextContent('11 groups look like the same merchant');
    expect(listedKeys()).not.toContain('LIMA.CO.UK');
    // And the worth moves with it: LIMA's two payees are no longer on offer.
    expect(card().textContent).toContain('Tidying them all would give 22 payees 11 names.');
  });

  it('drops by one the moment a suggestion is refused on this page', async () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    expect(heading()).toHaveTextContent('12 groups look like the same merchant');

    fireEvent.click(rowFor('GOLF.CO.UK'));
    fireEvent.click(screen.getByRole('button', { name: 'Not the same merchant' }));

    // The owner's exact experience, now with a number attached to it: the
    // suggestion goes, the next one does NOT quietly take its place in a list
    // of fixed length, and the heading says how many are left.
    await waitFor(() => expect(heading()).toHaveTextContent('11 groups look like the same merchant'));
    expect(listedKeys()).not.toContain('GOLF.CO.UK');
    expect(within(suggestionList()).getAllByRole('listitem')).toHaveLength(11);
  });

  it('drops a suggestion whose payees were taken off the page altogether', async () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    // ALPHA has exactly two payees, so hiding one leaves nothing to merge.
    fireEvent.click(screen.getByLabelText('Select REF*0B ALPHA.CO.UK'));
    fireEvent.click(screen.getByRole('button', { name: "Don't offer these again" }));

    await waitFor(() => expect(heading()).toHaveTextContent('11 groups look like the same merchant'));
    expect(listedKeys()).not.toContain('ALPHA.CO.UK');
    // 24 payees less the hidden one, less ALPHA's remaining payee — which is
    // still listed, but no longer part of any suggestion.
    expect(card().textContent).toContain('Tidying them all would give 22 payees 11 names.');
    expect(screen.getByText(`Showing ${TOTAL_PAYEES - 1} of ${TOTAL_PAYEES - 1} payees`))
      .toBeInTheDocument();
  });

  it('drops a suggestion left with one payee after the others were left out', async () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    fireEvent.click(rowFor('BRAVO.CO.UK'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Leave out REF*1B BRAVO.CO.UK from the BRAVO.CO.UK suggestion' })
    );

    await waitFor(() => expect(heading()).toHaveTextContent('11 groups look like the same merchant'));
  });
});

describe('Payee cleanup — the order the suggestions are read in', () => {
  it('opens on the biggest tidy-up first, which is what the page always did', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    expect(listedKeys()).toEqual(BY_TRANSACTIONS);
    expect(screen.getByRole('button', { name: 'Most transactions' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'A–Z' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('sorts by merchant name on request — the owner\'s ask', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    orderBy('A–Z');

    // The exact reverse of the order it opened in, so a page that ignored the
    // click, or sorted the wrong way, cannot pass this.
    expect(listedKeys()).toEqual(ALPHABETICAL);
    expect(screen.getByRole('button', { name: 'A–Z' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('goes back to the biggest tidy-up first', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    orderBy('A–Z');
    orderBy('Most transactions');

    expect(listedKeys()).toEqual(BY_TRANSACTIONS);
  });

  it('keeps the counts on every row in both orders', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    orderBy('A–Z');

    // Alphabetical makes a suggestion findable; it does not make it worth
    // doing. The counts are how you tell, so they stay whatever the order.
    expect(rowFor('LIMA.CO.UK')).toHaveTextContent('2 payees · 13 transactions');
    expect(rowFor('ALPHA.CO.UK')).toHaveTextContent('2 payees · 2 transactions');
  });

  it('does not change how many suggestions there are', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    orderBy('A–Z');

    expect(heading()).toHaveTextContent('12 groups look like the same merchant');
    expect(within(suggestionList()).getAllByRole('listitem')).toHaveLength(12);
  });

  it('offers no order to choose when there is only one suggestion', () => {
    __setAppContextValue({
      transactions: REGISTER.filter(t => t.description.includes('ALPHA')),
    });
    render(<PayeeCleanup />);

    expect(heading()).toHaveTextContent('1 group looks like the same merchant');
    expect(screen.queryByRole('group', { name: 'Order the suggestions' })).not.toBeInTheDocument();
  });
});

describe('Payee cleanup — picking a suggestion out of the list', () => {
  it('narrows the payees, ticks them, and offers the refusal — exactly as the chip did', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    fireEvent.click(rowFor('GOLF.CO.UK'));

    // GOLF is two payees over eight transactions.
    expect(screen.getByLabelText('Search payees')).toHaveValue('GOLF.CO.UK');
    expect(screen.getByText(`Showing 2 of ${TOTAL_PAYEES} payees`)).toBeInTheDocument();
    expect(screen.getByText('2 selected · 8 transactions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not the same merchant' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Leave out/ })).toHaveLength(2);
    expect(rowFor('GOLF.CO.UK')).toHaveAttribute('aria-pressed', 'true');
  });

  it('moves the picked suggestion when the order changes rather than losing it', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    fireEvent.click(rowFor('GOLF.CO.UK'));
    orderBy('A–Z');

    // The panel belongs to the suggestion, not to its position in the list.
    expect(rowFor('GOLF.CO.UK')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Not the same merchant' })).toBeInTheDocument();
    expect(listedKeys()).toEqual(ALPHABETICAL);
  });

  it('picks a suggestion that the old top-eight cap would never have shown', () => {
    __setAppContextValue({ transactions: REGISTER });
    render(<PayeeCleanup />);

    // ALPHA is the smallest of the twelve — ninth or later under the cap, and
    // therefore unreachable on the page the owner was using.
    fireEvent.click(rowFor('ALPHA.CO.UK'));

    expect(screen.getByText(`Showing 2 of ${TOTAL_PAYEES} payees`)).toBeInTheDocument();
    expect(screen.getByText('2 selected · 2 transactions')).toBeInTheDocument();
  });
});
