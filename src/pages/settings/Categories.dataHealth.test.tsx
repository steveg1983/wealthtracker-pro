/**
 * Settings → Categories: the Data Health panel's REMEDIES.
 *
 * The panel already named the problems. Naming a problem and leaving the user
 * to find the cure is how a health panel becomes wallpaper, so every line it
 * shows now ends in an action that lands where those exact rows are fixed.
 * These tests pin all four lines' actions, and pin the older rule they must not
 * break: a measure that is zero says nothing at all.
 *
 * Which surface each action picks is a decision with a reason, and the reasons
 * are what these tests are really protecting:
 *
 *  - the import's "Unassigned" bucket holds SPLIT LINES (the splits schema
 *    forbids a blank category, so the MS Money importer parks them in a bucket).
 *    A split line's category lives on the line, and only the parent's editor can
 *    change it — which is what a row in that bucket's transaction list opens.
 *    The review band's inline picker CANNOT: it fills blanks only, and these
 *    rows are not blank. So this action opens the bucket's list, here;
 *  - an empty category is deleted from the tree on this page, behind
 *    Edit → Delete mode, so the action arrives in that mode with the empty rows
 *    expanded, highlighted and the first one scrolled to;
 *  - a row filed under a category that NO LONGER EXISTS is still filed, so it
 *    is housekeeping: the Re-categorise section at the foot of this page opens
 *    on exactly those rows. It used to link to Categorisation, which linked
 *    back here, and the rows were never on screen in either direction — the
 *    loop the owner reported on 1 Sep 2026 from a real user.
 *
 * Every category, transaction and figure below is invented: this repo is public.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoriesSettings from './Categories';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Category, Transaction, TransactionSplit } from '../../types';

const toast = vi.hoisted(() => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showWarning: vi.fn(),
  showInfo: vi.fn(),
  showToast: vi.fn(),
  dismissToast: vi.fn(),
}));

vi.mock('../../contexts/ToastContext', () => ({ useToast: () => toast }));

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) =>
      Number(amount) < 0
        ? `(£${Math.abs(Number(amount)).toFixed(2)})`
        : `£${Number(amount).toFixed(2)}`,
    displayCurrency: 'GBP',
    getCurrencySymbol: () => '£',
    convert: vi.fn(),
    convertAndFormat: vi.fn(),
    convertAndSum: vi.fn(),
  }),
}));

const BUCKET = 'cat-unassigned';
const EMPTY_A = 'cat-never-used';
const EMPTY_B = 'cat-also-unused';

const CATEGORIES: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },
  { id: 'sub-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'sub-food' },
  { id: EMPTY_A, name: 'Never Used', type: 'expense', level: 'detail', parentId: 'sub-food' },
  { id: EMPTY_B, name: 'Also Unused', type: 'expense', level: 'detail', parentId: 'sub-food' },
  {
    id: BUCKET, name: 'Unassigned (import)', type: 'both', level: 'detail',
    parentId: 'type-expense', isUnassignedBucket: true,
  },
];

const txn = (over: Partial<Transaction> & { id: string }): Transaction => ({
  date: new Date('2026-05-01'),
  amount: -20,
  description: 'Synthetic shop',
  category: 'cat-groceries',
  accountId: 'acc-current',
  type: 'expense',
  ...over,
});

/** A split whose two lines are BOTH parked in the importer's bucket. */
const SPLIT_PARENT = txn({ id: 'txn-split', category: '', isSplit: true, amount: -60 });
const SPLITS: TransactionSplit[] = [
  { id: 's1', transactionId: 'txn-split', category: BUCKET, amount: -40, sortOrder: 1 },
  { id: 's2', transactionId: 'txn-split', category: BUCKET, amount: -20, sortOrder: 2 },
];

const setup = (
  overrides: Record<string, unknown> = {},
  /** The address the page is opened at — one remedy arrives in it. */
  entry: string = '/settings/categories'
): void => {
  __setAppContextValue({
    categories: CATEGORIES,
    transactions: [txn({ id: 'txn-filed' }), SPLIT_PARENT],
    transactionSplits: SPLITS,
    budgets: [],
    accounts: [{
      id: 'acc-current', name: 'Synthetic Current', type: 'current', balance: 0,
      currency: 'GBP', lastUpdated: new Date('2026-05-01'),
    }],
    getSubCategories: (parentId?: string) => CATEGORIES.filter(c => c.parentId === parentId),
    getDetailCategories: (parentId?: string) => CATEGORIES.filter(c => c.parentId === parentId),
    ...overrides,
  });
  render(
    <MemoryRouter initialEntries={[entry]}>
      <CategoriesSettings />
    </MemoryRouter>
  );
};

