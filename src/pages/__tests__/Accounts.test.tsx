import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import Accounts from '../Accounts';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { DataService } from '../../services/api/dataService';
import type { Account } from '../../types';

/**
 * These cover the two things the Accounts page adds for someone running ~200
 * accounts: folding a group down to its heading (name, count and running total
 * stay put — that total is the whole point of collapsing), and searching for
 * one account by name or institution. Search deliberately overrides collapse:
 * a fold that swallows the very result you searched for is worse than no fold.
 *
 * The app context is the shared test double from src/test/setup.ts (synthetic
 * data only — this repo is public). Its default accounts group, under Account
 * Type, into Current Accounts (Natwest + Monzo), Savings, Credit Cards, and so
 * on; "Primary Residence" sits under Assets with institution "Property".
 */

const renderAccounts = () =>
  render(
    <MemoryRouter initialEntries={['/accounts']}>
      <PreferencesProvider>
        {/* The page reports account close/reopen through the app's toasts,
            exactly as it does inside the real provider stack. */}
        <ToastProvider>
          <Accounts />
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );

// The toggle for a group is the section heading rendered as a button; its
// accessible name is the heading text (title + count + total).
const groupToggle = (name: RegExp) => screen.getByRole('button', { name });

describe('Accounts page — collapsible groups', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders each account-type group with its accounts expanded by default', async () => {
    renderAccounts();

    expect(await screen.findByRole('heading', { level: 2, name: 'Current Accounts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Savings Accounts' })).toBeInTheDocument();

    // Cards for the group's accounts are on show.
    expect(screen.getByRole('heading', { level: 3, name: 'Natwest Current Account' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Monzo Current Account' })).toBeInTheDocument();

    expect(groupToggle(/Current Accounts/)).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapsing a group hides its accounts but keeps the heading, count and total', async () => {
    renderAccounts();

    const toggle = await screen.findByRole('button', { name: /Current Accounts/ });
    // The entire header — name, "(2 accounts)" and the running total — before
    // the fold, so we can prove none of it is lost by collapsing.
    const headerBefore = toggle.textContent;
    expect(headerBefore).toMatch(/Current Accounts/);
    expect(headerBefore).toMatch(/2 accounts/);

    fireEvent.click(toggle);

    // The accounts are gone…
    expect(screen.queryByRole('heading', { level: 3, name: 'Natwest Current Account' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Monzo Current Account' })).not.toBeInTheDocument();

    // …but the heading is untouched: same name, same count, same total.
    expect(groupToggle(/Current Accounts/)).toHaveAttribute('aria-expanded', 'false');
    expect(groupToggle(/Current Accounts/).textContent).toBe(headerBefore);

    // Other groups are unaffected.
    expect(screen.getByRole('heading', { level: 3, name: 'Natwest Savings Account' })).toBeInTheDocument();
  });

  it('persists the collapsed set to localStorage, keyed by grouping mode and label', async () => {
    renderAccounts();

    fireEvent.click(await screen.findByRole('button', { name: /Current Accounts/ }));

    const stored: unknown = JSON.parse(localStorage.getItem('accountsCollapsedGroups') ?? '[]');
    expect(Array.isArray(stored) ? stored : []).toContain('type:current');
  });

  it('restores the collapsed state on a fresh mount from localStorage', async () => {
    localStorage.setItem('accountsCollapsedGroups', JSON.stringify(['type:current']));

    renderAccounts();

    // The heading loads expanded=false, and its accounts never render.
    expect(await screen.findByRole('button', { name: /Current Accounts/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('heading', { level: 3, name: 'Natwest Current Account' })).not.toBeInTheDocument();
    // A group with no stored key stays open.
    expect(screen.getByRole('heading', { level: 3, name: 'Natwest Savings Account' })).toBeInTheDocument();
  });
});

describe('Accounts page — search', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('filters to matching accounts and drops groups with no match', async () => {
    renderAccounts();
    await screen.findByRole('heading', { level: 2, name: 'Current Accounts' });

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'monzo' } });

    // Only the matching account survives, inside its still-present group.
    expect(screen.getByRole('heading', { level: 3, name: 'Monzo Current Account' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Natwest Current Account' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Current Accounts' })).toBeInTheDocument();
    // A group with nothing matching disappears entirely.
    expect(screen.queryByRole('heading', { level: 2, name: 'Savings Accounts' })).not.toBeInTheDocument();

    // The "n of m" result count reflects the hit against the whole book.
    expect(screen.getByText('1 of 12 accounts')).toBeInTheDocument();
  });

  it('matches on institution name, not just the account name', async () => {
    renderAccounts();
    await screen.findByRole('heading', { level: 2, name: 'Current Accounts' });

    // "Primary Residence" carries none of "property" in its name — only its
    // institution does.
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'property' } });

    expect(screen.getByRole('heading', { level: 3, name: 'Primary Residence' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Monzo Current Account' })).not.toBeInTheDocument();
    expect(screen.getByText('1 of 12 accounts')).toBeInTheDocument();
  });

  it('overrides collapse — a search never hides its own result', async () => {
    renderAccounts();

    // Collapse the group Monzo lives in…
    fireEvent.click(await screen.findByRole('button', { name: /Current Accounts/ }));
    expect(screen.queryByRole('heading', { level: 3, name: 'Monzo Current Account' })).not.toBeInTheDocument();

    // …then search for it: the fold is ignored and the card comes back.
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'monzo' } });
    expect(screen.getByRole('heading', { level: 3, name: 'Monzo Current Account' })).toBeInTheDocument();
    // The collapse preference is still on record, just not applied while searching.
    expect(JSON.parse(localStorage.getItem('accountsCollapsedGroups') ?? '[]')).toContain('type:current');
  });

  it('restores the full grouped view when the search is cleared', async () => {
    renderAccounts();
    await screen.findByRole('heading', { level: 2, name: 'Current Accounts' });

    const searchbox = screen.getByRole('searchbox');
    fireEvent.change(searchbox, { target: { value: 'monzo' } });
    expect(screen.queryByRole('heading', { level: 2, name: 'Savings Accounts' })).not.toBeInTheDocument();

    fireEvent.change(searchbox, { target: { value: '' } });

    // Every group and account is back, and the result count is gone.
    expect(screen.getByRole('heading', { level: 2, name: 'Savings Accounts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Natwest Current Account' })).toBeInTheDocument();
    expect(screen.queryByText(/of 12 accounts/)).not.toBeInTheDocument();
  });

  it('shows a plain empty state when nothing matches', async () => {
    renderAccounts();
    await screen.findByRole('heading', { level: 2, name: 'Current Accounts' });

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz-no-such-account' } });

    expect(screen.getByText(/No accounts match/)).toBeInTheDocument();
    expect(screen.getByText('0 of 12 accounts')).toBeInTheDocument();
  });
});

