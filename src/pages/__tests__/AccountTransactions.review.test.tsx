/**
 * The account register's review flow — Microsoft Money's bold, brought back.
 *
 * The owner's requirement, in his words: imported transactions "are 'new' and
 * render BOLD in the account register until reviewed"; there is "a 'To Review'
 * counter in a box next to the View dropdown"; clicking it "FILTERS the
 * register to only unreviewed rows" and clicking again clears the filter.
 *
 * And the precise semantics, which is the part that is easy to get wrong: a row
 * stops being new ONLY when a save button commits it. Opening the editor and
 * pressing Escape leaves it bold and the counter where it was. EDITING IS NOT
 * REVIEWING; SAVING IS.
 *
 * So this file is the semantics table:
 *
 *   bold        a new row's date and description are bold, a reviewed row's are
 *               not, and a row with no flag at all reads as reviewed;
 *   counter     counts this account's new rows, and renders NOTHING at zero;
 *   filter      one click narrows the register to them, a second clears it, and
 *               the button says which state it is in (aria-pressed);
 *   Save        writes needs_review = false;
 *   Save & Next writes needs_review = false;
 *   Confirm     goes through the confirm operation, which clears it server-side;
 *   Escape      writes nothing at all.
 *
 * Every name, date and figure below is invented: this repo is public.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { DataService } from '../../services/api/dataService';
import AccountTransactions from '../AccountTransactions';
import type { Account, Category, Transaction } from '../../types';

const ACCOUNT: Account = {
  id: 'acc-register', name: 'Synthetic Register', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 100, isActive: true,
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'det-takeaway', name: 'Takeaway', type: 'expense', level: 'detail', parentId: 'grp-food' },
];

const base = {
  amount: -18.4,
  type: 'expense' as const,
  category: 'det-groceries',
  accountId: ACCOUNT.id,
  cleared: false,
};

/** Arrived on a statement this morning; nobody has touched it. */
const NEW_ROW: Transaction = {
  ...base, id: 'txn-new', description: 'Marsh Lane Grocer',
  date: new Date(Date.UTC(2026, 2, 1)), needsReview: true,
};

/** Arrived, and the user has since saved it. */
const REVIEWED_ROW: Transaction = {
  ...base, id: 'txn-reviewed', description: 'Portway Hardware',
  date: new Date(Date.UTC(2026, 2, 2)), needsReview: false,
};

/** No flag at all — a pre-migration row, or one from the local/demo store. */
const UNMARKED_ROW: Transaction = {
  ...base, id: 'txn-unmarked', description: 'Cranbourne Dairy',
  date: new Date(Date.UTC(2026, 2, 3)),
};

const ROWS = [NEW_ROW, REVIEWED_ROW, UNMARKED_ROW];

const updateTransaction = vi.fn(async () => {});
const confirmTransactionCategories = vi.fn(async () => 1);

const renderRegister = () =>
  render(
    <MemoryRouter initialEntries={[`/accounts/${ACCOUNT.id}`]}>
      <PreferencesProvider>
        <ToastProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/accounts/:accountId" element={<AccountTransactions />} />
            </Routes>
          </NotificationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );

/**
 * The desktop register. Scoped deliberately: jsdom applies no media queries, so
 * the phone card list is in the document too, and this file is about the table.
 */
const grid = (): HTMLElement => screen.getByRole('grid', { name: 'Synthetic Register transactions' });

/** The register line showing `description`. */
const row = (description: string): HTMLElement => {
  const cell = within(grid()).getByText(description);
  const found = cell.closest('[role="row"]');
  if (!(found instanceof HTMLElement)) throw new Error(`no register row for "${description}"`);
  return found;
};

/**
 * Is this row drawn as new?
 *
 * Read off the two cells that carry the weight — the ones at opposite ends of
 * the line, which is what makes the whole line read as bold at a glance — and
 * they must agree. A row bold in one and not the other is a half-applied rule.
 */
