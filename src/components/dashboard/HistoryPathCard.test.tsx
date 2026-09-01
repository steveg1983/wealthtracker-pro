import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HistoryPathCard, { APPEARS_AT_BACKLOG } from './HistoryPathCard';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { preferences } from '../../services/preferencesService';
import type { Account, Budget, Transaction } from '../../types';

/**
 * THE HISTORY GUIDE'S FOUR CLAIMS ABOUT ITSELF:
 *
 *  - it meets the user the sequence was written for (a hundred rows or more
 *    awaiting review) and NOBODY else, and once met it stays until it is
 *    dismissed — its own advice shrinks the number that summoned it, so a card
 *    gated on the live count would vanish mid-journey;
 *  - the four observed steps read the ledger and the three manual ones read the
 *    user, and both kinds survive a reload because all of it goes through the
 *    preferences channel that travels between a phone and a desktop;
 *  - the counter is the app's ONE To Review predicate, so a transfer and a
 *    split parent — which take no category and are filed by what they are —
 *    cannot inflate it;
 *  - every step is a link into the tool that does it.
 *
 * Every account name, payee, amount and figure below is invented; this repo is
 * public.
 */

const ENGAGED_PREFERENCE = 'historyPath.engaged.v1';
const DISMISSED_PREFERENCE = 'historyPath.dismissed.v1';
const TICKS_PREFERENCE = 'historyPath.ticks.v1';

const ACCOUNT: Account = {
  id: 'acc-1',
  name: 'Synthetic Current',
  type: 'current',
  balance: 0,
  currency: 'GBP',
  lastUpdated: new Date(2025, 0, 2),
};

const BUDGET: Budget = {
  id: 'bud-1',
  categoryId: 'det-food',
  amount: 250,
  period: 'monthly',
  isActive: true,
  spent: 0,
  createdAt: new Date(2025, 0, 1),
  updatedAt: new Date(2025, 0, 1),
};

/** Rows with no category: unfiled, and therefore awaiting review. */
const unfiled = (count: number, prefix = 'unfiled'): Transaction[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    date: new Date(2025, 0, 2),
    description: `Payment ${index}`,
    amount: -12.5,
    type: 'expense' as const,
    accountId: ACCOUNT.id,
    category: '',
  }));

/** Rows that are filed and have been looked at: nothing outstanding. */
const filed = (count: number): Transaction[] =>
  unfiled(count, 'filed').map(row => ({ ...row, category: 'det-food', needsReview: false }));

const setLedger = (over: {
  accounts?: Account[];
  transactions?: Transaction[];
  budgets?: Budget[];
  isLoading?: boolean;
  transactionsLoadFailed?: boolean;
}): void => {
  __setAppContextValue({
    accounts: over.accounts ?? [ACCOUNT],
    transactions: over.transactions ?? [],
    budgets: over.budgets ?? [],
    transactionSplits: [],
    isLoading: over.isLoading ?? false,
    transactionsLoadFailed: over.transactionsLoadFailed ?? false,
  });
};

const renderCard = () =>
  render(
    <MemoryRouter>
      <HistoryPathCard />
    </MemoryRouter>
  );

const hrefOf = (name: string): string | null =>
  screen.getByRole('link', { name }).getAttribute('href');

beforeEach(() => {
  // Both halves of the channel: the service clears its document and this
  // browser's mirror, which is what `getItem` falls back to before an account's
  // row has landed.
  preferences.removeItem(ENGAGED_PREFERENCE);
  preferences.removeItem(DISMISSED_PREFERENCE);
  preferences.removeItem(TICKS_PREFERENCE);
});

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

