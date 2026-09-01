/**
 * Re-categorise past transactions — the housekeeping tool, through the UI.
 *
 * What these pin is everything that makes a BULK re-filing safe to hand to
 * someone with fifteen years of history: the population is rows that already
 * have a category and nothing else (the review band owns the blanks, and a
 * transfer takes no category at all), the exclusions are counted out loud
 * rather than being a silent shortfall, a cap that hides rows says so and
 * still lets the press cover every match, the write is the three fields of a
 * filing and never a deletion, and a press that was wrong can be taken back.
 *
 * Every name and amount is invented: this repo is public.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import RecategoriseSection from './RecategoriseSection';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import { NO_SURVIVORS } from '../utils/transferSurvivorRelease';
import type { Category, Transaction } from '../types';

const toast = vi.hoisted(() => ({
  showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn(),
  showInfo: vi.fn(), showToast: vi.fn(), dismissToast: vi.fn(),
}));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => toast }));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `£${Number(amount).toFixed(2)}`,
    displayCurrency: 'GBP', getCurrencySymbol: () => '£',
    convert: vi.fn(), convertAndFormat: vi.fn(), convertAndSum: vi.fn(),
  }),
}));

vi.mock('../hooks/useAccountNames', () => ({
  useAccountNames: () => (id: string) => ({
    'acc-current': 'Everyday account',
    'acc-joint': 'Household account',
  }[id] ?? id),
}));

const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'sub-earnings', name: 'Earnings', type: 'income', level: 'sub', parentId: 'type-income' },
  { id: 'cat-salary', name: 'Salary', type: 'income', level: 'detail', parentId: 'sub-earnings' },
  { id: 'cat-refunds', name: 'Refunds', type: 'income', level: 'detail', parentId: 'sub-earnings' },
  { id: 'sub-day', name: 'Day to day', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-personal', name: 'Personal spending', type: 'expense', level: 'detail', parentId: 'sub-day' },
  { id: 'cat-food', name: 'Food shopping', type: 'expense', level: 'detail', parentId: 'sub-day' },
  { id: 'cat-travel', name: 'Travel', type: 'expense', level: 'detail', parentId: 'sub-day' },
];

/**
 * Local-part dates, never a parsed ISO string: the suite runs under a fixed
 * clock in whatever zone the machine is in, and `new Date('2024-11-05')` is
 * the 4th of November for half the planet.
 */
const day = (year: number, month: number, date: number): Date => new Date(year, month - 1, date);

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: day(2024, 11, 5),
  amount: -42.5,
  description: 'Blossom Lane Market',
  category: 'cat-personal',
  accountId: 'acc-current',
  type: 'expense',
  categoryConfirmed: false,
  needsReview: true,
  ...over,
});

/** Filed, and the row the driving case is about: dumped in Personal spending. */
const MARKET = txn({ id: 'txn-market' });
/** Filed elsewhere, and only reachable by what its NOTES say. */
const FUEL = txn({
  id: 'txn-fuel',
  description: 'Zenith Forecourt',
  notes: 'Blossom Lane Market run',
  category: 'cat-travel',
  amount: -61.2,
  accountId: 'acc-joint',
});
/** Money in, so a mixed selection has something to be mixed with. */
const PAY = txn({
  id: 'txn-pay',
  description: 'Monthly pay',
  amount: 1200,
  category: 'cat-salary',
  type: 'income',
  categoryConfirmed: true,
  needsReview: false,
});
/** The same words, the same amount — and no category. Categorisation's row. */
const UNFILED = txn({ id: 'txn-unfiled', category: '' });
/** The same words again, moving money between two of the user's own accounts. */
const MOVED = txn({ id: 'txn-moved', type: 'transfer', amount: -100 });
/** The mirror of MARKET's amount, so "£42.50" can be asked about as a size. */
const REFUND = txn({
  id: 'txn-refund',
  description: 'Riverbank Refund',
  amount: 42.5,
  category: 'cat-refunds',
  type: 'income',
});

const setup = (
  transactions: Transaction[],
  overrides: Partial<Parameters<typeof __setAppContextValue>[0]> = {}
): void => {
  __setAppContextValue({ transactions, categories: CATEGORIES, ...overrides });
  render(<RecategoriseSection />);
  fireEvent.click(screen.getByRole('button', { name: 'Show' }));
};

const chooseKind = (position: number, kind: string): void => {
  fireEvent.change(screen.getByLabelText(`What to filter by, filter ${position}`), {
    target: { value: kind },
  });
};

