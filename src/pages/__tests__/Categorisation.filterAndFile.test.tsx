import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import Categorisation from '../Categorisation';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { NO_SURVIVORS } from '../../utils/transferSurvivorRelease';
import type { Account, Category, Transaction, TransactionSplit } from '../../types';

/**
 * Filter and file, on the page where a transaction gets its FIRST category.
 *
 * The card this replaced ("review one by one") opened the whole backlog in a
 * drill and asked the reader to work down it. What these pin is the thing that
 * makes the replacement worth having, and the thing that makes it safe:
 *
 *   * the POPULATION is everything still waiting — a blank row and a feed's
 *     guess alike — and nothing that has been filed and agreed with;
 *   * what it cannot file, it says out loud: transfers (with where they are
 *     dealt with) and the lines inside a split (with where they are edited),
 *     both of which the backlog figure above the list counts;
 *   * a press writes the three fields of a filing and never a deletion, and
 *     can be taken back.
 *
 * The list itself is shared with Settings → Categories and its mechanism is
 * pinned by RecategoriseSection.test.tsx; these are this page's half — the
 * population, the words, and the card that opens it.
 *
 * Every name and amount is invented: this repo is public.
 */

const ACCOUNT: Account = {
  id: 'acc-current',
  name: 'Everyday Account',
  type: 'current',
  balance: 0,
  currency: 'GBP',
  lastUpdated: new Date(2024, 0, 1),
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'sub-day', name: 'Day to day', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-food', name: 'Food shopping', type: 'expense', level: 'detail', parentId: 'sub-day' },
  { id: 'cat-travel', name: 'Travel', type: 'expense', level: 'detail', parentId: 'sub-day' },
];

/**
 * The category walkers, exactly as the real context implements them: every
 * child of the given parent, with no filter on level. The house picker builds
 * its groups and leaves out of these.
 */
const walkChildren = (parentId?: string): Category[] =>
  CATEGORIES.filter(category => category.parentId === parentId);

/** Local-part dates: the suite runs under a fixed clock in the machine's zone. */
const day = (year: number, month: number, date: number): Date => new Date(year, month - 1, date);

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: day(2024, 11, 5),
  amount: -18.4,
  description: 'Ashvale Market',
  category: '',
  accountId: 'acc-current',
  type: 'expense',
  categoryConfirmed: true,
  needsReview: false,
  ...over,
});

/** No category at all — the reports cannot see this money until it is filed. */
const UNFILED = txn({ id: 'txn-unfiled' });
/** A feed's guess: filed, but by the app, and nobody has agreed with it. */
const GUESSED = txn({
  id: 'txn-guessed',
  description: 'Ashvale Garage',
  category: 'cat-travel',
  categoryConfirmed: false,
  needsReview: true,
  amount: -55.75,
});
/** Filed, agreed with, done. The housekeeping tool's row, not this one's. */
const SETTLED = txn({
  id: 'txn-settled',
  description: 'Ashvale Bakery',
  category: 'cat-food',
  amount: -6.2,
});
/** Money between the reader's own accounts — no category, and never in a list. */
const MOVED = txn({
  id: 'txn-moved',
  description: 'Ashvale Savings',
  type: 'transfer',
  amount: -400,
  needsReview: true,
});
/**
 * Filed under a category somebody deleted. Counted as filing work here (its
 * money is in no report) but reachable only where filings are CHANGED — see
 * the loop test at the foot of this file.
 */
const ORPHANED = txn({
  id: 'txn-orphaned',
  description: 'Ashvale Hardware',
  category: 'cat-deleted-in-2019',
  amount: -31.05,
});
/** A split parent: unfiled in its LINES, which are edited in the register. */
const SPLIT = txn({ id: 'txn-split', description: 'Ashvale Hardware', isSplit: true, amount: -90 });
const SPLIT_LINES: TransactionSplit[] = [
  { id: 'line-1', transactionId: 'txn-split', category: '', amount: -60, sortOrder: 0 },
  { id: 'line-2', transactionId: 'txn-split', category: '', amount: -30, sortOrder: 1 },
];

const renderPage = (): void => {
  render(
    <MemoryRouter>
      <PreferencesProvider>
        <ToastProvider>
          <NotificationProvider>
            <Categorisation />
          </NotificationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

const setup = (
  transactions: Transaction[],
  overrides: Partial<Parameters<typeof __setAppContextValue>[0]> = {}
): void => {
  __setAppContextValue({
    accounts: [ACCOUNT],
    transactions,
    transactionSplits: [],
    categories: CATEGORIES,
    getSubCategories: walkChildren,
    getDetailCategories: walkChildren,
    ...overrides,
  });
  renderPage();
};

/** Open the list the way a reader does: by pressing its card. */
const openTheList = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /^Filter and file/ }));
};

