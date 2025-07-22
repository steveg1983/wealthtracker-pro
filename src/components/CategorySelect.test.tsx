/**
 * CategorySelect Tests
 * Tests for the category selection dropdown with hierarchical grouping
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CategorySelect from './CategorySelect';

describe('CategorySelect', () => {
  const mockOnChange = vi.fn();

  const mockCategories = [
    // Type level
    { id: 'type-income', name: 'Income', level: 'type' as const },
    { id: 'type-expense', name: 'Expense', level: 'type' as const },
    
    // Sub level
    { id: 'sub-salary', name: 'Salary', level: 'sub' as const, parentId: 'type-income' },
    { id: 'sub-food', name: 'Food', level: 'sub' as const, parentId: 'type-expense' },
    { id: 'sub-transport', name: 'Transport', level: 'sub' as const, parentId: 'type-expense' },
    
    // Detail level
    { id: 'detail-base', name: 'Base Salary', level: 'detail' as const, parentId: 'sub-salary' },
    { id: 'detail-bonus', name: 'Bonus', level: 'detail' as const, parentId: 'sub-salary' },
    { id: 'detail-groceries', name: 'Groceries', level: 'detail' as const, parentId: 'sub-food' },
    { id: 'detail-dining', name: 'Dining Out', level: 'detail' as const, parentId: 'sub-food' },
    { id: 'detail-fuel', name: 'Fuel', level: 'detail' as const, parentId: 'sub-transport' },
    
    // Standalone category (no parent)
    { id: 'standalone-misc', name: 'Miscellaneous', level: 'detail' as const },
    
    // Type with direct detail (no sub)
    { id: 'type-transfer', name: 'Transfer', level: 'type' as const },
    { id: 'detail-bank', name: 'Bank Transfer', level: 'detail' as const, parentId: 'type-transfer' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders select element', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
        />
      );
      
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('shows uncategorized option by default', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
        />
      );
      
      expect(screen.getByRole('option', { name: 'Uncategorized' })).toBeInTheDocument();
    });

    it('hides uncategorized option when showUncategorized is false', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
          showUncategorized={false}
        />
      );
      
      expect(screen.queryByRole('option', { name: 'Uncategorized' })).not.toBeInTheDocument();
    });

    it('shows multiple option when showMultiple is true', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
          showMultiple={true}
        />
      );
      
      expect(screen.getByRole('option', { name: 'Multiple' })).toBeInTheDocument();
    });

    it('shows placeholder when no uncategorized and no value', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
          showUncategorized={false}
          placeholder="Choose a category"
        />
      );
      
      const placeholderOption = screen.getByRole('option', { name: 'Choose a category' });
      expect(placeholderOption).toBeInTheDocument();
      expect(placeholderOption).toBeDisabled();
    });
  });

  describe('Hierarchical Grouping', () => {
    it('creates optgroups for categories with subcategories', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
        />
      );
      
      // Check for optgroups with hierarchical labels
      expect(screen.getByRole('group', { name: 'Income > Salary' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Expense > Food' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Expense > Transport' })).toBeInTheDocument();
    });

    it('shows detail categories within correct optgroups', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
        />
      );
      
      const salaryGroup = screen.getByRole('group', { name: 'Income > Salary' });
      expect(salaryGroup).toContainElement(screen.getByRole('option', { name: 'Base Salary' }));
      expect(salaryGroup).toContainElement(screen.getByRole('option', { name: 'Bonus' }));
      
      const foodGroup = screen.getByRole('group', { name: 'Expense > Food' });
      expect(foodGroup).toContainElement(screen.getByRole('option', { name: 'Groceries' }));
      expect(foodGroup).toContainElement(screen.getByRole('option', { name: 'Dining Out' }));
    });

    it('creates single optgroup for types with direct detail categories', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
        />
      );
      
      const transferGroup = screen.getByRole('group', { name: 'Transfer' });
      expect(transferGroup).toBeInTheDocument();
      expect(transferGroup).toContainElement(screen.getByRole('option', { name: 'Bank Transfer' }));
    });

    it('shows standalone categories outside optgroups', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
        />
      );
      
      const miscOption = screen.getByRole('option', { name: 'Miscellaneous' });
      expect(miscOption).toBeInTheDocument();
      expect(miscOption.closest('optgroup')).toBeNull();
    });
  });

  describe('Value Selection', () => {
    it('selects the correct value', () => {
      render(
        <CategorySelect
          value="detail-groceries"
          onChange={mockOnChange}
          categories={mockCategories}
        />
      );
      
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('detail-groceries');
    });

    it('calls onChange when selection changes', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
        />
      );
      
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'detail-fuel' }
      });
      
      expect(mockOnChange).toHaveBeenCalledWith('detail-fuel');
    });

    it('can select uncategorized', () => {
      render(
        <CategorySelect
          value="detail-fuel"
          onChange={mockOnChange}
          categories={mockCategories}
        />
      );
      
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: '' }
      });
      
      expect(mockOnChange).toHaveBeenCalledWith('');
    });

    it('can select multiple when enabled', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
          showMultiple={true}
        />
      );
      
      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: 'multiple' }
      });
      
      expect(mockOnChange).toHaveBeenCalledWith('multiple');
    });
  });

  describe('Props and State', () => {
    it('applies custom className', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
          className="custom-select-class"
        />
      );
      
      expect(screen.getByRole('combobox')).toHaveClass('custom-select-class');
    });

    it('disables select when disabled prop is true', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
          disabled={true}
        />
      );
      
      expect(screen.getByRole('combobox')).toBeDisabled();
    });

  });

  describe('Edge Cases', () => {
    it('handles empty categories array', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={[]}
        />
      );
      
      // Should only show uncategorized option
      expect(screen.getByRole('option', { name: 'Uncategorized' })).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });

    it('handles categories with missing parents gracefully', () => {
      const orphanCategories = [
        { id: 'orphan-1', name: 'Orphan Category', level: 'detail' as const, parentId: 'non-existent' }
      ];
      
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={orphanCategories}
        />
      );
      
      // Orphan categories are filtered out
      expect(screen.queryByRole('option', { name: 'Orphan Category' })).not.toBeInTheDocument();
    });

    it('handles type categories with no children', () => {
      const lonelyType = [
        { id: 'type-lonely', name: 'Lonely Type', level: 'type' as const }
      ];
      
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={lonelyType}
        />
      );
      
      // Type with no children doesn't create an optgroup
      expect(screen.queryByRole('group', { name: 'Lonely Type' })).not.toBeInTheDocument();
    });

    it('handles all three special options together', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
          showUncategorized={true}
          showMultiple={true}
          placeholder="Pick one"
        />
      );
      
      expect(screen.getByRole('option', { name: 'Uncategorized' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Multiple' })).toBeInTheDocument();
      // Placeholder not shown when showUncategorized is true
      expect(screen.queryByRole('option', { name: 'Pick one' })).not.toBeInTheDocument();
    });

    it('preserves option values correctly', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
        />
      );
      
      // Check that each detail category has correct value
      expect(screen.getByRole('option', { name: 'Base Salary' })).toHaveValue('detail-base');
      expect(screen.getByRole('option', { name: 'Groceries' })).toHaveValue('detail-groceries');
      expect(screen.getByRole('option', { name: 'Miscellaneous' })).toHaveValue('standalone-misc');
    });
  });

  describe('Complex Hierarchies', () => {
    it('handles multiple sub-categories under same type', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
        />
      );
      
      // Both Food and Transport should be under Expense
      expect(screen.getByRole('group', { name: 'Expense > Food' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Expense > Transport' })).toBeInTheDocument();
    });

    it('maintains correct parent-child relationships', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
        />
      );
      
      // Fuel should only be in Transport group
      const fuelOption = screen.getByRole('option', { name: 'Fuel' });
      const transportGroup = screen.getByRole('group', { name: 'Expense > Transport' });
      expect(transportGroup).toContainElement(fuelOption);
      
      // And not in Food group
      const foodGroup = screen.getByRole('group', { name: 'Expense > Food' });
      expect(foodGroup).not.toContainElement(fuelOption);
    });
  });

  describe('Accessibility', () => {
    it('select is keyboard navigable', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
        />
      );
      
      const select = screen.getByRole('combobox');
      select.focus();
      expect(document.activeElement).toBe(select);
    });

    it('optgroups provide semantic grouping', () => {
      render(
        <CategorySelect
          value=""
          onChange={mockOnChange}
          categories={mockCategories}
        />
      );
      
      const groups = screen.getAllByRole('group');
      expect(groups.length).toBeGreaterThan(0);
      groups.forEach(group => {
        expect(group).toHaveAttribute('label');
      });
    });
  });
});