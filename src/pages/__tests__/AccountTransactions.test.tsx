import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { DataService } from '../../services/api/dataService';
import AccountTransactions from '../AccountTransactions';
import type { Account, Category, Transaction } from '../../types';

/**
 * What the register does with an account id it cannot find in the open list.
 *
 * The app context carries only OPEN accounts, so every jump into a CLOSED
 * account's register — the payee drill, a report drill, a transfer's other
 * side, a bookmark — used to land on a bare "Account not found". Closing an
 * account keeps every transaction, so that page was simply wrong. There are
 * three states now: open (the register), closed (an honest page offering the
 * re-open, the Accounts-page rule), and genuinely gone.
 *
 * Closed accounts load from DataService.getClosedAccounts — not the context —
 * so they are injected by spying on that call. Every figure and name here is
 * synthetic (this repo is public).
 */

const OPEN_ACCOUNT: Account = {
  id: 'acc-open', name: 'Synthetic Current', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
};

const CLOSED_ACCOUNT: Account = {
  id: 'acc-closed', name: 'Retired Savings', type: 'savings', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: false,
};

// Bank details on show in the register header. A card stores (and is shown)
// its last 4 digits; a bank account's 8 digits are the whole number.
const CARD_ACCOUNT: Account = {
  id: 'acc-card', name: 'Synthetic Card', type: 'credit', balance: 0,
  currency: 'GBP', lastUpdated: new Date('2026-01-01'), openingBalance: 0, isActive: true,
  accountNumber: '9012',
};

const DETAILED_ACCOUNT: Account = {
  ...OPEN_ACCOUNT, sortCode: '12-34-56', accountNumber: '12345678',
};

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'grp-food' },
];

const OPEN_ROW: Transaction = {
  id: 'txn-open', date: new Date('2026-02-02'), description: 'Synthetic open row',
  amount: -12.5, type: 'expense', category: 'det-groceries', accountId: 'acc-open', cleared: false,
};

const CLOSED_ROW: Transaction = {
  id: 'txn-closed', date: new Date('2026-02-03'), description: 'Synthetic closed row',
  amount: -30, type: 'expense', category: 'det-groceries', accountId: 'acc-closed', cleared: false,
};

const updateAccount = vi.fn(async () => {});
const refreshCategories = vi.fn(async () => {});
// The reopen's re-pull, as the real context does it: the account leaves the
// closed list and joins the open one.
const refreshAccountsAndTransactions = vi.fn(async () => {
  __setAppContextValue({ accounts: [OPEN_ACCOUNT, { ...CLOSED_ACCOUNT, isActive: true }] });
});

const renderRegister = (path: string): void => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <PreferencesProvider>
        {/* The reopen reports failures through the app's toasts, and a selected
            row's editor raises transaction notifications — the same provider
            stack the route sits in. */}
        <ToastProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/accounts" element={<div>Accounts page</div>} />
              <Route path="/accounts/:accountId" element={<AccountTransactions />} />
            </Routes>
          </NotificationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

const reopenButton = (): HTMLElement => screen.getByRole('button', { name: 'Re-open and view' });

