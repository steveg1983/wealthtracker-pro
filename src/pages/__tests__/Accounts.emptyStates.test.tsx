/**
 * THE ACCOUNTS PAGE'S TWO KINDS OF NOTHING (DESIGN_PASS §4).
 *
 * On a personal-finance app these two states look identical and one of them is
 * terrifying. "No accounts" on a page that had eleven of them a moment ago is
 * indistinguishable, for as long as it lasts, from having lost them — so a
 * search that hides every account has to say how many are still there, what is
 * hiding them, and offer the one control that lets go.
 *
 * The true-empty state is the opposite job: a first run, where the remedy is
 * the whole point and there is nothing to reassure anybody about.
 *
 * Every account name and institution below comes from the shared synthetic
 * fixture: this repo is public.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import Accounts from '../Accounts';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { DataService } from '../../services/api/dataService';

const renderAccounts = () =>
  render(
    <MemoryRouter initialEntries={['/accounts']}>
      <PreferencesProvider>
        <ToastProvider>
          <Accounts />
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );

const searchFor = (term: string): void => {
  fireEvent.change(screen.getByLabelText('Search accounts by name or institution'), {
    target: { value: term }
  });
};

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(DataService, 'listClosedAccounts').mockResolvedValue([]);
});

afterEach(() => {
  __resetAppContextValue();
  vi.clearAllMocks();
});

describe('an accounts list with nothing in it', () => {
  it('says what is absent, what follows from it, and offers the way in', async () => {
    __setAppContextValue({ accounts: [], transactions: [], categories: [], isLoading: false });
    renderAccounts();

    const heading = await screen.findByRole('heading', { level: 3, name: 'No accounts yet' });
    // The consequence — why an empty accounts page empties the whole app.
    expect(screen.getByText(/the rest of the app has nothing to show/)).toBeInTheDocument();
    // The remedy as a real control IN THE EMPTY STATE, not an instruction to
    // go and find the toolbar's copy of it. The old copy was the instruction:
    // No accounts yet. Click "Add Account" to get started!
    const emptyState = heading.parentElement;
    expect(emptyState).not.toBeNull();
    expect(within(emptyState as HTMLElement).getByRole('button', { name: 'Add Account' })).toBeInTheDocument();
  });
});

describe('an accounts list emptied by the search is not an empty accounts list', () => {
  it('names how many are hidden and what is hiding them', async () => {
    renderAccounts();
    await screen.findByRole('heading', { level: 2, name: 'Current Accounts' });

    searchFor('quenchless ironmongery');

    expect(
      screen.getByRole('heading', { level: 3, name: 'No accounts match your search' })
    ).toBeInTheDocument();
    // THE COUNT IS THE POINT: it is the sentence that says they still exist.
    expect(screen.getByText(/of your accounts are hidden by/)).toBeInTheDocument();
    expect(screen.getByText('Search: quenchless ironmongery')).toBeInTheDocument();
  });

  it('is distinguishable from the empty list by every word that matters', async () => {
    renderAccounts();
    await screen.findByRole('heading', { level: 2, name: 'Current Accounts' });

    searchFor('quenchless ironmongery');

    // None of the first-run voice: an established user whose search missed is
    // not being welcomed to the product, and must not be offered "Add Account"
    // as the fix for accounts that are merely hidden.
    expect(screen.queryByRole('heading', { name: 'No accounts yet' })).not.toBeInTheDocument();
    expect(screen.queryByText(/the rest of the app has nothing to show/)).not.toBeInTheDocument();
  });

  it('offers one control that gives them back, and it gives them back', async () => {
    renderAccounts();
    await screen.findByRole('heading', { level: 2, name: 'Current Accounts' });

    searchFor('quenchless ironmongery');
    expect(screen.queryByRole('heading', { level: 3, name: 'Natwest Current Account' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByRole('heading', { level: 3, name: 'Natwest Current Account' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No accounts match your search' })).not.toBeInTheDocument();
  });
});