describe('who the history guide appears to', () => {
  it('says nothing to a fresh start — a small backlog is not a sequence problem', () => {
    setLedger({ transactions: unfiled(12) });
    renderCard();
    expect(screen.queryByTestId('history-path')).toBeNull();
    // And it does not quietly latch itself on for later.
    expect(preferences.getItem(ENGAGED_PREFERENCE)).toBeNull();
  });

  it('says nothing at all to an empty ledger — a zero renders nothing', () => {
    setLedger({ accounts: [], transactions: [] });
    renderCard();
    expect(screen.queryByTestId('history-path')).toBeNull();
  });

  it('appears at the owner’s hundred, and records that it has been met', () => {
    setLedger({ transactions: unfiled(APPEARS_AT_BACKLOG) });
    renderCard();
    expect(screen.getByTestId('history-path')).toBeInTheDocument();
    expect(preferences.getItem(ENGAGED_PREFERENCE)).toBe('true');
  });

  it('stays through the middle of the journey, when the pile it named has fallen', () => {
    // The point of the latch. Fifty left is halfway, not a reason to withdraw
    // the guide — and the payoff step is the one still unread at that point.
    preferences.setItem(ENGAGED_PREFERENCE, 'true');
    setLedger({ transactions: unfiled(50) });
    renderCard();
    expect(screen.getByTestId('history-path')).toBeInTheDocument();
    expect(screen.getByTestId('history-path-counter')).toHaveTextContent('50 left to review');
  });

  it('honours a dismissal whatever the backlog says', () => {
    preferences.setItem(DISMISSED_PREFERENCE, 'true');
    setLedger({ transactions: unfiled(2_000) });
    renderCard();
    expect(screen.queryByTestId('history-path')).toBeNull();
  });

  it('says nothing over a ledger that has not arrived, rather than congratulating the reader', () => {
    // An empty `transactions` means "still loading" as readily as it means
    // "nothing outstanding", and an engaged user would otherwise be shown the
    // settled card — job done, budgets built — for the length of a boot.
    preferences.setItem(ENGAGED_PREFERENCE, 'true');
    setLedger({ transactions: [], isLoading: true });
    renderCard();
    expect(screen.queryByTestId('history-path')).toBeNull();

    cleanup();
    setLedger({ transactions: [], transactionsLoadFailed: true });
    renderCard();
    expect(screen.queryByTestId('history-path')).toBeNull();
  });

  it('adopts the account’s answer when the stored document lands after the first paint', () => {
    // The row reaches a machine the user has never opened a few hundred
    // milliseconds into boot — after this card's first render. A card that read
    // its preferences once at mount would show a guide the user hid on their
    // desktop for the whole of that session, which is the per-device bug the
    // preferences document exists to end.
    setLedger({ transactions: unfiled(APPEARS_AT_BACKLOG) });
    renderCard();
    expect(screen.getByTestId('history-path')).toBeInTheDocument();

    act(() => {
      preferences.setItem(DISMISSED_PREFERENCE, 'true');
    });

    expect(screen.queryByTestId('history-path')).toBeNull();
  });

  it('is dismissed through the preferences channel, so the choice travels', () => {
    const setItem = vi.spyOn(preferences, 'setItem');
    setLedger({ transactions: unfiled(APPEARS_AT_BACKLOG) });
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Hide this guide' }));

    expect(setItem).toHaveBeenCalledWith(DISMISSED_PREFERENCE, 'true');
    expect(screen.queryByTestId('history-path')).toBeNull();

    // …and it is still gone on the next screen the user opens.
    cleanup();
    renderCard();
    expect(screen.queryByTestId('history-path')).toBeNull();
    setItem.mockRestore();
  });
});

describe('the counter', () => {
  it('states the backlog in the reader’s own formatting', () => {
    setLedger({ transactions: unfiled(1_500) });
    renderCard();
    // Compared against toLocaleString rather than a written-out separator: the
    // app prints numbers the way the reader's region does, and a hard-coded
    // comma here would be this test asserting a locale nobody chose.
    expect(screen.getByTestId('history-path-counter')).toHaveTextContent(
      `${(1_500).toLocaleString()} left to review`
    );
  });

  it('counts by the app’s ONE To Review predicate — a transfer and a split parent are not backlog', () => {
    // Both take no category: a transfer is filed by being a transfer, and a
    // split files through its lines. A second derivation on this card would be
    // a fourth answer to one question, which is how two counters came to
    // disagree in front of the owner on 1 Sep 2026.
    const transfer: Transaction = { ...unfiled(1, 'xfer')[0], type: 'transfer' };
    const splitParent: Transaction = { ...unfiled(1, 'split')[0], isSplit: true };
    setLedger({ transactions: [...unfiled(APPEARS_AT_BACKLOG), transfer, splitParent] });
    renderCard();
    expect(screen.getByTestId('history-path-counter')).toHaveTextContent('100 left to review');
  });

  it('celebrates plainly at zero, without printing a zero', () => {
    preferences.setItem(ENGAGED_PREFERENCE, 'true');
    setLedger({ transactions: filed(120) });
    renderCard();
    const counter = screen.getByTestId('history-path-counter');
    expect(counter).toHaveTextContent('Nothing left to review');
    expect(counter).not.toHaveTextContent('0 left to review');
  });
});