describe('Account register — open, closed, and gone', () => {
  beforeEach(() => {
    localStorage.clear();
    updateAccount.mockClear();
    refreshCategories.mockClear();
    refreshAccountsAndTransactions.mockClear();
    __setAppContextValue({
      accounts: [OPEN_ACCOUNT],
      transactions: [OPEN_ROW, CLOSED_ROW],
      categories: CATEGORIES,
      isLoading: false,
      updateAccount,
      refreshCategories,
      refreshAccountsAndTransactions,
    });
    vi.spyOn(DataService, 'getClosedAccounts').mockResolvedValue([CLOSED_ACCOUNT]);
  });

  afterEach(() => {
    // Only the closed-accounts spy is restored. vi.restoreAllMocks() would
    // also strip the shared setup's window.matchMedia implementation, and the
    // register's row components read prefers-reduced-motion through it.
    vi.mocked(DataService.getClosedAccounts).mockRestore();
    __resetAppContextValue();
  });

  it('renders the register for an open account, without asking for the closed list', async () => {
    renderRegister('/accounts/acc-open');

    expect(await screen.findByRole('heading', { level: 1, name: 'Synthetic Current' })).toBeInTheDocument();
    // The row is on show (the phone list and the desktop table both render it).
    expect(screen.getAllByText('Synthetic open row').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Re-open and view' })).not.toBeInTheDocument();
    // An ordinary register costs no extra request: the lookup only fires on a miss.
    expect(DataService.getClosedAccounts).not.toHaveBeenCalled();
  });

  it('meets a closed account with its name and the re-open offer, not its transactions', async () => {
    renderRegister('/accounts/acc-closed');

    // Named, so the user knows which account they have landed on…
    expect(await screen.findByRole('heading', { level: 1, name: 'Retired Savings' })).toBeInTheDocument();
    // …and told what is true: closed, no register, history intact.
    expect(screen.getByText(/closed accounts don’t have an open register/i)).toBeInTheDocument();
    expect(screen.getByText(/every transaction is preserved either way/i)).toBeInTheDocument();
    expect(reopenButton()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Accounts' })).toBeInTheDocument();

    // The register itself stays shut — closed accounts are not browsable.
    expect(screen.queryByText('Synthetic closed row')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Search & filters/ })).not.toBeInTheDocument();
    // Never the old dead end.
    expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
  });

  it('says an account is gone only when it is in neither list', async () => {
    vi.spyOn(DataService, 'getClosedAccounts').mockResolvedValue([]);
    renderRegister('/accounts/acc-vanished');

    expect(await screen.findByText('This account no longer exists')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to Accounts' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Re-open and view' })).not.toBeInTheDocument();
  });

  it('waits for the closed list rather than flashing an error at an account that exists', async () => {
    let release: (accounts: Account[]) => void = () => {};
    vi.spyOn(DataService, 'getClosedAccounts').mockReturnValue(
      new Promise<Account[]>(resolve => { release = resolve; })
    );

    renderRegister('/accounts/acc-closed');

    // In flight: no verdict either way.
    expect(await screen.findByText('Loading account…')).toBeInTheDocument();
    expect(screen.queryByText('This account no longer exists')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Re-open and view' })).not.toBeInTheDocument();

    release([CLOSED_ACCOUNT]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Retired Savings' })).toBeInTheDocument();
    expect(screen.queryByText('Loading account…')).not.toBeInTheDocument();
  });

  it('waits while the open list is still arriving', async () => {
    __setAppContextValue({ accounts: [], isLoading: true });
    renderRegister('/accounts/acc-open');

    expect(await screen.findByText('Loading account…')).toBeInTheDocument();
    // Nothing is decided yet, so nothing is asked of the server either.
    expect(DataService.getClosedAccounts).not.toHaveBeenCalled();
  });

  it('re-opens the account through the context, then renders its register in place', async () => {
    renderRegister('/accounts/acc-closed');
    fireEvent.click(await screen.findByRole('button', { name: 'Re-open and view' }));

    await waitFor(() => {
      expect(updateAccount).toHaveBeenCalledWith('acc-closed', { isActive: true });
    });
    // The Accounts page's recipe: re-pull the open list (closed accounts are
    // filtered out at load) and the categories (the DB trigger re-activated
    // the account's transfer category).
    await waitFor(() => {
      expect(refreshAccountsAndTransactions).toHaveBeenCalledTimes(1);
      expect(refreshCategories).toHaveBeenCalledTimes(1);
    });

    // The user stays put and the register takes over — no second navigation.
    expect(await screen.findByRole('button', { name: /Search & filters/ })).toBeInTheDocument();
    expect(screen.getAllByText('Synthetic closed row').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Re-open and view' })).not.toBeInTheDocument();
  });

  it('keeps the ?txn deep link across the re-open', async () => {
    renderRegister('/accounts/acc-closed?txn=txn-closed');

    const button = await screen.findByRole('button', { name: 'Re-open and view' });
    // mousedown as well as click: the register's click-outside-to-deselect
    // handler listens on mousedown, and pressing this very button used to be
    // "outside" — which would have thrown away the row the link asked for.
    fireEvent.mouseDown(button);
    fireEvent.click(button);

    // The deep-linked row arrives selected, with its quick-edit box open on it.
    const box = await waitFor(() => {
      const el = document.querySelector('[data-quick-edit-panel]');
      if (!(el instanceof HTMLElement)) throw new Error('no quick-edit box is showing');
      return el;
    });
    expect(within(box).getByLabelText('Description')).toHaveValue('Synthetic closed row');
  });

  it('leaves the account closed when the re-open fails', async () => {
    updateAccount.mockRejectedValueOnce(new Error('network is down'));
    renderRegister('/accounts/acc-closed');

    fireEvent.click(await screen.findByRole('button', { name: 'Re-open and view' }));

    await waitFor(() => {
      expect(refreshAccountsAndTransactions).not.toHaveBeenCalled();
    });
    // Still the offer, not a half-open register — and the button is usable again.
    expect(reopenButton()).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Search & filters/ })).not.toBeInTheDocument();
  });

  describe('the account number in the header', () => {
    it('shows a card as XXXX XXXX XXXX 1234', async () => {
      __setAppContextValue({ accounts: [CARD_ACCOUNT], transactions: [] });
      renderRegister('/accounts/acc-card');

      expect(await screen.findByText('XXXX XXXX XXXX 9012')).toBeInTheDocument();
      // Never the bare four, which reads like a number that got cut off.
      expect(screen.queryByText('9012')).not.toBeInTheDocument();
    });

    it('shows only the last 4 of a card row written before the rule existed', async () => {
      __setAppContextValue({
        accounts: [{ ...CARD_ACCOUNT, accountNumber: '4929123456789012' }],
        transactions: []
      });
      renderRegister('/accounts/acc-card');

      expect(await screen.findByText('XXXX XXXX XXXX 9012')).toBeInTheDocument();
      expect(screen.queryByText('4929123456789012')).not.toBeInTheDocument();
    });

    it('leaves a bank account number alone — it is not a card number', async () => {
      __setAppContextValue({ accounts: [DETAILED_ACCOUNT], transactions: [] });
      renderRegister('/accounts/acc-open');

      expect(await screen.findByText('12345678')).toBeInTheDocument();
      expect(screen.getByText('12-34-56')).toBeInTheDocument();
      expect(screen.queryByText(/^XXXX/)).not.toBeInTheDocument();
    });

    it('renders no number at all when the account has none', async () => {
      __setAppContextValue({ accounts: [{ ...CARD_ACCOUNT, accountNumber: undefined }], transactions: [] });
      renderRegister('/accounts/acc-card');

      expect(await screen.findByRole('heading', { level: 1, name: 'Synthetic Card' })).toBeInTheDocument();
      expect(screen.queryByText(/^XXXX/)).not.toBeInTheDocument();
    });
  });
});

