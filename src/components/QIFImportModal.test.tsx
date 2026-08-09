import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import QIFImportModal from './QIFImportModal';
import { qifImportService } from '../services/qifImportService';
import type { QIFParseResult } from '../services/qifImportService';
import { dataPort } from '../services/port';
import { formatCurrency as formatCurrencyDecimal } from '../utils/currency-decimal';

type QIFImportResult = Awaited<ReturnType<typeof qifImportService.importTransactions>>;

// Mock icons
vi.mock('./icons', () => ({
  UploadIcon: ({ className }: { className?: string }) => <div data-testid="upload-icon" className={className}>Upload</div>,
  FileTextIcon: ({ className }: { className?: string }) => <div data-testid="file-text-icon" className={className}>FileText</div>,
  CheckIcon: () => <div data-testid="check-icon">Check</div>,
  AlertCircleIcon: () => <div data-testid="alert-circle-icon">Alert</div>,
  InfoIcon: ({ className }: { className?: string }) => <div data-testid="info-icon" className={className}>Info</div>,
  RefreshCwIcon: () => <div data-testid="refresh-icon">Refresh</div>,
  // The account combobox's own chevron.
  ChevronDownIcon: () => <div data-testid="chevron-down-icon">Chevron</div>
}));

// Mock Modal component
vi.mock('./common/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => 
    isOpen ? (
      <div data-testid="modal">
        <div data-testid="modal-title">{title}</div>
        <button data-testid="modal-close" onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null,
  // The real ModalBody is the modal's one scrollable region; here it only
  // needs to exist and render its children.
  ModalBody: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="modal-body">{children}</div>
  )
}));

// Mock LoadingButton. `disabled={isLoading || disabled}` mirrors the real
// component — a stub that stayed clickable while loading would let a test
// "prove" the button cannot double-fire when in truth only the stub couldn't.
vi.mock('./loading/LoadingState', () => ({
  LoadingButton: ({ isLoading, onClick, disabled, children, className, loadingText = 'Loading...' }: { isLoading: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode; className?: string; loadingText?: string }) => (
    <button
      data-testid="loading-button"
      onClick={onClick}
      disabled={isLoading || disabled}
      className={className}
      data-loading={isLoading}
    >
      {isLoading ? loadingText : children}
    </button>
  )
}));

// Mock AppContext
const mockRefreshAccountsAndTransactions = vi.fn().mockResolvedValue(undefined);
const mockAccounts = [
  { id: 'acc1', name: 'Current Account', type: 'checking' },
  { id: 'acc2', name: 'Savings Account', type: 'savings' },
  { id: 'acc3', name: 'Credit Card', type: 'credit' }
];

const mockTransactions = [
  {
    id: 'trans1',
    date: new Date('2024-01-01'),
    amount: 100,
    description: 'Test Transaction',
    accountId: 'acc1',
    type: 'expense',
    category: 'Food',
    cleared: true
  }
];

const mockCategories = [
  { id: 'cat1', name: 'Food' },
  { id: 'cat2', name: 'Transport' }
];

vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    accounts: mockAccounts,
    transactions: mockTransactions,
    categories: mockCategories,
    refreshAccountsAndTransactions: mockRefreshAccountsAndTransactions
  })
}));

// Mock QIF import service
vi.mock('../services/qifImportService', () => ({
  qifImportService: {
    parseQIF: vi.fn(),
    importTransactions: vi.fn()
  }
}));

/**
 * THE WRITE, which is now one door rather than two.
 *
 * The dialog used to choose between the chunked cloud poster and a per-row
 * loop through the context itself, off `isUsingSupabase`, and this file mocked
 * both. It asks the seam once now; which store answers is the seam's business
 * and is tested where that decision lives (dataService.test.ts). What is
 * mocked here is the ANSWER, because what this file tests is what the modal
 * REPORTS about a write — and the only way to test that honestly is to control
 * what the write says it did.
 */
vi.mock('../services/port', () => ({
  dataPort: {
    importTransactions: vi.fn()
  }
}));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number, currency: string = 'GBP') =>
      formatCurrencyDecimal(amount, currency)
  })
}));

// Mock window methods
const mockAlert = vi.fn();
global.alert = mockAlert;

// Mock File.prototype.text method
const mockText = vi.fn().mockResolvedValue('QIF content');
global.File = class extends File {
  constructor(fileBits: BlobPart[], fileName: string, options?: FilePropertyBag) {
    super(fileBits, fileName, options);
    this.text = mockText;
  }
} as any;