const isBold = (description: string): boolean => {
  const line = row(description);
  const descriptionSpan = within(line).getByText(description);
  const dateCell = line.querySelector('[role="gridcell"] span');
  const dateBold = dateCell?.className.includes('font-semibold') ?? false;
  const descriptionBold = descriptionSpan.className.includes('font-semibold');
  if (dateBold !== descriptionBold) {
    throw new Error(`"${description}": date and description disagree about being new`);
  }
  return descriptionBold;
};

const toReviewButton = (): HTMLElement => screen.getByRole('button', { name: /To Review/ });
const queryToReviewButton = (): HTMLElement | null => screen.queryByRole('button', { name: /To Review/ });

const strip = (): HTMLElement => {
  const el = document.querySelector('[data-quick-edit="actions"]');
  if (!(el instanceof HTMLElement)) throw new Error('no row is being edited');
  return el;
};

const openRegister = async (): Promise<void> => {
  renderRegister();
  await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
};

const seed = (transactions: Transaction[]): void => {
  __setAppContextValue({
    accounts: [ACCOUNT],
    transactions,
    categories: CATEGORIES,
    isLoading: false,
    updateTransaction,
    confirmTransactionCategories,
    getSubCategories: (parentId?: string) => CATEGORIES.filter(c => c.level === 'sub' && c.parentId === parentId),
    getDetailCategories: (parentId?: string) => CATEGORIES.filter(c => c.level === 'detail' && c.parentId === parentId),
  });
};

beforeEach(() => {
  localStorage.clear();
  updateTransaction.mockClear();
  confirmTransactionCategories.mockClear();
  seed(ROWS);
  vi.spyOn(DataService, 'listClosedAccounts').mockResolvedValue([]);
});

afterEach(() => {
  vi.mocked(DataService.listClosedAccounts).mockRestore();
  __resetAppContextValue();
});

describe('Account register — a row that has just arrived', () => {
  it('prints it in bold, date and description together', async () => {
    await openRegister();

    expect(isBold('Marsh Lane Grocer')).toBe(true);
  });

  it('leaves a row the user has already dealt with alone', async () => {
    await openRegister();

    // A register that marks every row marks nothing.
    expect(isBold('Portway Hardware')).toBe(false);
  });

  it('treats a row with no review flag as already dealt with', async () => {
    await openRegister();

    // The load-bearing asymmetry: only `true` means new. A database without the
    // migration returns no such key, and reading that as new would print fifty
    // thousand rows of history in bold on the day of the deploy.
    expect(isBold('Cranbourne Dairy')).toBe(false);
  });

  it('says so in words as well, for anyone who cannot see weight', async () => {
    await openRegister();

    // Bold is a visual cue and nothing else — invisible to a screen reader, and
    // to anyone reading one row at a time in a magnifier (WCAG 1.4.1).
    expect(within(row('Marsh Lane Grocer')).getByText(/awaiting review/)).toBeInTheDocument();
    expect(within(row('Portway Hardware')).queryByText(/awaiting review/)).not.toBeInTheDocument();
  });
});