/**
 * The running Balance column, against the order the rows are actually in.
 *
 * The register accumulated balances with one local sort and displayed rows with
 * another, and the sort it used ordered a day by TYPE — income, then transfers,
 * then expenses. Two things were wrong at once: the display sequence did not
 * match the sequence the balances were computed in, and the sequence itself was
 * invented.
 *
 * The days below reproduce the SHAPE of the account that exposed it — one that
 * runs an automated two-way sweep with a linked savings account: ordinary
 * transactions through the day, then ONE sweep in the evening whose amount is
 * the exact negative of their sum, returning the balance to zero. So the sweep
 * is always the day's LAST transaction and the account rests at £0.00, which
 * makes every intermediate balance checkable line by line.
 *
 * Every figure and date here is invented — the repo is public. Only the shape is
 * real, and the shape is what the tests prove.
 *
 * The bank's order is carried by statementSequence, the file position the OFX
 * importer now records (see the migration of the same name).
 */
describe('Account register — the running Balance column', () => {
  const SWEPT_ACCOUNT: Account = {
    id: 'acc-swept', name: 'Synthetic Swept Current', type: 'current', balance: 0,
    currency: 'GBP', lastUpdated: new Date('2024-02-20'), openingBalance: 0, isActive: true,
  };

  const row = (
    over: Partial<Transaction> & Pick<Transaction, 'id' | 'date' | 'amount' | 'statementSequence'>
  ): Transaction => ({
    description: 'Synthetic row',
    type: 'expense',
    category: '',
    accountId: 'acc-swept',
    cleared: false,
    ...over
  });

  // Day one, in the bank's own order. The direct debit and the standing order
  // run the account down; the evening sweep (-12.75 + -300.00 = -312.75, so
  // +312.75) restores it. NOTE the two transfers: the standing order and the
  // sweep are both `transfer`, and they have a real order between them that no
  // type rule can express.
  const DAY_ONE_DIRECT_DEBIT = row({
    id: 'txn-one-c', date: new Date('2024-02-05'), amount: -12.75, statementSequence: 0,
    type: 'expense', description: 'Synthetic direct debit'
  });
  const DAY_ONE_STANDING_ORDER = row({
    id: 'txn-one-b', date: new Date('2024-02-05'), amount: -300, statementSequence: 1,
    type: 'transfer', description: 'Synthetic standing order out'
  });
  const DAY_ONE_SWEEP_IN = row({
    id: 'txn-one-a', date: new Date('2024-02-05'), amount: 312.75, statementSequence: 2,
    type: 'transfer', description: 'Synthetic two way sweep in'
  });

  // Day two: the payment out came first, taking the account to -£450.00, and the
  // sweep followed and restored it to zero. A credit AFTER a debit — exactly
  // what the retired income-first rule denied could happen.
  const DAY_TWO_PAYMENT_OUT = row({
    id: 'txn-two-z', date: new Date('2024-02-19'), amount: -450, statementSequence: 3,
    type: 'expense', description: 'Synthetic faster payment out'
  });
  const DAY_TWO_SWEEP_IN = row({
    id: 'txn-two-a', date: new Date('2024-02-19'), amount: 450, statementSequence: 4,
    type: 'transfer', description: 'Synthetic two way sweep in again'
  });

  /**
   * Every balance the statement itself contains, for this opening balance of
   * zero. Anything the register prints outside this set is a figure the account
   * never held.
   */
  const STATEMENT_BALANCES = ['£0.00', '-£12.75', '-£312.75', '-£450.00'];

  /** The Balance column, top row first, exactly as rendered. */
  const balanceColumn = (): string[] =>
    screen.getAllByTestId('register-balance').map(cell => cell.textContent ?? '');

  /** The account's balance, as the register's own header states it. */
  const headerAccountBalance = (): string =>
    screen.getByText('Account Balance').parentElement?.lastElementChild?.textContent ?? '';

  const sortByDate = (): void => {
    fireEvent.click(screen.getByRole('button', { name: /^Date/ }));
  };

  const openRegister = async (): Promise<void> => {
    renderRegister('/accounts/acc-swept');
    await screen.findByRole('heading', { level: 1, name: 'Synthetic Swept Current' });
  };

  beforeEach(() => {
    localStorage.clear();
    __setAppContextValue({
      accounts: [SWEPT_ACCOUNT],
      // Deliberately not in date order: the data layer hands rows over
      // newest-first, and the order they arrive in must not decide anything.
      transactions: [DAY_TWO_SWEEP_IN, DAY_TWO_PAYMENT_OUT, DAY_ONE_SWEEP_IN, DAY_ONE_STANDING_ORDER, DAY_ONE_DIRECT_DEBIT],
      categories: CATEGORIES,
      isLoading: false,
    });
    vi.spyOn(DataService, 'getClosedAccounts').mockResolvedValue([]);
  });

  afterEach(() => {
    vi.mocked(DataService.getClosedAccounts).mockRestore();
    __resetAppContextValue();
  });

  it('shows the account balance on the top row when sorted newest-first', async () => {
    await openRegister();
    sortByDate();

    // THE invariant. Newest-first, the top row is the account's last
    // transaction, so the balance beside it is the account's balance — read off
    // the register's own header rather than a literal, because the two agreeing
    // is the whole point.
    expect(balanceColumn()[0]).toBe(headerAccountBalance());
    expect(balanceColumn()[0]).toBe('£0.00');
    // Not the figure the type order produced: the sweep hoisted above the
    // payment it offsets, showing the day's money in without its money out.
    expect(balanceColumn()[0]).not.toBe('£450.00');
    // Nor a signed zero, which reads like a rounding error in the user's money.
    expect(balanceColumn()[0]).not.toBe('-£0.00');
  });

  it('walks a day in the bank\'s order: -12.75, -312.75, then swept to 0.00', async () => {
    await openRegister();

    // Ascending (the default): the lead Opening Balance row, then day one
    // exactly as the statement prints it, then day two.
    expect(balanceColumn()).toEqual([
      '£0.00',        // Opening Balance
      '-£12.75',      // direct debit
      '-£312.75',     // standing order
      '£0.00',        // evening sweep restores it
      '-£450.00',     // day two payment
      '£0.00'         // day two sweep
    ]);

    sortByDate();

    // Descending is the exact reverse.
    expect(balanceColumn()).toEqual([
      '£0.00', '-£450.00', '£0.00', '-£312.75', '-£12.75', '£0.00'
    ]);
  });

  it('prints no balance the statement does not contain', async () => {
    // The type order put the sweep in the MIDDLE of day one (both it and the
    // standing order are transfers, and transfers sorted before expenses),
    // producing intermediate balances the account never held — which is how a
    // day that closed at zero came to show a balance it never reached.
    await openRegister();

    for (const balance of balanceColumn()) {
      expect(STATEMENT_BALANCES).toContain(balance);
    }

    sortByDate();

    for (const balance of balanceColumn()) {
      expect(STATEMENT_BALANCES).toContain(balance);
    }
  });

  it('lands the day on the same closing balance when the bank\'s order is unknown', async () => {
    // The honest limit. Rows imported before statement_sequence existed have
    // none, so the tie falls to the id and the MIDDLE of a day may not match the
    // statement. What cannot vary is where the day ENDS — so the top row under
    // newest-first is still the account's balance.
    __setAppContextValue({
      transactions: [DAY_TWO_SWEEP_IN, DAY_TWO_PAYMENT_OUT, DAY_ONE_SWEEP_IN, DAY_ONE_STANDING_ORDER, DAY_ONE_DIRECT_DEBIT]
        .map(t => ({ ...t, statementSequence: null })),
    });

    await openRegister();
    sortByDate();

    expect(balanceColumn()[0]).toBe(headerAccountBalance());
    expect(balanceColumn()[0]).toBe('£0.00');
  });

  it('keeps a statement\'s own run contiguous when other rows have no sequence', async () => {
    // A hand-entered row on an imported day: it has no sequence, so it sorts
    // after the statement's rows rather than being guessed into the middle of
    // them. The imported run stays exactly as the bank printed it — which is the
    // run the user is checking — and the day still closes on the account's
    // balance.
    const HAND_ENTERED = row({
      id: 'txn-one-hand', date: new Date('2024-02-05'), amount: -25, statementSequence: null,
      type: 'expense', description: 'Synthetic hand entered'
    });
    __setAppContextValue({
      transactions: [HAND_ENTERED, DAY_ONE_SWEEP_IN, DAY_ONE_STANDING_ORDER, DAY_ONE_DIRECT_DEBIT],
    });

    await openRegister();

    expect(balanceColumn()).toEqual([
      '£0.00', '-£12.75', '-£312.75', '£0.00', '-£25.00'
    ]);
  });

  it('keeps every row true, and says the column has stopped running, under another sort', async () => {
    await openRegister();

    fireEvent.click(screen.getByRole('button', { name: /^Description/ }));

    // Alphabetical by description — each row still carrying the balance
    // immediately after it, which no longer runs down the page.
    expect(balanceColumn()).toEqual([
      '£0.00', '-£12.75', '-£450.00', '-£312.75', '£0.00', '£0.00'
    ]);
    expect(
      screen.getByText(/Sorted by Description, so the Balance column doesn't run down the page/)
    ).toBeInTheDocument();
  });

  it('says nothing about the column while it is in date order', async () => {
    await openRegister();

    expect(screen.queryByText(/the Balance column doesn't run down the page/)).not.toBeInTheDocument();
  });
});