describe('the steps the ledger answers for itself', () => {
  beforeEach(() => {
    preferences.setItem(ENGAGED_PREFERENCE, 'true');
  });

  it('asks for accounts while there are none, and stops asking once there is one', () => {
    setLedger({ accounts: [], transactions: unfiled(APPEARS_AT_BACKLOG) });
    renderCard();
    expect(screen.getByRole('link', { name: 'Add your accounts' })).toBeInTheDocument();

    cleanup();
    setLedger({ accounts: [ACCOUNT], transactions: unfiled(APPEARS_AT_BACKLOG) });
    renderCard();
    // A done step stops being a link — there is nothing to go and do.
    expect(screen.queryByRole('link', { name: 'Add your accounts' })).toBeNull();
    expect(screen.getByText('Add your accounts')).toBeInTheDocument();
  });

  it('asks for statements until a hundred rows have arrived', () => {
    setLedger({ transactions: unfiled(99) });
    renderCard();
    expect(screen.getByRole('link', { name: 'Import your statements' })).toBeInTheDocument();

    cleanup();
    setLedger({ transactions: unfiled(APPEARS_AT_BACKLOG) });
    renderCard();
    expect(screen.queryByRole('link', { name: 'Import your statements' })).toBeNull();
  });

  it('ticks the sweep only when the backlog it exists to produce is zero', () => {
    setLedger({ transactions: unfiled(APPEARS_AT_BACKLOG) });
    renderCard();
    expect(screen.getByRole('link', { name: 'Sweep what’s left' })).toBeInTheDocument();

    cleanup();
    setLedger({ transactions: [...filed(120), ...unfiled(1)] });
    renderCard();
    // One row left is still a backlog: the step is not done at "nearly".
    expect(screen.getByRole('link', { name: 'Sweep what’s left' })).toBeInTheDocument();

    cleanup();
    setLedger({ transactions: filed(120) });
    renderCard();
    expect(screen.queryByRole('link', { name: 'Sweep what’s left' })).toBeNull();
  });

  it('asks for budgets until one is actually running', () => {
    setLedger({ transactions: unfiled(APPEARS_AT_BACKLOG) });
    renderCard();
    expect(screen.getByRole('link', { name: 'Set budgets from your real year' })).toBeInTheDocument();

    cleanup();
    // An inactive budget is not a budget doing anything.
    setLedger({
      transactions: unfiled(APPEARS_AT_BACKLOG),
      budgets: [{ ...BUDGET, isActive: false }],
    });
    renderCard();
    expect(screen.getByRole('link', { name: 'Set budgets from your real year' })).toBeInTheDocument();

    cleanup();
    setLedger({ transactions: unfiled(APPEARS_AT_BACKLOG), budgets: [BUDGET] });
    renderCard();
    expect(screen.queryByRole('link', { name: 'Set budgets from your real year' })).toBeNull();
  });

  it('offers no control on a step it answers itself', () => {
    setLedger({ transactions: unfiled(APPEARS_AT_BACKLOG) });
    renderCard();
    // Three checkboxes, and only three: the observed steps are facts, not
    // claims the user is asked to make.
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });
});