const typeWords = (position: number, value: string): void => {
  fireEvent.change(screen.getByLabelText(`Words to look for, filter ${position}`), {
    target: { value },
  });
};

const chooseCategoryFilter = (position: number, categoryId: string): void => {
  chooseKind(position, 'category');
  fireEvent.change(screen.getByLabelText(`Current category, filter ${position}`), {
    target: { value: categoryId },
  });
};

const addFilter = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Add a filter' }));
};

/** One per drawn row, so this counts what is actually on screen. */
const drawnRows = (): HTMLElement[] =>
  screen.queryAllByRole('button', { name: /^Save the category for/ });

const rowDescriptions = (): string[] =>
  drawnRows().map(button => {
    const label = button.getAttribute('aria-label') ?? '';
    return label.replace(/^Save the category for /, '').replace(/ on .*$/, '');
  });

const selectAll = (): void => {
  fireEvent.click(screen.getByLabelText(/^Select all/));
};

const chooseBulkCategory = (categoryId: string): void => {
  fireEvent.change(
    screen.getByLabelText('Category to file the selected transactions under'),
    { target: { value: categoryId } }
  );
};

const pressBulkChange = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /^Change \d+ transactions?$/ }));
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); __resetAppContextValue(); });

describe('Re-categorise — what is searchable at all', () => {
  it('never lists an uncategorised row, however well it matches', () => {
    setup([MARKET, UNFILED]);
    typeWords(1, 'Blossom Lane');

    expect(rowDescriptions()).toEqual(['Blossom Lane Market']);
    // Same words, same amount, same account — it is out because it has no
    // category, which is Accounts → Categorisation's work.
    expect(drawnRows()).toHaveLength(1);
  });

  it('leaves transfers out and says how many it left out', () => {
    setup([MARKET, MOVED]);
    typeWords(1, 'Blossom Lane');

    expect(rowDescriptions()).toEqual(['Blossom Lane Market']);
    expect(screen.getByText(/1 transfer matched and is not shown/)).toBeInTheDocument();
    expect(screen.getByText(/transfers move money between your accounts/)).toBeInTheDocument();
  });

  it('says nothing at all when no transfer matched', () => {
    setup([MARKET, PAY, MOVED]);
    chooseCategoryFilter(1, 'cat-salary');

    expect(rowDescriptions()).toEqual(['Monthly pay']);
    expect(screen.queryByText(/transfer/i)).not.toBeInTheDocument();
  });

  it('lists nothing until a filter carries a value', () => {
    setup([MARKET, FUEL, PAY]);

    expect(drawnRows()).toHaveLength(0);
    expect(screen.getByText(/Nothing is searched until you ask something/)).toBeInTheDocument();
    // An empty box is not a search: a filter row exists but says nothing.
    expect(screen.queryByLabelText(/^Select all/)).not.toBeInTheDocument();
  });
});

