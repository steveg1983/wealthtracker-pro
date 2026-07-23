import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import Accounts from '../Accounts';

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
