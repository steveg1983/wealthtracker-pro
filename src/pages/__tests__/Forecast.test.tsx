import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import Forecast from '../Forecast';
import type { Account, Category, ForecastAdjustment, SuggestionDismissal, Transaction } from '../../types';

// The SEAM, not a service: the page reads its stored scenario through
// `dataPort` — for now only to COUNT it on the Forecast tab.
const seam = vi.hoisted(() => ({
  listForecastAdjustments: vi.fn(async (): Promise<ForecastAdjustment[]> => []),
}));
vi.mock('@data', () => ({ dataPort: seam }));

/**
 * THE P&L (owner, 19 Aug): income above, expenditure below, a net figure
 * at the bottom; sections collapsible; the months hidden behind a toggle;
 * a choice of windows. The rules pinned here:
 *
 *  - the current part month is not in the last-12 window;
 *  - income sits ABOVE expenditure in the document, net below both;
 *  - a section collapses to its total, and the months toggle turns the
 *    list into a twelve-column table;
 *  - the Current tab is ACTUALS, whole — a forecast-exclusion verdict no
 *    longer thins it (the verdicts are kept for the Forecast redesign,
 *    and the Forecast tab names what is kept);
 *  - the average divides by the WINDOW's month count, not always 12;
 *  - the verdicts are lazy-loaded and this page ASKS (the #353 lesson);
 *  - the page says, in words, that it never writes to Budget.
 *
 * Every payee, category and figure invented — the repo is public.
 */

const ACCOUNT: Account = {
  id: 'acc-base', name: 'Synthetic Current', type: 'current', balance: 0,
  currency: 'GBP', lastUpdated: new Date(), openingBalance: 0, isActive: true,
};

const CATEGORIES: Category[] = [
  // Food lives under a GROUP — the P&L reads side > group > category.
  { id: 'grp-living', name: 'Living', type: 'expense', level: 'sub' },
  { id: 'cat-food', name: 'Food', type: 'expense', level: 'detail', parentId: 'grp-living' },
  // Salary has no parent: it stands at group level by itself.
  { id: 'cat-salary', name: 'Salary', type: 'income', level: 'detail' },
];

const now = new Date();
/** The 15th of each of the twelve complete months before this one. */
const monthAgo = (monthsBack: number): Date =>
  new Date(now.getFullYear(), now.getMonth() - monthsBack, 15);

const ONE_OFF_ID = 'txn-one-off';

const LEDGER: Transaction[] = [
  // Twelve months of £100 Food and £2,000 Salary.
  ...Array.from({ length: 12 }, (_, i): Transaction[] => ([
    {
      id: `food-${i}`, accountId: ACCOUNT.id, description: 'Grocer',
      amount: -100, date: monthAgo(i + 1), type: 'expense', category: 'cat-food',
    },
    {
      id: `pay-${i}`, accountId: ACCOUNT.id, description: 'Payroll',
      amount: 2000, date: monthAgo(i + 1), type: 'income', category: 'cat-salary',
    },
  ])).flat(),
  // A £5,000 unfiled one-off — the roof.
  {
    id: ONE_OFF_ID, accountId: ACCOUNT.id, description: 'Roof repair',
    amount: -5000, date: monthAgo(3), type: 'expense', category: '',
  },
  // A transfer: neither income nor spending, counted out loud.
  {
    id: 'txn-transfer', accountId: ACCOUNT.id, description: 'To savings',
    amount: -500, date: monthAgo(2), type: 'transfer', category: '',
  },
  // THIS month — outside the last-12 window by definition.
  {
    id: 'txn-current', accountId: ACCOUNT.id, description: 'Current month spend',
    amount: -999, date: new Date(now.getFullYear(), now.getMonth(), 2), type: 'expense', category: 'cat-food',
  },
];

const refreshSuggestionDismissals = vi.fn(async () => {});

