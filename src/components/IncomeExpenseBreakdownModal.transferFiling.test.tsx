import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import IncomeExpenseBreakdownModal from './IncomeExpenseBreakdownModal';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import type { Category, Transaction } from '../types';
import type { SplitExpandedTransaction } from '../utils/transactionSplits';

/**
 * THE REVIEW BAND WILL NOT FILE A TRANSFER.
 *
 * This is the app's bulk-filing surface: a list of uncategorised rows, each
 * with an inline picker, saved in one go through
 * apply_category_to_uncategorized. That RPC filters the TARGET ROWS (blank,
 * non-split) and says nothing whatever about the category being applied — so
 * nothing on the server stops "To/From Savings" being stamped onto a hundred
 * rows at once, and each of those hundred would become a transfer with no other
 * side: dropped from every report, absent from this very band (it would have a
 * real category id), and still moving the balance.
 *
 * The gate is therefore the client's, in two layers: the picker does not OFFER
 * a transfer category (asserted here), and the context's
 * applyCategoryToUncategorized refuses one outright if some other caller ever
 * tries.
 *
 * Bulk CONVERSION is not the alternative. Each transfer needs the account it
 * moved to, resolved individually, and its other side created or matched —
 * which is the editor's job, one row at a time.
 *
 * Every payee, category and figure below is invented: this repo is public.
 */

const CATEGORIES: Category[] = [
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
  { id: 'grp-house', name: 'Household', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-repairs', name: 'Repairs', type: 'expense', level: 'detail', parentId: 'grp-house' },
  { id: 'type-income', name: 'Income', type: 'income', level: 'type' },
  { id: 'grp-earnings', name: 'Earnings', type: 'income', level: 'sub', parentId: 'type-income' },
  { id: 'det-fees', name: 'Consulting Fees', type: 'income', level: 'detail', parentId: 'grp-earnings' },
  { id: 'type-transfer', name: 'Transfer', type: 'both', level: 'type' },
  {
    id: 'tofrom-thrift', name: 'To/From Synthetic Thrift', type: 'both', level: 'detail',
    parentId: 'type-transfer', isTransferCategory: true, accountId: 'acc-thrift',
  },
  /**
   * A To/From category sitting among ORDINARY leaves, squarely inside the
   * sub→detail walk every picker uses.
   *
   * Nothing in the app parents one here today — which is exactly why it is in
   * this fixture. The account-managed categories hang one rung shallower than a
   * leaf, so tree shape alone keeps them out of this list, and a test built only
   * on the real shape would go on passing with the exclusion deleted. The rule
   * has to hold for the tree the app MIGHT have.
   */
  {
    id: 'tofrom-misplaced', name: 'To/From Petty Cash', type: 'expense', level: 'detail',
    parentId: 'grp-house', isTransferCategory: true, accountId: 'acc-petty',
  },
];

const ROW: Transaction = {
  id: 'txn-blank', date: new Date(Date.UTC(2026, 3, 6)), description: 'Unfiled payment',
  amount: -32.5, type: 'expense', category: '', accountId: 'acc-daily', cleared: false,
};

/** The real context's walkers: every child of a parent, no level filter. */
const walkChildren = (parentId?: string): Category[] =>
  CATEGORIES.filter(c => c.parentId === parentId);

const onApplyCategories = vi.fn(async () => 1);

const renderBand = (): void => {
  render(
    <PreferencesProvider>
      <IncomeExpenseBreakdownModal
        isOpen
        onClose={vi.fn()}
        title="Needs a category"
        bucket="uncategorized"
        rows={[ROW as SplitExpandedTransaction]}
        total={null}
        categories={CATEGORIES}
        onEditTransaction={vi.fn()}
        onApplyCategories={onApplyCategories}
      />
    </PreferencesProvider>
  );
};

beforeEach(() => {
  onApplyCategories.mockClear();
  __setAppContextValue({
    categories: CATEGORIES,
    getSubCategories: walkChildren,
    getDetailCategories: walkChildren,
  });
});

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

describe('the review band’s inline picker', () => {
  it('offers ordinary categories from both directions', () => {
    renderBand();
    fireEvent.click(screen.getByRole('combobox', { name: /categor/i }));

    // Money-style cross-type filing: a refund files under the expense category
    // it refunds, so both trees are listed. That much is unchanged.
    expect(screen.getByText('Repairs')).toBeInTheDocument();
    expect(screen.getByText('Consulting Fees')).toBeInTheDocument();
  });

  it('never offers a transfer category', () => {
    renderBand();
    fireEvent.click(screen.getByRole('combobox', { name: /categor/i }));

    expect(screen.queryByText('To/From Synthetic Thrift')).not.toBeInTheDocument();
    // And not the one parented among ordinary leaves either: the exclusion is
    // by FLAG, not by where the category happens to sit in the tree.
    expect(screen.queryByText('To/From Petty Cash')).not.toBeInTheDocument();
  });

  it('does not find one by search either — it is absent, not merely unlisted', () => {
    renderBand();
    const combobox = screen.getByRole('combobox', { name: /categor/i });
    fireEvent.click(combobox);
    fireEvent.change(screen.getByPlaceholderText('Choose a category…'), { target: { value: 'to/from' } });

    expect(screen.queryByText('To/From Synthetic Thrift')).not.toBeInTheDocument();
    expect(screen.queryByText('To/From Petty Cash')).not.toBeInTheDocument();
    // Nothing left to choose, so nothing can be saved — the Save button only
    // appears once a choice exists.
    expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument();
  });

  it('still files an ordinary category in bulk', () => {
    renderBand();
    fireEvent.click(screen.getByRole('combobox', { name: /categor/i }));
    fireEvent.click(screen.getByText('Repairs'));

    const save = screen.getByRole('button', { name: /^Save/ });
    fireEvent.click(within(save).getByText(/Save/) ?? save);

    expect(onApplyCategories).toHaveBeenCalledTimes(1);
    const assignments = onApplyCategories.mock.calls[0][0] as Map<string, string[]>;
    expect(assignments.get('det-repairs')).toEqual(['txn-blank']);
  });
});