describe('Re-categorise — the filters', () => {
  it('matches the description or the notes', () => {
    setup([MARKET, FUEL, PAY]);
    typeWords(1, 'blossom lane');

    expect(rowDescriptions().sort()).toEqual(['Blossom Lane Market', 'Zenith Forecourt']);
  });

  it('stacks filters with AND — the category and the words together', () => {
    setup([MARKET, FUEL, PAY]);
    chooseCategoryFilter(1, 'cat-personal');
    addFilter();
    typeWords(2, 'blossom');

    // FUEL says "Blossom Lane Market" in its notes but is filed under Travel,
    // so the pair of filters excludes it where either alone would not.
    expect(rowDescriptions()).toEqual(['Blossom Lane Market']);
  });

  it('matches an amount by its size, whichever way the money went', () => {
    setup([MARKET, REFUND, PAY, FUEL]);
    chooseKind(1, 'amount');
    fireEvent.change(
      screen.getByLabelText(/^Smallest amount, ignoring whether it went in or out/),
      { target: { value: '42' } }
    );
    fireEvent.change(
      screen.getByLabelText(/^Largest amount, ignoring whether it went in or out/),
      { target: { value: '43' } }
    );

    // −42.50 and +42.50 both, and neither of the other two.
    expect(rowDescriptions().sort()).toEqual(['Blossom Lane Market', 'Riverbank Refund']);
  });

  it('takes a date range by its ends, both of them inclusive', () => {
    const early = txn({ id: 'txn-early', description: 'Old year', date: day(2023, 12, 31) });
    const onFrom = txn({ id: 'txn-on-from', description: 'New year', date: day(2024, 1, 1) });
    const onTo = txn({ id: 'txn-on-to', description: 'Twelfth night', date: day(2024, 1, 6) });
    const late = txn({ id: 'txn-late', description: 'Later still', date: day(2024, 1, 7) });
    setup([early, onFrom, onTo, late]);
    chooseKind(1, 'date');
    fireEvent.change(screen.getByLabelText('From date, filter 1'), {
      target: { value: '2024-01-01' },
    });
    fireEvent.change(screen.getByLabelText('To date, filter 1'), {
      target: { value: '2024-01-06' },
    });

    expect(rowDescriptions().sort()).toEqual(['New year', 'Twelfth night']);
  });

  it('takes one end of a date range on its own', () => {
    const early = txn({ id: 'txn-early', description: 'Old year', date: day(2023, 12, 31) });
    const later = txn({ id: 'txn-later', description: 'New year', date: day(2024, 1, 1) });
    setup([early, later]);
    chooseKind(1, 'date');
    fireEvent.change(screen.getByLabelText('From date, filter 1'), {
      target: { value: '2024-01-01' },
    });

    expect(rowDescriptions()).toEqual(['New year']);
  });

  it('narrows to one account, naming it the way the rest of the app does', () => {
    setup([MARKET, FUEL]);
    chooseKind(1, 'account');
    fireEvent.change(screen.getByLabelText('Account, filter 1'), {
      target: { value: 'acc-joint' },
    });

    expect(rowDescriptions()).toEqual(['Zenith Forecourt']);
    expect(screen.getByRole('option', { name: 'Household account' })).toBeInTheDocument();
  });

  it('offers only the tags the searchable rows actually carry', () => {
    const tagged = txn({ id: 'txn-tagged', description: 'Market run', tags: ['holiday'] });
    const untagged = txn({ id: 'txn-untagged', description: 'Corner shop' });
    // A tag that exists only on an uncategorised row is not a tag this tool
    // can search by, because that row is not in the population.
    const unfiledTag = txn({ id: 'txn-unfiled-tag', category: '', tags: ['loft'] });
    setup([tagged, untagged, unfiledTag]);
    chooseKind(1, 'tag');

    const picker = screen.getByLabelText('Tag, filter 1');
    const offered = Array.from(picker.querySelectorAll('option')).map(option => option.value);
    expect(offered).toEqual(['', 'holiday']);

    fireEvent.change(picker, { target: { value: 'holiday' } });
    expect(rowDescriptions()).toEqual(['Market run']);
  });

  it('drops everything answering the old question when the search changes', () => {
    setup([MARKET, FUEL]);
    typeWords(1, 'blossom lane');
    selectAll();
    expect(screen.getByRole('button', { name: 'Change 2 transactions' })).toBeInTheDocument();

    typeWords(1, 'zenith');
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });
});

describe('Re-categorise — the display cap', () => {
  const MANY: Transaction[] = Array.from({ length: 250 }, (_, index) =>
    txn({
      id: `txn-many-${index}`,
      description: `Ledger line ${index}`,
      amount: -(index + 1),
    })
  );

  it('draws 200, names the whole match, and still selects all of it', () => {
    setup(MANY);
    chooseCategoryFilter(1, 'cat-personal');

    expect(drawnRows()).toHaveLength(200);
    expect(screen.getByText(/Showing the first 200 of 250 matched/)).toBeInTheDocument();
    expect(screen.getByText(/it covers all 250 matched when everything is ticked/)).toBeInTheDocument();

    // "All" is the whole match, not the drawn 200 — that is the point of it.
    selectAll();
    expect(screen.getByRole('button', { name: 'Change 250 transactions' })).toBeInTheDocument();

    chooseBulkCategory('cat-food');
    pressBulkChange();
    expect(screen.getByText(/This files 250 transactions under/)).toBeInTheDocument();
  });
});

