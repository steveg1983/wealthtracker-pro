/**
 * AccountSettingsModal Tests
 * Tests for the AccountSettingsModal component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountSettingsModal from '../AccountSettingsModal';
import { createMockAccount, createMockTransaction } from '../../test/testUtils';

// Mock matchMedia
const mockMatchMedia = vi.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

describe('AccountSettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: mockMatchMedia
    });
    // Mock document methods used by Modal component
    Object.defineProperty(document, 'activeElement', {
      writable: true,
      configurable: true,
      value: document.body
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    // Clean up body styles
    document.body.style.overflow = '';
  });

  const mockAccount = createMockAccount({
    id: 'acc-1',
    name: 'Test Account',
    type: 'current' as any,
    balance: 1000,
    institution: 'Test Bank',
    sortCode: '12-34-56',
    accountNumber: '12345678'
  });

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    account: mockAccount,
    onSave: vi.fn()
  };

  describe('rendering', () => {
    it('renders correctly with default props', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      expect(screen.getByText('Account Settings')).toBeInTheDocument();
      expect(screen.getByText('Test Account')).toBeInTheDocument();
      expect(screen.getByText('Account Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Opening balance amount')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<AccountSettingsModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Account Settings')).not.toBeInTheDocument();
    });

    it('does not render when account is null', () => {
      render(<AccountSettingsModal {...defaultProps} account={null} />);
      
      expect(screen.queryByText('Account Settings')).not.toBeInTheDocument();
    });

    it('shows bank details fields for current and savings accounts', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      expect(screen.getByLabelText('Bank sort code')).toBeInTheDocument();
      expect(screen.getByLabelText('Bank account number')).toBeInTheDocument();
    });

    it('hides bank details fields for non-bank accounts', async () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      // Find the select element by looking for the Account Type label's sibling
      const typeLabel = screen.getByText('Account Type');
      const typeSelect = typeLabel.parentElement?.querySelector('select');
      expect(typeSelect).toBeTruthy();
      
      await userEvent.selectOptions(typeSelect!, 'credit');
      
      expect(screen.queryByLabelText('Bank sort code')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Bank account number')).not.toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('handles close button click', async () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await userEvent.click(cancelButton);
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('handles form submission', async () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      // Submit form without changes - should include existing values
      const submitButton = screen.getByRole('button', { name: 'Save Changes' });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledWith('acc-1', expect.objectContaining({
          type: 'current',
          sortCode: '12-34-56',
          accountNumber: '12345678'
        }));
      });
    });

    it('has sort code input with correct attributes', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const sortCodeInput = screen.getByLabelText('Bank sort code');
      expect(sortCodeInput).toHaveAttribute('placeholder', 'XX-XX-XX');
      expect(sortCodeInput).toHaveAttribute('maxLength', '8');
    });

    it('has account number input with correct attributes', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const accountNumberInput = screen.getByLabelText('Bank account number');
      expect(accountNumberInput).toHaveAttribute('placeholder', '12345678');
      expect(accountNumberInput).toHaveAttribute('maxLength', '8');
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-labelledby');
      expect(screen.getByLabelText('Opening balance amount')).toBeInTheDocument();
      expect(screen.getByLabelText('Opening balance date')).toBeInTheDocument();
    });

    it('supports keyboard navigation', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      // Check that all form elements are accessible via keyboard
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('tabindex', '-1');
      
      // Check close button is focusable
      const closeButton = screen.getByLabelText('Close modal');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton.tagName).toBe('BUTTON');
    });

    it('closes modal on Escape key', async () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      await userEvent.keyboard('{Escape}');
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('has opening balance inputs', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const balanceInput = screen.getByLabelText('Opening balance amount');
      expect(balanceInput).toHaveAttribute('type', 'number');
      expect(balanceInput).toHaveAttribute('step', '0.01');
      
      const dateInput = screen.getByLabelText('Opening balance date');
      expect(dateInput).toHaveAttribute('type', 'date');
    });

    it('handles empty optional fields correctly', async () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      // Clear all optional fields
      const institutionInput = screen.getByPlaceholderText('Bank or financial institution name');
      fireEvent.change(institutionInput, { target: { value: '' } });
      
      const submitButton = screen.getByRole('button', { name: 'Save Changes' });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalledWith('acc-1', expect.objectContaining({
          institution: undefined,
          notes: undefined
        }));
      });
    });

    it('has correct structure for sort code', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const sortCodeInput = screen.getByLabelText('Bank sort code');
      expect(sortCodeInput).toHaveAttribute('maxLength', '8'); // 6 digits + 2 dashes
      expect(sortCodeInput).toHaveAttribute('placeholder', 'XX-XX-XX');
    });
  });
});