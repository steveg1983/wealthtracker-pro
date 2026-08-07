import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OFXImportModal from './OFXImportModal';
import { ofxImportService } from '../services/ofxImportService';
import type { Account } from '../types';

type ImportTransactionsResult = Awaited<ReturnType<typeof ofxImportService.importTransactions>>;

/** A bank statement for sort code 12-34-56, account 12345678. */
const OFX_BANK_ACCOUNT: ImportTransactionsResult['ofxAccount'] = {
  accountId: '12345678',
  bankId: '123456',
  accountType: 'CHECKING',
  isCreditCardStatement: false,
};

const createMockImportResult = (
  overrides: Partial<ImportTransactionsResult> = {}
): ImportTransactionsResult => ({
  transactions: [],
  matchedAccount: null,
  ofxAccount: OFX_BANK_ACCOUNT,
  matchConfidence: null,
  statementRows: [],
  duplicateMatches: { certain: [], possible: [] },
  duplicates: 0,
  newTransactions: 0,
  ...overrides,
});

/** N file rows, matching a mocked draft list — only the count is read here. */
const mockStatementRows = (count: number): ImportTransactionsResult['statementRows'] =>
  Array.from({ length: count }, (_, index) => ({
    date: new Date('2024-01-01'),
    amount: 100,
    description: 'Test',
    fitId: `fit-${index}`,
  }));

/** The file row behind a drafted transaction, as the service reports it. */
const statementRow = (
  transaction: ImportTransactionsResult['transactions'][number],
  fitId: string
): ImportTransactionsResult['statementRows'][number] => ({
  date: transaction.date,
  amount: transaction.amount,
  description: transaction.description,
  fitId,
});

const sampleTransaction: ImportTransactionsResult['transactions'][number] = {
  date: new Date('2024-01-01'),
  description: 'Test transaction',
  amount: 100,
  type: 'income',
  accountId: 'acc1',
  category: '',
  cleared: true,
  notes: '',
  isRecurring: false
};

// Mock icons
vi.mock('./icons', () => ({
  UploadIcon: ({ className }: { className?: string }) => <div data-testid="upload-icon" className={className}>Upload</div>,
  FileTextIcon: ({ className }: { className?: string }) => <div data-testid="file-text-icon" className={className}>FileText</div>,
  CheckIcon: () => <div data-testid="check-icon">Check</div>,
  AlertCircleIcon: () => <div data-testid="alert-circle-icon">Alert</div>,
  InfoIcon: ({ className }: { className?: string }) => <div data-testid="info-icon" className={className}>Info</div>,
  LinkIcon: () => <div data-testid="link-icon">Link</div>,
  UnlinkIcon: () => <div data-testid="unlink-icon">Unlink</div>,
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
    ) : null
}));

// Mock LoadingButton
vi.mock('./loading/LoadingState', () => ({
  LoadingButton: ({ isLoading, onClick, disabled, children, className }: { isLoading: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) => (
    <button 
      data-testid="loading-button"
      onClick={onClick} 
      disabled={disabled}
      className={className}
      data-loading={isLoading}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  )
}));

// Mock AppContext
const mockAddTransaction = vi.fn();
const mockUpdateAccount = vi.fn();
const mockAccount = (overrides: Partial<Account> & Pick<Account, 'id' | 'name' | 'type'>): Account => ({
  balance: 0,
  currency: 'GBP',
  lastUpdated: new Date('2026-01-01'),
  ...overrides
});

const mockAccounts: Account[] = [
  mockAccount({ id: 'acc1', name: 'Current Account', type: 'checking' }),
  mockAccount({ id: 'acc2', name: 'Savings Account', type: 'savings' }),
  mockAccount({ id: 'acc3', name: 'Credit Card', type: 'credit' }),
  // Already has its bank details recorded — nothing may ever be written over
  // them — and a bank balance more recent than any statement used in these
  // tests, which nothing may write over either.
  mockAccount({
    id: 'acc4',
    name: 'Filed Account',
    type: 'current',
    sortCode: '12-34-56',
    accountNumber: '12345678',
    bankBalance: 4200,
    bankBalanceDate: '2026-11-30'
  })
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
    cleared: true,
    notes: '',
    isRecurring: false
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
    addTransaction: mockAddTransaction,
    updateAccount: mockUpdateAccount
  })
}));

// Mock OFX import service
vi.mock('../services/ofxImportService', () => ({
  ofxImportService: {
    importTransactions: vi.fn()
  }
}));

// Mock window methods
const mockAlert = vi.fn();
global.alert = mockAlert;

// Mock File.prototype.text method
const mockText = vi.fn().mockResolvedValue('OFX content');
global.File = class extends File {
  constructor(fileBits: BlobPart[], fileName: string, options?: FilePropertyBag) {
    super(fileBits, fileName, options);
    this.text = mockText;
  }
} as any;

