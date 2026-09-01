/**
 * The budget wizard, through the UI.
 *
 * What is pinned here is the owner's design made visible: one question about
 * rhythm that decides which column takes typing, a grid with twelve complete
 * months of evidence beside every box, the fold that names what it is hiding,
 * and a confirm step that states the totals and every removal BY NAME before
 * anything is written.
 *
 * Every name and amount is invented: this repo is public. Dates are computed
 * from `new Date()` rather than spelled out, because the suite fixes its own
 * "now" and a hard-coded month would fall outside the window and read zero.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import BudgetWizard from './BudgetWizard';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import type { Budget, Category, Transaction } from '../types';

const toast = vi.hoisted(() => ({
  showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn(),
  showInfo: vi.fn(), showToast: vi.fn(), dismissToast: vi.fn(),
}));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => toast }));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (n: number | { toNumber: () => number }) =>
      `£${(typeof n === 'number' ? n : n.toNumber()).toFixed(2)}`,
    displayCurrency: 'GBP', getCurrencySymbol: () => '£',
    convert: vi.fn(), convertAndFormat: vi.fn(), convertAndSum: vi.fn(),
  }),
}));

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
  { id: 'grp-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-shop', name: 'Food Shopping', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'det-dining', name: 'Dining Out', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'det-quiet', name: 'Never Used', type: 'expense', level: 'detail', parentId: 'grp-food' },
  { id: 'det-still', name: 'Also Never Used', type: 'expense', level: 'detail', parentId: 'grp-food' },
];

/** £100 a month of shopping and £50 of dining, across the twelve complete months. */
const monthlySpend = (prefix: string, category: string, amount: number): Transaction[] => {
  const now = new Date();
  const anchor = new Date(now.getFullYear(), now.getMonth(), 0);
  return Array.from({ length: 12 }, (_, index) => ({
    id: `${prefix}-${index}`,
    accountId: 'acc-1',
    description: 'Synthetic row',
    amount: -amount,
    type: 'expense' as const,
    category,
    date: new Date(anchor.getFullYear(), anchor.getMonth() - index, 10),
  }));
};

const TRANSACTIONS: Transaction[] = [
  ...monthlySpend('shop', 'det-shop', 100),   // £1,200 a year
  ...monthlySpend('dine', 'det-dining', 50),  // £600 a year
];

/** What a test adds to the default world, for the few that need more of one. */
interface World {
  categories?: Category[];
  transactions?: Transaction[];
}

/**
 * A SECOND group, and the world that carries it.
 *
 * Kept out of the default fixture rather than added to it: most of the suite
 * pins row counts and totals that a second group would move, and the tests
 * that need one are exactly the tests about groups being counted APART.
 */
const TWO_GROUPS: World = {
  categories: [
    { id: 'grp-travel', name: 'Travel', type: 'expense', level: 'sub', parentId: 'type-expense' },
    { id: 'det-fares', name: 'Train Fares', type: 'expense', level: 'detail', parentId: 'grp-travel' },
  ],
  transactions: monthlySpend('fare', 'det-fares', 20),  // £240 a year
};

const addBudget = vi.fn(async () => {});
const updateBudget = vi.fn(async () => {});
const deleteBudget = vi.fn(async () => {});

const renderWizard = (budgets: Budget[] = [], world: World = {}): void => {
  __setAppContextValue({
    transactions: [...TRANSACTIONS, ...(world.transactions ?? [])],
    transactionSplits: [],
    categories: [...CATEGORIES, ...(world.categories ?? [])],
    budgets, addBudget, updateBudget, deleteBudget,
  });
  render(<BudgetWizard isOpen onClose={vi.fn()} />);
};

/** Answer step 1 and land on the grid. */
const chooseMonthly = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /Budget monthly/ }));
};
const chooseAnnually = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /Budget annually/ }));
};

const boxFor = (name: string, rhythm: 'Monthly' | 'Yearly' = 'Monthly'): HTMLElement =>
  screen.getByLabelText(`${rhythm} budget for ${name}`);

const rowFor = (name: string): HTMLElement =>
  screen.getByText(name).closest('tr') as HTMLElement;

