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

    it('displays the account name in an editable field', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      expect(screen.getByLabelText('Account name')).toHaveValue('Test Account');
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
      // Pairing needs an account list to pair with; without one there is
      // nothing to offer and nothing is written either way.
      expect(screen.queryByLabelText('Part of investment account')).not.toBeInTheDocument();
    });

    it('populates form with account data', () => {
      render(<AccountSettingsModal {...defaultProps} />);
      
      const typeSelect = screen.getByDisplayValue('Current Account');
      expect(typeSelect).toHaveValue('current');
      
      const balanceInput = screen.getByLabelText('Opening balance amount') as HTMLInputElement;
      expect(balanceInput.value).toBe('500.00');
      
      const dateInput = screen.getByLabelText('Opening balance date') as HTMLInputElement;
      expect(dateInput.value).toBe('01/12/2023');
      
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
      // 'assets' and 'liability' — the two that name the ASSETS and
      // LIABILITIES sections. 'other' was offered here as "Other Liability"
      // and filed under "Other Accounts", because it is not a section type at
      // all, so choosing it moved an account somewhere the label never
      // mentioned.
      expect(typeSelect).toContainHTML('<option value="assets">Asset</option>');
      expect(typeSelect).toContainHTML('<option value="liability">Liability</option>');
      expect(typeSelect).not.toContainHTML('<option value="other">');
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

  describe('Card Number', () => {
    const creditAccount: Account = { ...mockAccount, type: 'credit', sortCode: undefined, accountNumber: '9012' };

    it('stores the LAST four of a pasted card number, not the first', async () => {
      const onSave = vi.fn();
      render(<AccountSettingsModal {...defaultProps} account={creditAccount} onSave={onSave} />);

      fireEvent.change(screen.getByLabelText(/Card Number/), {
        target: { value: '4929 1234 5678 9012' }
      });
      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('acc1', expect.objectContaining({
          accountNumber: '9012'
        }));
      });
    });

    it('keeps the whole entry in the field so the right four survive the save', () => {
      render(<AccountSettingsModal {...defaultProps} account={creditAccount} />);

      const field = screen.getByLabelText(/Card Number/);
      fireEvent.change(field, { target: { value: '4929123456789012' } });

      // Capping the input would have left '4929' — the wrong four.
      expect(field).toHaveValue('4929123456789012');
    });

    it('trims on save even for a card the type was only just switched to', async () => {
      const onSave = vi.fn();
      render(<AccountSettingsModal {...defaultProps} onSave={onSave} />);

      fireEvent.change(screen.getByLabelText('Bank account number'), {
        target: { value: '12345678' }
      });
      fireEvent.change(screen.getByDisplayValue('Current Account'), { target: { value: 'credit' } });
      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('acc1', expect.objectContaining({
          accountNumber: '5678'
        }));
      });
    });

    it('tells the user what will be stored rather than offering them a choice', () => {
      render(<AccountSettingsModal {...defaultProps} account={creditAccount} />);

      fireEvent.change(screen.getByLabelText(/Card Number/), {
        target: { value: '4929123456789012' }
      });

      expect(screen.getByRole('status')).toHaveTextContent(
        'Saving will store 9012 and discard the rest.'
      );
      expect(screen.queryByRole('button', { name: /Keep only/ })).not.toBeInTheDocument();
    });

    it('clears the stored number when the card field is emptied', async () => {
      const onSave = vi.fn();
      render(<AccountSettingsModal {...defaultProps} account={creditAccount} onSave={onSave} />);

      fireEvent.change(screen.getByLabelText(/Card Number/), {
        target: { value: '' }
      });
      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('acc1', expect.objectContaining({
          accountNumber: undefined
        }));
      });
    });
  });

  /**
   * Investment↔cash pairing (the Microsoft Money model): a cash account is
   * filed inside the investment account whose money it holds. One-directional
   * and one deep, so the field is offered only where that shape holds.
   */
  describe('Part of investment account', () => {
    const investment: Account = {
      id: 'inv1', name: 'Fund ISA', type: 'investment', balance: 0, currency: 'GBP',
      lastUpdated: new Date('2026-01-01')
    };
    const otherInvestment: Account = { ...investment, id: 'inv2', name: 'Workplace Pension' };
    const pairable = { ...defaultProps, accounts: [mockAccount, investment] };

    it('offers every investment account, and None', () => {
      render(<AccountSettingsModal {...pairable} accounts={[mockAccount, investment, otherInvestment]} />);

      const field = screen.getByLabelText('Part of investment account');
      expect(field).toContainHTML('<option value="">None</option>');
      expect(field).toContainHTML('<option value="inv1">Fund ISA</option>');
      expect(field).toContainHTML('<option value="inv2">Workplace Pension</option>');
      // The account being edited is not somewhere it can be filed.
      expect(field).not.toContainHTML('value="acc1"');
    });

    it('saves the chosen investment account', async () => {
      const onSave = vi.fn();
      render(<AccountSettingsModal {...pairable} onSave={onSave} />);

      fireEvent.change(screen.getByLabelText('Part of investment account'), {
        target: { value: 'inv1' }
      });
      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('acc1', expect.objectContaining({
          parentAccountId: 'inv1'
        }));
      });
    });

    it('clears the pairing with null, which is what empties the column', async () => {
      const onSave = vi.fn();
      const paired = { ...mockAccount, parentAccountId: 'inv1' };
      render(<AccountSettingsModal {...pairable} account={paired} accounts={[paired, investment]} onSave={onSave} />);

      expect(screen.getByLabelText('Part of investment account')).toHaveValue('inv1');
      fireEvent.change(screen.getByLabelText('Part of investment account'), { target: { value: '' } });
      fireEvent.click(screen.getByText('Save Changes'));

      // undefined would leave the stored parent in place — mapAccountToDb
      // skips undefined fields.
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('acc1', expect.objectContaining({
          parentAccountId: null
        }));
      });
    });

    it('does not offer pairing for an investment account — pairing runs one way', () => {
      render(<AccountSettingsModal {...pairable} account={{ ...mockAccount, type: 'investment' }} />);

      expect(screen.queryByLabelText('Part of investment account')).not.toBeInTheDocument();
    });

    it('takes the field away, and writes nothing, when the type is switched to Investments', async () => {
      const onSave = vi.fn();
      render(<AccountSettingsModal {...pairable} onSave={onSave} />);

      expect(screen.getByLabelText('Part of investment account')).toBeInTheDocument();
      fireEvent.change(screen.getByDisplayValue('Current Account'), { target: { value: 'investment' } });
      expect(screen.queryByLabelText('Part of investment account')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Save Changes'));
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });
      expect(onSave.mock.calls[0][1]).not.toHaveProperty('parentAccountId');
    });

    it('does not offer pairing to an account that already has accounts inside it', () => {
      const child = { ...investment, id: 'child1', type: 'savings' as const, parentAccountId: 'acc1' };
      render(<AccountSettingsModal {...pairable} accounts={[mockAccount, investment, child]} />);

      expect(screen.queryByLabelText('Part of investment account')).not.toBeInTheDocument();
    });

    it('does not offer an investment account that is itself paired inside another', () => {
      const nested = { ...otherInvestment, parentAccountId: 'inv1' };
      render(<AccountSettingsModal {...pairable} accounts={[mockAccount, investment, nested]} />);

      const field = screen.getByLabelText('Part of investment account');
      expect(field).toContainHTML('value="inv1"');
      expect(field).not.toContainHTML('value="inv2"');
    });

    it('keeps the current parent selectable even once it would no longer qualify', () => {
      const nowNested = { ...investment, parentAccountId: 'inv2' };
      const paired = { ...mockAccount, parentAccountId: 'inv1' };
      render(
        <AccountSettingsModal
          {...pairable}
          account={paired}
          accounts={[paired, nowNested, otherInvestment]}
        />
      );

      // A select whose value is absent from its options shows something else,
      // and saving that would re-file the account somewhere nobody chose.
      expect(screen.getByLabelText('Part of investment account')).toHaveValue('inv1');
    });

    it('says nothing about pairing when there is no investment account to pair with', () => {
      render(<AccountSettingsModal {...defaultProps} accounts={[mockAccount]} />);

      expect(screen.queryByLabelText('Part of investment account')).not.toBeInTheDocument();
    });
  });

  describe('Opening Balance', () => {
    it('accepts decimal values', () => {
      render(<AccountSettingsModal {...defaultProps} />);

      const balanceInput = screen.getByLabelText('Opening balance amount');
      fireEvent.change(balanceInput, { target: { value: '1234.56' } });

      expect(balanceInput).toHaveValue('1234.56');
    });

    it('groups thousands once the field is left', () => {
      render(<AccountSettingsModal {...defaultProps} />);

      const balanceInput = screen.getByLabelText('Opening balance amount');
      fireEvent.change(balanceInput, { target: { value: '1000000' } });
      fireEvent.blur(balanceInput);

      expect(balanceInput).toHaveValue('1,000,000.00');
    });

    it('accepts a negative opening balance for accounts that open in the red', () => {
      render(<AccountSettingsModal {...defaultProps} />);

      const balanceInput = screen.getByLabelText('Opening balance amount');
      fireEvent.change(balanceInput, { target: { value: '-2500' } });
      fireEvent.blur(balanceInput);

      expect(balanceInput).toHaveValue('-2,500.00');
    });

    it('leaves the date BLANK when the account has none, and says what blank does', () => {
      /*
       * This asserted the opposite until 2026-08-13 — that the field defaults to
       * TODAY — and the assertion was the bug, written down.
       *
       * Most imported accounts have no opening date, correctly: Money records
       * `dtOpen` only sometimes and the importer writes nothing rather than
       * inventing one. The app then applies the opening balance from the first
       * transaction. Pre-filling today meant that opening this dialog to change
       * an account's NAME and pressing Save stamped "opened today" onto an
       * account that had been running since 2010 — silently, and cumulatively
       * across every account the owner ever edited.
       */
      const accountWithoutDate = { ...mockAccount, openingBalanceDate: undefined };
      render(<AccountSettingsModal {...defaultProps} account={accountWithoutDate} />);

      const dateInput = screen.getByLabelText('Opening balance date') as HTMLInputElement;
      expect(dateInput.value).toBe('');
      expect(screen.getByText(/applies from this account's first\s+transaction/i)).toBeInTheDocument();
    });

    it('does not write an opening date the user never entered', () => {
      // The half that actually corrupted data: a blank field must reach `onSave`
      // as no date at all, not as today's.
      const onSave = vi.fn();
      const accountWithoutDate = { ...mockAccount, openingBalanceDate: undefined };
      render(<AccountSettingsModal {...defaultProps} account={accountWithoutDate} onSave={onSave} />);

      fireEvent.change(screen.getByLabelText(/account name/i), { target: { value: 'Renamed' } });
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      expect(onSave).toHaveBeenCalled();
      const [, updates] = onSave.mock.calls[0];
      expect(updates).not.toHaveProperty('openingBalanceDate');
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
          name: 'Test Account',
          type: 'savings',
          institution: 'New Bank',
          notes: 'Test notes',
          sortCode: '123456',
          accountNumber: '12345678',
          isActive: true,
          openingBalance: 750,
          openingBalanceDate: expect.any(Date),
          lowBalanceAlertEnabled: false,
          lowBalanceThreshold: undefined
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
        expect(onSave).toHaveBeenCalledWith('acc1', expect.objectContaining({
          type: 'current',
          institution: undefined,
          notes: undefined,
          sortCode: undefined,
          accountNumber: undefined,
          isActive: true
        }));
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

    it('saves a renamed account (trimmed)', async () => {
      const onSave = vi.fn();
      render(<AccountSettingsModal {...defaultProps} onSave={onSave} />);

      fireEvent.change(screen.getByLabelText('Account name'), { target: { value: '  Everyday Current — Renamed  ' } });
      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('acc1', expect.objectContaining({
          name: 'Everyday Current — Renamed'
        }));
      });
    });

    it('never blanks the name: an emptied field is omitted from the update', async () => {
      const onSave = vi.fn();
      render(<AccountSettingsModal {...defaultProps} onSave={onSave} />);

      fireEvent.change(screen.getByLabelText('Account name'), { target: { value: '   ' } });
      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1);
      });
      expect(onSave.mock.calls[0][1]).not.toHaveProperty('name');
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