/** Filed under a category that was deleted, alongside one that is filed properly. */
const DANGLING_LEDGER = {
  transactions: [
    txn({ id: 'txn-orphan', description: 'Ashvale Hardware', category: 'was-deleted-long-ago' }),
    txn({ id: 'txn-filed', description: 'Riverbank Groceries' }),
  ],
  transactionSplits: [],
};

/** What such a row says beside its picker — the proof a ROW is on screen. */
const DANGLING_ROW_NOTE =
  'Filed under a category that no longer exists — choose one to put it right.';

const healthPanel = (): HTMLElement =>
  screen.getByRole('region', { name: 'Data health' });

beforeEach(() => {
  Object.values(toast).forEach(fn => fn.mockClear());
});

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

describe('every data-health line carries its remedy', () => {
  it('sends the uncategorised backlog to the page built for it', () => {
    setup();

    expect(within(healthPanel()).getByRole('link', { name: 'Review and categorise' }))
      .toHaveAttribute('href', '/categorisation');
  });

  it('opens the import bucket’s own rows — the only place a split line can be re-filed', () => {
    setup();

    // Named for what it does, and it does it in one click: no "would you like
    // to see these transactions?" confirmation, which is the user's own
    // sentence read back to them.
    fireEvent.click(within(healthPanel()).getByRole('button', { name: 'File them now' }));

    expect(screen.getByRole('heading', { name: 'Transactions in "Unassigned (import)"' }))
      .toBeInTheDocument();

    // Both bucket LINES are listed, each marked as part of a split, and each
    // one opens its parent (the editor that owns the line's category).
    const rows = screen.getAllByTitle(
      'Part of a split transaction — opens the full transaction to edit its splits'
    );
    expect(rows).toHaveLength(2);
  });

  /**
   * THE BUG, AND THE TEST OF IT (owner, from a user, 1 Sep 2026).
   *
   * This line used to link to Accounts → Categorisation, whose own amber note
   * about the same rows linked back to this page. A reader who followed either
   * arrived at the other announcement; the rows were never on screen, in either
   * direction, ever. The path has to END AT THE ROWS, and this is what says so.
   */
  it('ends the loop: the dangling rows come up HERE, each with its picker', () => {
    setup(DANGLING_LEDGER);

    // Before: the housekeeping section at the foot of the page is collapsed.
    expect(screen.queryByLabelText('What to filter by, filter 1')).not.toBeInTheDocument();

    fireEvent.click(within(healthPanel()).getByRole('button', { name: 'Re-file it now' }));

    // The section is open, on the search that finds exactly these rows…
    expect(screen.getByLabelText('What to filter by, filter 1')).toHaveValue('dangling');
    // …and the row is on screen, saying what is wrong with it, with the
    // control that puts it right beside it.
    expect(screen.getByLabelText(/^Category for Ashvale Hardware/)).toBeInTheDocument();
    expect(screen.getByText(DANGLING_ROW_NOTE)).toBeInTheDocument();
    // Nothing else filtered in: a properly filed row is not part of this job.
    expect(screen.queryByLabelText(/^Category for Riverbank Groceries/)).not.toBeInTheDocument();
  });

  it('the other end of the loop lands on the same rows, from its own address', () => {
    // What Categorisation's amber note links to (utils/categoryRefileLink) —
    // the ask travels in the address, because it has to survive a navigation.
    setup(DANGLING_LEDGER, '/settings/categories?refile=dangling');

    expect(screen.getByLabelText('What to filter by, filter 1')).toHaveValue('dangling');
    expect(screen.getByLabelText(/^Category for Ashvale Hardware/)).toBeInTheDocument();
    expect(screen.getByText(DANGLING_ROW_NOTE)).toBeInTheDocument();
  });

  it('opens nothing on an ordinary visit', () => {
    setup(DANGLING_LEDGER);

    // The section is a section, not a modal: it stays where it was for anyone
    // who did not come here about these rows.
    expect(screen.queryByLabelText('What to filter by, filter 1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument();
  });

  it('shows the empty categories in the tree, expanded, highlighted, deletion live', () => {
    setup();

    // Before: they are inside a collapsed group, and deletion is behind a mode.
    expect(screen.queryByText('Never Used')).not.toBeInTheDocument();

    fireEvent.click(within(healthPanel()).getByRole('button', { name: 'Show them in the tree' }));

    // Expanded…
    const first = screen.getByText('Never Used');
    const second = screen.getByText('Also Unused');
    // …highlighted, and said out loud rather than left to colour…
    expect(first.closest('[aria-current="true"]')).not.toBeNull();
    expect(second.closest('[aria-current="true"]')).not.toBeNull();
    // …and a category that is NOT a candidate is left alone.
    expect(screen.getByText('Groceries').closest('[aria-current="true"]')).toBeNull();

    // …with the delete affordance live and explaining itself.
    expect(screen.getByTitle('Cancel Delete')).toBeInTheDocument();
    expect(screen.getByText('Click on any category to delete it')).toBeInTheDocument();
  });

  it('scrolls the first candidate into view — a tree can be hundreds of rows long', () => {
    // jsdom has no scrollIntoView; the hook calls it optionally for that
    // reason, so it has to be supplied to be observed.
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true, writable: true, value: scrollIntoView,
    });
    setup();

    fireEvent.click(within(healthPanel()).getByRole('button', { name: 'Show them in the tree' }));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    // ONE of them: dragging the view to each in turn would land on the last,
    // which is not the one being introduced.
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    const scrolledRow = scrollIntoView.mock.instances[0];
    if (!(scrolledRow instanceof HTMLElement)) throw new Error('expected the scrolled row to be an element');
    expect(scrolledRow.textContent).toContain('Never Used');

    // jsdom does not define this, so put the absence back for the next test.
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });

  it('deletion of a highlighted empty category is one click away, and still asks', () => {
    const deleteCategory = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    setup({ deleteCategory });

    fireEvent.click(within(healthPanel()).getByRole('button', { name: 'Show them in the tree' }));
    fireEvent.click(screen.getByText('Never Used'));

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete "Never Used"?');
    expect(deleteCategory).toHaveBeenCalledWith(EMPTY_A);
    confirmSpy.mockRestore();
  });

  it('leaving edit mode puts the highlight away with it', () => {
    setup();

    fireEvent.click(within(healthPanel()).getByRole('button', { name: 'Show them in the tree' }));
    expect(screen.getByText('Never Used').closest('[aria-current="true"]')).not.toBeNull();

    fireEvent.click(screen.getByTitle('Done Editing'));

    expect(screen.getByText('Never Used').closest('[aria-current="true"]')).toBeNull();
  });
});