const typeWords = (value: string): void => {
  fireEvent.change(screen.getByLabelText('Words to look for, filter 1'), { target: { value } });
};

/** One per drawn row, so this counts what is actually on screen. */
const rowDescriptions = (): string[] =>
  screen.queryAllByRole('button', { name: /^Save the category for/ }).map(button => {
    const label = button.getAttribute('aria-label') ?? '';
    return label.replace(/^Save the category for /, '').replace(/ on .*$/, '');
  });

const openList = (): HTMLElement => screen.getByRole('listbox');

const choose = (picker: string | RegExp, option: string | RegExp): void => {
  fireEvent.click(screen.getByLabelText(picker));
  fireEvent.click(within(openList()).getByRole('option', { name: option }));
};

const fileEverythingUnder = (categoryName: string): void => {
  fireEvent.click(screen.getByLabelText(/^Select all/));
  choose('Category to file the selected transactions under', categoryName);
  fireEvent.click(screen.getByRole('button', { name: /^File \d+ transactions?$/ }));
  fireEvent.click(screen.getByRole('button', { name: 'File them' }));
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); __resetAppContextValue(); });

describe('Categorisation — the card that opens the list', () => {
  it('states the size of the job and reveals the list where it stands', () => {
    setup([UNFILED, GUESSED, SETTLED]);

    const card = screen.getByRole('button', { name: /^Filter and file/ });
    // Both of the outstanding rows, and neither of the settled ones — with
    // what "outstanding" covers said on the card, because this count is not
    // the backlog panel's and the difference is exactly the guessed row.
    expect(card).toHaveTextContent('Search the 2 outstanding transactions, tick them, and file them in one press.');
    expect(card).toHaveTextContent('Rows with no category and the app’s own guesses are both here.');
    expect(card).toHaveAttribute('aria-expanded', 'false');
    // Nothing is drawn until it is asked for: this list can be thousands long.
    expect(screen.queryByLabelText('What to filter by, filter 1')).not.toBeInTheDocument();

    fireEvent.click(card);
    expect(card).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('What to filter by, filter 1')).toBeInTheDocument();
    expect(screen.getByText(/Nothing is searched until you ask something/)).toBeInTheDocument();
  });

  it('counts one outstanding row as one', () => {
    setup([UNFILED, SETTLED]);

    expect(screen.getByRole('button', { name: /^Filter and file/ }))
      .toHaveTextContent('Search the one outstanding transaction, tick it, and file it in one press.');
  });

  it('offers no card at all when nothing is waiting', () => {
    setup([SETTLED]);

    // A zero renders nothing (house rule) — and the page says "everything is
    // filed" in its own words instead.
    expect(screen.queryByRole('button', { name: /^Filter and file/ })).not.toBeInTheDocument();
    expect(screen.getByText('Everything is filed')).toBeInTheDocument();
  });

  it('leaves the other two ways through exactly as they were', () => {
    setup([UNFILED, GUESSED]);

    // The owner's ruling: a pair of transfers and a pre-grouped merchant are
    // not a filter list wearing a different hat.
    expect(screen.getByRole('button', { name: /^Match transfers/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Categorise by payee/ })).toBeInTheDocument();
    expect(screen.queryByText('Review one by one')).not.toBeInTheDocument();
  });
});