describe('Account register — the To Review counter', () => {
  it('states how many of this account\'s rows are waiting', async () => {
    await openRegister();

    expect(toReviewButton()).toHaveTextContent('1');
  });

  it('renders nothing at all when there is nothing to review', async () => {
    // The house rule: a zero count renders nothing. A permanent box reading 0
    // is a box the eye learns to skip, and then it says nothing on the day it
    // reads 40. Its absence IS the "all done".
    seed([REVIEWED_ROW, UNMARKED_ROW]);
    await openRegister();

    expect(queryToReviewButton()).not.toBeInTheDocument();
  });

  it('starts unpressed — the register shows everything until asked', async () => {
    await openRegister();

    expect(toReviewButton()).toHaveAttribute('aria-pressed', 'false');
    expect(within(grid()).getByText('Portway Hardware')).toBeInTheDocument();
  });

  it('narrows the register to the waiting rows when clicked', async () => {
    await openRegister();

    fireEvent.click(toReviewButton());

    expect(toReviewButton()).toHaveAttribute('aria-pressed', 'true');
    expect(within(grid()).getByText('Marsh Lane Grocer')).toBeInTheDocument();
    expect(within(grid()).queryByText('Portway Hardware')).not.toBeInTheDocument();
    expect(within(grid()).queryByText('Cranbourne Dairy')).not.toBeInTheDocument();
  });

  it('is a toggle: a second click puts every row back', async () => {
    await openRegister();

    fireEvent.click(toReviewButton());
    fireEvent.click(toReviewButton());

    expect(toReviewButton()).toHaveAttribute('aria-pressed', 'false');
    expect(within(grid()).getByText('Portway Hardware')).toBeInTheDocument();
    expect(within(grid()).getByText('Cranbourne Dairy')).toBeInTheDocument();
  });

  it('keeps stating the same number while it is filtering', async () => {
    // The count is taken BEFORE this filter is applied. If it were taken after,
    // pressing the button would change the number the button is showing, which
    // is a control arguing with itself.
    await openRegister();

    fireEvent.click(toReviewButton());

    expect(toReviewButton()).toHaveTextContent('1');
  });

  it('lets go of the filter when the last row is dealt with', async () => {
    // Otherwise finishing the job leaves an empty register and no button to
    // press: the box hides itself at zero, taking the only way back with it.
    const { rerender } = renderRegister();
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    fireEvent.click(toReviewButton());
    expect(within(grid()).queryByText('Portway Hardware')).not.toBeInTheDocument();

    seed([{ ...NEW_ROW, needsReview: false }, REVIEWED_ROW, UNMARKED_ROW]);
    rerender(
      <MemoryRouter initialEntries={[`/accounts/${ACCOUNT.id}`]}>
        <PreferencesProvider>
          <ToastProvider>
            <NotificationProvider>
              <Routes>
                <Route path="/accounts/:accountId" element={<AccountTransactions />} />
              </Routes>
            </NotificationProvider>
          </ToastProvider>
        </PreferencesProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(queryToReviewButton()).not.toBeInTheDocument());
    expect(within(grid()).getByText('Portway Hardware')).toBeInTheDocument();
  });
});