/** A group's heading row — the shaded band that answers the same columns as its rows. */
const groupRow = (name: string): HTMLElement =>
  screen.getByRole('rowheader', { name }).closest('tr') as HTMLElement;

/** Its three figure cells, in the grid's own order: what it cost, the total, the twin. */
const groupCells = (name: string): HTMLElement[] => within(groupRow(name)).getAllByRole('cell');

/** Every £ figure in an element, as whole pence, so a test can add them up itself. */
const penceIn = (element: HTMLElement): number[] =>
  [...(element.textContent ?? '').matchAll(/£(\d+)\.(\d\d)/g)].map(
    ([, pounds, pence]) => Number(pounds) * 100 + Number(pence)
  );

/** What a group heading claims has been budgeted across it, in the rhythm being typed. */
const groupBudgetPence = (name: string): number => penceIn(groupCells(name)[1])[0] ?? 0;

/** What the scoreboard claims for the whole screen, in the same rhythm. */
const scoreboardPence = (): number => penceIn(screen.getByText(/Budgeted so far/))[0] ?? 0;

const budgetOf = (over: Partial<Budget> & { id: string; categoryId: string }): Budget => ({
  amount: 100, period: 'monthly', isActive: true, spent: 0,
  createdAt: new Date(), updatedAt: new Date(), ...over,
});

beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); __resetAppContextValue(); });

describe('step 1 — months or years', () => {
  it('asks one question before showing any grid', () => {
    renderWizard();
    expect(screen.getByText('Do you think in months or years?')).toBeInTheDocument();
    expect(screen.queryByLabelText('Monthly budget for Food Shopping')).not.toBeInTheDocument();
  });

  it('the monthly answer makes the monthly column the one you type in', () => {
    renderWizard();
    chooseMonthly();
    expect(boxFor('Food Shopping', 'Monthly')).toBeInTheDocument();
    expect(screen.queryByLabelText('Yearly budget for Food Shopping')).not.toBeInTheDocument();
  });

  it('the annual answer moves the typing to the year', () => {
    renderWizard();
    chooseAnnually();
    expect(boxFor('Food Shopping', 'Yearly')).toBeInTheDocument();
    expect(screen.queryByLabelText('Monthly budget for Food Shopping')).not.toBeInTheDocument();
  });

  it('lets you change your mind — Back returns to the question', () => {
    renderWizard();
    chooseMonthly();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Do you think in months or years?')).toBeInTheDocument();
  });
});

describe('step 2 — the evidence beside every box', () => {
  it('shows the year AND the month on every row, whichever is being typed', () => {
    renderWizard();
    chooseMonthly();
    const row = rowFor('Food Shopping');
    expect(within(row).getByText('£1200.00 a year')).toBeInTheDocument();
    expect(within(row).getByText('£100.00 a month')).toBeInTheDocument();
  });

  it('gives the grid a column for each of the four things (desktop)', () => {
    renderWizard();
    chooseMonthly();
    expect(screen.getByRole('columnheader', { name: /Category/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /What it cost/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Your budget, per month/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Which is/ })).toBeInTheDocument();
  });

  it('names the window it measured rather than describing it', () => {
    renderWizard();
    chooseMonthly();
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    const start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
    const month = (d: Date): string => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    expect(screen.getByText(`What you spent, ${month(start)} – ${month(end)}`)).toBeInTheDocument();
  });

  it('says the current month is not counted', () => {
    renderWizard();
    chooseMonthly();
    expect(screen.getByText(/this month is still running, so it is not counted/i)).toBeInTheDocument();
  });

  it('starts every box EMPTY — the history is a reference, not a default', () => {
    renderWizard();
    chooseMonthly();
    expect(boxFor('Food Shopping')).toHaveValue('');
  });

  it('files rows under their parent', () => {
    renderWizard();
    chooseMonthly();
    const body = groupRow('Food').closest('tbody') as HTMLElement;
    expect(within(body).getByLabelText('Monthly budget for Food Shopping')).toBeInTheDocument();
    expect(within(body).getByLabelText('Monthly budget for Dining Out')).toBeInTheDocument();
  });

  it('a typed monthly figure states its year', () => {
    renderWizard();
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '90' } });
    expect(within(rowFor('Food Shopping')).getByText('£1080.00 a year')).toBeInTheDocument();
  });

  it('a typed annual figure states its month', () => {
    renderWizard();
    chooseAnnually();
    // £1,800 rather than £1,200 on purpose: the history cell on this row
    // already reads "£100.00 a month", so a twin of £150.00 is the only way to
    // prove the twin is the figure being computed rather than the evidence.
    fireEvent.change(boxFor('Food Shopping', 'Yearly'), { target: { value: '1800' } });
    expect(within(rowFor('Food Shopping')).getByText('£150.00 a month')).toBeInTheDocument();
  });
});

