import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import Accounts from '../Accounts';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Account } from '../../types';

/**
 * The degraded state, on both surfaces at once — DESIGN_RULINGS_2026-08-12 §C.
 *
 * "One page must never show a confident group total above a degraded net
 * worth." This asserts that through ONE provider state: a single render, a
 * single rate outage, and both the net-worth card's provenance line and the
 * band header read together. Two stubs — one per surface — could be made to
 * agree in a test while the app disagreed on screen, which is exactly the bug
 * the ruling is guarding against.
 *
 * It lives in a file of its own because the rates cache is module state, and
 * Vitest gives each test FILE a cold module registry. A suite that had already
 * fetched a live quote would answer this test from that cache and never take
 * the fallback path at all.
 *
 * Every figure here is invented; this repo is public.
 */

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

describe('Accounts page — group totals degrade with the net-worth card', () => {
  const mockFetch = vi.fn();
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    // The rate provider is unreachable. Nothing else about the page changes.
    global.fetch = mockFetch;
    mockFetch.mockRejectedValue(new Error('offline'));
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    __setAppContextValue({
      accounts: [
        account('a1', 'Everyday Account', 'current', 'GBP', 1000),
        account('a2', 'Dollar Account', 'current', 'USD', 250),
        account('a3', 'Rainy Day', 'savings', 'GBP', 500),
      ],
      transactions: [],
    });
  });

  afterEach(() => {
    __resetAppContextValue();
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('marks the group total in the same render the card admits the rates are stored', async () => {
    render(
      <MemoryRouter initialEntries={['/accounts']}>
        <PreferencesProvider>
          <ToastProvider>
            <Accounts />
          </ToastProvider>
        </PreferencesProvider>
      </MemoryRouter>
    );

    // The card degrades…
    await waitFor(() =>
      expect(screen.getByTestId('converted-total-note'))
        .toHaveTextContent(/Approximate — converted at stored rates, not live ones/)
    );

    // …and in that same DOM, the band that needed a rate is marked, so the mark
    // and the line it refers to are on screen together. Read at one instant:
    // both figures come from one conversion pass and one state update, so there
    // is no window in which one has settled and the other has not.
    const current = screen.getByRole('button', { name: /Current Accounts/ }).textContent ?? '';
    expect(current).toContain('≈');
    // Still never the raw cross-currency sum, outage or not.
    expect(current).not.toContain('£1,250.00');

    // And the band that never needed a rate is untouched by the outage: it has
    // nothing to degrade, which is why the ruling exempts it and the
    // regression pin holds.
    const savings = screen.getByRole('button', { name: /Savings Accounts/ }).textContent ?? '';
    expect(savings).toMatch(/£500\.00/);
    expect(savings).not.toContain('≈');
  });

  it('offers no confident group total before the card has any provenance', () => {
    render(
      <MemoryRouter initialEntries={['/accounts']}>
        <PreferencesProvider>
          <ToastProvider>
            <Accounts />
          </ToastProvider>
        </PreferencesProvider>
      </MemoryRouter>
    );

    // First render, conversion still in flight: no note yet, and therefore no
    // settled-looking band total either. The naive sum is the thing that must
    // not be on screen while the page has nothing to say about rates.
    expect(screen.queryByTestId('converted-total-note')).not.toBeInTheDocument();
    expect(screen.queryByText(/£1,250\.00/)).not.toBeInTheDocument();
  });
});