describe('Account register — what ends a review, and what does not', () => {
  it('Save records that the row has been dealt with', async () => {
    await openRegister();

    fireEvent.click(within(grid()).getByText('Marsh Lane Grocer'));
    fireEvent.click(within(strip()).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(1));
    expect(updateTransaction.mock.calls[0][0]).toBe('txn-new');
    expect(updateTransaction.mock.calls[0][1]).toMatchObject({ needsReview: false });
  });

  it('Save & Next records it too — a run of rows is a run of reviews', async () => {
    await openRegister();

    fireEvent.click(within(grid()).getByText('Marsh Lane Grocer'));
    fireEvent.click(within(strip()).getByRole('button', { name: 'Save & Next' }));

    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(1));
    expect(updateTransaction.mock.calls[0][1]).toMatchObject({ needsReview: false });
  });

  /**
   * Confirm counts as reviewing, and it is the ONE write that does so without
   * going through the ordinary save path.
   *
   * The justification is that the row is open in front of the user and Confirm
   * answers the question that row was asking — it is the one-click form of the
   * Save that would otherwise have followed. Doing it inside the confirm
   * operation rather than firing a second write after it is also the only
   * honest mechanism: one click must be one write, or a confirm is two audit
   * entries and a race with itself. The clearing itself is pinned on the seam
   * (services/port/__tests__/contract.ts) and in the store; what is proved here
   * is that the register reaches for that operation and not for a save.
   */
  it('Confirm answers the row through the confirm operation, not through a save', async () => {
    seed([{ ...NEW_ROW, categoryConfirmed: false }, REVIEWED_ROW, UNMARKED_ROW]);
    await openRegister();

    fireEvent.click(within(grid()).getByText('Marsh Lane Grocer'));
    fireEvent.click(within(strip()).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(confirmTransactionCategories).toHaveBeenCalledWith(['txn-new']));
    expect(updateTransaction).not.toHaveBeenCalled();
  });

  it('Escape leaves the row exactly as it found it', async () => {
    await openRegister();

    fireEvent.click(within(grid()).getByText('Marsh Lane Grocer'));
    expect(document.querySelector('[data-quick-edit="actions"]')).not.toBeNull();

    fireEvent.keyDown(screen.getByLabelText('Transaction description'), { key: 'Escape' });

    // Nothing was written at all — so nothing decided the row had been dealt
    // with. Looking at a transaction is not the same as finishing with it.
    expect(updateTransaction).not.toHaveBeenCalled();
    expect(isBold('Marsh Lane Grocer')).toBe(true);
    expect(toReviewButton()).toHaveTextContent('1');
  });

  it('closing the editor with the × leaves it alone as well', async () => {
    await openRegister();

    fireEvent.click(within(grid()).getByText('Marsh Lane Grocer'));
    fireEvent.click(within(strip()).getByRole('button', { name: /Stop editing/i }));

    expect(updateTransaction).not.toHaveBeenCalled();
    expect(isBold('Marsh Lane Grocer')).toBe(true);
    expect(toReviewButton()).toHaveTextContent('1');
  });
});

describe('Account register — a review round sent from the focused accounts list', () => {
  /**
   * The owner's flow (19 Aug): press "Review x transactions" on Accounts,
   * pick an account's To Review count, deal with its arrivals — and land
   * BACK on the focused list to pick the next account, not in the register
   * just cleared. The link carries `back=accounts-review`; the register
   * consumes it like every other deep-link param and, when the queue
   * empties WHILE the filter is on, goes home to `/accounts?focus=review`.
   */
  const AccountsProbe = (): React.JSX.Element => {
    const location = useLocation();
    return <div data-testid="accounts-probe">{location.search}</div>;
  };

  const roundTree = (search: string): React.JSX.Element => (
    <MemoryRouter initialEntries={[`/accounts/${ACCOUNT.id}${search}`]}>
      <PreferencesProvider>
        <ToastProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/accounts/:accountId" element={<AccountTransactions />} />
              <Route path="/accounts" element={<AccountsProbe />} />
            </Routes>
          </NotificationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );

  it('returns to the focused list when the queue empties — not to the register just cleared', async () => {
    const view = render(roundTree('?review=1&back=accounts-review'));
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });
    // Arrived filtered to the one arrival.
    await waitFor(() => {
      expect(within(grid()).queryByText('Portway Hardware')).not.toBeInTheDocument();
    });
    expect(within(grid()).getByText('Marsh Lane Grocer')).toBeInTheDocument();

    // The ledger now holds that arrival dealt with — the queue is empty.
    seed(ROWS.map(r => (r.id === 'txn-new' ? { ...r, needsReview: false } : r)));
    view.rerender(roundTree('?review=1&back=accounts-review'));

    await waitFor(() => {
      expect(screen.getByTestId('accounts-probe')).toHaveTextContent('focus=review');
    });
  });

  it('without the marker, an emptied queue keeps you in the register, filter quietly off', async () => {
    const view = render(roundTree('?review=1'));
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Register' });

    seed(ROWS.map(r => (r.id === 'txn-new' ? { ...r, needsReview: false } : r)));
    view.rerender(roundTree('?review=1'));

    // The register stays; every row shows again; nobody is teleported.
    await waitFor(() => {
      expect(within(grid()).getByText('Portway Hardware')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('accounts-probe')).not.toBeInTheDocument();
  });
});