describe('step 2 — filling boxes', () => {
  it('"use my actual" fills the box rather than saving behind you', () => {
    renderWizard();
    chooseMonthly();
    fireEvent.click(screen.getByLabelText('Use what Food Shopping actually cost'));
    expect(boxFor('Food Shopping')).toHaveValue('100');
    expect(addBudget).not.toHaveBeenCalled();
  });

  it('fills the ANNUAL figure when annual is the rhythm', () => {
    renderWizard();
    chooseAnnually();
    fireEvent.click(screen.getByLabelText('Use what Food Shopping actually cost'));
    expect(boxFor('Food Shopping', 'Yearly')).toHaveValue('1200');
  });

  it('"Start from history" fills every row with evidence, in one press', () => {
    renderWizard();
    chooseMonthly();
    fireEvent.click(screen.getByRole('button', { name: 'Start from history' }));
    expect(boxFor('Food Shopping')).toHaveValue('100');
    expect(boxFor('Dining Out')).toHaveValue('50');
  });

  it('"Clear all" puts the boxes back — it does not queue a removal of everything', () => {
    renderWizard([budgetOf({ id: 'b-1', categoryId: 'det-shop', amount: 120 })]);
    chooseMonthly();
    fireEvent.click(screen.getByRole('button', { name: 'Start from history' }));
    expect(boxFor('Food Shopping')).toHaveValue('100');
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    // Back to what is STORED, not empty — emptying is how a budget is removed.
    expect(boxFor('Food Shopping')).toHaveValue('120');
    expect(boxFor('Dining Out')).toHaveValue('');
  });

  it('offers no "use my actual" on a row with nothing in the window', () => {
    renderWizard();
    chooseMonthly();
    fireEvent.click(screen.getByRole('button', { name: /categories with nothing in this window/ }));
    expect(screen.queryByLabelText('Use what Never Used actually cost')).not.toBeInTheDocument();
  });
});

describe('step 2 — the measuring stick and the scoreboard', () => {
  it('the measured-over choice changes the named window and its explainer', () => {
    renderWizard();
    chooseMonthly();
    const lastYear = new Date().getFullYear() - 1;
    fireEvent.change(screen.getByLabelText(/Measured over/), {
      target: { value: 'calendar-year' },
    });
    expect(screen.getByText(`What you spent, Jan – Dec ${lastYear}`)).toBeInTheDocument();
    expect(screen.getByText(/The last complete calendar year/)).toBeInTheDocument();
  });

  it('changing the measuring stick never touches what was typed', () => {
    renderWizard();
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText(/Measured over/), {
      target: { value: 'calendar-year' },
    });
    // The evidence changed; the intent did not.
    expect(boxFor('Food Shopping')).toHaveValue('150');
  });

  it('the scoreboard counts a typed box as I go along', () => {
    renderWizard();
    chooseMonthly();
    expect(screen.getByText(/0 of 4 boxes filled/)).toBeInTheDocument();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '150' } });
    expect(screen.getByText(/1 of 4 boxes filled/)).toBeInTheDocument();
    // The budgeted side leads with the chosen rhythm's figure.
    expect(screen.getAllByText('£150.00').length).toBeGreaterThan(0);
  });
});

