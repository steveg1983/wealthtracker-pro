/**
 * The global Transactions page, brought up to the account register's manners.
 *
 * The owner, on the two lists: "I want the experience to be familiar, between
 * the two." So this file is the parity table, as tests — one describe block per
 * thing a user switching pages would otherwise miss:
 *
 *   selection   a click picks a row out and it floats; the arrows move the
 *               highlight; Enter opens exactly what a click opens; Escape lets
 *               go; and the arrows stand aside while a row's own box has the
 *               cursor;
 *   C/R         Money's two letters, from the shared predicates — R for a
 *               reconciliation that finished, C for a mark made while
 *               balancing, and nothing at all for a row that is neither;
 *   review      a row that arrived and has not been saved is bold, and the To
 *               Review box counts them and narrows to them;
 *   arrival     the ?account= deep link this page has always honoured still
 *               lands on the right account.
 *
 * Every name, date and figure below is invented: this repo is public.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { LayoutProvider } from '../../contexts/LayoutContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { TRANSACTION_ROW_SELECTED_CLASS } from '../../components/TransactionRow';
import Transactions from '../Transactions';
import type { Account, Category, Transaction } from '../../types';

const CURRENT: Account = {
  id: 'acc-current', name: 'Everyday Current', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
};

const SAVINGS: Account = {
  id: 'acc-savings', name: 'Rainy Day Savings', type: 'savings', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-home', name: 'Home', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-repairs', name: 'Repairs', type: 'expense', level: 'detail', parentId: 'grp-home' },
];

const base = {
  amount: -24.5,
  type: 'expense' as const,
  category: 'det-repairs',
  accountId: CURRENT.id,
};

/** Through a finalized reconciliation: the committed state. */
const RECONCILED_ROW: Transaction = {
  ...base, id: 'txn-reconciled', description: 'Halberd Ironmongers',
  date: new Date(Date.UTC(2026, 3, 1)), cleared: true, reconciled: true,
};

/** Ticked off against a statement, but nobody has pressed Finish. */
const MARKED_ROW: Transaction = {
  ...base, id: 'txn-marked', description: 'Pellam Tyres',
  date: new Date(Date.UTC(2026, 3, 2)), cleared: true, reconciled: false,
  accountId: SAVINGS.id,
};

/** Neither marked nor reconciled. */
const UNMARKED_ROW: Transaction = {
  ...base, id: 'txn-unmarked', description: 'Wexford Bakery',
  date: new Date(Date.UTC(2026, 3, 3)), cleared: false, reconciled: false,
};

const ROWS = [RECONCILED_ROW, MARKED_ROW, UNMARKED_ROW];

const renderPage = (entry = '/transactions') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <PreferencesProvider>
        <LayoutProvider>
          <ToastProvider>
            {/* The lazily-loaded transaction editor this page keeps mounted
                asks for notifications the moment its chunk resolves. */}
            <NotificationProvider>
              <Routes>
                <Route path="/transactions" element={<Transactions />} />
              </Routes>
            </NotificationProvider>
          </ToastProvider>
        </LayoutProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );

const seed = (transactions: Transaction[]): void => {
  __setAppContextValue({
    accounts: [CURRENT, SAVINGS],
    transactions,
    categories: CATEGORIES,
    isLoading: false,
  });
};

/**
 * The desktop table. Scoped deliberately: jsdom applies no media queries, so
 * the phone card list is in the document too, and this file is about the table.
 */
const table = (): HTMLElement => screen.getByRole('table', { name: 'Financial transactions' });

/** The table line showing `description`. */
const row = (description: string): HTMLElement => {
  const cell = within(table()).getByText(description);
  const found = cell.closest('tr');
  if (!(found instanceof HTMLElement)) throw new Error(`no table row for "${description}"`);
  return found;
};

/** Is this row wearing the picked-out look? */
const isPickedOut = (line: HTMLElement): boolean =>
  TRANSACTION_ROW_SELECTED_CLASS.split(' ')
    .filter(Boolean)
    .every(utility => line.classList.contains(utility));

const openPage = async (entry?: string): Promise<void> => {
  renderPage(entry);
  await screen.findByRole('table', { name: 'Financial transactions' });
};

beforeEach(() => {
  localStorage.clear();
  seed(ROWS);
});

afterEach(() => {
  __resetAppContextValue();
});