describe('Categorisation — what the list searches', () => {
  it('takes the blank row and the app\'s guess, and leaves what is settled', () => {
    setup([UNFILED, GUESSED, SETTLED]);
    openTheList();
    typeWords('ashvale');

    expect(rowDescriptions().sort()).toEqual(['Ashvale Garage', 'Ashvale Market']);
  });

  it('leaves transfers out, counts them, and says where they are dealt with', () => {
    setup([UNFILED, MOVED]);
    openTheList();
    typeWords('ashvale');

    expect(rowDescriptions()).toEqual(['Ashvale Market']);
    // Flagged for review and still not listed: a transfer takes no category,
    // so a press here could not land on it.
    expect(screen.getByText(/1 transfer matched and is not shown/)).toBeInTheDocument();
    expect(screen.getByText(/Match transfers, above, is where those are paired up/)).toBeInTheDocument();
  });

  it('says nothing about transfers when the filters caught none', () => {
    setup([UNFILED, MOVED]);
    openTheList();
    typeWords('market');

    // A zero renders nothing: the shortfall sentence appears only when there
    // is a shortfall to explain.
    expect(rowDescriptions()).toEqual(['Ashvale Market']);
    expect(screen.queryByText(/matched and is not shown/)).not.toBeInTheDocument();
  });

  it('names the split lines the backlog counts and this list cannot file', () => {
    setup([UNFILED, SPLIT], { transactionSplits: SPLIT_LINES });

    // Three rows of filing work by the backlog above — one blank row and two
    // unfiled split lines — and one of them this list can settle.
    expect(screen.getByRole('button', { name: /^Filter and file/ }))
      .toHaveTextContent('Search the one outstanding transaction');
    openTheList();
    expect(screen.getByText(/2 of those are lines inside splits and are not listed here/))
      .toBeInTheDocument();
    expect(screen.getByText(/a split line is filed inside its parent/)).toBeInTheDocument();

    // …and neither the lines (whose ids are synthetic) nor their parent (which
    // the database refuses a single category) is in the list.
    typeWords('ashvale');
    expect(rowDescriptions()).toEqual(['Ashvale Market']);
  });

  it('says nothing about splits when there are none', () => {
    setup([UNFILED, GUESSED]);
    openTheList();

    expect(screen.queryByText(/lines inside splits/)).not.toBeInTheDocument();
    expect(screen.queryByText(/a line inside a split/)).not.toBeInTheDocument();
  });

  it('starts each row\'s picker on the app\'s guess, and a blank row blank', () => {
    setup([UNFILED, GUESSED]);
    openTheList();
    typeWords('ashvale');

    expect(screen.getByLabelText(/^Category for Ashvale Garage/))
      .toHaveTextContent('Day to day > Travel');
    expect(screen.getByLabelText(/^Category for Ashvale Market/))
      .toHaveTextContent('Choose a category…');
  });

  it('lets a guess be agreed with as it stands, which changing it never needed', () => {
    setup([UNFILED, GUESSED]);
    openTheList();
    typeWords('ashvale');

    // The guess's category is already right; the decision that is missing is a
    // person's, and making it writes the same three fields. On the
    // housekeeping mount that press would change nothing, and is refused.
    expect(screen.getByLabelText(/^Save the category for Ashvale Garage/)).toBeEnabled();
    // A blank row nobody has chosen for still has nothing to write.
    expect(screen.getByLabelText(/^Save the category for Ashvale Market/)).toBeDisabled();
  });

  it('lets a filter narrow to one guessed category, which is how a feed is reviewed', () => {
    const secondGuess = txn({
      id: 'txn-guessed-2',
      description: 'Ashvale Filling Station',
      category: 'cat-travel',
      categoryConfirmed: false,
      needsReview: true,
    });
    setup([UNFILED, GUESSED, secondGuess]);
    openTheList();
    fireEvent.change(screen.getByLabelText('What to filter by, filter 1'), {
      target: { value: 'category' },
    });
    choose('Current category, filter 1', 'Travel');

    expect(rowDescriptions().sort()).toEqual(['Ashvale Filling Station', 'Ashvale Garage']);
  });
});