describe('the three steps only the person doing them can judge', () => {
  beforeEach(() => {
    preferences.setItem(ENGAGED_PREFERENCE, 'true');
    setLedger({ transactions: unfiled(APPEARS_AT_BACKLOG) });
  });

  it('persists a tick through the preferences channel, so it travels', () => {
    const setItem = vi.spyOn(preferences, 'setItem');
    renderCard();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark “Match transfers first” as done' }));

    expect(setItem).toHaveBeenCalledWith(TICKS_PREFERENCE, JSON.stringify(['transfers']));
    expect(preferences.getItem(TICKS_PREFERENCE)).toBe(JSON.stringify(['transfers']));
    // The step reads as done, and its link stands down.
    expect(screen.queryByRole('link', { name: 'Match transfers first' })).toBeNull();
    setItem.mockRestore();
  });

  it('keeps the ticks it is given and no others', () => {
    renderCard();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark “Tidy your payees” as done' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark “Categorise by payee” as done' }));

    expect(preferences.getItem(TICKS_PREFERENCE)).toBe(
      JSON.stringify(['payees', 'payee-categories'])
    );
    expect(screen.getByRole('checkbox', { name: 'Mark “Match transfers first” as done' }))
      .not.toBeChecked();
  });

  it('un-ticks — a mis-tick has to be reversible', () => {
    preferences.setItem(TICKS_PREFERENCE, JSON.stringify(['payees']));
    renderCard();

    const tick = screen.getByRole('checkbox', { name: 'Mark “Tidy your payees” as done' });
    expect(tick).toBeChecked();

    fireEvent.click(tick);
    expect(preferences.getItem(TICKS_PREFERENCE)).toBe(JSON.stringify([]));
    expect(screen.getByRole('checkbox', { name: 'Mark “Tidy your payees” as done' })).not.toBeChecked();
    // …and the way back into the tool comes back with it.
    expect(screen.getByRole('link', { name: 'Tidy your payees' })).toBeInTheDocument();
  });

  it('reads a corrupt or foreign tick list as no ticks rather than failing', () => {
    preferences.setItem(TICKS_PREFERENCE, '{ not json');
    renderCard();
    for (const box of screen.getAllByRole('checkbox')) expect(box).not.toBeChecked();

    cleanup();
    preferences.setItem(TICKS_PREFERENCE, JSON.stringify(['a-step-from-2027', 'payees']));
    renderCard();
    expect(screen.getByRole('checkbox', { name: 'Mark “Tidy your payees” as done' })).toBeChecked();
  });

  it('gates nothing — the order is advice, and step five is reachable from the start', () => {
    renderCard();
    expect(screen.getByRole('link', { name: 'Categorise by payee' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set budgets from your real year' })).toBeInTheDocument();
  });
});

describe('every step is a way into the tool that does it', () => {
  it('addresses all seven', () => {
    preferences.setItem(ENGAGED_PREFERENCE, 'true');
    setLedger({ accounts: [], transactions: unfiled(50) });
    renderCard();

    expect(hrefOf('Add your accounts')).toBe('/accounts?action=add');
    expect(hrefOf('Import your statements')).toBe('/enhanced-import');
    expect(hrefOf('Match transfers first')).toBe('/categorisation');
    expect(hrefOf('Tidy your payees')).toBe('/settings/payees');
    expect(hrefOf('Categorise by payee')).toBe('/categorisation');
    expect(hrefOf('Sweep what’s left')).toBe('/categorisation');
    expect(hrefOf('Set budgets from your real year')).toBe('/budget');
  });
});

describe('when the job is done', () => {
  it('stands down to its dismissal, on the ledger’s word rather than the ticks', () => {
    // Nothing awaiting review and a budget running IS the outcome the three
    // manual steps exist to produce. A card that went on asking for ticks over
    // a finished ledger would be refusing to believe its own eyes.
    preferences.setItem(ENGAGED_PREFERENCE, 'true');
    setLedger({ transactions: filed(120), budgets: [BUDGET] });
    renderCard();

    expect(screen.getByTestId('history-path')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'You’re set up — hide this' })).toBeInTheDocument();
    // Only the dismissal: no steps, no links, no checkboxes left to answer.
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('is not settled while the payoff step is outstanding', () => {
    preferences.setItem(ENGAGED_PREFERENCE, 'true');
    setLedger({ transactions: filed(120) });
    renderCard();
    expect(screen.getByRole('link', { name: 'Set budgets from your real year' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide this guide' })).toBeInTheDocument();
  });
});
