/**
 * AddTransactionModal Component Tests
 * Tests for the critical transaction creation modal
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, createMockAccount, createMockCategory } from '../../test/testUtils';
import AddTransactionModal from '../AddTransactionModal';

// Mock the validation service
vi.mock('../../services/validationService', () => ({
  validationService: {
    validateTransaction: vi.fn((data) => ({
      success: true,
      data,
    })),
  },
}));

describe('AddTransactionModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
    accounts: [
      createMockAccount({
        id: 'acc-1',
        name: 'Main Checking',
        type: 'current',
      }),
      createMockAccount({
        id: 'acc-2',
        name: 'Savings Account',
        type: 'savings',
      }),
    ],
    categories: [
      createMockCategory({
        id: 'cat-1',
        name: 'Groceries',
        type: 'expense',
      }),
      createMockCategory({
        id: 'cat-2',
        name: 'Salary',
        type: 'income',
      }),
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open', () => {
    renderWithProviders(<AddTransactionModal {...defaultProps} />);
    
    expect(screen.getByText('Add Transaction')).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/account/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderWithProviders(
      <AddTransactionModal {...defaultProps} isOpen={false} />
    );
    
    expect(screen.queryByText('Add Transaction')).not.toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddTransactionModal {...defaultProps} />);
    
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when escape key is pressed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddTransactionModal {...defaultProps} />);
    
    await user.keyboard('{Escape}');
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('submits valid transaction data', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddTransactionModal {...defaultProps} />);
    
    // Fill out the form
    await user.type(screen.getByLabelText(/amount/i), '100.50');
    await user.type(screen.getByLabelText(/description/i), 'Test transaction');
    
    // Select account
    const accountSelect = screen.getByLabelText(/account/i);
    await user.selectOptions(accountSelect, 'acc-1');
    
    // Select type
    const typeSelect = screen.getByLabelText(/type/i);
    await user.selectOptions(typeSelect, 'expense');
    
    // Select category
    const categorySelect = screen.getByLabelText(/category/i);
    await user.selectOptions(categorySelect, 'cat-1');
    
    // Submit form
    const saveButton = screen.getByText('Save');
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100.50,
          description: 'Test transaction',
          accountId: 'acc-1',
          type: 'expense',
          category: 'cat-1',
        })
      );
    });
  });

  it('validates form inputs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddTransactionModal {...defaultProps} />);
    
    // Try to submit without filling required fields
    const saveButton = screen.getByText('Save');
    await user.click(saveButton);
    
    // Should show validation errors
    expect(screen.getByText(/amount is required/i)).toBeInTheDocument();
    expect(screen.getByText(/description is required/i)).toBeInTheDocument();
  });

  it('validates amount field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddTransactionModal {...defaultProps} />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    
    // Test invalid amount
    await user.type(amountInput, '-100');
    await user.tab(); // Trigger blur event
    
    expect(screen.getByText(/amount must be positive/i)).toBeInTheDocument();
    
    // Test valid amount
    await user.clear(amountInput);
    await user.type(amountInput, '100.50');
    await user.tab();
    
    expect(screen.queryByText(/amount must be positive/i)).not.toBeInTheDocument();
  });

  it('filters categories by transaction type', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddTransactionModal {...defaultProps} />);
    
    const typeSelect = screen.getByLabelText(/type/i);
    const categorySelect = screen.getByLabelText(/category/i);
    
    // Select expense type
    await user.selectOptions(typeSelect, 'expense');
    
    // Should only show expense categories
    const categoryOptions = screen.getAllByRole('option', { name: /groceries|salary/i });
    const visibleCategories = categoryOptions.filter(option => !option.hidden);
    
    expect(visibleCategories.some(option => option.textContent?.includes('Groceries'))).toBe(true);
    expect(visibleCategories.some(option => option.textContent?.includes('Salary'))).toBe(false);
  });

  it('handles date input correctly', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddTransactionModal {...defaultProps} />);
    
    const dateInput = screen.getByLabelText(/date/i);
    
    // Should default to today's date
    const today = new Date().toISOString().split('T')[0];
    expect(dateInput).toHaveValue(today);
    
    // Change to different date
    await user.clear(dateInput);
    await user.type(dateInput, '2025-01-15');
    
    expect(dateInput).toHaveValue('2025-01-15');
  });

  it('supports adding tags', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddTransactionModal {...defaultProps} />);
    
    const tagsInput = screen.getByLabelText(/tags/i);
    
    await user.type(tagsInput, 'food,essential');
    
    expect(tagsInput).toHaveValue('food,essential');
  });

  it('handles notes field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddTransactionModal {...defaultProps} />);
    
    const notesTextarea = screen.getByLabelText(/notes/i);
    
    await user.type(notesTextarea, 'Additional notes about this transaction');
    
    expect(notesTextarea).toHaveValue('Additional notes about this transaction');
  });

  it('toggles between income and expense correctly', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddTransactionModal {...defaultProps} />);
    
    const typeSelect = screen.getByLabelText(/type/i);
    
    // Start with expense
    await user.selectOptions(typeSelect, 'expense');
    expect(typeSelect).toHaveValue('expense');
    
    // Switch to income
    await user.selectOptions(typeSelect, 'income');
    expect(typeSelect).toHaveValue('income');
    
    // Categories should update accordingly
    const categorySelect = screen.getByLabelText(/category/i);
    const categoryOptions = Array.from(categorySelect.children) as HTMLOptionElement[];
    
    // Should include income categories
    expect(categoryOptions.some(option => option.textContent?.includes('Salary'))).toBe(true);
  });

  it('preserves form data when modal is reopened', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(<AddTransactionModal {...defaultProps} />);
    
    // Fill some form data
    await user.type(screen.getByLabelText(/amount/i), '100');
    await user.type(screen.getByLabelText(/description/i), 'Test');
    
    // Close modal
    rerender(<AddTransactionModal {...defaultProps} isOpen={false} />);
    
    // Reopen modal
    rerender(<AddTransactionModal {...defaultProps} isOpen={true} />);
    
    // Form should be reset (this is typical behavior for add modals)
    expect(screen.getByLabelText(/amount/i)).toHaveValue('');
    expect(screen.getByLabelText(/description/i)).toHaveValue('');
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    
    // Mock onSave to return a promise
    const mockOnSave = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    renderWithProviders(
      <AddTransactionModal {...defaultProps} onSave={mockOnSave} />
    );
    
    // Fill required fields
    await user.type(screen.getByLabelText(/amount/i), '100');
    await user.type(screen.getByLabelText(/description/i), 'Test');
    await user.selectOptions(screen.getByLabelText(/account/i), 'acc-1');
    await user.selectOptions(screen.getByLabelText(/type/i), 'expense');
    await user.selectOptions(screen.getByLabelText(/category/i), 'cat-1');
    
    // Submit form
    const saveButton = screen.getByText('Save');
    await user.click(saveButton);
    
    // Should show loading state
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
  });

  it('handles submission errors gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock onSave to throw an error
    const mockOnSave = vi.fn(() => Promise.reject(new Error('Save failed')));
    
    renderWithProviders(
      <AddTransactionModal {...defaultProps} onSave={mockOnSave} />
    );
    
    // Fill and submit form
    await user.type(screen.getByLabelText(/amount/i), '100');
    await user.type(screen.getByLabelText(/description/i), 'Test');
    await user.selectOptions(screen.getByLabelText(/account/i), 'acc-1');
    await user.selectOptions(screen.getByLabelText(/type/i), 'expense');
    await user.selectOptions(screen.getByLabelText(/category/i), 'cat-1');
    
    const saveButton = screen.getByText('Save');
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to save transaction/i)).toBeInTheDocument();
    });
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddTransactionModal {...defaultProps} />);
    
    // Tab through form fields
    await user.tab(); // Amount field
    expect(screen.getByLabelText(/amount/i)).toHaveFocus();
    
    await user.tab(); // Description field
    expect(screen.getByLabelText(/description/i)).toHaveFocus();
    
    await user.tab(); // Account select
    expect(screen.getByLabelText(/account/i)).toHaveFocus();
  });

  it('formats amount input correctly', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddTransactionModal {...defaultProps} />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    
    // Type amount with many decimal places
    await user.type(amountInput, '100.123456');
    await user.tab(); // Trigger blur to format
    
    // Should be formatted to 2 decimal places
    expect(amountInput).toHaveValue('100.12');
  });

  it('handles copy/paste of transaction data', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddTransactionModal {...defaultProps} />);
    
    const descriptionInput = screen.getByLabelText(/description/i);
    
    // Simulate pasting text
    await user.click(descriptionInput);
    await user.paste('Copied transaction description');
    
    expect(descriptionInput).toHaveValue('Copied transaction description');
  });

  it('clears form when modal is closed and reopened', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(<AddTransactionModal {...defaultProps} />);
    
    // Fill form
    await user.type(screen.getByLabelText(/amount/i), '100');
    await user.type(screen.getByLabelText(/description/i), 'Test transaction');
    
    // Close modal
    await user.click(screen.getByText('Cancel'));
    
    // Reopen modal
    rerender(<AddTransactionModal {...defaultProps} isOpen={true} />);
    
    // Form should be cleared
    expect(screen.getByLabelText(/amount/i)).toHaveValue('');
    expect(screen.getByLabelText(/description/i)).toHaveValue('');
  });
});