describe('Categorisation — filing what the list found', () => {
  it('writes exactly a filing to every ticked row, and deletes nothing', async () => {
    const updateTransaction = vi.fn(async (..._args: unknown[]) => {});
    const deleteTransaction = vi.fn(async () => NO_SURVIVORS);
    setup([UNFILED, GUESSED, SETTLED], { updateTransaction, deleteTransaction });
    openTheList();
    typeWords('ashvale');
    fireEvent.click(screen.getByLabelText(/^Select all/));
    choose('Category to file the selected transactions under', 'Food shopping');
    fireEvent.click(screen.getByRole('button', { name: 'File 2 transactions' }));

    // Nothing is written by opening the question.
    expect(updateTransaction).not.toHaveBeenCalled();
    expect(screen.getByText(/ends their review, replacing any category the app had guessed for them/))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'File them' }));

    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(2));
    // FILING ENDS REVIEW (1 Sep ruling): the category, and both flags.
    expect(updateTransaction).toHaveBeenCalledWith('txn-unfiled', {
      category: 'cat-food', categoryConfirmed: true, needsReview: false,
    });
    expect(updateTransaction).toHaveBeenCalledWith('txn-guessed', {
      category: 'cat-food', categoryConfirmed: true, needsReview: false,
    });
    // THE SAFETY PROPERTY: filing is not a removal.
    expect(deleteTransaction).not.toHaveBeenCalled();
  });

  it('files one row on its own, ending that row\'s review', async () => {
    const updateTransaction = vi.fn(async (..._args: unknown[]) => {});
    const deleteTransaction = vi.fn(async () => NO_SURVIVORS);
    setup([UNFILED], { updateTransaction, deleteTransaction });
    openTheList();
    typeWords('ashvale');
    choose(/^Category for Ashvale Market/, 'Travel');
    fireEvent.click(screen.getByLabelText(/^Save the category for Ashvale Market/));

    await waitFor(() => expect(updateTransaction).toHaveBeenCalledWith('txn-unfiled', {
      category: 'cat-travel', categoryConfirmed: true, needsReview: false,
    }));
    expect(deleteTransaction).not.toHaveBeenCalled();
  });

  it('puts every row back exactly as it was, one shot', async () => {
    const updateTransaction = vi.fn(async (..._args: unknown[]) => {});
    setup([UNFILED, GUESSED], { updateTransaction });
    openTheList();
    typeWords('ashvale');
    fileEverythingUnder('Food shopping');
    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(2));

    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(4));
    // Each row's own state, flags included: a blank row goes back to blank and
    // a guess goes back to being a guess nobody has agreed with.
    expect(updateTransaction).toHaveBeenCalledWith('txn-unfiled', {
      category: '', categoryConfirmed: true, needsReview: false,
    });
    expect(updateTransaction).toHaveBeenCalledWith('txn-guessed', {
      category: 'cat-travel', categoryConfirmed: false, needsReview: true,
    });
    expect(await screen.findByText(/still waiting to be filed/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });

  it('counts the rows the ledger refused and says they are still waiting', async () => {
    const updateTransaction = vi.fn(async (...args: unknown[]) => {
      if (args[0] === 'txn-guessed') throw new Error('the write was refused');
    });
    setup([UNFILED, GUESSED], { updateTransaction });
    openTheList();
    typeWords('ashvale');
    fileEverythingUnder('Food shopping');

    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(2));
    const account = await screen.findByRole('status');
    expect(account.textContent).toContain('1 transaction is now filed under Day to day : Food shopping.');
    expect(account.textContent).toContain('1 could not be filed and is still waiting.');
  });
});

describe('Categorisation — the rows whose category is gone', () => {
  /**
   * THE OTHER END OF THE LOOP (owner, from a user, 1 Sep 2026).
   *
   * This note pointed at Manage → Categories' front door, where the data-health
   * panel said the same thing again and offered a link back here. Two true
   * sentences, a closed circle, and the rows never on screen. The ask now
   * travels in the address, because it has to survive a navigation, and the
   * page it opens shows those rows with their pickers.
   */
  it('carries the ask in the link, so the destination opens on the rows', () => {
    setup([ORPHANED]);

    expect(screen.getByText(/filed\s+under a category that no longer exists/))
      .toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Manage/ }))
      .toHaveAttribute('href', '/settings/categories?refile=dangling');
  });

  it('offers the same filter on THIS mount too — the engine is shared', () => {
    setup([UNFILED, GUESSED]);
    openTheList();

    // The housekeeping mount is where the links land, but a filter kind is a
    // property of the list, not of a page: a dangling row that is still
    // awaiting review is findable from here as well.
    expect(within(screen.getByLabelText('What to filter by, filter 1'))
      .getByRole('option', { name: 'Filed under a category that no longer exists' }))
      .toBeInTheDocument();
  });

  it('says nothing at all when nothing dangles', () => {
    setup([UNFILED, GUESSED]);

    // A zero renders nothing, and no link to a job that does not exist.
    expect(screen.queryByText(/no longer exists/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Manage/ })).not.toBeInTheDocument();
  });
});

describe('Categorisation — what the new card did not take away', () => {
  it('still opens the drill from the account the work is in', () => {
    setup([UNFILED, GUESSED]);

    // The by-account buttons kept the drill when the third card gave it up —
    // the machinery has more than one consumer, and this is the other.
    fireEvent.click(screen.getByRole('button', { name: /^Everyday Account/ }));
    expect(screen.getByText('Uncategorised — Everyday Account')).toBeInTheDocument();
  });
});
