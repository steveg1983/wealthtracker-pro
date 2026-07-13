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

  describe('keyboard support', () => {
    it('is focusable and opens with Enter, Space, or ArrowDown', () => {
      render(
        <CategorySelector
          selectedCategory=""
          onCategoryChange={vi.fn()}
          transactionType="income"
          placeholder={PLACEHOLDER}
        />
      );
      const trigger = screen.getByRole('combobox', { name: 'Category' });
      expect(trigger).toHaveAttribute('tabindex', '0');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      fireEvent.keyDown(trigger, { key: 'Enter' });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('walks options with arrows and selects with Enter', () => {
      const { onCategoryChange } = renderOpen({ includeAllTypes: true });
      const input = screen.getByPlaceholderText(PLACEHOLDER);

      // Options render in group order: Salary→Payslip, then Food→Groceries.
      fireEvent.keyDown(input, { key: 'ArrowDown' }); // highlight Payslip
      fireEvent.keyDown(input, { key: 'ArrowDown' }); // highlight Groceries
      expect(input).toHaveAttribute('aria-activedescendant');
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onCategoryChange).toHaveBeenCalledWith('det-groceries');
    });

    it('selects the single remaining filtered option with Enter', () => {
      const { onCategoryChange } = renderOpen({ includeAllTypes: true });
      const input = screen.getByPlaceholderText(PLACEHOLDER);
      fireEvent.change(input, { target: { value: 'groc' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onCategoryChange).toHaveBeenCalledWith('det-groceries');
    });

    it('closes with Escape and returns focus to the trigger', () => {
      renderOpen();
      const input = screen.getByPlaceholderText(PLACEHOLDER);
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Category' })).toHaveFocus();
    });

    it('marks options with the option role and selection state', () => {
      render(
        <CategorySelector
          selectedCategory="det-payslip"
          onCategoryChange={vi.fn()}
          transactionType="income"
          placeholder={PLACEHOLDER}
          includeAllTypes
        />
      );
      // Trigger shows the selected name, so open via the combobox role.
      fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThanOrEqual(2);
      const payslip = options.find(o => o.textContent?.includes('Payslip'));
      expect(payslip).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('excludeIds', () => {
    it('leaves excluded categories out of the list', () => {
      renderOpen({ includeAllTypes: true, excludeIds: ['det-groceries'] });
      expect(screen.queryByText('Groceries')).not.toBeInTheDocument();
      expect(screen.getByText('Payslip')).toBeInTheDocument();
    });
  });

  describe('allowClear (un-categorise)', () => {
    it('offers a pinned Uncategorised option that selects the blank category', () => {
      const { onCategoryChange } = renderOpen({ allowClear: true });
      fireEvent.click(screen.getByText('Uncategorised'));
      expect(onCategoryChange).toHaveBeenCalledWith('');
    });

    it('hides the option without allowClear', () => {
      renderOpen();
      expect(screen.queryByText('Uncategorised')).not.toBeInTheDocument();
    });

    it('keeps the option while the search could still mean it', () => {
      renderOpen({ allowClear: true });
      const input = screen.getByPlaceholderText(PLACEHOLDER);
      fireEvent.change(input, { target: { value: 'unc' } });
      expect(screen.getByText('Uncategorised')).toBeInTheDocument();
      fireEvent.change(input, { target: { value: 'payslip' } });
      expect(screen.queryByText('Uncategorised')).not.toBeInTheDocument();
    });

    it('is the first keyboard stop and selects the blank category with Enter', () => {
      const { onCategoryChange } = renderOpen({ allowClear: true });
      const input = screen.getByPlaceholderText(PLACEHOLDER);
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onCategoryChange).toHaveBeenCalledWith('');
    });

    it('clears the selection with Delete on the closed picker', () => {
      const onCategoryChange = vi.fn();
      render(
        <CategorySelector
          selectedCategory="det-payslip"
          onCategoryChange={onCategoryChange}
          transactionType="income"
          placeholder={PLACEHOLDER}
          allowClear
        />
      );
      fireEvent.keyDown(screen.getByRole('combobox', { name: 'Category' }), { key: 'Delete' });
      expect(onCategoryChange).toHaveBeenCalledWith('');
    });

    it('does NOT clear on Delete without allowClear', () => {
      const onCategoryChange = vi.fn();
      render(
        <CategorySelector
          selectedCategory="det-payslip"
          onCategoryChange={onCategoryChange}
          transactionType="income"
          placeholder={PLACEHOLDER}
        />
      );
      fireEvent.keyDown(screen.getByRole('combobox', { name: 'Category' }), { key: 'Delete' });
      expect(onCategoryChange).not.toHaveBeenCalled();
    });
  });
});
