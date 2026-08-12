import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import Accounts from '../Accounts';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Account } from '../../types';

/**
 * Group headers that span currencies — DESIGN_RULINGS_2026-08-12 §C.
 *
 * A band used to add its accounts up one-for-one and print the answer with a
 * "£": a dollar counted as a pound, the same fault the net-worth card was
 * carrying until it learned to convert. The ruling is that group totals convert
 * the same way the card does, mark themselves `≈`, and say nothing else —
 * WHICH rate and WHEN is stated once per page, under the card.
 *
 * Every figure here is invented; this repo is public.
 */

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

const account = (
  id: string,
  name: string,
  type: Account['type'],
  currency: string,
  openingBalance: number
): Account => ({
  id, name, type, currency, openingBalance,
  balance: openingBalance,
  lastUpdated: new Date('2026-08-01'),
});

/** Sterling everywhere. The overwhelmingly common ledger, and the control. */
const STERLING_ONLY: Account[] = [
  account('a1', 'Everyday Account', 'current', 'GBP', 1000),
  account('a3', 'Rainy Day', 'savings', 'GBP', 500),
];

/**
 * The same ledger with one dollar account added to Current Accounts.
 *
 * Savings is untouched and still whole in sterling — it is the regression pin:
 * a second currency elsewhere on the page must not change it by one byte.
 */
const MIXED: Account[] = [
  account('a1', 'Everyday Account', 'current', 'GBP', 1000),
  // 250 USD at 1.25 to the pound is 200 GBP, so Current Accounts totals £1,200
  // — never £1,250, which is what adding the two numbers raw would print.
  account('a2', 'Dollar Account', 'current', 'USD', 250),
  account('a3', 'Rainy Day', 'savings', 'GBP', 500),
];

const bandHeader = (name: RegExp) => screen.getByRole('button', { name });

describe('Accounts page — group totals across currencies', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ base: 'GBP', rates: { GBP: 1, USD: 1.25, EUR: 1.2 } }),
    });
  });

  afterEach(() => {
    __resetAppContextValue();
    vi.restoreAllMocks();
  });

  it('leaves a single-currency group byte-for-byte as it was', async () => {
    __setAppContextValue({ accounts: STERLING_ONLY, transactions: [] });
    renderAccounts();
    const before = (await screen.findByRole('button', { name: /Savings Accounts/ })).textContent;
    expect(before).toMatch(/£500\.00/);

    cleanup();

    // The same ledger, plus a dollar account in a DIFFERENT band.
    __setAppContextValue({ accounts: MIXED, transactions: [] });
    renderAccounts();
    // Wait for the page's conversion to settle, so this compares the finished
    // state rather than a moment before the rates land.
    await waitFor(() => expect(screen.getByText('≈ £1,200.00')).toBeInTheDocument());

    expect(bandHeader(/Savings Accounts/).textContent).toBe(before);
  });

  it('never marks a single-currency group, even on a page that converts', async () => {
    __setAppContextValue({ accounts: MIXED, transactions: [] });
    renderAccounts();

    await waitFor(() => expect(screen.getByText('≈ £1,200.00')).toBeInTheDocument());

    // Savings needed no rate, so it makes no claim about one.
    const savings = bandHeader(/Savings Accounts/).textContent ?? '';
    expect(savings).toMatch(/£500\.00/);
    expect(savings).not.toContain('≈');
    expect(savings).not.toContain('approximately');
  });

  it('converts a mixed group and marks it with ≈', async () => {
    __setAppContextValue({ accounts: MIXED, transactions: [] });
    renderAccounts();

    await waitFor(() => expect(screen.getByText('≈ £1,200.00')).toBeInTheDocument());
    expect(bandHeader(/Current Accounts/).textContent).toMatch(/≈ £1,200\.00/);
  });

  it('says "approximately" where the ≈ cannot be heard', async () => {
    __setAppContextValue({ accounts: MIXED, transactions: [] });
    renderAccounts();

    // The glyph is decoration; the accessible name carries the word. A screen
    // reader that skips "≈" would otherwise hear a converted figure as an exact
    // one — the one thing the mark exists to prevent.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Current Accounts.*approximately £1,200\.00/ }))
        .toBeInTheDocument()
    );
  });

  it('never shows the raw cross-currency sum, not even for a frame', async () => {
    __setAppContextValue({ accounts: MIXED, transactions: [] });
    renderAccounts();

    // £1,250.00 is what 1000 + 250 prints when a dollar is counted as a pound.
    // It must not appear before the conversion, during it, or after.
    expect(screen.queryByText(/£1,250\.00/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('≈ £1,200.00')).toBeInTheDocument());
    expect(screen.queryByText(/£1,250\.00/)).not.toBeInTheDocument();
  });

  it('carries exactly one provenance line for the whole page', async () => {
    __setAppContextValue({ accounts: MIXED, transactions: [] });
    renderAccounts();

    await waitFor(() => expect(screen.getByText('≈ £1,200.00')).toBeInTheDocument());

    // The `≈` on the group total points AT this line; it does not repeat it.
    expect(screen.getAllByTestId('converted-total-note')).toHaveLength(1);
  });

  it('falls back to the unsummed pair when a currency has no rate at all', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    __setAppContextValue({
      accounts: [
        account('a1', 'Everyday Account', 'current', 'GBP', 1000),
        account('a2', 'Mystery Account', 'current', 'ZZZ', 250),
      ],
      transactions: [],
    });
    renderAccounts();

    // No rate exists for ZZZ, so there is no honest single figure for this
    // band. The unsummed pair is the failure state — and the card above says
    // the same thing about the same currency, in the same render, off the same
    // `unconverted` list. Neither surface can be confident while the other is
    // not, because there is only one of them.
    await waitFor(() =>
      expect(screen.getByTestId('converted-total-note')).toHaveTextContent(/This total is wrong/)
    );
    expect(bandHeader(/Current Accounts/).textContent).toMatch(/£1,000\.00 \+ ZZZ\s?250\.00/);
    expect(bandHeader(/Current Accounts/).textContent).not.toContain('≈');
    warn.mockRestore();
  });
});