describe('Transactions page — picking a row out', () => {
  it('highlights the row a click lands on, and says so to a screen reader', async () => {
    await openPage();

    const line = row('Wexford Bakery');
    expect(isPickedOut(line)).toBe(false);

    fireEvent.click(line);

    expect(isPickedOut(line)).toBe(true);
    // Bold is not the marker here — weight already says "this arrived and has
    // not been reviewed" — so the fact is carried in the markup as well.
    expect(line).toHaveAttribute('aria-current', 'true');
    // And the click hands the keyboard to the row it picked out, so the arrows
    // are live on it without a second gesture. (jsdom does not focus on click
    // of its own accord, so this is asserting the page's own call.)
    expect(line).toHaveFocus();
  });

  it('holds the highlight on ONE row at a time', async () => {
    await openPage();

    fireEvent.click(row('Wexford Bakery'));
    fireEvent.click(row('Pellam Tyres'));

    expect(isPickedOut(row('Pellam Tyres'))).toBe(true);
    expect(isPickedOut(row('Wexford Bakery'))).toBe(false);
  });

  it('moves the highlight down and up with the arrow keys', async () => {
    await openPage();

    // Newest first, which is this page's default sort: Wexford, Pellam,
    // Halberd. So down from the first is Pellam.
    const first = row('Wexford Bakery');
    fireEvent.click(first);

    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(isPickedOut(row('Pellam Tyres'))).toBe(true);

    fireEvent.keyDown(row('Pellam Tyres'), { key: 'ArrowUp' });
    expect(isPickedOut(row('Wexford Bakery'))).toBe(true);
  });

  it('stops at the ends rather than wrapping', async () => {
    await openPage();

    const first = row('Wexford Bakery');
    fireEvent.click(first);
    fireEvent.keyDown(first, { key: 'ArrowUp' });

    // Still the first row: a list that wrapped would teleport the user to the
    // far end of a statement they were reading down.
    expect(isPickedOut(row('Wexford Bakery'))).toBe(true);
  });

  /**
   * The mouse's destination and the keyboard's, asserted apart so that neither
   * can be the other's leftovers.
   *
   * They are one call in the page (handleView), and these two tests are what
   * says so: the same panel, naming the same transaction, reached both ways.
   */
  it('opens the transaction when its description is clicked', async () => {
    await openPage();

    fireEvent.click(within(row('Wexford Bakery')).getByText('Wexford Bakery'));

    const panel = (await screen.findByRole('heading', { name: 'Transaction Details' })).closest('div.fixed');
    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).getByText('Wexford Bakery')).toBeInTheDocument();
  });

  it('opens the same transaction when Enter is pressed on the highlighted row', async () => {
    await openPage();

    const line = row('Wexford Bakery');
    fireEvent.click(line);
    // Nothing is open yet: picking a row out is not opening it.
    expect(screen.queryByRole('heading', { name: 'Transaction Details' })).not.toBeInTheDocument();

    fireEvent.keyDown(line, { key: 'Enter' });

    const panel = (await screen.findByRole('heading', { name: 'Transaction Details' })).closest('div.fixed');
    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).getByText('Wexford Bakery')).toBeInTheDocument();
  });

  it('opens the row on a second click, the way the register does', async () => {
    await openPage();

    const line = row('Wexford Bakery');
    fireEvent.click(line);
    expect(screen.queryByRole('heading', { name: 'Transaction Details' })).not.toBeInTheDocument();

    fireEvent.click(line);

    expect(await screen.findByRole('heading', { name: 'Transaction Details' })).toBeInTheDocument();
  });

  it('lets go of the row on Escape', async () => {
    await openPage();

    const line = row('Wexford Bakery');
    fireEvent.click(line);
    expect(isPickedOut(line)).toBe(true);

    fireEvent.keyDown(line, { key: 'Escape' });

    expect(isPickedOut(row('Wexford Bakery'))).toBe(false);
    expect(row('Wexford Bakery')).not.toHaveAttribute('aria-current');
  });

  it('leaves the arrows alone while a row is being typed in', async () => {
    await openPage();

    const line = row('Wexford Bakery');
    fireEvent.click(line);

    // Turn the category cell into its picker — the row now holds a control
    // with the cursor in it.
    fireEvent.click(within(line).getByRole('button', { name: /Change category/ }));
    const picker = within(row('Wexford Bakery')).getByRole('combobox');

    fireEvent.keyDown(picker, { key: 'ArrowDown' });

    // The highlight has not moved: ArrowDown in a picker belongs to the picker.
    expect(isPickedOut(row('Wexford Bakery'))).toBe(true);
    expect(isPickedOut(row('Pellam Tyres'))).toBe(false);
  });

  it('leaves the row alone when the click was on one of its own buttons', async () => {
    await openPage();

    const line = row('Wexford Bakery');
    fireEvent.click(within(line).getByTestId('edit-button'));

    // Edit means edit. A button that also picked its row out would make every
    // action a two-part gesture.
    expect(isPickedOut(row('Wexford Bakery'))).toBe(false);
  });

  it('offers the keyboard exactly one way in, however many rows there are', async () => {
    await openPage();

    // Roving tabindex: one tab stop for the whole table, the rest reached with
    // the arrows.
    const stops = within(table()).getAllByRole('row').filter(line => line.getAttribute('tabindex') === '0');
    expect(stops).toHaveLength(1);
  });
});

