/**
 * CSVImportWizard Tests
 * Comprehensive tests for the CSV import wizard component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CSVImportWizard from './CSVImportWizard';
import { enhancedCsvImportService } from '../services/enhancedCsvImportService';
import { transactionImportService } from '../services/transactionImportService';
import { importTransactionsLocally } from '../services/localTransactionImportService';

const mockRefreshAccountsAndTransactions = vi.fn().mockResolvedValue(undefined);
/** Flipped per test to exercise the cloud path and the local one. */
let mockIsUsingSupabase = false;

// Mock all dependencies
vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    accounts: [
      { id: 'acc-1', name: 'Checking Account', type: 'checking', currency: 'GBP' },
      { id: 'acc-2', name: 'Savings Account', type: 'savings', currency: 'GBP' },
    ],
    transactions: [],
    addAccount: vi.fn(),
    categories: [
      { id: 'cat-1', name: 'Food', type: 'expense' },
      { id: 'cat-2', name: 'Income', type: 'income' },
    ],
    isUsingSupabase: mockIsUsingSupabase,
    refreshAccountsAndTransactions: mockRefreshAccountsAndTransactions,
  }),
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('test-token') }),
}));

/**
 * Both write paths are mocked, because what these tests check is what the
 * wizard REPORTS about a write — which can only be checked by controlling what
 * the write says it did.
 */
vi.mock('../services/transactionImportService', () => ({
  transactionImportService: {
    setAuthTokenProvider: vi.fn(),
    importInChunks: vi.fn(),
  },
}));

vi.mock('../services/localTransactionImportService', () => ({
  importTransactionsLocally: vi.fn(),
}));

vi.mock('../services/enhancedCsvImportService', () => ({
  enhancedCsvImportService: {
    parseCSV: vi.fn(() => ({
      headers: ['Date', 'Description', 'Amount', 'Account'],
      data: [
        ['2023-01-15', 'Grocery Store', '-85.50', 'Checking'],
        ['2023-01-16', 'Salary', '2000.00', 'Checking'],
        ['2023-01-17', 'Coffee Shop', '-4.50', 'Checking'],
      ],
    })),
    suggestMappings: vi.fn(() => [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
      { sourceColumn: 'Account', targetField: 'accountName' },
    ]),
    getBankMappings: vi.fn(() => [
      { sourceColumn: 'Transaction Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Amount', targetField: 'amount' },
    ]),
    getProfiles: vi.fn(() => [
      { id: 'profile-1', name: 'My Bank Profile', type: 'transaction', mappings: [], lastUsed: new Date() },
    ]),
    saveProfile: vi.fn(),
    importTransactions: vi.fn(() => Promise.resolve({
      success: 2,
      failed: 0,
      duplicates: 1,
      items: [
        {
          date: new Date('2023-01-15'),
          description: 'Grocery Store',
          amount: 85.50,
          category: 'Food',
          accountId: 'acc-1',
          type: 'expense',
          tags: [],
          notes: '',
        },
        {
          date: new Date('2023-01-16'),
          description: 'Salary',
          amount: 2000.00,
          category: 'Income',
          accountId: 'acc-1',
          type: 'income',
          tags: [],
          notes: '',
        },
      ],
      errors: [],
    })),
  },
}));

