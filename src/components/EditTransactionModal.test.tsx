/**
 * EditTransactionModal Tests
 * Basic tests for the transaction editing modal component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditTransactionModal from './EditTransactionModal';
import type { Transaction } from '../types';

// The modal navigates (a linked transfer's "jump to the other side"); every
// host sits inside the app router, but this file renders it bare.
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/accounts/acc-1', search: '', hash: '', state: null, key: 'test' }),
  };
});

// Mock all dependencies with minimal implementations.
// AppContextSupabase (which the component actually consumes) is mocked
// globally in src/test/setup.ts via src/test/mocks/AppContextSupabase.ts.
vi.mock('../hooks/useTransactionNotifications', () => ({
  useTransactionNotifications: () => ({
    addTransaction: vi.fn(),
  }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    dismissToast: vi.fn(),
  }),
}));

vi.mock('./CategoryCreationModal', () => ({
  default: () => null,
}));

// Stubbed like the other heavy children — the picker's own behaviour is
// covered by CategorySelector.test.tsx; here we only care about the modal.
vi.mock('./CategorySelector', () => ({
  default: () => <div data-testid="category-selector">Category Selector</div>,
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

// Hoisted so the date-field tests can read what the form was actually told to
// store — a fresh vi.fn() per render would be unassertable.
const { mockUpdateField } = vi.hoisted(() => ({ mockUpdateField: vi.fn() }));

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
    updateField: mockUpdateField,
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

// Mock all icons with simple divs. The shared DatePicker draws from the same
// module, so its glyphs (calendar + the calendar's own chevrons) belong here too.
vi.mock('../components/icons', () => ({
  CalendarIcon: () => <div data-testid="calendar-icon">📅</div>,
  ChevronLeftIcon: () => <div data-testid="chevron-left-icon">‹</div>,
  ChevronRightIcon: () => <div data-testid="chevron-right-icon">›</div>,
  // The account combobox's own chevron.
  ChevronDownIcon: () => <div data-testid="chevron-down-icon">⌄</div>,
  ArrowUpRightIcon: () => <div data-testid="arrow-up-right-icon">↗️</div>,
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
  XIcon: () => <div data-testid="x-icon">✕</div>,
}));

describe('EditTransactionModal', () => {
  const mockOnClose = vi.fn();

  const createMockTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
    id: 'txn-1',
    description: 'Test Transaction',
    // Signed convention: expenses are stored as negative amounts
    amount: -100.50,
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

    it('bands the account picker into the Accounts page sections', () => {
      // The owner's complaint: seventy accounts in one flat unsorted list.
      // It is now the same searchable combobox as the category picker, banded
      // by type and then by institution — sections in page order, alphabetical
      // inside each, and each call site's own option wording unchanged.
      renderModal(true, null);

      fireEvent.click(screen.getByRole('combobox', { name: 'Account' }));

      const list = screen.getByRole('listbox', { name: 'Account' });
      const typeSections = Array.from(list.children)
        .filter(child => child.getAttribute('role') === 'group')
        .map(child => child.getAttribute('aria-label'));
      expect(typeSections).toEqual([
        'Current Accounts', 'Savings Accounts', 'Credit Cards', 'Loans', 'Investments', 'Assets',
      ]);

      const creditCards = screen.getByRole('group', { name: 'Credit Cards' });
      // Institution sub-bands nested inside the type section, alphabetical.
      expect(Array.from(creditCards.querySelectorAll('[role="group"]')).map(g => g.getAttribute('aria-label')))
        .toEqual(['American Express', 'Natwest']);
      expect(Array.from(creditCards.querySelectorAll('[role="option"]')).map(o => o.textContent)).toEqual([
        'American Express Gold (credit)', 'Natwest Credit Card (credit)',
      ]);
      // A mortgage files under Loans, as it does on the Accounts page.
      const loans = screen.getByRole('group', { name: 'Loans' });
      expect(Array.from(loans.querySelectorAll('[role="option"]')).map(o => o.textContent)).toEqual([
        'Natwest Mortgage (mortgage)', 'Natwest Personal Loan (loan)',
      ]);
    });

    it('filters the account picker as the user types, by name or by bank', () => {
      // The point of the change: with seventy accounts, typing beats scrolling.
      renderModal(true, null);
      fireEvent.click(screen.getByRole('combobox', { name: 'Account' }));

      const search = screen.getByPlaceholderText('Search or select account…');
      fireEvent.change(search, { target: { value: 'premium' } });
      expect(screen.getAllByRole('option').map(o => o.textContent))
        .toEqual(['NS&I Premium Bonds (savings)']);

      // An institution finds every account held with it, whatever they're called.
      fireEvent.change(search, { target: { value: 'hargreaves' } });
      expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual([
        'Hargreaves Lansdown ISA (investment)', 'Hargreaves Lansdown SIPP (investment)',
      ]);
    });

    it('displays transaction type options', () => {
      renderModal(true, null);
      
      expect(screen.getByText('Income')).toBeInTheDocument();
      expect(screen.getByText('Expense')).toBeInTheDocument();
      expect(screen.getByText('Transfer')).toBeInTheDocument();
    });

    it('displays status checkboxes', () => {
      renderModal(true, null);
      
      // The working flag says so in words: only finalizing a reconciliation
      // reconciles anything.
      expect(screen.getByText('Marked against a statement')).toBeInTheDocument();
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
      
      // Two: the Date field's label, and the date picker's own trailing glyph.
      expect(screen.getAllByTestId('calendar-icon')).toHaveLength(2);
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

  describe('date field', () => {
    // The reported bug: the modal used a native <input type="date">, which
    // renders in the BROWSER's locale. A register row reading 07/02/2022 opened
    // here as 02/07/2022 — 7 February against 2 July, on money.
    it('reads the stored ISO date back in UK order', () => {
      renderModal(true, createMockTransaction());

      const field = screen.getByLabelText('Transaction date');
      // 2023-01-15 — day first, so 15 cannot be mistaken for a month.
      expect(field).toHaveValue('15/01/2023');
      expect(field).toHaveAttribute('placeholder', 'dd/mm/yyyy');
      // Not a native control: those are the ones that follow the browser.
      expect(field).toHaveAttribute('type', 'text');
      expect(field).toBeRequired();
    });

    it('stores a typed UK date as ISO, unchanged', () => {
      renderModal(true, createMockTransaction());

      fireEvent.change(screen.getByLabelText('Transaction date'), {
        target: { value: '06/07/2017' },
      });

      // 6 July 2017 — the value handed to the form is the ISO the DB holds,
      // so the caller's state shape is untouched by the presentation change.
      expect(mockUpdateField).toHaveBeenCalledWith('date', '2017-07-06');
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

  describe('Previous / Save & Next batch buttons', () => {
    it('shows both when handlers are provided for an existing transaction', () => {
      render(
        <EditTransactionModal
          isOpen
          onClose={mockOnClose}
          transaction={createMockTransaction()}
          onSaveAndNext={vi.fn()}
          onSaveAndPrevious={vi.fn()}
        />
      );
      expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save & Next' })).toBeInTheDocument();
    });

    it('omits Previous when there is no previous handler (e.g. first row)', () => {
      render(
        <EditTransactionModal
          isOpen
          onClose={mockOnClose}
          transaction={createMockTransaction()}
          onSaveAndNext={vi.fn()}
        />
      );
      expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Save & Next' })).toBeInTheDocument();
    });

    it('shows neither for a new transaction', () => {
      render(
        <EditTransactionModal
          isOpen
          onClose={mockOnClose}
          transaction={null}
          onSaveAndNext={vi.fn()}
          onSaveAndPrevious={vi.fn()}
        />
      );
      expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Save & Next' })).toBeNull();
    });
  });

  describe('split mode', () => {
    const splitToggle = () =>
      screen.getByRole('checkbox', { name: /split across multiple categories/i });

    it('offers the split toggle when editing a transaction', () => {
      renderModal(true, createMockTransaction());
      expect(splitToggle()).toBeInTheDocument();
      expect(splitToggle()).not.toBeChecked();
    });

    it('hides the toggle for new transactions (create single first, then split)', () => {
      renderModal(true, null);
      expect(
        screen.queryByRole('checkbox', { name: /split across multiple categories/i })
      ).toBeNull();
    });

    it('seeds two split lines when toggled on', () => {
      renderModal(true, createMockTransaction());
      fireEvent.click(splitToggle());

      expect(screen.getAllByLabelText(/split line \d+ amount/i)).toHaveLength(2);
      expect(screen.getByRole('button', { name: /add another category/i })).toBeInTheDocument();
      // Two empty lines have no categories yet — save is blocked and says why
      expect(screen.getByText(/every split line needs a category/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    });

    it('shows the live remainder when the totals do not match', () => {
      renderModal(true, createMockTransaction());
      fireEvent.click(splitToggle());

      fireEvent.change(screen.getByLabelText('Split line 1 amount'), { target: { value: '60' } });
      // Mocked form amount is '' (0), so allocating 60 leaves -60 outstanding
      expect(screen.getByText(/remaining to allocate/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    });

    it('adds and removes split lines (minimum of two enforced)', () => {
      renderModal(true, createMockTransaction());
      fireEvent.click(splitToggle());

      // Two lines: no remove buttons (the minimum)
      expect(screen.queryByRole('button', { name: /remove split line/i })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /add another category/i }));
      expect(screen.getAllByLabelText(/split line \d+ amount/i)).toHaveLength(3);
      expect(screen.getAllByRole('button', { name: /remove split line/i })).toHaveLength(3);

      fireEvent.click(screen.getByRole('button', { name: 'Remove split line 3' }));
      expect(screen.getAllByLabelText(/split line \d+ amount/i)).toHaveLength(2);
      expect(screen.queryByRole('button', { name: /remove split line/i })).toBeNull();
    });

    it('returns to the single category picker when toggled back off', () => {
      renderModal(true, createMockTransaction());
      fireEvent.click(splitToggle());
      // Split mode renders one (stubbed) selector per line — two of them —
      // and no amount-free single picker.
      expect(screen.getAllByTestId('category-selector')).toHaveLength(2);

      fireEvent.click(splitToggle());
      expect(screen.getAllByTestId('category-selector')).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Save Changes' })).not.toBeDisabled();
    });
  });
});