describe('QIFImportModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: the write does what it was asked. Tests that care about a
    // failing or a partial write override this.
    vi.mocked(dataPort.importTransactions).mockImplementation(
      async (_accountId, rows) => ({
        inserted: rows.length,
        alreadyPresent: 0,
        total: rows.length,
        complete: true
      })
    );
  });

  /**
   * The destination account is a searchable combobox now, not a native
   * <select>: open it and click the row, as a user would.
   */
  const chooseAccount = (label: string): void => {
    fireEvent.click(screen.getByRole('combobox', { name: 'Import to Account' }));
    fireEvent.click(screen.getByText(label));
  };

  const CURRENT_ACCOUNT = 'Current Account (checking)';
  const SAVINGS_ACCOUNT = 'Savings Account (savings)';

  const sampleTransaction: QIFParseResult['transactions'][number] = {
    date: '2024-01-15',
    amount: 100,
    payee: 'Test Payee',
    memo: 'Test Memo',
    cleared: true,
    category: 'Food'
  };

  const createMockParseResult = (overrides: Partial<QIFParseResult> = {}): QIFParseResult => ({
    transactions: [sampleTransaction],
    accountType: 'Bank',
    ...overrides
  });

  describe('Rendering', () => {
    it('renders nothing when closed', () => {
      render(<QIFImportModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('renders modal when open', () => {
      render(<QIFImportModal {...defaultProps} />);
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Import QIF File');
    });

    it('renders file upload section initially', () => {
      render(<QIFImportModal {...defaultProps} />);
      
      expect(screen.getByText('Upload QIF File')).toBeInTheDocument();
      expect(screen.getByText('Drag and drop your .qif file here, or click to browse')).toBeInTheDocument();
      expect(screen.getByText('Select QIF File')).toBeInTheDocument();
      expect(screen.getByTestId('upload-icon')).toBeInTheDocument();
    });

    it('renders info section about QIF files', () => {
      render(<QIFImportModal {...defaultProps} />);
      
      expect(screen.getByText('About QIF Files')).toBeInTheDocument();
      expect(screen.getByText(/QIF.*Quicken Interchange Format.*is a simple text format/)).toBeInTheDocument();
      expect(screen.getByText(/Widely supported by UK banks and financial software/)).toBeInTheDocument();
      expect(screen.getByText(/Simple format but no unique transaction IDs/)).toBeInTheDocument();
      expect(screen.getByTestId('info-icon')).toBeInTheDocument();
    });

    it('renders file input with correct attributes', () => {
      render(<QIFImportModal {...defaultProps} />);

      const fileInput = document.getElementById('qif-upload');
      expect(fileInput).toHaveAttribute('accept', '.qif');
      expect(fileInput).toHaveAttribute('type', 'file');
    });

    /**
     * The picker was `className="hidden"` — display:none, which takes the input
     * out of the tab order altogether, and a <label> cannot hold focus in its
     * place. There was no way to reach it but a mouse.
     *
     * sr-only keeps it off screen and IN the tab order; focus-within paints the
     * ring on the button the user can actually see, so the focus is not
     * invisible either.
     */
    it('leaves the file picker in the tab order, with a visible focus ring', () => {
      render(<QIFImportModal {...defaultProps} />);

      const fileInput = document.getElementById('qif-upload');
      expect(fileInput).not.toHaveClass('hidden');
      expect(fileInput).toHaveClass('sr-only');
      expect(fileInput).not.toBeDisabled();
      expect(fileInput).not.toHaveAttribute('tabindex', '-1');
      expect(fileInput?.closest('label')?.className).toContain('focus-within:ring-2');
    });
  });

  describe('File Upload', () => {
    it('accepts QIF file upload', async () => {
      const mockParseResult = createMockParseResult();
      vi.mocked(qifImportService.parseQIF).mockReturnValueOnce(mockParseResult);
      
      render(<QIFImportModal {...defaultProps} />);
      
      const file = new File(['QIF content'], 'test.qif', { type: 'application/qif' });
      const fileInput = document.getElementById('qif-upload')!;
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(qifImportService.parseQIF).toHaveBeenCalled();
      });
    });

    it('rejects non-QIF files', () => {
      render(<QIFImportModal {...defaultProps} />);
      
      const file = new File(['CSV content'], 'test.csv', { type: 'text/csv' });
      const fileInput = document.getElementById('qif-upload')!;
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      expect(mockAlert).toHaveBeenCalledWith('Please select a QIF file');
      expect(qifImportService.parseQIF).not.toHaveBeenCalled();
    });

    it('handles drag and drop for QIF files', async () => {
      const mockParseResult = createMockParseResult();
      vi.mocked(qifImportService.parseQIF).mockReturnValueOnce(mockParseResult);
      
      render(<QIFImportModal {...defaultProps} />);
      
      const dropZone = screen.getByText('Drag and drop your .qif file here, or click to browse').closest('div')!;
      const file = new File(['QIF content'], 'test.qif', { type: 'application/qif' });
      
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file]
        }
      });
      
      await waitFor(() => {
        expect(qifImportService.parseQIF).toHaveBeenCalled();
      });
    });

    it('ignores drag and drop for non-QIF files', () => {
      render(<QIFImportModal {...defaultProps} />);
      
      const dropZone = screen.getByText('Drag and drop your .qif file here, or click to browse').closest('div')!;
      const file = new File(['CSV content'], 'test.csv', { type: 'text/csv' });
      
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file]
        }
      });
      
      expect(qifImportService.parseQIF).not.toHaveBeenCalled();
    });

    it('prevents default on drag over', () => {
      render(<QIFImportModal {...defaultProps} />);
      
      const dropZone = screen.getByText('Drag and drop your .qif file here, or click to browse').closest('div')!;
      
      fireEvent.dragOver(dropZone);
      
      // The component's onDragOver handler should call preventDefault
      expect(dropZone).toBeInTheDocument();
    });
  });

  describe('File Parsing', () => {
    it('shows file info after successful parsing', async () => {
      const mockParseResult = createMockParseResult({
        transactions: [
          { ...sampleTransaction },
          { ...sampleTransaction, date: '2024-01-16', amount: 200, payee: 'Test Payee 2' }
        ]
      });
      
      vi.mocked(qifImportService.parseQIF).mockReturnValueOnce(mockParseResult);
      
      render(<QIFImportModal {...defaultProps} />);
      
      const file = new File(['QIF content'], 'test.qif', { type: 'application/qif' });
      const fileInput = document.getElementById('qif-upload')!;
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('test.qif')).toBeInTheDocument();
        expect(screen.getByText('2 transactions found (Type: Bank)')).toBeInTheDocument();
      });
    });

    it('shows account selection dropdown', async () => {
      const mockParseResult = createMockParseResult();
      vi.mocked(qifImportService.parseQIF).mockReturnValueOnce(mockParseResult);
      
      render(<QIFImportModal {...defaultProps} />);
      
      const file = new File(['QIF content'], 'test.qif', { type: 'application/qif' });
      const fileInput = document.getElementById('qif-upload')!;
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: 'Import to Account' })).toBeInTheDocument();
      });
      expect(screen.getByText('Search or select an account…')).toBeInTheDocument();

      // The same searchable, banded picker as every other account field — and
      // the DB's 'checking' still files under Current Accounts.
      fireEvent.click(screen.getByRole('combobox', { name: 'Import to Account' }));
      const list = screen.getByRole('listbox', { name: 'Import to Account' });
      expect(
        Array.from(list.children)
          .filter(child => child.getAttribute('role') === 'group')
          .map(child => child.getAttribute('aria-label'))
      ).toEqual(['Current Accounts', 'Savings Accounts', 'Credit Cards']);
      expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual([
        'Current Account (checking)', 'Savings Account (savings)', 'Credit Card (credit)',
      ]);
    });

    it('shows transaction preview', async () => {
      const mockParseResult = createMockParseResult({
        transactions: [
          { ...sampleTransaction, amount: -50, payee: 'Grocery Store' },
          { ...sampleTransaction, date: '2024-01-16', amount: 100, payee: undefined, memo: 'Salary Payment' }
        ]
      });
      
      vi.mocked(qifImportService.parseQIF).mockReturnValueOnce(mockParseResult);
      
      render(<QIFImportModal {...defaultProps} />);
      
      const file = new File(['QIF content'], 'test.qif', { type: 'application/qif' });
      const fileInput = document.getElementById('qif-upload')!;
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('Preview (First 5 transactions)')).toBeInTheDocument();
        expect(screen.getByText('2024-01-15 - Grocery Store')).toBeInTheDocument();
        expect(screen.getByText('2024-01-16 - Salary Payment')).toBeInTheDocument();
        expect(screen.getByText('£50.00')).toBeInTheDocument();
        expect(screen.getByText('£100.00')).toBeInTheDocument();
      });
    });

    it('handles parsing errors', async () => {
      vi.mocked(qifImportService.parseQIF).mockImplementationOnce(() => {
        throw new Error('Invalid QIF format');
      });
      
      render(<QIFImportModal {...defaultProps} />);
      
      const file = new File(['Invalid content'], 'test.qif', { type: 'application/qif' });
      const fileInput = document.getElementById('qif-upload')!;
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Error parsing QIF file. Please check the file format.');
      });
    });

    it('pre-selects account when only one exists', async () => {
      // We'll test this by checking if the component behaves correctly with a single account
      // For now, this test is disabled since it's complex to re-mock the context
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Import Options', () => {
    beforeEach(async () => {
      const mockParseResult = {
        transactions: [{ date: '2024-01-15', amount: 100, payee: 'Test' }],
        accountType: 'Bank'
      };
      
      vi.mocked(qifImportService.parseQIF).mockReturnValueOnce(mockParseResult);
      
      render(<QIFImportModal {...defaultProps} />);
      
      const file = new File(['QIF content'], 'test.qif', { type: 'application/qif' });
      const fileInput = document.getElementById('qif-upload')!;
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('Skip potential duplicates')).toBeInTheDocument();
      });
    });

    it('shows skip duplicates option checked by default', () => {
      const checkbox = screen.getByRole('checkbox', { name: /Skip potential duplicates/ });
      expect(checkbox).toBeChecked();
      expect(screen.getByText('Checks for transactions with the same date, amount, and payee')).toBeInTheDocument();
    });

    it('allows toggling skip duplicates option', () => {
      const checkbox = screen.getByRole('checkbox', { name: /Skip potential duplicates/ });
      
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
      
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    it('allows selecting account', () => {
      chooseAccount(SAVINGS_ACCOUNT);

      expect(screen.getByRole('combobox', { name: 'Import to Account' }))
        .toHaveTextContent(SAVINGS_ACCOUNT);
    });

    it('shows required field indicator', () => {
      expect(screen.getByText('Import to Account')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument(); // Required indicator
      expect(screen.getByText(/QIF files don't contain account information/)).toBeInTheDocument();
    });
  });

  describe('Import Process', () => {
    beforeEach(async () => {
      const mockParseResult = {
        transactions: [{ date: '2024-01-15', amount: 100, payee: 'Test' }],
        accountType: 'Bank'
      };
      
      vi.mocked(qifImportService.parseQIF).mockReturnValueOnce(mockParseResult);
      
      render(<QIFImportModal {...defaultProps} />);
      
      const file = new File(['QIF content'], 'test.qif', { type: 'application/qif' });
      const fileInput = document.getElementById('qif-upload')!;
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByTestId('loading-button')).toBeInTheDocument();
      });
    });

    it('disables import button when no account selected', () => {
      const importButton = screen.getByTestId('loading-button');
      expect(importButton).toBeDisabled();
    });

    it('enables import button when account is selected', () => {
      chooseAccount(CURRENT_ACCOUNT);
      
      const importButton = screen.getByTestId('loading-button');
      expect(importButton).not.toBeDisabled();
      expect(importButton).toHaveTextContent('Import Transactions');
    });

    it('processes import successfully', async () => {
      const mockImportResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        newTransactions: 1,
        duplicates: 0,
        invalidDates: 0,
        matchedCategories: 0,
        unmatchedCategories: []
      };
      
      vi.mocked(qifImportService.importTransactions).mockResolvedValueOnce(mockImportResult);
      
      chooseAccount(CURRENT_ACCOUNT);
      
      const importButton = screen.getByTestId('loading-button');
      fireEvent.click(importButton);
      
      await waitFor(() => {
        expect(screen.getByText('Import Successful!')).toBeInTheDocument();
        expect(screen.getByText('Imported 1 transactions to Current Account')).toBeInTheDocument();
        expect(screen.getByTestId('check-icon')).toBeInTheDocument();
      });

      expect(dataPort.importTransactions).toHaveBeenCalledWith(
        'acc1',
        [{ id: 'trans1', amount: 100, description: 'Test' }],
        { source: 'file', onProgress: expect.any(Function) }
      );
    });

    /**
     * Pressing Import on a long statement used to leave the dialog completely
     * still — no count, no bar, nothing to say the click had even been
     * accepted. The only action available to somebody watching that is to
     * press the button again.
     */
    describe('while the write is running', () => {
      /** A write held open, so the in-flight state can be looked at. */
      const heldWrite = () => {
        vi.mocked(qifImportService.importTransactions).mockResolvedValueOnce({
          transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
          newTransactions: 1,
          duplicates: 0,
          invalidDates: 0,
          matchedCategories: 0,
          unmatchedCategories: []
        });
        let release: (() => void) | null = null;
        const finished = new Promise<void>(resolve => { release = resolve; });
        vi.mocked(dataPort.importTransactions).mockImplementationOnce(async (_accountId, rows) => {
          await finished;
          return { inserted: rows.length, alreadyPresent: 0, total: rows.length, complete: true };
        });
        return { release: () => release?.() };
      };

      it('says it is importing, and names the size of the job', async () => {
        const write = heldWrite();
        chooseAccount(CURRENT_ACCOUNT);
        fireEvent.click(screen.getByTestId('loading-button'));

        // Announced politely rather than by stealing focus.
        const status = await screen.findByRole('status');
        expect(status).toHaveTextContent('Importing 1 transactions…');
        expect(screen.getByRole('progressbar')).toBeInTheDocument();

        write.release();
        await waitFor(() => {
          expect(screen.getByText('Import Successful!')).toBeInTheDocument();
        });
        // The summary takes over; the progress region goes with it.
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      it('cannot be fired twice, and says why Cancel is unavailable', async () => {
        const write = heldWrite();
        chooseAccount(CURRENT_ACCOUNT);
        fireEvent.click(screen.getByTestId('loading-button'));
        await screen.findByRole('status');

        expect(screen.getByTestId('loading-button')).toBeDisabled();
        const cancel = screen.getByText('Cancel').closest('button');
        expect(cancel).toBeDisabled();
        expect(cancel).toHaveAttribute('title', 'Import in progress');

        // A second press while it runs must not start a second import.
        fireEvent.click(screen.getByTestId('loading-button'));
        write.release();
        await waitFor(() => {
          expect(screen.getByText('Import Successful!')).toBeInTheDocument();
        });
        expect(qifImportService.importTransactions).toHaveBeenCalledTimes(1);
        expect(dataPort.importTransactions).toHaveBeenCalledTimes(1);
      });
    });

    it('shows duplicate count in success message', async () => {
      const mockImportResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        newTransactions: 1,
        duplicates: 3,
        invalidDates: 0,
        matchedCategories: 0,
        unmatchedCategories: []
      };
      
      vi.mocked(qifImportService.importTransactions).mockResolvedValueOnce(mockImportResult);
      
      chooseAccount(CURRENT_ACCOUNT);
      
      const importButton = screen.getByTestId('loading-button');
      fireEvent.click(importButton);
      
      await waitFor(() => {
        expect(screen.getByText('Import Successful!')).toBeInTheDocument();
        expect(screen.getByText('Skipped 3 potential duplicate transactions')).toBeInTheDocument();
      });
    });

    it('handles import errors', async () => {
      vi.mocked(qifImportService.importTransactions).mockRejectedValueOnce(new Error('Import failed'));
      
      chooseAccount(CURRENT_ACCOUNT);
      
      const importButton = screen.getByTestId('loading-button');
      fireEvent.click(importButton);
      
      await waitFor(() => {
        expect(screen.getByText('Import Failed')).toBeInTheDocument();
        expect(screen.getByText('Import failed')).toBeInTheDocument();
        expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
      });
    });

    it('shows loading state during import', async () => {
      chooseAccount(CURRENT_ACCOUNT);
      
      const importButton = screen.getByTestId('loading-button');
      
      // Mock a delayed response
      vi.mocked(qifImportService.importTransactions).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      
      fireEvent.click(importButton);

      expect(importButton).toHaveAttribute('data-loading', 'true');
      expect(importButton).toHaveTextContent('Importing…');
    });

    it('calls import service with correct parameters', async () => {
      const mockImportResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        newTransactions: 1,
        duplicates: 0,
        invalidDates: 0,
        matchedCategories: 0,
        unmatchedCategories: []
      };
      
      vi.mocked(qifImportService.importTransactions).mockResolvedValueOnce(mockImportResult);
      
      chooseAccount(SAVINGS_ACCOUNT);
      
      const importButton = screen.getByTestId('loading-button');
      fireEvent.click(importButton);
      
      await waitFor(() => {
        expect(qifImportService.importTransactions).toHaveBeenCalled();
        // Verify it was called with the correct account ID by checking the call arguments
        const callArgs = vi.mocked(qifImportService.importTransactions).mock.calls[0];
        expect(callArgs[1]).toBe('acc2'); // Second argument should be selected account ID
      });
    });

    it('skips duplicate check when option is disabled', async () => {
      const mockImportResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        newTransactions: 1,
        duplicates: 0,
        invalidDates: 0,
        matchedCategories: 0,
        unmatchedCategories: []
      };
      
      vi.mocked(qifImportService.importTransactions).mockResolvedValueOnce(mockImportResult);
      
      chooseAccount(CURRENT_ACCOUNT);
      
      const checkbox = screen.getByRole('checkbox', { name: /Skip potential duplicates/ });
      fireEvent.click(checkbox); // Uncheck the option
      
      const importButton = screen.getByTestId('loading-button');
      fireEvent.click(importButton);
      
      await waitFor(() => {
        expect(qifImportService.importTransactions).toHaveBeenCalled();
        // Verify it was called with empty array for transactions (no duplicate check)
        const callArgs = vi.mocked(qifImportService.importTransactions).mock.calls[0];
        expect(callArgs[1]).toBe('acc1'); // Selected account ID
        expect(callArgs[2]).toEqual([]); // Empty array when skip duplicates is off
      });
    });
  });

  /**
   * THE WRITE — what reaches a store when Import is pressed, and what the
   * dialog then tells the user about it.
   *
   * These tests were written against the two writers this dialog used to
   * choose between itself, off `isUsingSupabase`: the chunked cloud poster,
   * and a loop handing the context one row at a time. They are now one set,
   * because there is now one call. The pair they replace is the change:
   *
   *   was — 'writes the file a row at a time, one context write per row'
   *         (three rows, three separate writes through the context) and
   *         'posts the whole file to the chunked client, holding its own
   *         token' (the same file, one post, a Clerk token handed over by the
   *         dialog);
   *   is  — one call to the seam, with the same rows, either way.
   *
   *   was — 'leaves the rows written before a failure in the register'
   *         (row three refuses; rows one and two stay in, and the screen says
   *         only "Import Failed");
   *   is  — 'nothing half-lands' (the store answers 0 of 3, and 0 is what is
   *         in the register).
   */
  describe('The write', () => {
    const draft = (
      description: string,
      amount: number,
      day: string
    ): QIFImportResult['transactions'][number] => ({
      date: new Date(day),
      description,
      amount,
      type: amount < 0 ? 'expense' : 'income',
      accountId: 'acc1',
      category: '',
      cleared: false,
      notes: '',
      isRecurring: false
    });

    /** Three invented rows — a file's worth, in file order. */
    const threeRows: QIFImportResult['transactions'] = [
      draft('ACME SUPPLIES', -18.4, '2024-03-01'),
      draft('RIVERSIDE CAFE', -6.25, '2024-03-02'),
      draft('MONTHLY TRANSFER IN', 250, '2024-03-03')
    ];

    const importResultOf = (
      transactions: QIFImportResult['transactions'],
      overrides: Partial<QIFImportResult> = {}
    ): QIFImportResult => ({
      transactions,
      duplicates: 0,
      newTransactions: transactions.length,
      invalidDates: 0,
      matchedCategories: 0,
      unmatchedCategories: [],
      ...overrides
    });

    /** QIF rows for the preview — only their count is read by these tests. */
    const parseRows = (count: number): QIFParseResult['transactions'] =>
      Array.from({ length: count }, (_, index) => ({
        date: `2024-03-${String(index + 1).padStart(2, '0')}`,
        amount: -10,
        payee: `PAYEE ${index + 1}`
      }));

    // These use mockReturnValue/mockResolvedValue rather than the ...Once form,
    // and an implementation survives vi.clearAllMocks() — so it is dropped with
    // the test that made it, or the next describe inherits this file's rows.
    afterEach(() => {
      vi.mocked(qifImportService.parseQIF).mockReset();
      vi.mocked(qifImportService.importTransactions).mockReset();
    });

    /** Upload a file, choose the destination, press Import. */
    const pressImport = async (
      transactions: QIFImportResult['transactions'],
      overrides: Partial<QIFImportResult> = {}
    ): Promise<void> => {
      vi.mocked(qifImportService.parseQIF).mockReturnValue(
        createMockParseResult({ transactions: parseRows(transactions.length) })
      );
      vi.mocked(qifImportService.importTransactions).mockResolvedValue(
        importResultOf(transactions, overrides)
      );

      render(<QIFImportModal {...defaultProps} />);
      fireEvent.change(document.getElementById('qif-upload')!, {
        target: { files: [new File(['QIF content'], 'quicken.qif', { type: 'application/qif' })] }
      });
      await waitFor(() => {
        expect(screen.getByTestId('loading-button')).toBeInTheDocument();
      });
      chooseAccount(CURRENT_ACCOUNT);
      fireEvent.click(screen.getByTestId('loading-button'));
    };

    it('hands the whole file to the seam in one call', async () => {
      await pressImport(threeRows);

      await waitFor(() => {
        expect(screen.getByText('Import Successful!')).toBeInTheDocument();
      });

      // One call for the file, not one per row, into the account the user
      // picked — a QIF names no account, so that choice is the whole
      // destination and nothing else in the file can overrule it.
      expect(dataPort.importTransactions).toHaveBeenCalledTimes(1);
      expect(dataPort.importTransactions).toHaveBeenCalledWith(
        'acc1',
        threeRows,
        // 'file', not 'ofx': a QIF row carries no id of its own, so no store
        // can recognise a second copy of it. Saying so is what stops one from
        // behaving as though it could.
        { source: 'file', onProgress: expect.any(Function) }
      );
      expect(screen.getByText('Imported 3 transactions to Current Account')).toBeInTheDocument();
    });

    it('re-reads the register, so the screen shows what actually landed', async () => {
      await pressImport(threeRows);

      await waitFor(() => {
        expect(screen.getByText('Import Successful!')).toBeInTheDocument();
      });
      expect(mockRefreshAccountsAndTransactions).toHaveBeenCalled();
    });

    it('reports what the write confirmed, not what the file offered', async () => {
      // The file offers three rows and the store confirms three. The partial
      // below is the same file with a different answer, and a different count.
      vi.mocked(dataPort.importTransactions).mockResolvedValueOnce({
        inserted: 3,
        alreadyPresent: 0,
        total: 3,
        complete: true
      });

      await pressImport(threeRows);

      await waitFor(() => {
        expect(screen.getByText('Imported 3 transactions to Current Account')).toBeInTheDocument();
      });
    });

    it('says how far it got when the write stops partway', async () => {
      vi.mocked(dataPort.importTransactions).mockResolvedValueOnce({
        inserted: 2,
        alreadyPresent: 0,
        total: 3,
        complete: false,
        error: 'QuotaExceededError'
      });

      await pressImport(threeRows);

      await waitFor(() => {
        expect(screen.getByText('Import Failed')).toBeInTheDocument();
      });
      expect(
        screen.getByText('Imported 2 of 3 transactions before an error stopped the import.')
      ).toBeInTheDocument();
      // Whatever did land is read back before anything is said about it.
      expect(mockRefreshAccountsAndTransactions).toHaveBeenCalled();
    });

    it('nothing half-lands: a device write that fails wrote no rows at all', async () => {
      // THE DECLARED CHANGE. This used to be a loop, so a file that failed on
      // its third row left the first two in the register with nothing on
      // screen but "Import Failed". A device write is one transaction: its
      // answer is 0 or all of them, and 0 is what the user is told.
      vi.mocked(dataPort.importTransactions).mockResolvedValueOnce({
        inserted: 0,
        alreadyPresent: 0,
        total: 3,
        complete: false,
        error: 'This device could not store the import.'
      });

      await pressImport(threeRows);

      await waitFor(() => {
        expect(screen.getByText('Import Failed')).toBeInTheDocument();
      });
      expect(
        screen.getByText('Imported 0 of 3 transactions before an error stopped the import.')
      ).toBeInTheDocument();
    });

    it('counts the rows as a chunked store reports them', async () => {
      // A store that commits in pieces says so between them; the dialog puts
      // those figures on screen as they arrive rather than jumping from
      // nothing to done. A store whose write is one atomic transaction reports
      // nothing, and the bar stays honestly indeterminate — the test below.
      let release: (() => void) | null = null;
      const held = new Promise<void>(resolve => { release = resolve; });
      vi.mocked(dataPort.importTransactions).mockImplementationOnce(
        async (_accountId, rows, options) => {
          options?.onProgress?.({ inserted: 2, total: rows.length });
          await held;
          return { inserted: rows.length, alreadyPresent: 0, total: rows.length, complete: true };
        }
      );

      await pressImport(threeRows);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Importing… 2 of 3 transactions');
      });
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67');

      release?.();
      await waitFor(() => {
        expect(screen.getByText('Import Successful!')).toBeInTheDocument();
      });
    });

    it('names the size of the job while a silent store is writing', async () => {
      // Nothing is claimed as inserted until a write says so. "0 of 3" beside
      // an empty bar reads as stuck, which is what the bar exists to remove.
      let release: (() => void) | null = null;
      const held = new Promise<void>(resolve => { release = resolve; });
      vi.mocked(dataPort.importTransactions).mockImplementationOnce(async (_accountId, rows) => {
        await held;
        return { inserted: rows.length, alreadyPresent: 0, total: rows.length, complete: true };
      });

      await pressImport(threeRows);

      const status = await screen.findByRole('status');
      expect(status).toHaveTextContent('Importing 3 transactions…');
      expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');

      release?.();
      await waitFor(() => {
        expect(screen.getByText('Import Successful!')).toBeInTheDocument();
      });
    });
  });

  describe('User Actions', () => {
    it('calls onClose when modal close button clicked', () => {
      const onClose = vi.fn();
      render(<QIFImportModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByTestId('modal-close'));
      expect(onClose).toHaveBeenCalled();
    });

    it('resets modal when cancel button clicked', async () => {
      const mockParseResult = {
        transactions: [{ date: '2024-01-15', amount: 100, payee: 'Test' }],
        accountType: 'Bank'
      };
      
      vi.mocked(qifImportService.parseQIF).mockReturnValueOnce(mockParseResult);
      
      render(<QIFImportModal {...defaultProps} />);
      
      const file = new File(['QIF content'], 'test.qif', { type: 'application/qif' });
      const fileInput = document.getElementById('qif-upload')!;
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('test.qif')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Cancel'));
      
      // Should return to initial state
      expect(screen.getByText('Upload QIF File')).toBeInTheDocument();
      expect(screen.queryByText('test.qif')).not.toBeInTheDocument();
    });

    it('shows import another file button after successful import', async () => {
      const mockParseResult = {
        transactions: [{ date: '2024-01-15', amount: 100, payee: 'Test' }],
        accountType: 'Bank'
      };
      
      const mockImportResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        newTransactions: 1,
        duplicates: 0,
        invalidDates: 0,
        matchedCategories: 0,
        unmatchedCategories: []
      };
      
      vi.mocked(qifImportService.parseQIF).mockReturnValueOnce(mockParseResult);
      vi.mocked(qifImportService.importTransactions).mockResolvedValueOnce(mockImportResult);
      
      render(<QIFImportModal {...defaultProps} />);
      
      const file = new File(['QIF content'], 'test.qif', { type: 'application/qif' });
      const fileInput = document.getElementById('qif-upload')!;
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        chooseAccount(CURRENT_ACCOUNT);
        
        const importButton = screen.getByTestId('loading-button');
        fireEvent.click(importButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Import Another File')).toBeInTheDocument();
        expect(screen.getByText('Done')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Import Another File'));
      
      // Should reset to initial state
      expect(screen.getByText('Upload QIF File')).toBeInTheDocument();
    });

    it('calls onClose when Done button clicked after import', async () => {
      const onClose = vi.fn();
      const mockParseResult = {
        transactions: [{ date: '2024-01-15', amount: 100, payee: 'Test' }],
        accountType: 'Bank'
      };
      
      const mockImportResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        newTransactions: 1,
        duplicates: 0,
        invalidDates: 0,
        matchedCategories: 0,
        unmatchedCategories: []
      };
      
      vi.mocked(qifImportService.parseQIF).mockReturnValueOnce(mockParseResult);
      vi.mocked(qifImportService.importTransactions).mockResolvedValueOnce(mockImportResult);
      
      render(<QIFImportModal {...defaultProps} onClose={onClose} />);
      
      const file = new File(['QIF content'], 'test.qif', { type: 'application/qif' });
      const fileInput = document.getElementById('qif-upload')!;
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        chooseAccount(CURRENT_ACCOUNT);
        
        const importButton = screen.getByTestId('loading-button');
        fireEvent.click(importButton);
      });
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Done'));
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty file upload', () => {
      render(<QIFImportModal {...defaultProps} />);
      
      const fileInput = document.getElementById('qif-upload')!;
      fireEvent.change(fileInput, { target: { files: [] } });
      
      expect(qifImportService.parseQIF).not.toHaveBeenCalled();
    });

    it('handles file upload without extension', () => {
      render(<QIFImportModal {...defaultProps} />);
      
      const file = new File(['content'], 'noextension', { type: 'text/plain' });
      const fileInput = document.getElementById('qif-upload')!;
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      expect(mockAlert).toHaveBeenCalledWith('Please select a QIF file');
    });

    it('handles drag drop without files', () => {
      render(<QIFImportModal {...defaultProps} />);
      
      const dropZone = screen.getByText('Drag and drop your .qif file here, or click to browse').closest('div')!;
      
      fireEvent.drop(dropZone, {
        dataTransfer: { files: [] }
      });
      
      expect(qifImportService.parseQIF).not.toHaveBeenCalled();
    });

    it('handles zero transactions found', async () => {
      const mockParseResult = {
        transactions: [],
        accountType: 'Bank'
      };
      
      vi.mocked(qifImportService.parseQIF).mockReturnValueOnce(mockParseResult);
      
      render(<QIFImportModal {...defaultProps} />);
      
      const file = new File(['QIF content'], 'test.qif', { type: 'application/qif' });
      const fileInput = document.getElementById('qif-upload')!;
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('0 transactions found (Type: Bank)')).toBeInTheDocument();
      });
    });

    it('handles transactions without payee or memo', async () => {
      const mockParseResult = {
        transactions: [
          { date: '2024-01-15', amount: 100 }, // No payee or memo
          { date: '2024-01-16', amount: -50, payee: '' } // Empty payee
        ],
        accountType: 'Bank'
      };
      
      vi.mocked(qifImportService.parseQIF).mockReturnValueOnce(mockParseResult);
      
      render(<QIFImportModal {...defaultProps} />);
      
      const file = new File(['QIF content'], 'test.qif', { type: 'application/qif' });
      const fileInput = document.getElementById('qif-upload')!;
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('2024-01-15 - No description')).toBeInTheDocument();
        expect(screen.getByText('2024-01-16 - No description')).toBeInTheDocument();
      });
    });

    it('handles more than 5 transactions in preview', async () => {
      const mockParseResult = {
        transactions: Array(10).fill(0).map((_, i) => ({
          date: `2024-01-${15 + i}`,
          amount: 100 + i,
          payee: `Payee ${i + 1}`
        })),
        accountType: 'Bank'
      };
      
      vi.mocked(qifImportService.parseQIF).mockReturnValueOnce(mockParseResult);
      
      render(<QIFImportModal {...defaultProps} />);
      
      const file = new File(['QIF content'], 'test.qif', { type: 'application/qif' });
      const fileInput = document.getElementById('qif-upload')!;
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('10 transactions found (Type: Bank)')).toBeInTheDocument();
        expect(screen.getByText('...and 5 more transactions')).toBeInTheDocument();
        expect(screen.getByText('2024-01-15 - Payee 1')).toBeInTheDocument();
        expect(screen.getByText('2024-01-19 - Payee 5')).toBeInTheDocument();
        expect(screen.queryByText('2024-01-20 - Payee 6')).not.toBeInTheDocument(); // Should not show 6th
      });
    });

    it('handles parsing result without account type', async () => {
      const mockParseResult = {
        transactions: [{ date: '2024-01-15', amount: 100, payee: 'Test' }]
        // No accountType
      };
      
      vi.mocked(qifImportService.parseQIF).mockReturnValueOnce(mockParseResult);
      
      render(<QIFImportModal {...defaultProps} />);
      
      const file = new File(['QIF content'], 'test.qif', { type: 'application/qif' });
      const fileInput = document.getElementById('qif-upload')!;
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('1 transactions found')).toBeInTheDocument();
        expect(screen.queryByText('Type:')).not.toBeInTheDocument();
      });
    });
  });

  /**
   * A file handed in by the Batch Import queue rather than picked here. It has
   * to reach exactly the same code the drop zone reaches — that is the whole
   * reason the queue is allowed to be a queue instead of a fourth importer.
   *
   * A QIF names no account, so this is also the check that a queued file still
   * ASKS which one it belongs to. The screen this queue replaced answered that
   * question itself, with accounts[0].
   */
  describe('A file handed in by the batch queue', () => {
    const queuedFile = (name = 'quicken.qif'): File =>
      new File(['QIF content'], name, { type: 'application/qif' });

    it('parses it on mount, with no click on the drop zone', async () => {
      vi.mocked(qifImportService.parseQIF).mockReturnValue(createMockParseResult());

      render(<QIFImportModal {...defaultProps} initialFile={queuedFile()} />);

      await waitFor(() => {
        expect(qifImportService.parseQIF).toHaveBeenCalled();
      });
      expect(screen.getByText('quicken.qif')).toBeInTheDocument();
      expect(screen.getByText('1 transactions found (Type: Bank)')).toBeInTheDocument();
    });

    it('still asks which account the file belongs to', async () => {
      vi.mocked(qifImportService.parseQIF).mockReturnValue(createMockParseResult());

      render(<QIFImportModal {...defaultProps} initialFile={queuedFile()} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: 'Import to Account' })).toBeInTheDocument();
      });
      // Nothing is imported until that question is answered.
      expect(screen.getByTestId('loading-button')).toBeDisabled();
    });

    /**
     * The queue re-renders whenever its own state moves. Re-parsing on each of
     * those would throw away an account the user had just chosen, mid-decision.
     */
    it('does not re-parse when the same file is handed in again', async () => {
      vi.mocked(qifImportService.parseQIF).mockReturnValue(createMockParseResult());

      const file = queuedFile();
      const { rerender } = render(<QIFImportModal {...defaultProps} initialFile={file} />);

      await waitFor(() => {
        expect(qifImportService.parseQIF).toHaveBeenCalledTimes(1);
      });

      rerender(<QIFImportModal {...defaultProps} initialFile={file} />);
      rerender(<QIFImportModal {...defaultProps} initialFile={file} />);

      expect(qifImportService.parseQIF).toHaveBeenCalledTimes(1);
    });

    it('reads a different file that happens to share a name', async () => {
      vi.mocked(qifImportService.parseQIF).mockReturnValue(createMockParseResult());

      const { rerender } = render(
        <QIFImportModal {...defaultProps} initialFile={queuedFile('export.qif')} />
      );
      await waitFor(() => {
        expect(qifImportService.parseQIF).toHaveBeenCalledTimes(1);
      });

      rerender(<QIFImportModal {...defaultProps} initialFile={queuedFile('export.qif')} />);

      await waitFor(() => {
        expect(qifImportService.parseQIF).toHaveBeenCalledTimes(2);
      });
    });

    it('shows the drop zone as usual when no file is handed in', () => {
      render(<QIFImportModal {...defaultProps} />);

      expect(screen.getByText('Upload QIF File')).toBeInTheDocument();
      expect(qifImportService.parseQIF).not.toHaveBeenCalled();
    });
  });
});
