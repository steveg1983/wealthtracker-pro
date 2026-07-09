/**
 * CategorySelector tests
 *
 * Focus: the searchable-combobox behaviour used by the transaction modal and
 * the account-register quick-edit bar — type-to-filter, and the `includeAllTypes`
 * flag that lists BOTH income and expense detail categories (Money-style
 * cross-type filing) rather than only the current transaction's direction.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CategorySelector from './CategorySelector';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import type { Category } from '../types';

// A minimal two-direction category tree: one income detail (Payslip) and one
// expense detail (Groceries), each under its own sub/type parents.
const tree: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type' },
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
  { id: 'sub-salary', name: 'Salary', type: 'income', level: 'sub', parentId: 'type-income' },
  { id: 'sub-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-payslip', name: 'Payslip', type: 'income', level: 'detail', parentId: 'sub-salary' },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'sub-food' },
];

const PLACEHOLDER = 'Pick a category';

beforeEach(() => {
  __setAppContextValue({
    categories: tree,
    getSubCategories: (parentId?: string) =>
      tree.filter(c => c.level === 'sub' && c.parentId === parentId),
    getDetailCategories: (parentId?: string) =>
      tree.filter(c => c.level === 'detail' && c.parentId === parentId),
  });
});

afterEach(() => {
  cleanup();
  __resetAppContextValue();
});

/** Render the picker and open its dropdown (click the collapsed trigger). */
function renderOpen(props: Partial<React.ComponentProps<typeof CategorySelector>> = {}) {
  const onCategoryChange = vi.fn();
  render(
    <CategorySelector
      selectedCategory=""
      onCategoryChange={onCategoryChange}
      transactionType="income"
      placeholder={PLACEHOLDER}
      {...props}
    />
  );
  fireEvent.click(screen.getByText(PLACEHOLDER));
  return { onCategoryChange };
}

describe('CategorySelector', () => {
  it('lists only the transaction direction by default', () => {
    renderOpen();
    expect(screen.getByText('Payslip')).toBeInTheDocument();
    expect(screen.queryByText('Groceries')).not.toBeInTheDocument();
  });

  it('lists both directions when includeAllTypes is set', () => {
    renderOpen({ includeAllTypes: true });
    expect(screen.getByText('Payslip')).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });

  it('filters the list as the user types', () => {
    renderOpen({ includeAllTypes: true });
    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: 'groc' } });
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.queryByText('Payslip')).not.toBeInTheDocument();
  });

  it('reports the chosen category id when an option is clicked', () => {
    const { onCategoryChange } = renderOpen({ includeAllTypes: true });
    fireEvent.click(screen.getByText('Groceries'));
    expect(onCategoryChange).toHaveBeenCalledWith('det-groceries');
  });

  it('groups items under their parent sub-category headers', () => {
    renderOpen({ includeAllTypes: true });
    // Section headers (the sub-categories) plus their detail items beneath.
    expect(screen.getByText('Salary')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('Payslip')).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });

  it('omits the helper hint when showHelperText is false', () => {
    render(
      <CategorySelector
        selectedCategory=""
        onCategoryChange={vi.fn()}
        transactionType="income"
        placeholder={PLACEHOLDER}
        showHelperText={false}
      />
    );
    expect(screen.queryByText(/Select a category for this/)).not.toBeInTheDocument();
  });
});