describe('a measure that is zero says nothing at all', () => {
  it('no bucket rows → no bucket line, and no orphan action pointing at nothing', () => {
    setup({ transactions: [txn({ id: 'txn-filed' })], transactionSplits: [] });

    const panel = healthPanel();
    expect(within(panel).queryByText(/Unassigned/)).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'File them now' })).not.toBeInTheDocument();
    // The empty-category line IS showing here, so this is a per-line rule and
    // not just an empty panel.
    expect(within(panel).getByRole('button', { name: 'Show them in the tree' })).toBeInTheDocument();
  });

  it('no dangling rows → no dangling line, and no re-file action', () => {
    setup({ transactions: [txn({ id: 'txn-filed' })], transactionSplits: [] });

    const panel = healthPanel();
    expect(within(panel).queryByText(/no longer exists/)).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: /^Re-file/ })).not.toBeInTheDocument();
  });

  it('clean data → the whole panel, and every remedy in it, renders nothing', () => {
    setup({
      categories: [
        { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
        { id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'type-expense' },
      ],
      transactions: [txn({ id: 'txn-filed' })],
      transactionSplits: [],
      getSubCategories: (parentId?: string) => (parentId === 'type-expense'
        ? [{ id: 'cat-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'type-expense' }]
        : []),
      getDetailCategories: () => [],
    });

    expect(screen.queryByRole('region', { name: 'Data health' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'File them now' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show them in the tree' })).not.toBeInTheDocument();
  });
});