describe('Accounts page — no account type vanishes', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    __resetAppContextValue();
  });

  it('renders every account under type grouping, whatever its type', async () => {
    // The three union members that had no section of their own. 'assets' is
    // creatable TODAY (the Add Account modal's "Other Assets") — an account a
    // user just created must not vanish from the page that lists accounts.
    const account = (id: string, name: string, type: Account['type']): Account => ({
      id, name, type, balance: 0, currency: 'GBP', lastUpdated: new Date(), openingBalance: 0,
    });
    __setAppContextValue({
      accounts: [
        account('m1', 'Chalet Mortgage', 'mortgage'),
        account('a1', 'Grand Piano', 'assets'),
        account('o1', 'Box of Mysteries', 'other'),
      ],
    });

    renderAccounts();

    // Mortgages file under Loans — the app's own words: "Mortgages, personal
    // loans". "Other Assets" files under Assets. 'other' lands in the
    // catch-all section rather than nowhere.
    expect(await screen.findByRole('heading', { level: 2, name: 'Loans' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Chalet Mortgage' })).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 2, name: 'Assets' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Grand Piano' })).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 2, name: 'Other Accounts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Box of Mysteries' })).toBeInTheDocument();
  });
});

/**
 * Closed accounts are the archive (the Microsoft Money model: closing hides an
 * account and keeps its history, never deletes it). They load from
 * DataService.getClosedAccounts — NOT the app-context accounts list, which
 * carries only the open ones — so the synthetic closed accounts are injected by
 * spying on that call rather than through __setAppContextValue. They used to
 * arrive in no order at all; now they group exactly like the open list (by
 * account type, or by institution when the page toggle flips) with rows
 * alphabetical by name within each group.
 */