/**
 * THE GROUP HEADING IS A ROW OF THE GRID (owner, 2 Sep 2026).
 *
 * It used to be a banner laid across all four columns, with the group's SPEND
 * on the right where the budget columns are — "that is actually my spend for
 * the period, not my budget". So what is pinned here is that every figure on
 * the heading now sits under the column that describes it, and that the
 * budget total is the sum of that group's own boxes as they are typed: the
 * same arithmetic as the scoreboard, over a subset of the same boxes, which
 * is why the group figures must ADD UP to the scoreboard's exactly.
 */
describe('step 2 — the group heading is a row of the grid', () => {
  it('answers the same four columns its rows do, and takes no typing', () => {
    renderWizard();
    chooseMonthly();
    const row = groupRow('Food');
    // One heading cell and three figure cells — the grid's four columns.
    expect(within(row).getAllByRole('rowheader')).toHaveLength(1);
    expect(within(row).getAllByRole('cell')).toHaveLength(3);
    // Still context, never a box: budgeting a group AND its children double-counts.
    expect(within(row).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('puts what the group cost under "What it cost", both periods', () => {
    renderWizard();
    chooseMonthly();
    const [cost] = groupCells('Food');
    expect(cost).toHaveTextContent('£1800.00 a year');
    expect(cost).toHaveTextContent('£150.00 a month');
  });

  it('shows NO budget figure while every box in the group is empty', () => {
    renderWizard();
    chooseMonthly();
    const [, budget, twin] = groupCells('Food');
    // An empty box is no budget, so an untouched group has no total. £0.00
    // here would claim a budget of nothing across every row beneath it.
    expect(budget).toBeEmptyDOMElement();
    expect(twin).toBeEmptyDOMElement();
  });

  it('adds up its own boxes as they are typed, and says the twin beside it', () => {
    renderWizard();
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '90' } });
    fireEvent.change(boxFor('Dining Out'), { target: { value: '40.50' } });
    const [, budget, twin] = groupCells('Food');
    expect(budget).toHaveTextContent('£130.50');
    expect(twin).toHaveTextContent('£1566.00 a year');
  });

  it('does not move when a box in another group is filled', () => {
    renderWizard([], TWO_GROUPS);
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '90' } });
    fireEvent.change(boxFor('Dining Out'), { target: { value: '40.50' } });
    expect(groupBudgetPence('Food')).toBe(13050);

    fireEvent.change(boxFor('Train Fares'), { target: { value: '15' } });
    expect(groupBudgetPence('Food')).toBe(13050);
    expect(groupBudgetPence('Travel')).toBe(1500);
  });

  it('counts a typed nought, and stops counting a box that is cleared', () => {
    renderWizard();
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '40' } });
    fireEvent.change(boxFor('Dining Out'), { target: { value: '0' } });
    expect(groupBudgetPence('Food')).toBe(4000);

    // A nought is a budget of nothing: it is filled in, so the total remains
    // — as £0.00, which is a different claim from no figure at all.
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '' } });
    expect(groupCells('Food')[1]).toHaveTextContent('£0.00');

    fireEvent.change(boxFor('Dining Out'), { target: { value: '' } });
    expect(groupCells('Food')[1]).toBeEmptyDOMElement();
  });

  it('the group totals add up to the scoreboard, to the penny', () => {
    renderWizard([], TWO_GROUPS);
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '90' } });
    fireEvent.change(boxFor('Dining Out'), { target: { value: '40.50' } });
    fireEvent.change(boxFor('Train Fares'), { target: { value: '15' } });

    expect(scoreboardPence()).toBe(14550);
    expect(groupBudgetPence('Food') + groupBudgetPence('Travel')).toBe(scoreboardPence());
  });

  it('…and still adds up when the year is the rhythm being typed', () => {
    renderWizard([], TWO_GROUPS);
    chooseAnnually();
    fireEvent.change(boxFor('Food Shopping', 'Yearly'), { target: { value: '1080' } });
    fireEvent.change(boxFor('Dining Out', 'Yearly'), { target: { value: '486' } });
    fireEvent.change(boxFor('Train Fares', 'Yearly'), { target: { value: '180' } });

    expect(scoreboardPence()).toBe(174600);
    expect(groupBudgetPence('Food') + groupBudgetPence('Travel')).toBe(scoreboardPence());
    // The twin is the month now, on the heading as on every row.
    expect(groupCells('Food')[2]).toHaveTextContent('£130.50 a month');
  });

  it('turns over with a change of rhythm, scoreboard and all', () => {
    renderWizard();
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '90' } });
    expect(groupCells('Food')[2]).toHaveTextContent('£1080.00 a year');

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    chooseAnnually();
    // The same figure, read as a year now — so its twin is the month.
    expect(groupCells('Food')[2]).toHaveTextContent('£7.50 a month');
    expect(groupBudgetPence('Food')).toBe(scoreboardPence());
  });
});

