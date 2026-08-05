/**
 * BudgetModal Tests
 *
 * Focus: the category field. It is the shared CategorySelector combobox —
 * grouped under its parent group, expense tree only — and it deals in category
 * IDs, which is what `calculateBudgetSpending` matches transactions on. The old
 * flat <select> stored the category NAME, so budgets added here matched nothing.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import BudgetModal from '../BudgetModal';
import type { Budget, Category } from '../../types';

// A two-direction tree: budgets are spending limits, so only the expense side
// may be offered.
const tree: Category[] = [
  { id: 'type-income', name: 'Income', type: 'income', level: 'type' },
  { id: 'type-expense', name: 'Expenses', type: 'expense', level: 'type' },
  { id: 'sub-salary', name: 'Salary', type: 'income', level: 'sub', parentId: 'type-income' },
  { id: 'sub-food', name: 'Food', type: 'expense', level: 'sub', parentId: 'type-expense' },
  { id: 'det-payslip', name: 'Payslip', type: 'income', level: 'detail', parentId: 'sub-salary' },
  { id: 'det-groceries', name: 'Groceries', type: 'expense', level: 'detail', parentId: 'sub-food' },
];

const addBudget = vi.fn();
const updateBudget = vi.fn();

describe('BudgetModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    __setAppContextValue({
      categories: tree,
      addBudget,
      updateBudget,
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

  /** Open the category combobox by clicking its collapsed trigger. */
  const openCategoryPicker = (): void => {
    fireEvent.click(screen.getByText('Search or select category…'));
  };

  it('renders without crashing', () => {
    renderWithProviders(<BudgetModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('offers the shared searchable combobox, not a flat select', () => {
    renderWithProviders(<BudgetModal {...defaultProps} />);
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeInTheDocument();
  });

  it('lists expense categories under their group heading, and no income ones', () => {
    renderWithProviders(<BudgetModal {...defaultProps} />);
    openCategoryPicker();
    expect(screen.getByText('Food')).toBeInTheDocument();        // group heading
    expect(screen.getByText('Groceries')).toBeInTheDocument();   // the category
    expect(screen.queryByText('Payslip')).not.toBeInTheDocument();
  });

  it('saves the chosen category as an ID — what budget spending matches on', () => {
    renderWithProviders(<BudgetModal {...defaultProps} />);
    openCategoryPicker();
    fireEvent.click(screen.getByText('Groceries'));
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Budget' }));

    expect(addBudget).toHaveBeenCalledTimes(1);
    expect(addBudget.mock.calls[0][0]).toMatchObject({ categoryId: 'det-groceries', amount: 250 });
  });

  it('blocks the save and says so when no category is chosen', () => {
    renderWithProviders(<BudgetModal {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Budget' }));

    expect(addBudget).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a category to budget against.');
  });

  it('shows the category of a budget stored the legacy way, by NAME', () => {
    // Budgets added by the old flat <select> hold the category name. Resolve it
    // back to an id so the picker displays it — and so saving heals the value.
    const legacyBudget = {
      id: 'b-1',
      categoryId: 'Groceries',
      amount: 300,
      period: 'monthly',
      isActive: true,
      spent: 0,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    } satisfies Budget;

    renderWithProviders(<BudgetModal {...defaultProps} budget={legacyBudget} />);
    expect(screen.getByText('Food > Groceries')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(updateBudget).toHaveBeenCalledWith('b-1', expect.objectContaining({
      categoryId: 'det-groceries',
    }));
  });
});