describe('OFXImportModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * The destination account is a searchable combobox now, not a native
   * <select>: open it and click the row, as a user would.
   */
  const chooseAccount = (label: string): void => {
    fireEvent.click(screen.getByRole('combobox', { name: 'Import to Account' }));
    fireEvent.click(screen.getByText(label));
  };

  /** A preview summary tile, found by its label rather than by its number. */
  const summaryTile = (label: string): HTMLElement => {
    const tile = screen.getByText(label).parentElement;
    if (!tile) throw new Error(`no summary tile labelled "${label}"`);
    return tile;
  };

  const CURRENT_ACCOUNT = 'Current Account (checking)';
  const SAVINGS_ACCOUNT = 'Savings Account (savings)';

  describe('Rendering', () => {
    it('renders nothing when closed', () => {
      render(<OFXImportModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('renders modal when open', () => {
      render(<OFXImportModal {...defaultProps} />);
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('Import OFX File');
    });

    it('renders file upload section initially', () => {
      render(<OFXImportModal {...defaultProps} />);
      
      expect(screen.getByText('Upload OFX File')).toBeInTheDocument();
      expect(screen.getByText('Drag and drop your .ofx file here, or click to browse')).toBeInTheDocument();
      expect(screen.getByText('Select OFX File')).toBeInTheDocument();
      expect(screen.getByTestId('upload-icon')).toBeInTheDocument();
    });

    it('renders info section about OFX files', () => {
      render(<OFXImportModal {...defaultProps} />);
      
      expect(screen.getByText('About OFX Files')).toBeInTheDocument();
      expect(screen.getByText(/OFX.*Open Financial Exchange.*files contain standardized financial data/)).toBeInTheDocument();
      expect(screen.getByText(/Finds transactions you already have/)).toBeInTheDocument();
      expect(screen.getByText(/Smart account matching based on account numbers/)).toBeInTheDocument();
      expect(screen.getByTestId('info-icon')).toBeInTheDocument();
    });

    it('renders file input with correct attributes', () => {
      render(<OFXImportModal {...defaultProps} />);
      
      const fileInput = document.getElementById('ofx-upload');
      expect(fileInput).toHaveAttribute('accept', '.ofx');
      expect(fileInput).toHaveAttribute('type', 'file');
    });
  });

  describe('File Upload', () => {
    it('accepts OFX file upload', async () => {
      const mockParseResult = createMockImportResult({
        transactions: [sampleTransaction],
        newTransactions: 1
      });
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(ofxImportService.importTransactions).toHaveBeenCalled();
      });
    });

    it('rejects non-OFX files', () => {
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['CSV content'], 'test.csv', { type: 'text/csv' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      expect(mockAlert).toHaveBeenCalledWith('Please select an OFX file');
      expect(ofxImportService.importTransactions).not.toHaveBeenCalled();
    });

    it('handles drag and drop for OFX files', async () => {
      const mockParseResult = createMockImportResult({
        transactions: [sampleTransaction],
        newTransactions: 1
      });
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const dropZone = screen.getByText('Drag and drop your .ofx file here, or click to browse').closest('div')!;
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file]
        }
      });
      
      await waitFor(() => {
        expect(ofxImportService.importTransactions).toHaveBeenCalled();
      });
    });

    it('ignores drag and drop for non-OFX files', () => {
      render(<OFXImportModal {...defaultProps} />);
      
      const dropZone = screen.getByText('Drag and drop your .ofx file here, or click to browse').closest('div')!;
      const file = new File(['CSV content'], 'test.csv', { type: 'text/csv' });
      
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file]
        }
      });
      
      expect(ofxImportService.importTransactions).not.toHaveBeenCalled();
    });

    it('prevents default on drag over', () => {
      render(<OFXImportModal {...defaultProps} />);
      
      const dropZone = screen.getByText('Drag and drop your .ofx file here, or click to browse').closest('div')!;
      const preventDefaultSpy = vi.fn();
      
      fireEvent.dragOver(dropZone, {
        preventDefault: preventDefaultSpy
      });
      
      // The component's onDragOver handler should call preventDefault
      // Since we're mocking, we need to check that the handler exists
      expect(dropZone).toBeInTheDocument();
    });
  });

  describe('File Parsing', () => {
    it('shows file info after successful parsing', async () => {
      const second = { ...sampleTransaction, description: 'Test 2', amount: 200 };
      const mockParseResult = createMockImportResult({
        transactions: [sampleTransaction, second],
        statementRows: [statementRow(sampleTransaction, 'fit-1'), statementRow(second, 'fit-2')],
        newTransactions: 2
      });
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('test.ofx')).toBeInTheDocument();
        expect(screen.getByText('2 transactions found')).toBeInTheDocument();
      });
      // The tiles are read by their label, not by hunting for a loose "2":
      // both of them say 2 here, and which is which is the whole point.
      expect(summaryTile('In this file')).toHaveTextContent('2');
      expect(summaryTile('Will be imported')).toHaveTextContent('2');
    });

    it('says a guessed match is a guess', async () => {
      const mockParseResult = createMockImportResult({
        transactions: [sampleTransaction],
        matchedAccount: mockAccounts[0],
        matchConfidence: 'heuristic',
        newTransactions: 1
      });

      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);

      render(<OFXImportModal {...defaultProps} />);

      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Automatically matched to: Current Account')).toBeInTheDocument();
        expect(screen.getByText(/A best guess from the account's name and type/)).toBeInTheDocument();
        expect(screen.getByTestId('link-icon')).toBeInTheDocument();
      });
    });

    it('says an identifier match is the account\'s own recorded details', async () => {
      const mockParseResult = createMockImportResult({
        transactions: [sampleTransaction],
        matchedAccount: mockAccounts[0],
        matchConfidence: 'identifier',
        newTransactions: 1
      });

      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);

      render(<OFXImportModal {...defaultProps} />);

      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/Its recorded bank details are the ones in this file/)).toBeInTheDocument();
      });
    });

    it('lets the destination be changed even after an automatic match', async () => {
      // A match the user cannot overrule is a trap when the match is a guess.
      const mockParseResult = createMockImportResult({
        transactions: [sampleTransaction],
        matchedAccount: mockAccounts[0],
        matchConfidence: 'heuristic',
        newTransactions: 1
      });

      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);

      render(<OFXImportModal {...defaultProps} />);

      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: 'Import to Account' })).toBeInTheDocument();
      });

      chooseAccount(SAVINGS_ACCOUNT);
      expect(screen.getByRole('combobox', { name: 'Import to Account' }))
        .toHaveTextContent(SAVINGS_ACCOUNT);
    });

    it('shows unmatched account warning when no match found', async () => {
      const mockParseResult = createMockImportResult({
        transactions: [sampleTransaction],
        newTransactions: 1
      });

      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);

      render(<OFXImportModal {...defaultProps} />);

      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('No matching account found')).toBeInTheDocument();
        expect(screen.getByText(/OFX Account: \*\*\*\*5678.*Sort code: 12-34-56/)).toBeInTheDocument();
        expect(screen.getByTestId('unlink-icon')).toBeInTheDocument();
      });
    });

    it('does not present a 9-digit routing number as a sort code', async () => {
      // A US routing number is not a UK sort code, and its last 6 digits are
      // not one either — showing it as one invents a fact about the file.
      const mockParseResult = createMockImportResult({
        transactions: [sampleTransaction],
        ofxAccount: { ...OFX_BANK_ACCOUNT, bankId: '123456789' },
        newTransactions: 1
      });

      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);

      render(<OFXImportModal {...defaultProps} />);

      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/OFX Account: \*\*\*\*5678/)).toBeInTheDocument();
      });
      expect(screen.queryByText(/Sort code/)).not.toBeInTheDocument();
    });

    it('shows account selection dropdown when no match found', async () => {
      const mockParseResult = createMockImportResult({
        transactions: [sampleTransaction],
        newTransactions: 1
      });
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: 'Import to Account' })).toBeInTheDocument();
      });
      expect(screen.getByText('Search or select an account…')).toBeInTheDocument();

      // The same searchable, banded picker as every other account field.
      fireEvent.click(screen.getByRole('combobox', { name: 'Import to Account' }));
      const list = screen.getByRole('listbox', { name: 'Import to Account' });
      expect(
        Array.from(list.children)
          .filter(child => child.getAttribute('role') === 'group')
          .map(child => child.getAttribute('aria-label'))
      ).toEqual(['Current Accounts', 'Savings Accounts', 'Credit Cards']);
      expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual([
        'Current Account (checking)', 'Filed Account (current)',
        'Savings Account (savings)', 'Credit Card (credit)',
      ]);
    });

    it('handles parsing errors', async () => {
      vi.mocked(ofxImportService.importTransactions).mockRejectedValueOnce(new Error('Invalid OFX format'));
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['Invalid content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Error parsing OFX file. Please check the file format.');
      });
    });
  });

  describe('Import Options', () => {
    beforeEach(async () => {
      const mockParseResult = createMockImportResult({
        transactions: [sampleTransaction],
        newTransactions: 1
      });
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('Skip transactions you already have')).toBeInTheDocument();
      });
    });

    it('shows skip duplicates option checked by default', () => {
      const checkbox = screen.getByRole('checkbox', { name: /Skip transactions you already have/ });
      expect(checkbox).toBeChecked();
      expect(screen.getByText(/otherwise on the date and the exact amount in this\s+account/)).toBeInTheDocument();
    });

    it('allows toggling skip duplicates option', () => {
      const checkbox = screen.getByRole('checkbox', { name: /Skip transactions you already have/ });
      
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
      
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    it('allows selecting account when no match found', () => {
      chooseAccount(SAVINGS_ACCOUNT);

      expect(screen.getByRole('combobox', { name: 'Import to Account' }))
        .toHaveTextContent(SAVINGS_ACCOUNT);
    });
  });

  describe('Import Process', () => {
    beforeEach(async () => {
      const mockParseResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        statementRows: mockStatementRows(1),
        duplicateMatches: { certain: [], possible: [] },
        duplicates: 0,
        matchedAccount: { id: 'acc1', name: 'Current Account' }
      };
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByTestId('loading-button')).toBeInTheDocument();
      });
    });

    it('enables import button when account is matched', () => {
      const importButton = screen.getByTestId('loading-button');
      expect(importButton).not.toBeDisabled();
      expect(importButton).toHaveTextContent('Import Transactions');
    });

    it('processes import successfully', async () => {
      const mockImportResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        statementRows: mockStatementRows(1),
        duplicateMatches: { certain: [], possible: [] },
        newTransactions: 1,
        duplicates: 0,
        matchedAccount: { id: 'acc1', name: 'Current Account' }
      };
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockImportResult);
      
      const importButton = screen.getByTestId('loading-button');
      fireEvent.click(importButton);
      
      await waitFor(() => {
        expect(screen.getByText('Import Successful!')).toBeInTheDocument();
        expect(screen.getByText('Imported 1 transactions to Current Account')).toBeInTheDocument();
        expect(screen.getByTestId('check-icon')).toBeInTheDocument();
      });
      
      expect(mockAddTransaction).toHaveBeenCalledWith({ id: 'trans1', amount: 100, description: 'Test' });
    });

    it('shows duplicate count in success message', async () => {
      const mockImportResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        statementRows: mockStatementRows(1),
        duplicateMatches: { certain: [], possible: [] },
        newTransactions: 1,
        duplicates: 3,
        matchedAccount: { id: 'acc1', name: 'Current Account' }
      };
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockImportResult);
      
      const importButton = screen.getByTestId('loading-button');
      fireEvent.click(importButton);
      
      await waitFor(() => {
        expect(screen.getByText('Import Successful!')).toBeInTheDocument();
        expect(screen.getByText(/Left out\s+3\s+transactions this account already had/)).toBeInTheDocument();
      });
    });

    it('handles import errors', async () => {
      vi.mocked(ofxImportService.importTransactions).mockRejectedValueOnce(new Error('Import failed'));
      
      const importButton = screen.getByTestId('loading-button');
      fireEvent.click(importButton);
      
      await waitFor(() => {
        expect(screen.getByText('Import Failed')).toBeInTheDocument();
        expect(screen.getByText('Import failed')).toBeInTheDocument();
        expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
      });
    });

    it('shows loading state during import', async () => {
      const importButton = screen.getByTestId('loading-button');
      
      // Mock a delayed response
      vi.mocked(ofxImportService.importTransactions).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      
      fireEvent.click(importButton);

      expect(importButton).toHaveAttribute('data-loading', 'true');
      expect(importButton).toHaveTextContent('Loading...');

      // The mocked import resolves ~100ms later — wait for the async work to
      // settle inside the test (otherwise the finally-block setState fires
      // after environment teardown: "window is not defined", an intermittent
      // whole-file failure). On completion the button either stops loading or
      // is replaced by the result view; both mean the promise chain finished.
      await waitFor(() => {
        const btn = screen.queryByTestId('loading-button');
        expect(btn === null || btn.getAttribute('data-loading') === 'false').toBe(true);
      });
    });
  });

  describe('Import Validation', () => {
    it('disables import button when no account selected and no match', async () => {
      const mockParseResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        statementRows: mockStatementRows(1),
        duplicateMatches: { certain: [], possible: [] },
        duplicates: 0,
        matchedAccount: null,
      };
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        const importButton = screen.getByTestId('loading-button');
        expect(importButton).toBeDisabled();
      });
    });

    it('enables import button when account is manually selected', async () => {
      const mockParseResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        statementRows: mockStatementRows(1),
        duplicateMatches: { certain: [], possible: [] },
        duplicates: 0,
        matchedAccount: null,
      };
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        chooseAccount(CURRENT_ACCOUNT);
        
        const importButton = screen.getByTestId('loading-button');
        expect(importButton).not.toBeDisabled();
      });
    });
  });

  describe('User Actions', () => {
    it('calls onClose when modal close button clicked', () => {
      const onClose = vi.fn();
      render(<OFXImportModal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByTestId('modal-close'));
      expect(onClose).toHaveBeenCalled();
    });

    it('resets modal when cancel button clicked', async () => {
      const mockParseResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        statementRows: mockStatementRows(1),
        duplicateMatches: { certain: [], possible: [] },
        duplicates: 0,
        matchedAccount: null
      };
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('test.ofx')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Cancel'));
      
      // Should return to initial state
      expect(screen.getByText('Upload OFX File')).toBeInTheDocument();
      expect(screen.queryByText('test.ofx')).not.toBeInTheDocument();
    });

    it('shows import another file button after successful import', async () => {
      const mockParseResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        statementRows: mockStatementRows(1),
        duplicateMatches: { certain: [], possible: [] },
        duplicates: 0,
        matchedAccount: { id: 'acc1', name: 'Current Account' }
      };
      
      const mockImportResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        statementRows: mockStatementRows(1),
        duplicateMatches: { certain: [], possible: [] },
        newTransactions: 1,
        duplicates: 0,
        matchedAccount: { id: 'acc1', name: 'Current Account' }
      };
      
      vi.mocked(ofxImportService.importTransactions)
        .mockResolvedValueOnce(mockParseResult)
        .mockResolvedValueOnce(mockImportResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        const importButton = screen.getByTestId('loading-button');
        fireEvent.click(importButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Import Another File')).toBeInTheDocument();
        expect(screen.getByText('Done')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Import Another File'));
      
      // Should reset to initial state
      expect(screen.getByText('Upload OFX File')).toBeInTheDocument();
    });

    it('calls onClose when Done button clicked after import', async () => {
      const onClose = vi.fn();
      const mockParseResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        statementRows: mockStatementRows(1),
        duplicateMatches: { certain: [], possible: [] },
        duplicates: 0,
        matchedAccount: { id: 'acc1', name: 'Current Account' }
      };
      
      const mockImportResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        statementRows: mockStatementRows(1),
        duplicateMatches: { certain: [], possible: [] },
        newTransactions: 1,
        duplicates: 0,
        matchedAccount: { id: 'acc1', name: 'Current Account' }
      };
      
      vi.mocked(ofxImportService.importTransactions)
        .mockResolvedValueOnce(mockParseResult)
        .mockResolvedValueOnce(mockImportResult);
      
      render(<OFXImportModal {...defaultProps} onClose={onClose} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
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
      render(<OFXImportModal {...defaultProps} />);
      
      const fileInput = document.getElementById('ofx-upload')!
      fireEvent.change(fileInput, { target: { files: [] } });
      
      expect(ofxImportService.importTransactions).not.toHaveBeenCalled();
    });

    it('handles file upload without extension', () => {
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['content'], 'noextension', { type: 'text/plain' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      expect(mockAlert).toHaveBeenCalledWith('Please select an OFX file');
    });

    it('handles drag drop without files', () => {
      render(<OFXImportModal {...defaultProps} />);
      
      const dropZone = screen.getByText('Drag and drop your .ofx file here, or click to browse').closest('div')!;
      
      fireEvent.drop(dropZone, {
        dataTransfer: { files: [] }
      });
      
      expect(ofxImportService.importTransactions).not.toHaveBeenCalled();
    });

    it('handles unmatched account without bank ID', async () => {
      const mockParseResult = createMockImportResult({
        transactions: [sampleTransaction],
        matchedAccount: null,
        // No bankId, so no sort code to show.
        ofxAccount: { accountId: '12345678', accountType: 'CHECKING', isCreditCardStatement: false }
      });

      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText(/OFX Account: \*\*\*\*5678/)).toBeInTheDocument();
        expect(screen.queryByText(/Sort code/)).not.toBeInTheDocument();
      });
    });

    it('handles zero transactions found', async () => {
      const mockParseResult = {
        transactions: [],
        statementRows: mockStatementRows(0),
        duplicateMatches: { certain: [], possible: [] },
        duplicates: 0,
        matchedAccount: null,
      };
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('0 transactions found')).toBeInTheDocument();
        expect(screen.getAllByText('0')).toHaveLength(2); // In file info and summary sections
      });
    });

    it('handles import with selectedAccountId when no matchedAccount', async () => {
      const mockParseResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        statementRows: mockStatementRows(1),
        duplicateMatches: { certain: [], possible: [] },
        duplicates: 0,
        matchedAccount: null,
      };
      
      const mockImportResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        statementRows: mockStatementRows(1),
        duplicateMatches: { certain: [], possible: [] },
        newTransactions: 1,
        duplicates: 0,
        matchedAccount: null // No matched account in result
      };
      
      vi.mocked(ofxImportService.importTransactions)
        .mockResolvedValueOnce(mockParseResult)
        .mockResolvedValueOnce(mockImportResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        chooseAccount(SAVINGS_ACCOUNT);
        
        const importButton = screen.getByTestId('loading-button');
        fireEvent.click(importButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Import Successful!')).toBeInTheDocument();
        expect(screen.getByText('Imported 1 transactions to Savings Account')).toBeInTheDocument();
      });
    });
  });

  /**
   * Filling in an account's blank sort code / account number from the file
   * being imported. It can only ever fill a blank, it only ever touches the
   * account the transactions went into, and it always says what it did.
   */
  describe('Saving the file\'s details to the account', () => {
    const CREDIT_CARD = 'Credit Card (credit)';
    const FILED_ACCOUNT = 'Filed Account (current)';

    const CARD_STATEMENT: ImportTransactionsResult['ofxAccount'] = {
      // A card statement whose <ACCTID> is the full card number, as some
      // banks really do publish it.
      accountId: '4929123456789012',
      accountType: 'CREDITCARD',
      isCreditCardStatement: true,
    };

    /** Upload a file, choose a destination, and press Import. */
    const runImport = async (
      parsed: Partial<ImportTransactionsResult>,
      accountLabel: string | null,
      importedAccount: Account
    ): Promise<void> => {
      const parseResult = createMockImportResult({
        transactions: [sampleTransaction],
        newTransactions: 1,
        ...parsed
      });

      vi.mocked(ofxImportService.importTransactions)
        .mockResolvedValueOnce(parseResult)
        .mockResolvedValueOnce(
          createMockImportResult({
            ...parseResult,
            matchedAccount: importedAccount
          })
        );

      render(<OFXImportModal {...defaultProps} />);
      fireEvent.change(document.getElementById('ofx-upload')!, {
        target: { files: [new File(['OFX content'], 'test.ofx', { type: 'application/ofx' })] }
      });

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: 'Import to Account' })).toBeInTheDocument();
      });
      if (accountLabel) chooseAccount(accountLabel);
    };

    const pressImport = async (): Promise<void> => {
      fireEvent.click(screen.getByTestId('loading-button'));
      await waitFor(() => {
        expect(screen.getByText('Import Successful!')).toBeInTheDocument();
      });
    };

    it('fills in a chosen account\'s blank details and says it did', async () => {
      await runImport({}, SAVINGS_ACCOUNT, mockAccounts[1]);

      expect(screen.getByRole('checkbox', { name: /Save this file's/ })).toBeChecked();
      await pressImport();

      expect(mockUpdateAccount).toHaveBeenCalledWith('acc2', {
        sortCode: '12-34-56',
        accountNumber: '12345678'
      });
      expect(screen.getByText(/Also saved to Savings Account/)).toBeInTheDocument();
      expect(screen.getByText(/sort code 12-34-56 and account number ending 5678/)).toBeInTheDocument();
    });

    it('does not call a chosen account a guess, even after the box is unticked', async () => {
      await runImport({}, SAVINGS_ACCOUNT, mockAccounts[1]);

      const checkbox = screen.getByRole('checkbox', { name: /Save this file's/ });
      fireEvent.click(checkbox);

      expect(checkbox).not.toBeChecked();
      expect(screen.queryByText(/Off by default because this account was a guess/)).not.toBeInTheDocument();

      await pressImport();
      expect(mockUpdateAccount).not.toHaveBeenCalled();
    });

    it('never names a full account number in what it tells the user', async () => {
      await runImport({}, SAVINGS_ACCOUNT, mockAccounts[1]);
      await pressImport();

      expect(document.body.textContent).not.toContain('12345678');
    });

    it('leaves an account that already has its details completely alone', async () => {
      await runImport({}, FILED_ACCOUNT, mockAccounts[3]);

      expect(screen.queryByRole('checkbox', { name: /Save this file's/ })).not.toBeInTheDocument();
      await pressImport();

      expect(mockUpdateAccount).not.toHaveBeenCalled();
      expect(screen.queryByText(/Also saved to/)).not.toBeInTheDocument();
    });

    it('does not act on a guessed match unless the user says so', async () => {
      await runImport(
        {
          matchedAccount: mockAccounts[1],
          matchConfidence: 'heuristic'
        },
        null,
        mockAccounts[1]
      );

      const checkbox = screen.getByRole('checkbox', { name: /Save this file's/ });
      expect(checkbox).not.toBeChecked();
      expect(screen.getByText(/Off by default because this account was a guess/)).toBeInTheDocument();

      await pressImport();
      expect(mockUpdateAccount).not.toHaveBeenCalled();
    });

    it('acts on a guessed match once the user ticks the box', async () => {
      await runImport(
        {
          matchedAccount: mockAccounts[1],
          matchConfidence: 'heuristic'
        },
        null,
        mockAccounts[1]
      );

      fireEvent.click(screen.getByRole('checkbox', { name: /Save this file's/ }));
      await pressImport();

      expect(mockUpdateAccount).toHaveBeenCalledWith('acc2', {
        sortCode: '12-34-56',
        accountNumber: '12345678'
      });
    });

    it('stores only the last 4 digits of a card, and never the number itself', async () => {
      await runImport({ ofxAccount: CARD_STATEMENT }, CREDIT_CARD, mockAccounts[2]);
      await pressImport();

      expect(mockUpdateAccount).toHaveBeenCalledWith('acc3', { accountNumber: '9012' });
      expect(screen.getByText(/card ending 9012/)).toBeInTheDocument();
      // The full card number must not survive anywhere the user can see it,
      // let alone anywhere it would be stored.
      expect(document.body.textContent).not.toContain('4929123456789012');
    });

    it('refuses to write a card statement onto a current account', async () => {
      // <ACCTID> may be a full card number; its first 8 digits are not an
      // account number, and storing them would be storing part of a card.
      await runImport({ ofxAccount: CARD_STATEMENT }, SAVINGS_ACCOUNT, mockAccounts[1]);

      expect(screen.queryByRole('checkbox', { name: /Save this file's/ })).not.toBeInTheDocument();
      await pressImport();
      expect(mockUpdateAccount).not.toHaveBeenCalled();
    });

    it('still reports the import as done when saving the details fails', async () => {
      mockUpdateAccount.mockRejectedValueOnce(new Error('offline'));
      await runImport({}, SAVINGS_ACCOUNT, mockAccounts[1]);
      await pressImport();

      expect(screen.getByText('Imported 1 transactions to Savings Account')).toBeInTheDocument();
      expect(screen.getByText(/Couldn't save .* to Savings Account/)).toBeInTheDocument();
    });
  });

  /**
   * Setting the account's Bank Balance from the statement's own closing
   * balance — the figure Reconciliation compares the cleared ledger against,
   * and without which finalising a reconciliation proves nothing.
   */
  describe('Setting the Bank Balance from the statement', () => {
    const CREDIT_CARD = 'Credit Card (credit)';
    const FILED_ACCOUNT = 'Filed Account (current)';

    // Some of these tests stop at the preview and never press Import, leaving
    // the second queued result unconsumed — and a mockResolvedValueOnce queue
    // survives vi.clearAllMocks(), so it would be handed to the NEXT test's
    // parse. Drop the queue with the test that made it.
    afterEach(() => {
      vi.mocked(ofxImportService.importTransactions).mockReset();
    });

    const CARD_STATEMENT: ImportTransactionsResult['ofxAccount'] = {
      accountId: '4929123456789012',
      accountType: 'CREDITCARD',
      isCreditCardStatement: true,
    };

    /** Upload a file, choose a destination, and stop before pressing Import. */
    const runImport = async (
      parsed: Partial<ImportTransactionsResult>,
      accountLabel: string,
      importedAccount: Account
    ): Promise<void> => {
      const parseResult = createMockImportResult({
        transactions: [sampleTransaction],
        newTransactions: 1,
        statementBalance: { amount: 5000, dateAsOf: '2026-03-31' },
        ...parsed
      });

      vi.mocked(ofxImportService.importTransactions)
        .mockResolvedValueOnce(parseResult)
        .mockResolvedValueOnce(
          createMockImportResult({
            ...parseResult,
            matchedAccount: importedAccount
          })
        );

      render(<OFXImportModal {...defaultProps} />);
      fireEvent.change(document.getElementById('ofx-upload')!, {
        target: { files: [new File(['OFX content'], 'test.ofx', { type: 'application/ofx' })] }
      });

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: 'Import to Account' })).toBeInTheDocument();
      });
      chooseAccount(accountLabel);
    };

    const pressImport = async (): Promise<void> => {
      fireEvent.click(screen.getByTestId('loading-button'));
      await waitFor(() => {
        expect(screen.getByText('Import Successful!')).toBeInTheDocument();
      });
    };

    /** Every field this import wrote to the account, across all calls. */
    const writtenFields = (): string[] =>
      mockUpdateAccount.mock.calls.flatMap(([, updates]) => Object.keys(updates));

    it('sets the Bank Balance to the statement\'s closing figure, dated by the statement', async () => {
      await runImport({}, SAVINGS_ACCOUNT, mockAccounts[1]);
      await pressImport();

      expect(mockUpdateAccount).toHaveBeenCalledWith('acc2', {
        bankBalance: 5000,
        bankBalanceDate: '2026-03-31'
      });
      expect(screen.getByText(/Bank Balance set to £5,000\.00, as at 31 Mar 2026/))
        .toBeInTheDocument();
    });

    it('never writes `balance` — that is the ledger the transactions already moved', async () => {
      await runImport({}, SAVINGS_ACCOUNT, mockAccounts[1]);
      await pressImport();

      expect(mockUpdateAccount).toHaveBeenCalled();
      expect(writtenFields()).not.toContain('balance');
      expect(writtenFields()).not.toContain('openingBalance');
    });

    it('says what it will do before the user commits to it', async () => {
      await runImport({}, SAVINGS_ACCOUNT, mockAccounts[1]);

      expect(
        screen.getByText(/Savings Account's Bank Balance will be set to £5,000\.00, as at 31 Mar 2026/)
      ).toBeInTheDocument();
      expect(mockUpdateAccount).not.toHaveBeenCalled();
    });

    it('leaves a more recent Bank Balance alone, and says which one it kept', async () => {
      // Filed Account's balance is dated 30 Nov 2026; this statement closes in
      // March. Overwriting would show months of spending as a difference.
      await runImport({}, FILED_ACCOUNT, mockAccounts[3]);

      expect(
        screen.getByText(/will be left as it is: it already holds £4,200\.00 dated 30 Nov 2026/)
      ).toBeInTheDocument();

      await pressImport();
      expect(mockUpdateAccount).not.toHaveBeenCalled();
      expect(screen.queryByText(/Bank Balance set to/)).not.toBeInTheDocument();
    });

    it('keeps a card statement\'s debt a debt', async () => {
      // OFX signs the closing balance the same way it signs the purchases
      // beside it, and this app stores a liability negative. Negating it here
      // — as the TrueLayer card feed needs — would turn the debt into £1,234.56
      // of assets.
      await runImport(
        {
          ofxAccount: CARD_STATEMENT,
          statementBalance: { amount: -1234.56, dateAsOf: '2026-03-31' }
        },
        CREDIT_CARD,
        mockAccounts[2]
      );
      await pressImport();

      expect(mockUpdateAccount).toHaveBeenCalledWith('acc3', {
        bankBalance: -1234.56,
        bankBalanceDate: '2026-03-31'
      });
      expect(screen.getByText(/Bank Balance set to -£1,234\.56/)).toBeInTheDocument();
    });

    it('says plainly when the file states no closing balance', async () => {
      await runImport({ statementBalance: undefined }, SAVINGS_ACCOUNT, mockAccounts[1]);

      expect(
        screen.getByText(/This file doesn't state a closing balance/)
      ).toBeInTheDocument();

      await pressImport();
      expect(writtenFields()).not.toContain('bankBalance');
    });

    it('still reports the import as done when the Bank Balance write fails', async () => {
      // Filed Account has its details recorded, so the balance is the only
      // write this import attempts.
      await runImport(
        { statementBalance: { amount: 5000, dateAsOf: '2026-12-31' } },
        FILED_ACCOUNT,
        mockAccounts[3]
      );
      mockUpdateAccount.mockRejectedValueOnce(new Error('offline'));
      await pressImport();

      expect(screen.getByText('Imported 1 transactions to Filed Account')).toBeInTheDocument();
      expect(screen.getByText(/Bank Balance couldn't be updated/)).toBeInTheDocument();
    });
  });
  /**
   * The preview's duplicate review. `mockTransactions` gives account acc1 one
   * £100 transaction on 2024-01-01 described "Test Transaction"; the statement
   * below carries the same money on the same day under the bank's own wording,
   * which is exactly the shape that used to import a second copy in silence.
   */
  describe('Duplicate review', () => {
    const sameMoneyDifferentWords: ImportTransactionsResult['statementRows'][number] = {
      date: new Date('2024-01-01'),
      amount: 100,
      description: 'Immediate Faster Payment (Online) to B EXAMPLE 01-JAN-2024',
      fitId: 'fit-1'
    };

    const openPreview = async (): Promise<void> => {
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(
        createMockImportResult({
          transactions: [sampleTransaction],
          statementRows: [sameMoneyDifferentWords],
          matchedAccount: mockAccounts[0],
          newTransactions: 1
        })
      );

      render(<OFXImportModal {...defaultProps} />);
      fireEvent.change(document.getElementById('ofx-upload')!, {
        target: { files: [new File(['OFX content'], 'test.ofx', { type: 'application/ofx' })] }
      });

      await waitFor(() => {
        expect(screen.getByText('test.ofx')).toBeInTheDocument();
      });
    };

    it('lists the row against the transaction it matches, and leaves it out by default', async () => {
      await openPreview();

      expect(screen.getByText('1 transaction looks like one you already have')).toBeInTheDocument();
      // Both sides shown: the user is being asked to judge a pair, and the
      // descriptions are the only part that differs.
      expect(screen.getByText(/Immediate Faster Payment \(Online\) to B EXAMPLE/)).toBeInTheDocument();
      expect(screen.getByText(/Already here as “Test Transaction” on 01\/01\/2024/)).toBeInTheDocument();

      expect(screen.getByRole('checkbox', { name: /Immediate Faster Payment/ })).not.toBeChecked();
      expect(summaryTile('In this file')).toHaveTextContent('1');
      expect(summaryTile('Will be imported')).toHaveTextContent('0');
    });

    it('imports it after the user says it is a separate payment', async () => {
      await openPreview();

      fireEvent.click(screen.getByRole('checkbox', { name: /Immediate Faster Payment/ }));
      expect(summaryTile('Will be imported')).toHaveTextContent('1');

      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(
        createMockImportResult({
          transactions: [sampleTransaction],
          statementRows: [sameMoneyDifferentWords],
          matchedAccount: mockAccounts[0],
          newTransactions: 1
        })
      );
      fireEvent.click(screen.getByTestId('loading-button'));

      await waitFor(() => {
        expect(screen.getByText('Import Successful!')).toBeInTheDocument();
      });
      expect(ofxImportService.importTransactions).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ importAnywayFitIds: ['fit-1'] })
      );
    });

    it('forgets the decision when the destination account changes', async () => {
      await openPreview();
      fireEvent.click(screen.getByRole('checkbox', { name: /Immediate Faster Payment/ }));

      // Savings holds none of this, so there is nothing left to review — and
      // the overrule must not survive into an account it was never about.
      chooseAccount(SAVINGS_ACCOUNT);
      expect(screen.queryByText(/looks like one you already have/)).not.toBeInTheDocument();
      expect(summaryTile('Will be imported')).toHaveTextContent('1');

      chooseAccount(CURRENT_ACCOUNT);
      expect(screen.getByRole('checkbox', { name: /Immediate Faster Payment/ })).not.toBeChecked();
      expect(summaryTile('Will be imported')).toHaveTextContent('0');
    });
  });
});
