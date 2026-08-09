import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import Investments from '../Investments';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Account, Category, Transaction } from '../../types';

/**
 * The Investments page over an investment↔cash PAIR (the Microsoft Money
 * model). Synthetic accounts and round figures — this repo is public.
 *
 * Fund ISA: £1,000 opening, £500 in from the current account, £200 moved to
 * its own cash side. Its cash account holds that £200. The pair is therefore
 * worth £1,500, of which £500 was put in from outside.
 */

const ISA = 'acc-isa';
const ISA_CASH = 'acc-isa-cash';
const EVERYDAY = 'acc-everyday';

const account = (overrides: Partial<Account> & Pick<Account, 'id' | 'name' | 'type'>): Account => ({
  currency: 'GBP',
  balance: 0,
  lastUpdated: new Date(2026, 0, 1),
  openingBalance: 0,
  ...overrides,
});

const txn = (overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'accountId' | 'amount'>): Transaction => ({
  date: new Date(2026, 2, 10),
  description: 'Movement',
  category: '',
  type: 'transfer',
  ...overrides,
});

const accounts: Account[] = [
  account({ id: ISA, name: 'Fund ISA', type: 'investment', institution: 'Sample Brokers', openingBalance: 1000 }),
  account({ id: ISA_CASH, name: 'Fund ISA (Cash)', type: 'current', parentAccountId: ISA }),
  account({ id: EVERYDAY, name: 'Everyday Account', type: 'current', openingBalance: 5000 }),
];

const transactions: Transaction[] = [
  txn({ id: 't-in-isa', accountId: ISA, amount: 500, linkedTransferId: 't-in-everyday' }),
  txn({ id: 't-in-everyday', accountId: EVERYDAY, amount: -500, linkedTransferId: 't-in-isa' }),
  txn({ id: 't-internal-out', accountId: ISA, amount: -200, linkedTransferId: 't-internal-in' }),
  txn({ id: 't-internal-in', accountId: ISA_CASH, amount: 200, linkedTransferId: 't-internal-out' }),
];

const categories: Category[] = [
  { id: 'tofrom-everyday', name: 'To/From Everyday Account', type: 'both', level: 'detail', isTransferCategory: true, accountId: EVERYDAY },
];

const renderInvestments = (overrides: { transactions?: Transaction[] } = {}) => {
  __setAppContextValue({
    accounts,
    transactions: overrides.transactions ?? transactions,
    transactionSplits: [],
    categories,
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
});

describe('Investments page — the pair is the portfolio', () => {
  it('values a holding at the investment account plus its nested cash', async () => {
    renderInvestments();

    // £1,300 in the fund and £200 in its cash: the tile and the holding row
    // both say £1,500, and the fund's own £1,300 is never shown on its own.
    expect(await screen.findAllByText('£1,500.00')).toHaveLength(2);
    expect(screen.queryByText('£1,300.00')).not.toBeInTheDocument();
  });

  it('shows the nested cash inside the holding, not as a holding of its own', async () => {
    renderInvestments();

    expect(await screen.findByRole('heading', { level: 3, name: 'Fund ISA' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Fund ISA (Cash)' })).not.toBeInTheDocument();

    // Sub-line under the row: the importer's "<Name> (Cash)" reads as 'Cash'.
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('£200.00')).toBeInTheDocument();
  });

  it('counts the whole portfolio once, at 100% allocation', async () => {
    renderInvestments();

    expect(await screen.findAllByText('100.00%')).toHaveLength(2);
  });
});

describe('Investments page — contributions and return', () => {
  it('counts money in from outside and ignores moves within the pair', async () => {
    renderInvestments();

    // £500 in from the current account. The £200 shuffled into the pair's own
    // cash side is not a contribution in either direction.
    expect(await screen.findByText('Net Contributions')).toBeInTheDocument();
    expect(screen.getByText('£500.00')).toBeInTheDocument();
    expect(screen.getByText('+£1,000.00')).toBeInTheDocument();
    expect(screen.getByText('+200.00%')).toBeInTheDocument();
  });

  it('says nothing about unmatched transfers when every transfer is matched', async () => {
    renderInvestments();

    await screen.findByText('Net Contributions');
    expect(screen.queryByText(/no matching row in another account/)).not.toBeInTheDocument();
  });

  it('discloses what an unmatched transfer does to the figures', async () => {
    // The other half of the internal move is gone, so its £200 leg now looks
    // like money leaving the portfolio.
    renderInvestments({
      transactions: transactions
        .filter(t => t.id !== 't-internal-in')
        .map(t => (t.id === 't-internal-out' ? { ...t, linkedTransferId: undefined } : t)),
    });

    expect(await screen.findByText(/no matching row in another account/)).toBeInTheDocument();
  });

  it('refuses to state a return percentage when nothing was contributed', async () => {
    renderInvestments({ transactions: [] });

    expect(await screen.findByText('—')).toBeInTheDocument();
    expect(screen.getByText('No contributions to measure a return against')).toBeInTheDocument();
  });
});
