/**
 * Settings → Categories: the starter set is a MERGE, never a replacement.
 *
 * The owner's ruling of 29 August 2026 ("merge not replace"): a user who
 * already has categories may look at the example tree and add what theirs is
 * missing — and the flow must be constitutionally incapable of touching what
 * they have. Three things pinned here:
 *
 *   1. The modal IS the consent: it lists the whole tree, marks each entry
 *      "new" or "already yours" from the SAME planner the import runs, and
 *      states the consequence with a real count before any button.
 *   2. Confirming calls importCategoryTree WITHOUT the prune option — the
 *      context API still carries replace semantics for other callers, and the
 *      day this surface passes `pruneOthers` again is the day this test names
 *      the regression.
 *   3. A user whose categories already cover the set gets the statement and a
 *      Close — no add button, because a zero count renders no action.
 *
 * Every name below that is not the tree's own is invented: this repo is public.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CategoriesSettings from './Categories';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import { DEFAULT_CATEGORY_TREE } from '../../data/defaultCategoryTree';
import type { Category } from '../../types';

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
    formatCurrency: (amount: number) => `£${Number(amount).toFixed(2)}`,
    displayCurrency: 'GBP',
    getCurrencySymbol: () => '£',
    convert: vi.fn(),
    convertAndFormat: vi.fn(),
    convertAndSum: vi.fn(),
  }),
}));

const ANCHORS: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type', isSystem: true },
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type', isSystem: true },
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type', isSystem: true },
];

/** Anchors plus ONE tree group and ONE of its leaves, already present. */
const PARTIAL: Category[] = [
  ...ANCHORS,
  { id: 'sub-household', name: 'Household', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-insurance', name: 'Insurance', type: 'expense', level: 'detail', parentId: 'sub-household' },
];

/** The whole tree already present, derived from the tree so it cannot drift. */
const COVERED: Category[] = [
  ...ANCHORS,
  ...DEFAULT_CATEGORY_TREE.flatMap((group, g) => {
    const subId = `sub-${g}`;
    const anchor = group.type === 'income' ? 'type-income' : 'type-expense';
    const leaves = group.children.length > 0 ? group.children : [group.name];
    return [
      { id: subId, name: group.name, type: group.type, level: 'sub' as const, parentId: anchor },
      ...leaves.map((leaf, l) => ({
        id: `det-${g}-${l}`, name: leaf, type: group.type, level: 'detail' as const, parentId: subId,
      })),
    ];
  }),
];

/** Every entry the tree holds: its groups plus every selectable leaf. */
const TREE_ENTRY_COUNT = DEFAULT_CATEGORY_TREE.reduce(
  (sum, group) => sum + 1 + (group.children.length > 0 ? group.children.length : 1),
  0
);

const importCategoryTree = vi.fn(async () => ({
  created: TREE_ENTRY_COUNT - 2, skipped: 2, pruned: 0, keptForTransactions: 0,
}));

const renderPage = (categories: Category[]): void => {
  __setAppContextValue({
    categories,
    transactions: [],
    transactionSplits: [],
    budgets: [],
    accounts: [],
    recurringTransactions: [],
    isLoading: false,
    importCategoryTree,
  });
  render(
    <MemoryRouter>
      <CategoriesSettings />
    </MemoryRouter>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

describe('Settings → Categories — the starter set is offered as a merge', () => {
  it('opens a preview that marks what is new and what is already yours, with the real count', () => {
    renderPage(PARTIAL);

    fireEvent.click(screen.getByRole('button', { name: 'See the starter set' }));
    const dialog = screen.getByRole('dialog', { name: 'The starter category set' });

    // Household and its Insurance leaf are already the user's; the planner
    // skips both, so the count offered is every other entry in the tree.
    const missing = TREE_ENTRY_COUNT - 2;
    expect(within(dialog).getByText(`${missing} entries marked new`)).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: `Add ${missing} categories` })
    ).toBeInTheDocument();

    // The row that is already theirs says so quietly; a missing sibling from
    // the same group is marked new. Scoped to the Household group, because
    // "Insurance" is also a Vehicles leaf — and THAT one must read as new.
    const household = within(dialog).getByText('Household', { exact: true }).closest('li')!;
    const insurance = within(household).getByText('Insurance', { exact: true }).closest('li')!;
    expect(within(insurance).getByText('already yours')).toBeInTheDocument();
    const furnishings = within(household).getByText('Furnishings', { exact: true }).closest('li')!;
    expect(within(furnishings).getByText('new')).toBeInTheDocument();
  });

  it('confirming merges — importCategoryTree is called with NO prune option', async () => {
    renderPage(PARTIAL);

    fireEvent.click(screen.getByRole('button', { name: 'See the starter set' }));
    const dialog = screen.getByRole('dialog', { name: 'The starter category set' });
    fireEvent.click(
      within(dialog).getByRole('button', { name: `Add ${TREE_ENTRY_COUNT - 2} categories` })
    );

    await waitFor(() => expect(importCategoryTree).toHaveBeenCalledTimes(1));
    // THE ruling, as an argument list: the tree and nothing else. Passing
    // { pruneOthers: true } here is what "replace" looks like in code.
    expect(importCategoryTree).toHaveBeenCalledWith(DEFAULT_CATEGORY_TREE);
    expect(toast.showSuccess).toHaveBeenCalledWith(
      expect.stringContaining('Everything you already had is untouched'),
      'Starter set added'
    );
  });

  it('a user whose categories cover the set gets the statement and a Close — no add button', () => {
    renderPage(COVERED);

    expect(
      screen.getByText('Your categories already include the whole starter set.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'See the starter set' }));
    const dialog = screen.getByRole('dialog', { name: 'The starter category set' });

    expect(within(dialog).getByText(/nothing to add/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^Add / })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