describe('Re-categorise — the bulk change', () => {
  it('asks first, then writes exactly a filing to every selected row', async () => {
    const updateTransaction = vi.fn(async (..._args: unknown[]) => {});
    const deleteTransaction = vi.fn(async () => NO_SURVIVORS);
    setup([MARKET, FUEL, PAY], { updateTransaction, deleteTransaction });
    typeWords(1, 'blossom lane');
    selectAll();
    chooseBulkCategory('cat-food');
    pressBulkChange();

    // Nothing is written by opening the question.
    expect(updateTransaction).not.toHaveBeenCalled();
    expect(screen.getByText(/replacing whatever category each currently has/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Change them' }));

    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(2));
    expect(updateTransaction).toHaveBeenCalledWith('txn-market', {
      category: 'cat-food', categoryConfirmed: true, needsReview: false,
    });
    expect(updateTransaction).toHaveBeenCalledWith('txn-fuel', {
      category: 'cat-food', categoryConfirmed: true, needsReview: false,
    });
    // THE SAFETY PROPERTY: a re-filing is not a removal.
    expect(deleteTransaction).not.toHaveBeenCalled();
  });

  it('leaves the question unanswered when it is cancelled', async () => {
    const updateTransaction = vi.fn(async (..._args: unknown[]) => {});
    setup([MARKET, FUEL], { updateTransaction });
    typeWords(1, 'blossom lane');
    selectAll();
    chooseBulkCategory('cat-food');
    pressBulkChange();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByText(/replacing whatever category each currently has/)).not.toBeInTheDocument()
    );
    expect(updateTransaction).not.toHaveBeenCalled();
  });

  it('moves money in and money out in one press, with no refusal by direction', async () => {
    const updateTransaction = vi.fn(async (..._args: unknown[]) => {});
    setup([MARKET, PAY], { updateTransaction });
    chooseKind(1, 'amount');
    fireEvent.change(
      screen.getByLabelText(/^Smallest amount, ignoring whether it went in or out/),
      { target: { value: '1' } }
    );
    selectAll();
    // An EXPENSE category for both, including the pay: the owner's ruling is
    // that a mixed move is allowed and the colours are what keep it legible.
    chooseBulkCategory('cat-food');
    pressBulkChange();
    fireEvent.click(screen.getByRole('button', { name: 'Change them' }));

    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(2));
    expect(updateTransaction).toHaveBeenCalledWith('txn-pay', {
      category: 'cat-food', categoryConfirmed: true, needsReview: false,
    });
    expect(screen.getByText(/now filed under Day to day : Food shopping/)).toBeInTheDocument();
  });

  it('counts the rows it could not change and says what became of them', async () => {
    const updateTransaction = vi.fn(async (...args: unknown[]) => {
      if (args[0] === 'txn-fuel' || args[0] === 'txn-pay') throw new Error('the write was refused');
    });
    setup([MARKET, FUEL, PAY], { updateTransaction });
    chooseKind(1, 'amount');
    fireEvent.change(
      screen.getByLabelText(/^Smallest amount, ignoring whether it went in or out/),
      { target: { value: '1' } }
    );
    selectAll();
    chooseBulkCategory('cat-food');
    pressBulkChange();
    fireEvent.click(screen.getByRole('button', { name: 'Change them' }));

    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(3));
    // The whole sentence, counts included — read off the live region the press
    // reports itself in rather than a fragment of it.
    const account = await screen.findByRole('status');
    expect(account.textContent).toContain('1 transaction is now filed under Day to day : Food shopping.');
    expect(account.textContent).toContain('2 could not be changed and keep their current categories.');
  });

  it('shows the amounts in the register colours, so a mixed selection reads', () => {
    setup([MARKET, PAY]);
    chooseKind(1, 'amount');
    fireEvent.change(
      screen.getByLabelText(/^Smallest amount, ignoring whether it went in or out/),
      { target: { value: '1' } }
    );

    const out = screen.getByText('−£42.50');
    const inward = screen.getByText('+£1200.00');
    expect(out.className).toContain('text-red-600');
    expect(inward.className).toContain('text-green-600');
  });
});