describe('Transactions page — the C/R column', () => {
  it('heads the column with both letters', async () => {
    await openPage();

    expect(within(table()).getByRole('columnheader', { name: /C\/R column/ })).toBeInTheDocument();
  });

  it('shows R for a row a reconciliation finished', async () => {
    await openPage();

    expect(within(row('Halberd Ironmongers')).getByTitle('Reconciled')).toHaveTextContent('R');
  });

  it('shows C for a row that is marked but not reconciled', async () => {
    await openPage();

    // The discrimination this column exists for: a working mark must not read
    // as settled work. One tick for both was the bug.
    const marked = within(row('Pellam Tyres'));
    expect(marked.getByTitle(/not reconciled until you finalize/)).toHaveTextContent('C');
    expect(marked.queryByTitle('Reconciled')).not.toBeInTheDocument();
  });

  it('shows nothing at all for a row that is neither', async () => {
    await openPage();

    const untouched = within(row('Wexford Bakery'));
    expect(untouched.queryByTitle('Reconciled')).not.toBeInTheDocument();
    expect(untouched.queryByTitle(/not reconciled until you finalize/)).not.toBeInTheDocument();
  });
});

describe('Transactions page — rows that have just arrived', () => {
  const NEW_ROW: Transaction = {
    ...base, id: 'txn-new', description: 'Calder Street Market',
    date: new Date(Date.UTC(2026, 3, 4)), cleared: false, needsReview: true,
  };
  const SAVED_ROW: Transaction = {
    ...base, id: 'txn-saved', description: 'Ordsall Fuel',
    date: new Date(Date.UTC(2026, 3, 5)), cleared: false, needsReview: false,
  };

  /**
   * Read off the two cells that carry the weight — the ones at opposite ends of
   * the line, which is what makes the whole row read as bold at a glance — and
   * they must agree. A row bold in one and not the other is a half-applied rule.
   */
  const isBold = (description: string): boolean => {
    const line = row(description);
    const descriptionSpan = within(line).getByText(description);
    const dateSpan = line.querySelector('td span');
    const dateBold = dateSpan?.className.includes('font-semibold') ?? false;
    const descriptionBold = descriptionSpan.className.includes('font-semibold');
    if (dateBold !== descriptionBold) {
      throw new Error(`"${description}": date and description disagree about being new`);
    }
    return descriptionBold;
  };

  it('prints a new row in bold, date and description together', async () => {
    seed([NEW_ROW, SAVED_ROW, UNMARKED_ROW]);
    await openPage();

    expect(isBold('Calder Street Market')).toBe(true);
  });

  it('leaves a row somebody has already saved alone', async () => {
    seed([NEW_ROW, SAVED_ROW, UNMARKED_ROW]);
    await openPage();

    // A list that marks every row marks nothing.
    expect(isBold('Ordsall Fuel')).toBe(false);
  });

  it('treats a row with no review flag at all as already dealt with', async () => {
    seed([NEW_ROW, SAVED_ROW, UNMARKED_ROW]);
    await openPage();

    // The load-bearing asymmetry: only `true` means new. A database without the
    // migration returns no such key, and reading that as new would print a
    // whole imported history in bold on the day of the deploy.
    expect(isBold('Wexford Bakery')).toBe(false);
  });

  it('says it in words as well, for anyone who cannot see weight', async () => {
    seed([NEW_ROW, SAVED_ROW, UNMARKED_ROW]);
    await openPage();

    expect(within(row('Calder Street Market')).getByText(/new, not reviewed yet/)).toBeInTheDocument();
  });

  it('counts them in a To Review box, and narrows the list to them', async () => {
    seed([NEW_ROW, SAVED_ROW, UNMARKED_ROW]);
    await openPage();

    const box = screen.getByRole('button', { name: /To Review/ });
    expect(box).toHaveTextContent('1');
    expect(box).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(box);

    await waitFor(() => {
      expect(within(table()).queryByText('Ordsall Fuel')).not.toBeInTheDocument();
    });
    expect(within(table()).getByText('Calder Street Market')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /To Review/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('gives the whole list back when the box is pressed again', async () => {
    seed([NEW_ROW, SAVED_ROW, UNMARKED_ROW]);
    await openPage();

    fireEvent.click(screen.getByRole('button', { name: /To Review/ }));
    fireEvent.click(screen.getByRole('button', { name: /To Review/ }));

    await waitFor(() => {
      expect(within(table()).getByText('Ordsall Fuel')).toBeInTheDocument();
    });
  });

  it('renders nothing at all when there is nothing to review', async () => {
    seed([SAVED_ROW, UNMARKED_ROW]);
    await openPage();

    // A permanent box reading 0 is a box the eye learns to skip, and then it
    // says nothing on the day it reads 40. Its absence is the "all done".
    expect(screen.queryByRole('button', { name: /To Review/ })).not.toBeInTheDocument();
  });
});

describe('Transactions page — arriving from somewhere else', () => {
  it('still lands filtered to the account a deep link named', async () => {
    await openPage(`/transactions?account=${SAVINGS.id}`);

    // The only arrival this page has ever honoured, and it has to survive the
    // selection work: ?txn= deep links go to the account register (see
    // utils/transactionDeepLink), never here.
    await waitFor(() => {
      expect(within(table()).getByText('Pellam Tyres')).toBeInTheDocument();
    });
    expect(within(table()).queryByText('Wexford Bakery')).not.toBeInTheDocument();
    expect(screen.getByText(/Showing transactions for/)).toHaveTextContent(SAVINGS.name);
  });
});