describe('step 2 — the fold names what it hides', () => {
  it('folds the zero-spend categories away, with their count said out loud', () => {
    renderWizard();
    chooseMonthly();
    expect(screen.queryByText('Never Used')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '2 categories with nothing in this window' })
    ).toBeInTheDocument();
  });

  it('opens on a tap', () => {
    renderWizard();
    chooseMonthly();
    fireEvent.click(screen.getByRole('button', { name: /categories with nothing in this window/ }));
    expect(screen.getByText('Never Used')).toBeInTheDocument();
    expect(boxFor('Never Used')).toBeInTheDocument();
  });

  it('never folds a category that already has a budget, however quiet it is', () => {
    renderWizard([budgetOf({ id: 'b-q', categoryId: 'det-quiet', amount: 25 })]);
    chooseMonthly();
    // Visible without expanding anything: a removal you cannot see is not an offer.
    expect(screen.getByText('Never Used')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '1 category with nothing in this window' })
    ).toBeInTheDocument();
  });
});

describe('step 2 — existing budgets arrive pre-filled', () => {
  it('shows a stored monthly budget in the monthly box', () => {
    renderWizard([budgetOf({ id: 'b-1', categoryId: 'det-shop', amount: 120 })]);
    chooseMonthly();
    expect(boxFor('Food Shopping')).toHaveValue('120');
  });

  it('converts a stored yearly budget for display when months are being typed', () => {
    renderWizard([budgetOf({ id: 'b-1', categoryId: 'det-shop', amount: 1500, period: 'yearly' })]);
    chooseMonthly();
    expect(boxFor('Food Shopping')).toHaveValue('125');
  });

  it('leaves a weekly budget alone and says where to change it', () => {
    renderWizard([budgetOf({ id: 'b-wk', categoryId: 'det-shop', amount: 30, period: 'weekly' })]);
    chooseMonthly();
    expect(screen.queryByLabelText('Monthly budget for Food Shopping')).not.toBeInTheDocument();
    expect(screen.getByText(/left as it is\. Change it on the Budget page/)).toBeInTheDocument();
  });
});

describe('step 3 — what will happen, before it happens', () => {
  const review = (): void => fireEvent.click(screen.getByRole('button', { name: 'Review' }));

  it('states the count, the month, the year and what was really spent', () => {
    renderWizard();
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '90' } });
    fireEvent.change(boxFor('Dining Out'), { target: { value: '40' } });
    review();
    expect(screen.getByText("You're budgeting 2 categories")).toBeInTheDocument();
    expect(
      screen.getByText(/£130\.00 a month \(£1560\.00 a year\), against £1800\.00 actually spent/)
    ).toBeInTheDocument();
  });

  it('names a shortfall in words rather than leaving it to be worked out', () => {
    renderWizard();
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '90' } });
    review();
    expect(screen.getByText(/£120\.00 a year LESS than they really cost/)).toBeInTheDocument();
  });

  it('names headroom when the budgets allow more than the year cost', () => {
    renderWizard();
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '150' } });
    review();
    expect(screen.getByText(/£600\.00 a year MORE than they really cost/)).toBeInTheDocument();
  });

  it('lists every removal BY NAME', () => {
    renderWizard([budgetOf({ id: 'b-1', categoryId: 'det-shop', amount: 120 })]);
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '' } });
    review();
    expect(screen.getByText('1 budget will be removed: Food Shopping.')).toBeInTheDocument();
  });

  it('says plainly when nothing has changed, and will not save', () => {
    renderWizard();
    chooseMonthly();
    review();
    expect(screen.getByText('Nothing has changed, so there is nothing to save.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save budgets' })).toBeDisabled();
  });
});

