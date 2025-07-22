/**
 * EditTransactionModal Tests
 * Basic tests for the transaction editing modal component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EditTransactionModal from './EditTransactionModal';
import type { Transaction } from '../types';

// Mock all dependencies with minimal implementations
vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    accounts: [
      { id: 'acc-1', name: 'Checking Account', type: 'checking', currency: 'USD', balance: 1000, lastUpdated: new Date() },
    ],
    categories: [
      { id: 'cat-1', name: 'Food', level: 'sub', parentId: 'type-expense' },
    ],
    updateTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    getSubCategories: vi.fn(() => []),
    getDetailCategories: vi.fn(() => []),
  }),
}));

vi.mock('../hooks/useTransactionNotifications', () => ({
  useTransactionNotifications: () => ({
    addTransaction: vi.fn(),
  }),
}));

vi.mock('./CategoryCreationModal', () => ({
  default: () => null,
}));

vi.mock('./TagSelector', () => ({
  default: () => <div data-testid="tag-selector">Tag Selector</div>,
}));

vi.mock('./MarkdownEditor', () => ({
  default: () => <div data-testid="markdown-editor">Markdown Editor</div>,
}));

vi.mock('./DocumentManager', () => ({
  default: () => <div data-testid="document-manager">Document Manager</div>,
}));

vi.mock('./common/Modal', () => ({
  Modal: ({ isOpen, children, title }: any) => 
    isOpen ? (
      <div data-testid="modal" role="dialog" aria-label={title}>
        <div data-testid="modal-title">{title}</div>
        {children}
      </div>
    ) : null,
  ModalBody: ({ children }: any) => <div data-testid="modal-body">{children}</div>,
  ModalFooter: ({ children }: any) => <div data-testid="modal-footer">{children}</div>,
}));

vi.mock('../hooks/useModalForm', () => ({
  useModalForm: () => ({
    formData: {
      date: '2023-01-15',
      description: '',
      amount: '',
      type: 'expense',
      category: '',
      subCategory: '',
      accountId: 'acc-1',
      tags: [],
      notes: '',
      cleared: false,
      reconciledWith: ''
    },
    updateField: vi.fn(),
    handleSubmit: vi.fn(),
    setFormData: vi.fn(),
  }),
}));

vi.mock('../utils/currency', () => ({
  getCurrencySymbol: () => '$',
}));

vi.mock('../services/validationService', () => ({
  ValidationService: {
    validateTransaction: vi.fn((data) => data),
    formatErrors: vi.fn(() => ({})),
  },
}));

// Mock all icons with simple divs
vi.mock('../components/icons', () => ({
  CalendarIcon: () => <div data-testid="calendar-icon">📅</div>,
  TagIcon: () => <div data-testid="tag-icon">🏷️</div>,
  FileTextIcon: () => <div data-testid="file-text-icon">📄</div>,
  CheckIcon2: () => <div data-testid="check-icon-2">✓</div>,
  LinkIcon: () => <div data-testid="link-icon">🔗</div>,
  PlusIcon: () => <div data-testid="plus-icon">+</div>,
  HashIcon: () => <div data-testid="hash-icon">#</div>,
  WalletIcon: () => <div data-testid="wallet-icon">👛</div>,
  ArrowRightLeftIcon: () => <div data-testid="arrow-right-left-icon">↔️</div>,
  BanknoteIcon: () => <div data-testid="banknote-icon">💵</div>,
  PaperclipIcon: () => <div data-testid="paperclip-icon">📎</div>,
}));

describe('EditTransactionModal', () => {
  const mockOnClose = vi.fn();

  const createMockTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
    id: 'txn-1',
    description: 'Test Transaction',
    amount: 100.50,
    type: 'expense',
    accountId: 'acc-1',
    date: new Date('2023-01-15'),
    category: 'cat-1',
    tags: ['test'],
    notes: 'Test notes',
    cleared: false,
    reconciledWith: '',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (isOpen = true, transaction: Transaction | null = null) => {
    return render(
      <EditTransactionModal
        isOpen={isOpen}
        onClose={mockOnClose}
        transaction={transaction}
      />
    );
  };

  describe('basic rendering', () => {
    it('renders when open for new transaction', () => {
      renderModal(true, null);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('New Transaction');
    });

    it('renders when open for editing transaction', () => {
      const transaction = createMockTransaction();
      renderModal(true, transaction);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Edit Transaction');
    });

    it('does not render when closed', () => {
      renderModal(false);
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('displays modal structure correctly', () => {
      renderModal(true, null);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-body')).toBeInTheDocument();
      expect(screen.getByTestId('modal-footer')).toBeInTheDocument();
    });

    it('displays delete button when editing existing transaction', () => {
      const transaction = createMockTransaction();
      renderModal(true, transaction);
      
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('does not display delete button when creating new transaction', () => {
      renderModal(true, null);
      
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('displays document manager when editing existing transaction', () => {
      const transaction = createMockTransaction();
      renderModal(true, transaction);
      
      expect(screen.getByTestId('document-manager')).toBeInTheDocument();
    });

    it('does not display document manager when creating new transaction', () => {
      renderModal(true, null);
      
      expect(screen.queryByTestId('document-manager')).not.toBeInTheDocument();
    });
  });

  describe('form structure', () => {
    it('displays all main form sections', () => {
      renderModal(true, null);
      
      // Check for key form elements
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Account')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText(/amount/i)).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Tags')).toBeInTheDocument();
      expect(screen.getByText('Notes')).toBeInTheDocument();
    });

    it('displays transaction type options', () => {
      renderModal(true, null);
      
      expect(screen.getByText('Income')).toBeInTheDocument();
      expect(screen.getByText('Expense')).toBeInTheDocument();
      expect(screen.getByText('Transfer')).toBeInTheDocument();
    });

    it('displays status checkboxes', () => {
      renderModal(true, null);
      
      expect(screen.getByText('Reconciled')).toBeInTheDocument();
      expect(screen.getByText('Linked to bank statement')).toBeInTheDocument();
    });

    it('displays action buttons', () => {
      renderModal(true, null);
      
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add transaction/i })).toBeInTheDocument();
    });

    it('shows correct submit button text for editing', () => {
      const transaction = createMockTransaction();
      renderModal(true, transaction);
      
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });
  });

  describe('component integration', () => {
    it('includes tag selector component', () => {
      renderModal(true, null);
      
      expect(screen.getByTestId('tag-selector')).toBeInTheDocument();
    });

    it('includes markdown editor component', () => {
      renderModal(true, null);
      
      expect(screen.getByTestId('markdown-editor')).toBeInTheDocument();
    });

    it('includes create new category button', () => {
      renderModal(true, null);
      
      expect(screen.getByText(/create new category/i)).toBeInTheDocument();
    });
  });

  describe('icons display', () => {
    it('displays form field icons', () => {
      renderModal(true, null);
      
      expect(screen.getByTestId('calendar-icon')).toBeInTheDocument();
      expect(screen.getByTestId('wallet-icon')).toBeInTheDocument();
      expect(screen.getAllByTestId('file-text-icon')).toHaveLength(2); // Description and Notes
      expect(screen.getByTestId('arrow-right-left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('banknote-icon')).toBeInTheDocument();
      expect(screen.getByTestId('tag-icon')).toBeInTheDocument();
      expect(screen.getByTestId('hash-icon')).toBeInTheDocument();
      expect(screen.getByTestId('check-icon-2')).toBeInTheDocument();
      expect(screen.getByTestId('link-icon')).toBeInTheDocument();
      expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    });

    it('displays paperclip icon when editing existing transaction', () => {
      const transaction = createMockTransaction();
      renderModal(true, transaction);
      
      expect(screen.getByTestId('paperclip-icon')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper modal structure with ARIA labels', () => {
      renderModal(true, null);
      
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('aria-label', 'New Transaction');
    });

    it('has proper button roles', () => {
      const transaction = createMockTransaction();
      renderModal(true, transaction);
      
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });
  });

  describe('transaction data display', () => {
    it('shows bank reconciliation status when applicable', () => {
      const transaction = createMockTransaction({
        reconciledWith: 'bank-txn-123',
      });
      renderModal(true, transaction);
      
      expect(screen.getByText(/reconciled with transaction id/i)).toBeInTheDocument();
    });

    it('hides bank reconciliation for manual transactions', () => {
      const transaction = createMockTransaction({
        reconciledWith: 'manual',
      });
      renderModal(true, transaction);
      
      expect(screen.queryByText(/reconciled with transaction id/i)).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles null transaction gracefully', () => {
      renderModal(true, null);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('New Transaction');
    });

    it('handles modal state changes', () => {
      const { rerender } = renderModal(true, null);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      
      rerender(
        <EditTransactionModal
          isOpen={false}
          onClose={mockOnClose}
          transaction={null}
        />
      );
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('handles transaction prop changes', () => {
      const transaction1 = createMockTransaction({ id: 'txn-1' });
      const { rerender } = renderModal(true, transaction1);
      
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Edit Transaction');
      
      const transaction2 = createMockTransaction({ id: 'txn-2' });
      rerender(
        <EditTransactionModal
          isOpen={true}
          onClose={mockOnClose}
          transaction={transaction2}
        />
      );
      
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Edit Transaction');
    });
  });
});