const renderForecast = (
  dismissals: SuggestionDismissal[] = [],
  status: 'idle' | 'ready' = 'ready',
  transactions: Transaction[] = LEDGER,
  categories: Category[] = CATEGORIES
): void => {
  __setAppContextValue({
    accounts: [ACCOUNT],
    categories,
    transactions,
    isLoading: false,
    suggestionDismissals: dismissals,
    suggestionDismissalsStatus: status,
    refreshSuggestionDismissals,
  });
  render(
    <MemoryRouter>
      <PreferencesProvider>
        <ToastProvider>
          <Forecast />
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );
};

const excludedVerdict: SuggestionDismissal = {
  id: 'dis-roof',
  kind: 'forecast-excluded',
  subjectKey: ONE_OFF_ID,
  subjectIds: [ONE_OFF_ID],
  dismissedAt: new Date(),
};

beforeEach(() => {
  localStorage.clear();
  refreshSuggestionDismissals.mockClear();
  seam.listForecastAdjustments.mockClear();
  seam.listForecastAdjustments.mockResolvedValue([]);
});

afterEach(() => {
  __resetAppContextValue();
});

describe('Forecast — the Current P&L', () => {
  it('reads income above expenditure with net below, over the last twelve complete months', () => {
    renderForecast();

    // Food: 12 × £100 — and NOT 13: the current month's £999 is outside the
    // window, or the figures would claim a typical month that never was. Its
    // GROUP heading carries the same figure as a subtotal: side > group >
    // category, the way a P&L is set out.
    expect(screen.getByRole('button', { name: 'Living' })).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getAllByText('(£1,200.00)')).toHaveLength(2);
    // Salary: the figure appears TWICE by construction, as the income side's
    // total and as its only category's — the two agreeing is the property.
    expect(screen.getAllByText('+£24,000.00')).toHaveLength(2);
    expect(screen.getAllByText('£2,000.00 a month')).toHaveLength(2);
    // The unfiled one-off under its NAMED line, the transfer out BY NAME.
    expect(screen.getByText('Uncategorised — not yet filed')).toBeInTheDocument();
    expect(screen.getByText(/\(1 in this stretch\)/)).toBeInTheDocument();

    // The P&L's shape: Income ABOVE Expenditure, net at the foot.
    const income = screen.getByRole('button', { name: 'Income' });
    const expenditure = screen.getByRole('button', { name: 'Expenditure' });
    expect(income.compareDocumentPosition(expenditure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Net = £24,000 − £6,200: named for its direction, worn the app's way.
    expect(screen.getByText('Net income')).toBeInTheDocument();
    expect(screen.getByText('+£17,800.00')).toBeInTheDocument();
    expect(screen.getByText('£1,483.33 a month')).toBeInTheDocument();

    // MOVED 22 Aug (Claude Design §10): the Budget-relationship promise left
    // the Actuals preamble — a disclaimer at the top of a page of history —
    // for the Forecast tab, beside the place a scenario would actually be
    // promoted. The Actuals side must NOT carry it; the tab's own spec below
    // asserts where it lives now.
    expect(screen.queryByText(/writes to your Budget/)).not.toBeInTheDocument();
  });

  it('carries the Budget promise on the Forecast tab, at the point of action', () => {
    renderForecast();

    fireEvent.click(screen.getByRole('button', { name: 'Forecast' }));

    expect(screen.getByText(/Nothing here will write to your Budget/)).toBeInTheDocument();
    expect(screen.getByText(/explicit, per-category say-so/)).toBeInTheDocument();
  });

  it('a section heading collapses to its total; a category expands to its rows', () => {
    renderForecast();

    // Collapse Income: Salary's row goes, the side total stays.
    fireEvent.click(screen.getByRole('button', { name: 'Income' }));
    expect(screen.queryByText('Salary')).not.toBeInTheDocument();
    expect(screen.getAllByText('+£24,000.00')).toHaveLength(1);

    // A category drills to the rows its figure is the sum of.
    fireEvent.click(screen.getByRole('button', { name: /Uncategorised — not yet filed/ }));
    expect(screen.getByText('Roof repair')).toBeInTheDocument();
  });

  it('a group heading hides and shows the categories below, keeping its subtotal', () => {
    renderForecast();

    fireEvent.click(screen.getByRole('button', { name: 'Living' }));
    expect(screen.queryByText('Food')).not.toBeInTheDocument();
    // The group's subtotal stands while its categories are folded away.
    expect(screen.getAllByText('(£1,200.00)')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Living' }));
    expect(screen.getByText('Food')).toBeInTheDocument();
  });

  it('sorts by value in either direction or by name — the unfiled remainder always last', () => {
    // Two groups a month back: Utilities (£900) outweighs Living (£100).
    renderForecast([], 'ready', [
      {
        id: 'txn-a', accountId: ACCOUNT.id, description: 'Grocer',
        amount: -100, date: monthAgo(1), type: 'expense', category: 'cat-food',
      },
      {
        id: 'txn-b', accountId: ACCOUNT.id, description: 'Water board',
        amount: -900, date: monthAgo(1), type: 'expense', category: 'cat-water',
      },
      {
        id: 'txn-c', accountId: ACCOUNT.id, description: 'Roof repair',
        amount: -5000, date: monthAgo(1), type: 'expense', category: '',
      },
    ], [
      ...CATEGORIES,
      { id: 'grp-util', name: 'Utilities', type: 'expense', level: 'sub' },
      { id: 'cat-water', name: 'Water', type: 'expense', level: 'detail', parentId: 'grp-util' },
    ]);

    const ordered = (first: string | RegExp, second: string | RegExp): boolean => {
      const a = screen.getByRole('button', { name: first });
      const b = screen.getByRole('button', { name: second });
      return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    };

    // Value, largest first is the default…
    expect(ordered('Utilities', 'Living')).toBe(true);
    // …A to Z reorders by name…
    fireEvent.click(screen.getByRole('button', { name: 'A to Z' }));
    expect(ordered('Living', 'Utilities')).toBe(true);
    // …and clicking it AGAIN turns the alphabet around (owner, 19 Aug:
    // "A-Z should be clickable to change to Z-A") — the label follows.
    fireEvent.click(screen.getByRole('button', { name: 'A to Z' }));
    expect(screen.getByRole('button', { name: 'Z to A' })).toBeInTheDocument();
    expect(ordered('Utilities', 'Living')).toBe(true);
    // ONE Value button, wearing an arrow: first click returns to value…
    fireEvent.click(screen.getByRole('button', { name: 'Value, largest first' }));
    expect(ordered('Utilities', 'Living')).toBe(true);
    // …second click turns the order around.
    fireEvent.click(screen.getByRole('button', { name: 'Value, largest first' }));
    expect(screen.getByRole('button', { name: 'Value, smallest first' })).toBeInTheDocument();
    expect(ordered('Living', 'Utilities')).toBe(true);
    // The unfiled £5,000 outweighs and out-alphabets both, and is still last.
    expect(ordered('Utilities', /Uncategorised — not yet filed/)).toBe(true);
  });

  it('the months are hidden by default, and the toggle spreads them across like a full P&L', () => {
    renderForecast();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show the months' }));

    // Twelve month columns plus Total and the monthly average.
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument();
    // Food's £100 in each of ITS OWN twelve cells — the section's cells
    // carry their own sums (£5,100 where the roof month lands).
    const foodRow = screen.getByRole('button', { name: /Food/ }).closest('tr') as HTMLElement;
    expect(within(foodRow).getAllByText('(£100.00)')).toHaveLength(12);

    fireEvent.click(screen.getByRole('button', { name: 'Hide the months' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('a forecast-exclusion verdict no longer thins the Current tab — actuals are whole', () => {
    renderForecast([excludedVerdict]);

    // The roof stays in the expenditure figures: £1,200 + £5,000.
    expect(screen.getByText('(£6,200.00)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Uncategorised — not yet filed/ })).toBeInTheDocument();
  });

  it('a custom window averages over ITS month count, not twelve', () => {
    // Three months, one £300 row in the middle one — £100 a month.
    const year = now.getFullYear() - 2;
    renderForecast([], 'ready', [{
      id: 'txn-past', accountId: ACCOUNT.id, description: 'Old grocer',
      amount: -300, date: new Date(year, 1, 10), type: 'expense', category: 'cat-food',
    }]);

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: `${year}-01` } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: `${year}-03` } });

    // FOUR agreeing figures by construction — the category, its group, its
    // side, and (with no income) the net — and £300 over three months is
    // £100 a month. The net's average wears the brackets its direction earns.
    expect(screen.getAllByText('(£300.00)')).toHaveLength(4);
    expect(screen.getByText('Net expenditure')).toBeInTheDocument();
    expect(screen.getAllByText('£100.00 a month')).toHaveLength(3);
    expect(screen.getByText('(£100.00) a month')).toBeInTheDocument();
  });

  it('the tax year window says its convention out loud', () => {
    renderForecast();
    fireEvent.click(screen.getByRole('button', { name: 'Tax year' }));
    expect(screen.getByText(/6 April \d{4} to 5 April \d{4}/)).toBeInTheDocument();
    expect(screen.getByText(/months run 6th to 5th, as tax months do/)).toBeInTheDocument();
  });

  it('ASKS for the lazy-loaded verdicts when they have never been loaded', async () => {
    renderForecast([], 'idle');
    await waitFor(() => {
      expect(refreshSuggestionDismissals).toHaveBeenCalled();
    });
  });
});

describe('Forecast — the Forecast tab', () => {
  it('is deliberately empty while the tool is designed, and names what is kept', async () => {
    seam.listForecastAdjustments.mockResolvedValue([
      { id: 'adj-1', categoryId: 'cat-food', monthlyMinor: 9000 },
    ]);
    renderForecast([excludedVerdict]);

    fireEvent.click(screen.getByRole('button', { name: 'Forecast' }));
    expect(screen.getByText(/it is being designed/)).toBeInTheDocument();
    // Stated judgments are not lost, and the tab says so by count.
    await waitFor(() => {
      expect(screen.getByText(/Kept for it: 1 adjusted category and 1 excluded one-off/)).toBeInTheDocument();
    });
    // The P&L itself is off-screen on this tab.
    expect(screen.queryByText('Net income')).not.toBeInTheDocument();
  });

  it('with nothing stated, it claims nothing — zero counts render nothing', () => {
    renderForecast();
    fireEvent.click(screen.getByRole('button', { name: 'Forecast' }));
    expect(screen.getByText(/it is being designed/)).toBeInTheDocument();
    expect(screen.queryByText(/Kept for it/)).not.toBeInTheDocument();
  });

  it('a failed adjustments read is said, never guessed at', async () => {
    seam.listForecastAdjustments.mockRejectedValue(new Error('offline'));
    renderForecast();
    fireEvent.click(screen.getByRole('button', { name: 'Forecast' }));
    await waitFor(() => {
      expect(screen.getByText(/could not be read just now/)).toBeInTheDocument();
    });
  });
});

describe('Forecast — whole pounds, this page\'s own checkbox', () => {
  it('ticking it drops the pennies from every figure on the statement', () => {
    renderForecast();

    // Pennies by default…
    expect(screen.getAllByText('+£24,000.00')).toHaveLength(2);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide decimals' }));
    // …whole pounds once asked: totals, averages, the net line, all of it.
    expect(screen.queryByText('+£24,000.00')).not.toBeInTheDocument();
    expect(screen.getAllByText('+£24,000')).toHaveLength(2);
    expect(screen.getByText('+£17,800')).toBeInTheDocument();
    expect(screen.getByText('£1,483 a month')).toBeInTheDocument();

    // And back, because it is a display choice, not a conversion.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide decimals' }));
    expect(screen.getAllByText('+£24,000.00')).toHaveLength(2);
  });
});