describe('what it writes', () => {
  const reviewAndSave = (): void => {
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save budgets' }));
  };

  it('creates a budget on the category, in the chosen rhythm', async () => {
    renderWizard();
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '90' } });
    reviewAndSave();

    await waitFor(() => expect(addBudget).toHaveBeenCalledTimes(1));
    expect(addBudget).toHaveBeenCalledWith(expect.objectContaining({
      categoryId: 'det-shop', amount: 90, period: 'monthly', isActive: true,
    }));
  });

  it('writes the ANNUAL period when annual was the rhythm', async () => {
    renderWizard();
    chooseAnnually();
    fireEvent.change(boxFor('Food Shopping', 'Yearly'), { target: { value: '1500' } });
    reviewAndSave();

    await waitFor(() => expect(addBudget).toHaveBeenCalledTimes(1));
    expect(addBudget).toHaveBeenCalledWith(expect.objectContaining({
      amount: 1500, period: 'yearly',
    }));
  });

  it('writes a typed ZERO — a budget of nothing is a budget', async () => {
    renderWizard();
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '0' } });
    reviewAndSave();

    await waitFor(() => expect(addBudget).toHaveBeenCalledTimes(1));
    expect(addBudget).toHaveBeenCalledWith(expect.objectContaining({ amount: 0 }));
  });

  it('writes NOTHING for a box left empty', async () => {
    renderWizard();
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '90' } });
    reviewAndSave();

    await waitFor(() => expect(addBudget).toHaveBeenCalledTimes(1));
    expect(addBudget).not.toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'det-dining' }));
  });

  it('edits the budget that is there rather than adding a second', async () => {
    renderWizard([budgetOf({ id: 'b-1', categoryId: 'det-shop', amount: 120 })]);
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '95' } });
    reviewAndSave();

    await waitFor(() => expect(updateBudget).toHaveBeenCalledTimes(1));
    expect(updateBudget).toHaveBeenCalledWith('b-1', { amount: 95, period: 'monthly' });
    expect(addBudget).not.toHaveBeenCalled();
  });

  it('removes the budget behind a box that was emptied', async () => {
    renderWizard([budgetOf({ id: 'b-1', categoryId: 'det-shop', amount: 120 })]);
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '' } });
    reviewAndSave();

    await waitFor(() => expect(deleteBudget).toHaveBeenCalledWith('b-1'));
    expect(updateBudget).not.toHaveBeenCalled();
  });

  it('never touches alert thresholds — it does not ask, so it does not answer', async () => {
    renderWizard([budgetOf({ id: 'b-1', categoryId: 'det-shop', amount: 120, alertThreshold: 0.9 })]);
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '95' } });
    reviewAndSave();

    await waitFor(() => expect(updateBudget).toHaveBeenCalledTimes(1));
    expect(updateBudget).toHaveBeenCalledWith('b-1', expect.not.objectContaining({ alertThreshold: expect.anything() }));
  });

  it('reports which rows failed instead of claiming a clean save', async () => {
    updateBudget.mockRejectedValueOnce(new Error('offline'));
    renderWizard([
      budgetOf({ id: 'b-1', categoryId: 'det-shop', amount: 120 }),
      budgetOf({ id: 'b-2', categoryId: 'det-dining', amount: 60 }),
    ]);
    chooseMonthly();
    fireEvent.change(boxFor('Food Shopping'), { target: { value: '95' } });
    fireEvent.change(boxFor('Dining Out'), { target: { value: '65' } });
    reviewAndSave();

    // The second row still ran: one failure does not strand the batch.
    await waitFor(() => expect(updateBudget).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(toast.showError).toHaveBeenCalledWith(expect.stringContaining('Food Shopping'))
    );
    expect(toast.showSuccess).not.toHaveBeenCalled();
  });
});
