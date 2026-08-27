import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import Investments from '../Investments';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Account } from '../../types';

/**
 * THE ONE ADD-A-HOLDING DOOR.
 *
 * The page's "+" used to open `AddInvestmentModal`, which asked for units,
 * price, fees and stamp duty and then wrote ONE EXPENSE TRANSACTION and no
 * holding — a buy that left the portfolio unchanged, and the reason "Cash"
 * appeared in it as a thing you could buy at a price of 1.00. It has been
 * retired; the button now leads to the manager that creates a holding.
 *
 * A holding belongs to an ACCOUNT, so these pin the part that cannot be
 * guessed: with one investment account the door opens straight through, and
 * with several it asks which sleeve before opening anything.
 *
 * Synthetic accounts and round figures — this repo is public.
 */

const account = (id: string, name: string, type: Account['type']): Account => ({
  id,
  name,
  type,
  currency: 'GBP',
  balance: 0,
  openingBalance: 0,
  lastUpdated: new Date(2026, 0, 1),
});

const renderWith = (accounts: Account[]) => {
  __setAppContextValue({
    accounts,
    transactions: [],
    transactionSplits: [],
    categories: [],
  });
  return render(
    <MemoryRouter initialEntries={['/investments']}>
      <PreferencesProvider>
        <Investments />
      </PreferencesProvider>
    </MemoryRouter>
  );
};

afterEach(() => {
  __resetAppContextValue();
  vi.restoreAllMocks();
});

const ONE = [
  account('acc-isa', 'Fund ISA', 'investment'),
  account('acc-everyday', 'Everyday Account', 'current'),
];

const SEVERAL = [
  account('acc-isa', 'Fund ISA', 'investment'),
  account('acc-sipp', 'Pension SIPP', 'investment'),
  account('acc-everyday', 'Everyday Account', 'current'),
];

describe('Investments — the add-a-holding door', () => {
  it('asks which account when there is more than one sleeve', async () => {
    renderWith(SEVERAL);

    const door = await screen.findByRole('button', { name: 'Add a holding' });
    expect(door).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(door);

    // Named, not guessed: the wrong sleeve is a mis-filing that only surfaces
    // later, in a total that will not match a broker's statement.
    expect(screen.getByText('Add a holding to…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fund ISA' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pension SIPP' })).toBeInTheDocument();
    expect(door).toHaveAttribute('aria-expanded', 'true');
  });

  it('choosing a sleeve opens that account’s add form, on the Portfolio tab', async () => {
    renderWith(SEVERAL);

    fireEvent.click(await screen.findByRole('button', { name: 'Add a holding' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pension SIPP' }));

    // The door walks the whole way: the tab, the account's manager, the form.
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Add a holding/ })).toBeInTheDocument();
    });
    // And it is the chosen sleeve's panel that opened, not the other one.
    // The control says what it does — it is a disclosure, so it closes with
    // "Hide holdings" rather than "Done", which was the vocabulary of an
    // action (Design, 27 Aug §3).
    expect(screen.getByRole('button', { name: 'Hide holdings' })).toBeInTheDocument();
  });

  it('goes straight through when there is only one sleeve — one account is not a question', async () => {
    renderWith(ONE);

    fireEvent.click(await screen.findByRole('button', { name: 'Add a holding' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Add a holding/ })).toBeInTheDocument();
    });
    expect(screen.queryByText('Add a holding to…')).not.toBeInTheDocument();
  });

  it('offers no door at all with no investment account to hold anything', () => {
    renderWith([account('acc-everyday', 'Everyday Account', 'current')]);

    expect(screen.queryByRole('button', { name: 'Add a holding' })).not.toBeInTheDocument();
  });
});