vi.mock('./loading/LoadingState', () => ({
  LoadingButton: ({ children, isLoading, onClick, className, disabled }: {
    children: React.ReactNode;
    isLoading?: boolean;
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={className}
      disabled={disabled || isLoading}
      data-testid="loading-button"
    >
      {isLoading ? 'Loading...' : children}
    </button>
  ),
}));

vi.mock('./common/Modal', () => ({
  Modal: ({ isOpen, children, title, onClose }: {
    isOpen: boolean;
    children: React.ReactNode;
    title: string;
    onClose: () => void;
  }) => 
    isOpen ? (
      <div data-testid="modal" role="dialog" aria-label={title}>
        <div data-testid="modal-title">{title}</div>
        <button data-testid="modal-close" onClick={onClose}>×</button>
        {children}
      </div>
    ) : null,
}));

// Mock all icons
vi.mock('./icons', () => ({
  UploadIcon: ({ size, className }: { size?: number; className?: string }) => <div data-testid="upload-icon" data-size={size} className={className}>📤</div>,
  FileTextIcon: ({ size }: { size?: number }) => <div data-testid="file-text-icon" data-size={size}>📄</div>,
  CheckIcon: ({ size, className }: { size?: number; className?: string }) => <div data-testid="check-icon" data-size={size} className={className}>✓</div>,
  XIcon: ({ size }: { size?: number }) => <div data-testid="x-icon" data-size={size}>✕</div>,
  AlertCircleIcon: ({ size }: { size?: number }) => <div data-testid="alert-circle-icon" data-size={size}>ⓘ</div>,
  ChevronRightIcon: ({ size, className }: { size?: number; className?: string }) => <div data-testid="chevron-right-icon" data-size={size} className={className}>→</div>,
  ChevronLeftIcon: ({ size }: { size?: number }) => <div data-testid="chevron-left-icon" data-size={size}>←</div>,
  SaveIcon: ({ size, className }: { size?: number; className?: string }) => <div data-testid="save-icon" data-size={size} className={className}>💾</div>,
  DownloadIcon: ({ size }: { size?: number }) => <div data-testid="download-icon" data-size={size}>⬇️</div>,
  RefreshCwIcon: ({ size }: { size?: number }) => <div data-testid="refresh-cw-icon" data-size={size}>🔄</div>,
}));

// Mock FileReader
global.FileReader = class FileReader {
  result: string | null = null;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
  
  readAsText(_file: File) {
    setTimeout(() => {
      this.result = 'Date,Description,Amount,Account\n2023-01-15,Grocery Store,-85.50,Checking\n2023-01-16,Salary,2000.00,Checking';
      if (this.onload) {
        this.onload({ target: this } as ProgressEvent<FileReader>);
      }
    }, 0);
  }
} as unknown as typeof FileReader;

describe('CSVImportWizard', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsUsingSupabase = false;
    // Default: the write does what it was asked. Tests about a failing write
    // override this.
    vi.mocked(importTransactionsLocally).mockImplementation(
      async (_accountId, rows) => ({ inserted: rows.length, alreadyPresent: 0, total: rows.length, complete: true })
    );
    vi.mocked(transactionImportService.importInChunks).mockImplementation(
      async (_accountId, rows) => ({ inserted: rows.length, alreadyPresent: 0, total: rows.length, complete: true })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderWizard = (isOpen = true, type: 'transaction' | 'account' = 'transaction') => {
    return render(
      <CSVImportWizard
        isOpen={isOpen}
        onClose={mockOnClose}
        type={type}
      />
    );
  };

  describe('basic rendering', () => {
    it('renders when open', () => {
      renderWizard(true);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByTestId('modal-title')).toHaveTextContent('CSV Import Wizard');
    });

    it('does not render when closed', () => {
      renderWizard(false);
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('displays step indicators', () => {
      renderWizard(true);
      
      expect(screen.getByText('Upload')).toBeInTheDocument();
      expect(screen.getByText('Map Columns')).toBeInTheDocument();
      expect(screen.getByText('Preview')).toBeInTheDocument();
      expect(screen.getByText('Import')).toBeInTheDocument();
    });

    it('shows upload step as active initially', () => {
      renderWizard(true);
      
      // The Upload step should be active (primary background)
      const uploadStep = screen.getByText('Upload').closest('div');
      expect(uploadStep).toBeInTheDocument();
    });
  });

  describe('upload step', () => {
    it('displays upload area', () => {
      renderWizard(true);
      
      expect(screen.getByText('Upload CSV File')).toBeInTheDocument();
      expect(screen.getByText(/drag and drop your csv file/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/select file/i)).toBeInTheDocument();
    });

    it.skip('displays bank template sections', () => {
      renderWizard(true);
      
      expect(screen.getByText('Quick Start with Bank Templates')).toBeInTheDocument();
      expect(screen.getByText('UK Major Banks')).toBeInTheDocument();
      expect(screen.getByText('US Banks')).toBeInTheDocument();
      expect(screen.getByText('Online Payment Services')).toBeInTheDocument();
    });

    it('displays major UK banks', () => {
      renderWizard(true);
      
      expect(screen.getByText('Barclays')).toBeInTheDocument();
      expect(screen.getByText('HSBC')).toBeInTheDocument();
      expect(screen.getByText('Lloyds')).toBeInTheDocument();
      expect(screen.getByText('NatWest')).toBeInTheDocument();
    });

    it('displays US banks', () => {
      renderWizard(true);
      
      expect(screen.getByText('Chase')).toBeInTheDocument();
      expect(screen.getByText('Bank of America')).toBeInTheDocument();
      expect(screen.getByText('Wells Fargo')).toBeInTheDocument();
    });

    it('displays digital banks', () => {
      renderWizard(true);
      
      expect(screen.getByText('Monzo')).toBeInTheDocument();
      expect(screen.getByText('Starling')).toBeInTheDocument();
      expect(screen.getByText('Revolut')).toBeInTheDocument();
    });

    it('handles bank template selection', async () => {
      const user = userEvent.setup();
      renderWizard(true);
      
      const barclaysButton = screen.getByText('Barclays');
      await user.click(barclaysButton);
      
      // Should move to mapping step
      expect(screen.getByText('Column Mapping')).toBeInTheDocument();
    });
  });

  describe('file upload functionality', () => {
    it('handles file upload via input', async () => {
      const user = userEvent.setup();
      renderWizard(true);
      
      const file = new File(['Date,Description,Amount\n2023-01-15,Test,-10.00'], 'test.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/select file/i);
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('Column Mapping')).toBeInTheDocument();
      });
    });

    it('handles drag and drop', async () => {
      renderWizard(true);
      
      const dropZone = screen.getByText(/drag and drop your csv file/i).closest('div');
      const file = new File(['Date,Description,Amount\n2023-01-15,Test,-10.00'], 'test.csv', { type: 'text/csv' });
      
      const dataTransfer = {
        files: [file],
      };
      
      fireEvent.drop(dropZone!, { dataTransfer });
      
      await waitFor(() => {
        expect(screen.getByText('Column Mapping')).toBeInTheDocument();
      });
    });
  });

  describe('mapping step', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      renderWizard(true);
      
      // Upload a file to get to mapping step
      const file = new File(['Date,Description,Amount\n2023-01-15,Test,-10.00'], 'test.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/select file/i);
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('Column Mapping')).toBeInTheDocument();
      });
    });

    it('displays mapping interface', () => {
      expect(screen.getByText('Column Mapping')).toBeInTheDocument();
      expect(screen.getByText(/map your csv columns/i)).toBeInTheDocument();
    });

    it('displays import profiles section', () => {
      expect(screen.getByText('Import Profiles')).toBeInTheDocument();
      expect(screen.getByText('Save Current')).toBeInTheDocument();
    });

    it('displays column mappings', () => {
      expect(screen.getAllByText('Select CSV column...')).toHaveLength(4); // Multiple mapping rows
      expect(screen.getAllByText('Select target field...')).toHaveLength(4);
    });

    it('allows adding new mapping', async () => {
      const user = userEvent.setup();
      
      const addButton = screen.getByText('+ Add Mapping');
      await user.click(addButton);
      
      // Should have additional mapping rows (started with 4, now should have 5)
      const csvSelects = screen.getAllByText('Select CSV column...');
      expect(csvSelects.length).toBeGreaterThan(4);
    });

    it('allows removing mappings', async () => {
      const user = userEvent.setup();
      
      const removeButtons = screen.getAllByTestId('x-icon');
      const initialCount = removeButtons.length;
      
      await user.click(removeButtons[0]);
      
      // Should have one fewer remove button
      const remainingButtons = screen.getAllByTestId('x-icon');
      expect(remainingButtons.length).toBeLessThan(initialCount);
    });

    it('displays save profile button', () => {
      expect(screen.getByTestId('save-icon')).toBeInTheDocument();
      expect(screen.getByText('Save Current')).toBeInTheDocument();
    });
  });

  describe('preview step', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      renderWizard(true);
      
      // Navigate to preview step
      const file = new File(['Date,Description,Amount\n2023-01-15,Test,-10.00'], 'test.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/select file/i);
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('Column Mapping')).toBeInTheDocument();
      });
      
      const nextButton = screen.getByText('Next');
      await user.click(nextButton);
    });

    it('displays preview interface', () => {
      expect(screen.getByText('Preview Import')).toBeInTheDocument();
      expect(screen.getByText(/review the first few rows/i)).toBeInTheDocument();
    });

    it('displays duplicate detection settings', () => {
      expect(screen.getByText('Skip duplicate transactions')).toBeInTheDocument();
      expect(screen.getByText('Threshold:')).toBeInTheDocument();
    });

    it('displays preview table', () => {
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('date')).toBeInTheDocument();
      expect(screen.getByText('description')).toBeInTheDocument();
    });

    it('handles duplicate threshold changes', async () => {
      const user = userEvent.setup();
      
      const thresholdInput = screen.getByDisplayValue('90');
      await user.clear(thresholdInput);
      await user.type(thresholdInput, '85');
      
      expect(thresholdInput).toHaveValue(85);
    });

    it('handles duplicate detection toggle', async () => {
      const user = userEvent.setup();
      
      const checkbox = screen.getByLabelText(/skip duplicate transactions/i);
      await user.click(checkbox);
      
      expect(checkbox).not.toBeChecked();
    });
  });

  describe('result step', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      renderWizard(true);
      
      // Navigate through all steps to result
      const file = new File(['Date,Description,Amount\n2023-01-15,Test,-10.00'], 'test.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/select file/i);
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('Column Mapping')).toBeInTheDocument();
      });
      
      const nextButton = screen.getByText('Next');
      await user.click(nextButton);
      
      const importButton = screen.getByTestId('loading-button');
      await user.click(importButton);
      
      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      });
    });

    it('displays success message', () => {
      expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      const checkIcons = screen.getAllByTestId('check-icon');
      expect(checkIcons.length).toBeGreaterThan(0); // Multiple check icons from step indicators and success icon
    });

    it('displays import statistics', () => {
      expect(screen.getByText('2')).toBeInTheDocument(); // Success count
      expect(screen.getByText('Imported')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument(); // Duplicates count
      expect(screen.getByText('Skipped')).toBeInTheDocument();
    });

    it('displays action buttons', () => {
      expect(screen.getByText('Import More')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  /**
   * What the wizard says a write did, as opposed to what the file offered.
   *
   * The old loop fired `addTransaction` per row without awaiting and then read
   * the Imported tile off the PARSER's `success` count — so a file whose rows
   * never reached the database still reported them as imported. These tests
   * hold the two numbers apart.
   */
  describe('reporting what actually landed', () => {
    /** Two rows for Checking Account, invented. */
    const twoRows = [
      {
        date: new Date('2023-01-15'),
        description: 'GROCERY STORE',
        amount: -85.5,
        category: 'Food',
        accountId: 'acc-1',
        type: 'expense' as const,
        tags: [],
        notes: ''
      },
      {
        date: new Date('2023-01-16'),
        description: 'SALARY',
        amount: 2000,
        category: 'Income',
        accountId: 'acc-1',
        type: 'income' as const,
        tags: [],
        notes: ''
      }
    ];

    const parsedAs = (items: unknown[], overrides: Record<string, unknown> = {}) => ({
      success: items.length,
      failed: 0,
      duplicates: 0,
      items,
      errors: [],
      ...overrides
    });

    const runImport = async (): Promise<void> => {
      const user = userEvent.setup();
      renderWizard(true);

      const file = new File(['Date,Description,Amount\n2023-01-15,Test,-10.00'], 'test.csv', { type: 'text/csv' });
      await user.upload(screen.getByLabelText(/select file/i), file);
      await waitFor(() => {
        expect(screen.getByText('Column Mapping')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByTestId('loading-button'));
    };

    it('writes each account in one awaited batch, not a row at a time', async () => {
      vi.mocked(enhancedCsvImportService.importTransactions).mockResolvedValueOnce(parsedAs(twoRows));

      await runImport();

      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      });
      expect(importTransactionsLocally).toHaveBeenCalledTimes(1);
      expect(importTransactionsLocally).toHaveBeenCalledWith(
        'acc-1',
        expect.arrayContaining([
          expect.objectContaining({ description: 'GROCERY STORE', accountId: 'acc-1' }),
          expect.objectContaining({ description: 'SALARY', accountId: 'acc-1' })
        ])
      );
      expect(mockRefreshAccountsAndTransactions).toHaveBeenCalled();
    });

    it('carries the category provenance the service set', async () => {
      // The wizard rebuilds each row to hand it to the write, so this mapper is
      // the one place the flag can be lost. Lost, the app's own guess arrives
      // indistinguishable from a category the user chose.
      vi.mocked(enhancedCsvImportService.importTransactions).mockResolvedValueOnce(
        parsedAs([
          { ...twoRows[0], categoryConfirmed: false },
          { ...twoRows[1], categoryConfirmed: true }
        ])
      );

      await runImport();

      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      });
      expect(importTransactionsLocally).toHaveBeenCalledWith('acc-1', [
        expect.objectContaining({ description: 'GROCERY STORE', categoryConfirmed: false }),
        expect.objectContaining({ description: 'SALARY', categoryConfirmed: true })
      ]);
    });

    it('shows the Imported tile as what LANDED, not what the file offered', async () => {
      // The file offers two; the write confirms one. The tile must say one.
      vi.mocked(enhancedCsvImportService.importTransactions).mockResolvedValueOnce(parsedAs(twoRows));
      vi.mocked(importTransactionsLocally).mockResolvedValueOnce({
        inserted: 1,
        alreadyPresent: 0,
        total: 2,
        complete: false,
        error: 'QuotaExceededError'
      });

      await runImport();

      await waitFor(() => {
        expect(screen.getByText('Imported')).toBeInTheDocument();
      });
      const tile = screen.getByText('Imported').parentElement;
      expect(tile).toHaveTextContent('1');
      expect(tile).not.toHaveTextContent('2');
    });

    it('names the row that never landed, and what its absence means', async () => {
      vi.mocked(enhancedCsvImportService.importTransactions).mockResolvedValueOnce(parsedAs(twoRows));
      vi.mocked(importTransactionsLocally).mockResolvedValueOnce({
        inserted: 1,
        alreadyPresent: 0,
        total: 2,
        complete: false,
        error: 'QuotaExceededError'
      });

      await runImport();

      await waitFor(() => {
        expect(screen.getByText('Part of this file is missing')).toBeInTheDocument();
      });
      expect(screen.getByText('1 transaction never reached Checking Account')).toBeInTheDocument();
      expect(screen.getByText('16/01/2023 · SALARY · £2,000.00')).toBeInTheDocument();
      expect(screen.getByText(/will not agree with the statement this file came from/)).toBeInTheDocument();
      expect(screen.getByText(/What stopped it: QuotaExceededError/)).toBeInTheDocument();
      // And the count on the tile is what landed, not what was parsed.
      expect(screen.queryByText('Import Complete!')).not.toBeInTheDocument();
    });

    it('splits a multi-account file into one atomic batch per account', async () => {
      vi.mocked(enhancedCsvImportService.importTransactions).mockResolvedValueOnce(
        parsedAs([...twoRows, { ...twoRows[0], description: 'TRANSFER IN', accountId: 'acc-2' }])
      );

      await runImport();

      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      });
      expect(importTransactionsLocally).toHaveBeenCalledTimes(2);
      expect(vi.mocked(importTransactionsLocally).mock.calls.map(call => call[0]))
        .toEqual(['acc-1', 'acc-2']);
    });

    it('keeps one account\'s failure from cancelling another account\'s rows', async () => {
      // Separate accounts have nothing to do with each other; refusing to file
      // the working one helps nobody, so long as the failure is named.
      vi.mocked(enhancedCsvImportService.importTransactions).mockResolvedValueOnce(
        parsedAs([...twoRows, { ...twoRows[0], description: 'TRANSFER IN', accountId: 'acc-2' }])
      );
      vi.mocked(importTransactionsLocally)
        .mockResolvedValueOnce({ inserted: 2, alreadyPresent: 0, total: 2, complete: true })
        .mockResolvedValueOnce({ inserted: 0, alreadyPresent: 0, total: 1, complete: false, error: 'offline' });

      await runImport();

      await waitFor(() => {
        expect(screen.getByText('1 transaction never reached Savings Account')).toBeInTheDocument();
      });
      expect(screen.queryByText(/never reached Checking Account/)).not.toBeInTheDocument();
    });

    it('says when rows name an account that does not exist, instead of dropping them', async () => {
      // This is the silent case: the old type guard skipped these rows while
      // the Imported tile went on counting them.
      vi.mocked(enhancedCsvImportService.importTransactions).mockResolvedValueOnce(
        parsedAs([
          twoRows[0],
          { ...twoRows[1], accountId: 'default', accountName: 'Barclays Everyday' }
        ])
      );

      await runImport();

      await waitFor(() => {
        expect(screen.getByText('1 transaction had no account to go into')).toBeInTheDocument();
      });
      expect(screen.getByText(/Barclays Everyday.*you have no account of that name/)).toBeInTheDocument();
      // One row routed, so one row landed — not the parser's two.
      expect(importTransactionsLocally).toHaveBeenCalledWith('acc-1', [
        expect.objectContaining({ description: 'GROCERY STORE' })
      ]);
    });

    it('says when no Account column was mapped at all', async () => {
      vi.mocked(enhancedCsvImportService.importTransactions).mockResolvedValueOnce(
        parsedAs(twoRows.map(row => ({ ...row, accountId: undefined })))
      );

      await runImport();

      await waitFor(() => {
        expect(screen.getByText('Nothing was imported')).toBeInTheDocument();
      });
      expect(screen.getByText(/No column is mapped to/)).toBeInTheDocument();
      expect(importTransactionsLocally).not.toHaveBeenCalled();
    });

    it('surfaces a thrown import instead of leaving a dead button', async () => {
      vi.mocked(enhancedCsvImportService.importTransactions).mockRejectedValueOnce(
        new Error('Unclosed quote on line 4')
      );

      await runImport();

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      expect(screen.getByText(/Nothing was imported and nothing was changed/)).toBeInTheDocument();
      expect(screen.getByText(/What went wrong: Unclosed quote on line 4/)).toBeInTheDocument();
      // Still on Preview, with the mappings intact, so it can be retried.
      expect(screen.getByText('Preview Import')).toBeInTheDocument();
    });

    it('uses the cloud endpoint when signed in', async () => {
      mockIsUsingSupabase = true;
      vi.mocked(enhancedCsvImportService.importTransactions).mockResolvedValueOnce(parsedAs(twoRows));

      await runImport();

      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      });
      expect(transactionImportService.importInChunks).toHaveBeenCalledTimes(1);
      expect(importTransactionsLocally).not.toHaveBeenCalled();
    });
  });

  describe('navigation', () => {
    it('displays cancel button on upload step', () => {
      renderWizard(true);
      
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('displays back button on other steps', async () => {
      const user = userEvent.setup();
      renderWizard(true);
      
      // Navigate to mapping step
      const file = new File(['Date,Description,Amount\n2023-01-15,Test,-10.00'], 'test.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/select file/i);
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('Back')).toBeInTheDocument();
      });
    });

    it('handles back navigation', async () => {
      const user = userEvent.setup();
      renderWizard(true);
      
      // Navigate to mapping step then back
      const file = new File(['Date,Description,Amount\n2023-01-15,Test,-10.00'], 'test.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/select file/i);
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('Column Mapping')).toBeInTheDocument();
      });
      
      const backButton = screen.getByText('Back');
      await user.click(backButton);
      
      expect(screen.getByText('Upload CSV File')).toBeInTheDocument();
    });

    it('handles cancel action', async () => {
      const user = userEvent.setup();
      renderWizard(true);
      
      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('step indicators', () => {
    it('shows correct step states initially', () => {
      renderWizard(true);
      
      // Should show step labels
      expect(screen.getByText('Upload')).toBeInTheDocument();
      expect(screen.getByText('Map Columns')).toBeInTheDocument();
      expect(screen.getByText('Preview')).toBeInTheDocument();
      expect(screen.getByText('Import')).toBeInTheDocument();
    });

    it('updates step states as user progresses', async () => {
      const user = userEvent.setup();
      renderWizard(true);
      
      // Navigate to mapping step
      const file = new File(['Date,Description,Amount\n2023-01-15,Test,-10.00'], 'test.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/select file/i);
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('Column Mapping')).toBeInTheDocument();
      });
      
      // Upload should be complete, mapping should be active
      expect(screen.getByText('Map Columns')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper modal structure', () => {
      renderWizard(true);
      
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('aria-label', 'CSV Import Wizard');
    });

    it('has proper form controls', () => {
      renderWizard(true);
      
      expect(screen.getByLabelText(/select file/i)).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      renderWizard(true);
      
      const fileInput = screen.getByLabelText(/select file/i);
      fileInput.focus();
      
      expect(fileInput).toHaveFocus();
    });
  });

  describe('transaction vs account type', () => {
    it('displays transaction-specific fields for transaction import', () => {
      renderWizard(true, 'transaction');
      
      // Navigate to see target fields (would need to get to mapping step)
      expect(screen.getByTestId('modal-title')).toHaveTextContent('CSV Import Wizard');
    });

    it('displays account-specific fields for account import', () => {
      renderWizard(true, 'account');
      
      expect(screen.getByTestId('modal-title')).toHaveTextContent('CSV Import Wizard');
    });
  });

  describe('icons display', () => {
    it('displays required icons', () => {
      renderWizard(true);
      
      expect(screen.getByTestId('upload-icon')).toBeInTheDocument();
      expect(screen.getByTestId('file-text-icon')).toBeInTheDocument();
      expect(screen.getAllByTestId('chevron-right-icon').length).toBeGreaterThanOrEqual(3); // Between steps
    });
  });

  describe('edge cases', () => {
    it('handles modal state changes', () => {
      const { rerender } = renderWizard(true);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      
      rerender(
        <CSVImportWizard
          isOpen={false}
          onClose={mockOnClose}
          type="transaction"
        />
      );
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('handles type prop changes', () => {
      const { rerender } = renderWizard(true, 'transaction');
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      
      rerender(
        <CSVImportWizard
          isOpen={true}
          onClose={mockOnClose}
          type="account"
        />
      );
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    it('handles empty file upload', async () => {
      renderWizard(true);
      
      const fileInput = screen.getByLabelText(/select file/i);
      
      // Simulate no file selected
      fireEvent.change(fileInput, { target: { files: [] } });
      
      // Should remain on upload step
      expect(screen.getByText('Upload CSV File')).toBeInTheDocument();
    });
  });

  describe('real-world scenarios', () => {
    it('handles complete import workflow', async () => {
      const user = userEvent.setup();
      renderWizard(true);
      
      // 1. Upload file
      const file = new File(['Date,Description,Amount\n2023-01-15,Test,-10.00'], 'test.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/select file/i);
      await user.upload(fileInput, file);
      
      // 2. Verify mapping step
      await waitFor(() => {
        expect(screen.getByText('Column Mapping')).toBeInTheDocument();
      });
      
      // 3. Proceed to preview
      const nextButton = screen.getByText('Next');
      await user.click(nextButton);
      
      expect(screen.getByText('Preview Import')).toBeInTheDocument();
      
      // 4. Start import
      const importButton = screen.getByTestId('loading-button');
      await user.click(importButton);
      
      // 5. Verify results
      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      });
    });

    it('handles bank template selection workflow', async () => {
      const user = userEvent.setup();
      renderWizard(true);
      
      // Select bank template
      const barclaysButton = screen.getByText('Barclays');
      await user.click(barclaysButton);
      
      // Should skip to mapping with pre-configured mappings
      expect(screen.getByText('Column Mapping')).toBeInTheDocument();
    });

    it('handles profile save and load workflow', async () => {
      const user = userEvent.setup();
      renderWizard(true);
      
      // Navigate to mapping step
      const file = new File(['Date,Description,Amount\n2023-01-15,Test,-10.00'], 'test.csv', { type: 'text/csv' });
      const fileInput = screen.getByLabelText(/select file/i);
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText('Column Mapping')).toBeInTheDocument();
      });
      
      // Should have profile functionality available
      expect(screen.getByText('Save Current')).toBeInTheDocument();
      expect(screen.getByText('Select a saved profile...')).toBeInTheDocument();
    });
  });
});
