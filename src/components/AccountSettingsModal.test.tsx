import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AccountSettingsModal from './AccountSettingsModal';
import type { Account } from '../types';

// Mock the Modal components
vi.mock('./common/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: any) => 
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="Close modal">Close</button>
        {children}
      </div>
    ) : null,
  ModalBody: ({ children, className }: any) => <div className={className}>{children}</div>,
  ModalFooter: ({ children }: any) => <div>{children}</div>,
}));

// Mock useModalForm hook
vi.mock('../hooks/useModalForm', () => ({
  useModalForm: (initialData: any, options: any) => {
    const [formData, setFormData] = React.useState(initialData);
    
    const updateField = (field: string, value: any) => {
      setFormData((prev: any) => ({ ...prev, [field]: value }));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      options.onSubmit(formData);
    };
    
    return { formData, updateField, handleSubmit, setFormData };
  }
}));

describe('AccountSettingsModal', () => {
  const mockAccount: Account = {
    id: 'acc1',
    name: 'Test Account',
    type: 'current' as const,
    balance: 1000,
    currency: 'USD',
    createdAt: new Date('2024-01-01'),
    openingBalance: 500,
    openingBalanceDate: new Date('2023-12-01'),
    sortCode: '123456',
    accountNumber: '12345678',
    institution: 'Test Bank',
    notes: 'Test notes'
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    account: mockAccount,
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when account is null', () => {
      render(<AccountSettingsModal {...defaultProps} account={null} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders modal when open with account', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Account Settings')).toBeInTheDocument();
    });

    it('displays account name', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      expect(screen.getByText('Test Account')).toBeInTheDocument();
    });

    it('renders all form fields', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      expect(screen.getByText('Account Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Opening balance amount')).toBeInTheDocument();
      expect(screen.getByLabelText('Opening balance date')).toBeInTheDocument();
      expect(screen.getByLabelText('Bank sort code')).toBeInTheDocument();
      expect(screen.getByLabelText('Bank account number')).toBeInTheDocument();
      expect(screen.getByText('Institution')).toBeInTheDocument();
      expect(screen.getByText('Notes')).toBeInTheDocument();
    });

    it('populates form with account data', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const typeSelect = screen.getByDisplayValue('Current Account');
      expect(typeSelect).toHaveValue('current');
      
      const balanceInput = screen.getByLabelText('Opening balance amount') as HTMLInputElement;
      expect(balanceInput.value).toBe('500');
      
      const dateInput = screen.getByLabelText('Opening balance date') as HTMLInputElement;
      expect(dateInput.value).toBe('2023-12-01');
      
      const sortCodeInput = screen.getByLabelText('Bank sort code') as HTMLInputElement;
      // Sort code is stored as '123456' but not formatted initially
      expect(sortCodeInput.value).toBe('123456');
      
      const accountNumberInput = screen.getByLabelText('Bank account number') as HTMLInputElement;
      expect(accountNumberInput.value).toBe('12345678');
      
      const institutionInput = screen.getByPlaceholderText('Bank or financial institution name') as HTMLInputElement;
      expect(institutionInput.value).toBe('Test Bank');
      
      const notesTextarea = screen.getByPlaceholderText('Additional information about this account') as HTMLTextAreaElement;
      expect(notesTextarea.value).toBe('Test notes');
    });
  });

  describe('Account Type', () => {
    it('renders all account type options', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const typeSelect = screen.getByDisplayValue('Current Account');
      expect(typeSelect).toContainHTML('<option value="current">Current Account</option>');
      expect(typeSelect).toContainHTML('<option value="savings">Savings Account</option>');
      expect(typeSelect).toContainHTML('<option value="loan">Loan Account</option>');
      expect(typeSelect).toContainHTML('<option value="credit">Credit Card</option>');
      expect(typeSelect).toContainHTML('<option value="investment">Investments</option>');
      expect(typeSelect).toContainHTML('<option value="assets">Other Asset</option>');
      expect(typeSelect).toContainHTML('<option value="other">Other Liability</option>');
    });

    it('shows help text for account type', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      expect(screen.getByText('Changing the type will relocate this account to the appropriate section')).toBeInTheDocument();
    });

    it('updates account type on selection', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const typeSelect = screen.getByDisplayValue('Current Account');
      fireEvent.change(typeSelect, { target: { value: 'savings' } });
      
      expect(typeSelect).toHaveValue('savings');
    });
  });

  describe('Bank Details', () => {
    it('shows bank details for current account', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      expect(screen.getByLabelText('Bank sort code')).toBeInTheDocument();
      expect(screen.getByLabelText('Bank account number')).toBeInTheDocument();
    });

    it('shows bank details for savings account', () => {
      const savingsAccount = { ...mockAccount, type: 'savings' as const };
      render(<AccountSettingsModal {...defaultProps} account={savingsAccount} />);
      
      expect(screen.getByLabelText('Bank sort code')).toBeInTheDocument();
      expect(screen.getByLabelText('Bank account number')).toBeInTheDocument();
    });

    it('hides bank details for credit card', () => {
      const creditAccount = { ...mockAccount, type: 'credit' as const };
      render(<AccountSettingsModal {...defaultProps} account={creditAccount} />);
      
      expect(screen.queryByLabelText('Bank sort code')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Bank account number')).not.toBeInTheDocument();
    });

    it('shows/hides bank details when changing type', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      // Initially shows for current account
      expect(screen.getByLabelText('Bank sort code')).toBeInTheDocument();
      
      // Change to credit card
      const typeSelect = screen.getByDisplayValue('Current Account');
      fireEvent.change(typeSelect, { target: { value: 'credit' } });
      
      expect(screen.queryByLabelText('Bank sort code')).not.toBeInTheDocument();
      
      // Change back to savings
      fireEvent.change(typeSelect, { target: { value: 'savings' } });
      
      expect(screen.getByLabelText('Bank sort code')).toBeInTheDocument();
    });
  });

  describe('Sort Code Formatting', () => {
    it('formats sort code as XX-XX-XX', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const sortCodeInput = screen.getByLabelText('Bank sort code');
      
      // Clear and type new value
      fireEvent.change(sortCodeInput, { target: { value: '' } });
      fireEvent.change(sortCodeInput, { target: { value: '123456' } });
      
      expect(sortCodeInput).toHaveValue('12-34-56');
    });

    it('handles partial sort code', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const sortCodeInput = screen.getByLabelText('Bank sort code');
      
      fireEvent.change(sortCodeInput, { target: { value: '12' } });
      expect(sortCodeInput).toHaveValue('12');
      
      fireEvent.change(sortCodeInput, { target: { value: '1234' } });
      expect(sortCodeInput).toHaveValue('12-34');
    });

    it('removes non-numeric characters from sort code', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const sortCodeInput = screen.getByLabelText('Bank sort code');
      
      fireEvent.change(sortCodeInput, { target: { value: 'ab12cd34ef56' } });
      expect(sortCodeInput).toHaveValue('12-34-56');
    });

    it('limits sort code to 6 digits', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const sortCodeInput = screen.getByLabelText('Bank sort code');
      
      fireEvent.change(sortCodeInput, { target: { value: '1234567890' } });
      expect(sortCodeInput).toHaveValue('12-34-56');
    });
  });

  describe('Account Number', () => {
    it('only allows numeric input', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const accountNumberInput = screen.getByLabelText('Bank account number');
      
      fireEvent.change(accountNumberInput, { target: { value: 'abc123def456' } });
      expect(accountNumberInput).toHaveValue('123456');
    });

    it('limits account number to 8 digits', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const accountNumberInput = screen.getByLabelText('Bank account number');
      expect(accountNumberInput).toHaveAttribute('maxLength', '8');
    });
  });

  describe('Opening Balance', () => {
    it('accepts decimal values', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const balanceInput = screen.getByLabelText('Opening balance amount');
      fireEvent.change(balanceInput, { target: { value: '1234.56' } });
      
      expect(balanceInput).toHaveValue(1234.56);
    });

    it('has step of 0.01', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const balanceInput = screen.getByLabelText('Opening balance amount');
      expect(balanceInput).toHaveAttribute('step', '0.01');
    });

    it('defaults date to today for accounts without opening balance date', () => {
      const accountWithoutDate = { ...mockAccount, openingBalanceDate: undefined };
      render(<AccountSettingsModal {...defaultProps} account={accountWithoutDate} />);
      
      const dateInput = screen.getByLabelText('Opening balance date') as HTMLInputElement;
      expect(dateInput.value).toBe(new Date().toISOString().split('T')[0]);
    });
  });

  describe('Form Submission', () => {
    it('calls onSave with updated data', async () => {
      const onSave = vi.fn();
      render(<AccountSettingsModal {...defaultProps} onSave={onSave} />);
      
      // Change some fields
      fireEvent.change(screen.getByDisplayValue('Current Account'), { target: { value: 'savings' } });
      fireEvent.change(screen.getByLabelText('Opening balance amount'), { target: { value: '750' } });
      fireEvent.change(screen.getByPlaceholderText('Bank or financial institution name'), { target: { value: 'New Bank' } });
      
      // Submit form
      fireEvent.click(screen.getByText('Save Changes'));
      
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('acc1', {
          type: 'savings',
          institution: 'New Bank',
          notes: 'Test notes',
          sortCode: '123456',
          accountNumber: '12345678',
          openingBalance: 750,
          openingBalanceDate: expect.any(Date)
        });
      });
    });

    it('excludes empty optional fields', async () => {
      const onSave = vi.fn();
      const accountWithMinimalData = {
        ...mockAccount,
        sortCode: undefined,
        accountNumber: undefined,
        institution: undefined,
        notes: undefined,
        openingBalance: undefined,
        openingBalanceDate: undefined
      };
      
      render(<AccountSettingsModal {...defaultProps} account={accountWithMinimalData} onSave={onSave} />);
      
      // Submit without filling optional fields
      fireEvent.click(screen.getByText('Save Changes'));
      
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('acc1', {
          type: 'current',
          institution: undefined,
          notes: undefined,
          sortCode: undefined,
          accountNumber: undefined
        });
      });
    });

    it('parses opening balance as float', async () => {
      const onSave = vi.fn();
      render(<AccountSettingsModal {...defaultProps} onSave={onSave} />);
      
      fireEvent.change(screen.getByLabelText('Opening balance amount'), { target: { value: '123.45' } });
      fireEvent.click(screen.getByText('Save Changes'));
      
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('acc1', expect.objectContaining({
          openingBalance: 123.45
        }));
      });
    });

    it('includes opening balance when provided', async () => {
      const onSave = vi.fn();
      render(<AccountSettingsModal {...defaultProps} onSave={onSave} />);
      
      // Ensure opening balance is included
      fireEvent.change(screen.getByLabelText('Opening balance amount'), { target: { value: '999' } });
      fireEvent.click(screen.getByText('Save Changes'));
      
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('acc1', expect.objectContaining({
          openingBalance: 999
        }));
      });
    });
  });

  describe('Cancel Action', () => {
    it('calls onClose when cancel clicked', () => {
      const onClose = vi.fn();
      render(<AccountSettingsModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when close button clicked', () => {
      const onClose = vi.fn();
      render(<AccountSettingsModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByLabelText('Close modal'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles account without extended properties', () => {
      const minimalAccount = {
        id: 'acc1',
        name: 'Minimal Account',
        type: 'current' as const,
        balance: 0,
        currency: 'USD',
        createdAt: new Date()
      };
      
      render(<AccountSettingsModal {...defaultProps} account={minimalAccount} />);
      
      const balanceInput = screen.getByLabelText('Opening balance amount') as HTMLInputElement;
      expect(balanceInput.value).toBe('');
      
      const sortCodeInput = screen.getByLabelText('Bank sort code') as HTMLInputElement;
      expect(sortCodeInput.value).toBe('');
    });

    it('handles whitespace in optional fields', async () => {
      const onSave = vi.fn();
      render(<AccountSettingsModal {...defaultProps} onSave={onSave} />);
      
      // Enter whitespace only
      fireEvent.change(screen.getByPlaceholderText('Bank or financial institution name'), { target: { value: '   ' } });
      fireEvent.change(screen.getByPlaceholderText('Additional information about this account'), { target: { value: '   ' } });
      
      fireEvent.click(screen.getByText('Save Changes'));
      
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('acc1', expect.objectContaining({
          institution: '   ',
          notes: '   '
        }));
      });
    });
  });
});