describe('Accounts page — closed accounts ordering', () => {
  const closedAccount = (
    id: string,
    name: string,
    type: Account['type'],
    institution?: string,
  ): Account => ({
    id, name, type, balance: 0, currency: 'GBP', lastUpdated: new Date(),
    openingBalance: 0, isActive: false, ...(institution ? { institution } : {}),
  });

  // Interleaved types and out-of-order names on purpose: a passing test then
  // proves BOTH the type grouping and the A–Z sort inside a group.
  const closed: Account[] = [
    closedAccount('c1', 'Zephyr Current', 'current', 'Barclays'),
    closedAccount('c2', 'Nimbus Card', 'credit'),
    closedAccount('c3', 'Alpha Current', 'current', 'Barclays'),
    closedAccount('c4', 'Beacon Savings', 'savings', 'Aldermore'),
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(DataService, 'getClosedAccounts').mockResolvedValue(closed);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // True when `earlier` sits before `later` in document order.
  const precedes = (earlier: HTMLElement, later: HTMLElement): boolean =>
    Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('groups closed accounts by type, in section order, alphabetical within', async () => {
    renderAccounts();

    // The toggle only appears once the closed list has loaded (its count is in
    // the label), so finding it also waits out the async load. It starts folded.
    fireEvent.click(await screen.findByRole('button', { name: /Closed Accounts \(4\)/ }));

    const closedSection = screen.getByTestId('closed-accounts');
    // Subheadings ("Current Accounts" etc.) are scoped to the closed section, so
    // they never clash with the identically-named OPEN section headings above.
    const seq = [
      within(closedSection).getByText('Current Accounts'),
      within(closedSection).getByText('Alpha Current'),
      within(closedSection).getByText('Zephyr Current'),
      within(closedSection).getByText('Savings Accounts'),
      within(closedSection).getByText('Beacon Savings'),
      within(closedSection).getByText('Credit Cards'),
      within(closedSection).getByText('Nimbus Card'),
    ];
    // Each item strictly follows the previous — proving the section order
    // (Current → Savings → Credit) and A–Z names inside Current Accounts.
    for (let i = 1; i < seq.length; i += 1) {
      expect(precedes(seq[i - 1], seq[i])).toBe(true);
    }
  });

  it('regroups closed accounts by institution when the page toggle flips', async () => {
    renderAccounts();

    // Switch the whole page — open and closed alike — to institution grouping.
    fireEvent.click(await screen.findByRole('button', { name: 'Institution' }));
    fireEvent.click(await screen.findByRole('button', { name: /Closed Accounts \(4\)/ }));

    const closedSection = screen.getByTestId('closed-accounts');
    // Institution names double as both a subheading and each row's subtext, so
    // assert on the unique account names instead: their order alone proves the
    // grouping (Aldermore → Barclays → Other) and the A–Z sort inside Barclays.
    // The flip is unmistakable — under type grouping Alpha/Zephyr came before
    // Beacon; under institution grouping Beacon (Aldermore) now leads.
    const seq = [
      within(closedSection).getByText('Beacon Savings'),
      within(closedSection).getByText('Alpha Current'),
      within(closedSection).getByText('Zephyr Current'),
      within(closedSection).getByText('Nimbus Card'),
    ];
    for (let i = 1; i < seq.length; i += 1) {
      expect(precedes(seq[i - 1], seq[i])).toBe(true);
    }
    // The catch-all subheading for the account with no institution renders too
    // (unique: no closed row carries "Other Accounts" as its institution).
    expect(within(closedSection).getByText('Other Accounts')).toBeInTheDocument();
  });
});

/**
 * Settings on a closed account, without reopening it. Reopen–edit–close was
 * three steps to check or correct one fact (its name, its opening date), so
 * every closed row carries its own settings button. The archive still stays an
 * archive: the modal edits details only — the transaction list is reachable
 * only by actually reopening the account.
 */
describe('Accounts page — closed account settings', () => {
  const closedAccount = (id: string, name: string, type: Account['type']): Account => ({
    id, name, type, balance: 0, currency: 'GBP', lastUpdated: new Date(),
    openingBalance: 0, isActive: false,
  });

  const closed: Account[] = [
    closedAccount('c1', 'Alpha Current', 'current'),
    closedAccount('c2', 'Nimbus Card', 'credit'),
  ];

  // The context's real updateAccount is what a reopen (or a settings save)
  // goes through, so spying on it is how "no reopen happened" is proved.
  const updateAccount = vi.fn();

  // Opens the Closed Accounts section and hands back its container. Finding
  // the toggle by its count also waits out the async closed-accounts load.
  const openClosedSection = async (): Promise<HTMLElement> => {
    fireEvent.click(await screen.findByRole('button', { name: /Closed Accounts \(2\)/ }));
    return screen.getByTestId('closed-accounts');
  };

  beforeEach(() => {
    localStorage.clear();
    updateAccount.mockClear();
    vi.spyOn(DataService, 'getClosedAccounts').mockResolvedValue(closed);
    __setAppContextValue({ updateAccount });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    __resetAppContextValue();
  });

  it('gives every closed row its own settings button', async () => {
    renderAccounts();
    const closedSection = await openClosedSection();

    // Named per account, so two rows never present the same control.
    expect(within(closedSection).getByRole('button', { name: 'Account settings for Alpha Current' })).toBeInTheDocument();
    expect(within(closedSection).getByRole('button', { name: 'Account settings for Nimbus Card' })).toBeInTheDocument();
  });

  it('opens settings for that account without reopening it', async () => {
    renderAccounts();
    const closedSection = await openClosedSection();

    fireEvent.click(within(closedSection).getByRole('button', { name: 'Account settings for Alpha Current' }));

    const dialog = await screen.findByRole('dialog', { name: 'Account Settings' });
    // It is THAT account's settings, loaded from the closed list (a closed
    // account is absent from the app-context accounts the modal used to read).
    expect(within(dialog).getByLabelText('Account name')).toHaveValue('Alpha Current');
    // Editing details is not reopening: nothing was written, and the row still
    // offers Reopen as the only way back to the live list.
    expect(updateAccount).not.toHaveBeenCalled();
    expect(within(closedSection).getAllByRole('button', { name: 'Reopen' })).toHaveLength(2);
    // The archive stays an archive — no route out of this modal into the
    // account's register.
    expect(within(dialog).queryAllByRole('link')).toHaveLength(0);
  });

  it('saves an edit and leaves the account closed', async () => {
    renderAccounts();
    const closedSection = await openClosedSection();

    fireEvent.click(within(closedSection).getByRole('button', { name: 'Account settings for Alpha Current' }));
    const dialog = await screen.findByRole('dialog', { name: 'Account Settings' });
    fireEvent.change(within(dialog).getByLabelText('Account name'), { target: { value: 'Alpha Renamed' } });
    fireEvent.click(within(dialog).getByText('Save Changes'));

    // The save carries the account's OWN status back — a rename must never
    // quietly reopen what it edited.
    await waitFor(() => {
      expect(updateAccount).toHaveBeenCalledWith('c1', expect.objectContaining({
        name: 'Alpha Renamed',
        isActive: false,
      }));
    });
    // …and the closed list is re-pulled, so the row shows the new name at once.
    await waitFor(() => {
      expect(DataService.getClosedAccounts).toHaveBeenCalledTimes(2);
    });
  });

  it('leaves Reopen working', async () => {
    renderAccounts();
    const closedSection = await openClosedSection();

    const rows = within(closedSection).getAllByRole('button', { name: 'Reopen' });
    fireEvent.click(rows[0]);

    await waitFor(() => {
      expect(updateAccount).toHaveBeenCalledWith('c1', { isActive: true });
    });
  });
});