describe('Re-categorise — the migration this exists for', () => {
  /** The category id an update names, read off an untyped call the way the
      real context receives it. */
  const categoryFrom = (updates: unknown): string | null =>
    typeof updates === 'object' && updates !== null && 'category' in updates
      && typeof updates.category === 'string'
      ? updates.category
      : null;

  it('keeps the account of the press when the rows it changed leave the search', async () => {
    // A write that really lands: the rows take their new category, so the
    // "Personal spending" search that found them stops matching them — which
    // is the whole point of the migration and, until the summary was moved out
    // of the results, the moment it disappeared.
    let ledger: Transaction[] = [MARKET, txn({ id: 'txn-second', description: 'Corner Shop' })];
    const updateTransaction = vi.fn(async (...args: unknown[]) => {
      const category = categoryFrom(args[1]);
      if (category === null) return;
      ledger = ledger.map(row => (row.id === args[0] ? { ...row, category } : row));
      __setAppContextValue({ transactions: ledger });
    });
    setup(ledger, { updateTransaction });
    chooseCategoryFilter(1, 'cat-personal');
    expect(drawnRows()).toHaveLength(2);

    selectAll();
    chooseBulkCategory('cat-food');
    pressBulkChange();
    fireEvent.click(screen.getByRole('button', { name: 'Change them' }));

    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(2));
    // The list is empty because the press worked…
    await waitFor(() => expect(drawnRows()).toHaveLength(0));
    // …and the press still says what it did, with the way back still there.
    expect(screen.getByText(/now filed under Day to day : Food shopping/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    // The emptied category is still nameable, so the filter still displays
    // what it is still applying.
    expect(screen.getByLabelText('Current category, filter 1')).toHaveValue('cat-personal');
  });
});

describe('Re-categorise — undo', () => {
  it('gives every changed row its own category and flags back', async () => {
    const updateTransaction = vi.fn(async (..._args: unknown[]) => {});
    setup([MARKET, PAY], { updateTransaction });
    chooseKind(1, 'amount');
    fireEvent.change(
      screen.getByLabelText(/^Smallest amount, ignoring whether it went in or out/),
      { target: { value: '1' } }
    );
    selectAll();
    chooseBulkCategory('cat-food');
    pressBulkChange();
    fireEvent.click(screen.getByRole('button', { name: 'Change them' }));
    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(2));

    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(4));
    // Each row's OWN previous filing, flags included — MARKET was an unagreed
    // guess still awaiting review, PAY was settled.
    expect(updateTransaction).toHaveBeenCalledWith('txn-market', {
      category: 'cat-personal', categoryConfirmed: false, needsReview: true,
    });
    expect(updateTransaction).toHaveBeenCalledWith('txn-pay', {
      category: 'cat-salary', categoryConfirmed: true, needsReview: false,
    });
    expect(await screen.findByText(/back under the categories they had before/)).toBeInTheDocument();
  });

  it('is one shot — it is gone once used', async () => {
    const updateTransaction = vi.fn(async (..._args: unknown[]) => {});
    setup([MARKET, FUEL], { updateTransaction });
    typeWords(1, 'blossom lane');
    selectAll();
    chooseBulkCategory('cat-food');
    pressBulkChange();
    fireEvent.click(screen.getByRole('button', { name: 'Change them' }));
    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(2));

    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(4));
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });
});

describe('Re-categorise — one row at a time', () => {
  it('saves the row that was changed and no other', async () => {
    const updateTransaction = vi.fn(async (..._args: unknown[]) => {});
    const deleteTransaction = vi.fn(async () => NO_SURVIVORS);
    setup([MARKET, FUEL], { updateTransaction, deleteTransaction });
    typeWords(1, 'blossom lane');

    fireEvent.change(screen.getByLabelText(/^Category for Blossom Lane Market/), {
      target: { value: 'cat-travel' },
    });
    fireEvent.click(screen.getByLabelText(/^Save the category for Blossom Lane Market/));

    await waitFor(() => expect(updateTransaction).toHaveBeenCalledTimes(1));
    expect(updateTransaction).toHaveBeenCalledWith('txn-market', {
      category: 'cat-travel', categoryConfirmed: true, needsReview: false,
    });
    expect(deleteTransaction).not.toHaveBeenCalled();
    expect(toast.showSuccess).toHaveBeenCalled();
  });

  it('offers no save until the category is actually changed', () => {
    setup([MARKET], { });
    typeWords(1, 'blossom lane');

    const save = screen.getByLabelText(/^Save the category for Blossom Lane Market/);
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Category for Blossom Lane Market/), {
      target: { value: 'cat-food' },
    });
    expect(save).toBeEnabled();
  });

  it('offers both directions in every picker, whatever the row is', () => {
    setup([MARKET]);
    typeWords(1, 'blossom lane');

    const picker = screen.getByLabelText(/^Category for Blossom Lane Market/);
    const bands = Array.from(picker.querySelectorAll('optgroup')).map(band => band.label);
    expect(bands).toEqual(['Income', 'Expense']);
    const values = Array.from(picker.querySelectorAll('option')).map(option => option.value);
    expect(values).toContain('cat-salary');
    expect(values).toContain('cat-food');
  });
});

describe('Re-categorise — the standing note', () => {
  it('says what changing history does not change', () => {
    setup([MARKET]);
    expect(
      screen.getByText(/suggestions keep learning from everything you file/)
    ).toBeInTheDocument();
  });
});
