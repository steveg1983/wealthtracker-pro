/**
 * CSVImportWizard Tests
 * Comprehensive tests for the CSV import wizard component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CSVImportWizard from './CSVImportWizard';
import { enhancedCsvImportService } from '../services/enhancedCsvImportService';
import { dataPort } from '../services/port';

const mockRefreshAccountsAndTransactions = vi.fn().mockResolvedValue(undefined);

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
    refreshAccountsAndTransactions: mockRefreshAccountsAndTransactions,
  }),
}));

/**
 * THE WRITE, which is now one door rather than two.
 *
 * The wizard used to choose between the cloud client and the browser-storage
 * importer itself, off `isUsingSupabase`, and these tests mocked both. It asks
 * the seam once now; which store answers is the seam's business and is tested
 * where that decision lives (dataService.test.ts). What is mocked here is the
 * ANSWER, because what these tests check is what the wizard reports about a
 * write — and that can only be checked by controlling what the write says it
 * did.
 */
vi.mock('../services/port', () => ({
  dataPort: {
    importTransactions: vi.fn(),
  },
}));

/**
 * The parse and the write are mocked (these tests are about what the wizard
 * DOES with them), but everything that READS A FILE is the REAL implementation,
 * imported through vi.importActual: `generatePreview`, `buildRows`,
 * `missingRequiredFields` and the bank template registry.
 *
 * That is the whole point of those: they wrap the same buildTransactionFromRow
 * the import uses, so a stub of them would test nothing but the stub — and the
 * bugs they exist to prevent (a bank's Credit column previewing blank while the
 * import writes it correctly; a mapping that names a column the file has not
 * got) are bugs in exactly the code a stub would replace.
 */
/**
 * A whole ParsedCsv, from just the headers and rows a test cares about.
 *
 * The wizard reads every field of this shape — the physical line each row
 * starts on, where the headings were found, what sat above them — so a mock
 * that answered only `headers` and `data` would be testing the component
 * against a contract the real service does not have. Rows are numbered as a
 * file with a one-line header and no covering block would number them, which is
 * what these fixtures are.
 */
function parsedCsv(headers: string[], data: string[][]) {
  return {
    headers,
    data,
    lines: data.map((_, index) => index + 2),
    headerLine: 1,
    preamble: [],
    headingCandidates: [
      { cells: headers, line: 1, lineSpan: 1, raw: headers.join(',') }
    ],
    headerDetectedBecause: null,
    unterminatedQuoteLine: null
  };
}

vi.mock('../services/enhancedCsvImportService', async () => {
  const actual = await vi.importActual<typeof import('../services/enhancedCsvImportService')>(
    '../services/enhancedCsvImportService'
  );
  const real = actual.enhancedCsvImportService;
  return {
  ...actual,
  enhancedCsvImportService: {
    generatePreview: real.generatePreview.bind(real),
    buildRows: real.buildRows.bind(real),
    missingRequiredFields: real.missingRequiredFields.bind(real),
    listBankTemplates: real.listBankTemplates.bind(real),
    // The whole ParsedCsv shape, because the wizard now uses all of it: the
    // physical line each row starts on (printed in every refusal), where the
    // headings were found, and what sat above them. Built by parsedCsv() below
    // so a mock can never answer half of a contract the component relies on.
    parseCSV: vi.fn(() => parsedCsv(
      ['Date', 'Description', 'Amount', 'Account'],
      [
        ['2023-01-15', 'Grocery Store', '-85.50', 'Checking'],
        ['2023-01-16', 'Salary', '2000.00', 'Checking'],
        ['2023-01-17', 'Coffee Shop', '-4.50', 'Checking'],
      ]
    )),
    dateColumnSamples: real.dateColumnSamples.bind(real),
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
      { id: 'profile-1', name: 'My Bank Profile', mappings: [], lastUsed: new Date() },
    ]),
    consumeDiscardedProfileNotice: vi.fn(() => []),
    saveProfile: vi.fn(),
    deleteProfile: vi.fn(() => true),
    renameProfile: vi.fn(() => true),
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
  };
});

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
  // The destination-account combobox's own icons. Missing from this mock, they
  // came through as undefined components and the mapping step would not render
  // at all — a whole-module mock has to cover the whole module its subject uses.
  ChevronDownIcon: ({ size }: { size?: number }) => <div data-testid="chevron-down-icon" data-size={size}>▾</div>,
  PlusIcon: ({ size }: { size?: number }) => <div data-testid="plus-icon" data-size={size}>＋</div>,
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
    // Default: the write does what it was asked. Tests about a failing write
    // override this.
    vi.mocked(dataPort.importTransactions).mockImplementation(
      async (_accountId, rows) => ({ inserted: rows.length, alreadyPresent: 0, total: rows.length, complete: true })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderWizard = (isOpen = true) => {
    return render(
      <CSVImportWizard
        isOpen={isOpen}
        onClose={mockOnClose}
      />
    );
  };

  /**
   * Choose where the rows go.
   *
   * A bank statement names its account on the covering page, not in its rows,
   * so the wizard asks — the same question the OFX and QIF dialogs have always
   * asked. Files whose mapping includes an accountName column can skip it; a
   * file without one cannot leave the mapping step until it is answered.
   */
  const chooseDestinationAccount = async (name = 'Checking Account'): Promise<void> => {
    fireEvent.click(screen.getByRole('combobox', { name: 'Import these transactions into' }));
    fireEvent.click(await screen.findByRole('option', { name: new RegExp(name) }));
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

    /**
     * The bank list is COLLAPSED and second now. It used to be forty-one
     * buttons filling the step below a drop zone that a centred, overflowing
     * flex column had pushed off the top of the dialog — which is why the
     * owner of this app reported the wizard as having no file picker at all.
     */
    it('keeps the bank formats out of the way until they are asked for', () => {
      renderWizard(true);

      expect(screen.queryByText('Barclays')).not.toBeInTheDocument();
      const disclosure = screen.getByRole('button', { name: /know your bank/i });
      expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    });

    it('shows the formats, searchable, when they are asked for', async () => {
      const user = userEvent.setup();
      renderWizard(true);

      await user.click(screen.getByRole('button', { name: /know your bank/i }));

      expect(screen.getByText('Barclays')).toBeInTheDocument();
      expect(screen.getByText('Monzo')).toBeInTheDocument();
      // The list comes from the service, so what is offered is what exists —
      // and formats that were unreachable from the old hand-typed grid, like
      // Wells Fargo and Mint, are reachable now.
      expect(screen.getByText('Wells Fargo')).toBeInTheDocument();
      expect(screen.getByLabelText(/search \d+ bank formats/i)).toBeInTheDocument();
    });

    it('narrows the list as it is searched, and by column name too', async () => {
      const user = userEvent.setup();
      renderWizard(true);
      await user.click(screen.getByRole('button', { name: /know your bank/i }));

      await user.type(screen.getByLabelText(/search \d+ bank formats/i), 'monzo');

      expect(screen.getByText('Monzo')).toBeInTheDocument();
      expect(screen.queryByText('Barclays')).not.toBeInTheDocument();
    });

    /**
     * THE OWNER'S WALK, STEP TWO. He chose a bank and pressed Next, and the
     * wizard took him to Column Mapping with no file — where every dropdown was
     * empty because there were no columns to offer.
     */
    it('does not navigate anywhere when a bank format is chosen', async () => {
      const user = userEvent.setup();
      renderWizard(true);
      await user.click(screen.getByRole('button', { name: /know your bank/i }));

      await user.click(screen.getByText('Barclays'));

      expect(screen.queryByText('Column Mapping')).not.toBeInTheDocument();
      expect(screen.getByText('Choose your CSV file')).toBeInTheDocument();
      // And it says what it did do: remembered the columns for later.
      expect(screen.getByText(/will be filled in as soon as you choose a file/i)).toBeInTheDocument();
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

    it('displays mapping interface, naming the file it is mapping', () => {
      expect(screen.getByText('Column Mapping')).toBeInTheDocument();
      expect(screen.getByText(/which column of test\.csv holds what/i)).toBeInTheDocument();
    });

    it('displays import profiles section', () => {
      expect(screen.getByText('Import Profiles')).toBeInTheDocument();
      expect(screen.getByText('Save Current')).toBeInTheDocument();
    });

    it('says nothing about removed profiles when none were removed', () => {
      expect(screen.queryByText(/was for creating accounts from a CSV/)).not.toBeInTheDocument();
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

    /**
     * The preview shows what will be WRITTEN, not the file's raw cells — so
     * the columns are the transaction's fields, and the values have been
     * through the same builder the import uses.
     */
    it('displays the built values, column by column', () => {
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Description' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Amount' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Type' })).toBeInTheDocument();
      // The mocked parse maps an Account column, so that one is shown too;
      // no Category column is mapped, so there is no Category column.
      expect(screen.getByRole('columnheader', { name: 'Account' })).toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: 'Category' })).not.toBeInTheDocument();

      // Signed and formatted as money, not reprinted as the file's text.
      expect(screen.getByText('(£85.50)')).toBeInTheDocument();
      expect(screen.getByText('£2,000.00')).toBeInTheDocument();
      expect(screen.getByText('Grocery Store')).toBeInTheDocument();
      expect(screen.getByText('15/01/2023')).toBeInTheDocument();
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

  /**
   * The bug this preview was rewired to fix.
   *
   * Many UK banks ship a statement with SEPARATE Debit and Credit columns, both
   * mapped to `amount`. The old preview printed the first mapping's raw cell, so
   * every credit row — whose Debit cell is empty — previewed BLANK while the
   * import wrote it perfectly well. The screen and the register disagreed on the
   * rows people check hardest.
   *
   * Every figure and payee below is invented.
   */
  describe('a statement with separate Debit and Credit columns', () => {
    const LLOYDS_HEADERS = ['Date', 'Description', 'Debit Amount', 'Credit Amount'];
    const LLOYDS_ROWS = [
      ['2025-06-01', 'CORNER SHOP', '50.00', ''],
      ['2025-06-02', 'SALARY', '', '100.00'],
      ['2025-06-03', 'REFUNDED CHARGE', '-12.50', ''],
      ['2025-06-04', 'ZERO ROW', '0.00', ''],
    ];
    const LLOYDS_MAPPINGS = [
      { sourceColumn: 'Date', targetField: 'date' },
      { sourceColumn: 'Description', targetField: 'description' },
      { sourceColumn: 'Debit Amount', targetField: 'amount' },
      { sourceColumn: 'Credit Amount', targetField: 'amount' },
    ];

    const previewLloydsFile = async (): Promise<void> => {
      const user = userEvent.setup();
      vi.mocked(enhancedCsvImportService.parseCSV).mockReturnValueOnce(
        parsedCsv(LLOYDS_HEADERS, LLOYDS_ROWS)
      );
      vi.mocked(enhancedCsvImportService.suggestMappings).mockReturnValueOnce(LLOYDS_MAPPINGS);

      renderWizard(true);
      await user.upload(
        screen.getByLabelText(/select file/i),
        new File(['statement'], 'lloyds.csv', { type: 'text/csv' })
      );
      await waitFor(() => {
        expect(screen.getByText('Column Mapping')).toBeInTheDocument();
      });
      // This statement has no account column of its own, so the wizard will not
      // move on until it is told where the rows go.
      await chooseDestinationAccount();
      await user.click(screen.getByText('Next'));
    };

    it('previews a credit row with its positive amount, not a blank', async () => {
      await previewLloydsFile();

      const salary = screen.getByText('SALARY').closest('tr');
      expect(salary).toHaveTextContent('£100.00');
      expect(salary).not.toHaveTextContent('(£100.00)');
      expect(salary).toHaveTextContent('income');
    });

    it('previews a debit row as money out', async () => {
      await previewLloydsFile();

      const shop = screen.getByText('CORNER SHOP').closest('tr');
      expect(shop).toHaveTextContent('(£50.00)');
      expect(shop).toHaveTextContent('expense');
    });

    it('previews a negative debit as the reversal it is', async () => {
      // A negative cell in a Debit column is money coming BACK.
      await previewLloydsFile();

      const refund = screen.getByText('REFUNDED CHARGE').closest('tr');
      expect(refund).toHaveTextContent('£12.50');
      expect(refund).toHaveTextContent('income');
    });

    it('says which rows will be skipped rather than dropping them silently', async () => {
      // A zero debit/credit pair carries no direction, so the import passes
      // over it. Leaving it out of the preview is how somebody spends an
      // evening looking for it in the register.
      await previewLloydsFile();

      // With the builder's own reason, not one generic apology for every kind
      // of failure: an unreadable date and a zero debit/credit pair are
      // different problems with different cures.
      expect(
        screen.getByText(/Will be skipped — No non-zero amount found in the debit\/credit columns/)
      ).toBeInTheDocument();
      expect(screen.queryByText('ZERO ROW')).not.toBeInTheDocument();
    });

    it('counts the skipped rows over the WHOLE file, not just the five on screen', async () => {
      await previewLloydsFile();

      expect(screen.getByText(/3 of 4 rows/)).toBeInTheDocument();
      expect(
        screen.getByText(/1 row skipped — No non-zero amount found in the debit\/credit columns/)
      ).toBeInTheDocument();
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
      // "Skipped" alone said nothing about why. These were left out on purpose.
      expect(screen.getByText('Skipped as duplicates')).toBeInTheDocument();
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
      expect(dataPort.importTransactions).toHaveBeenCalledTimes(1);
      expect(dataPort.importTransactions).toHaveBeenCalledWith(
        'acc-1',
        expect.arrayContaining([
          expect.objectContaining({ description: 'GROCERY STORE', accountId: 'acc-1' }),
          expect.objectContaining({ description: 'SALARY', accountId: 'acc-1' })
        ]),
        // The destination the wizard resolved, the rows it routed there, and a
        // way to hear about them landing. Nothing about which store answers.
        { onProgress: expect.any(Function) }
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
      expect(dataPort.importTransactions).toHaveBeenCalledWith(
        'acc-1',
        [
          expect.objectContaining({ description: 'GROCERY STORE', categoryConfirmed: false }),
          expect.objectContaining({ description: 'SALARY', categoryConfirmed: true })
        ],
        { onProgress: expect.any(Function) }
      );
    });

    it('shows the Imported tile as what LANDED, not what the file offered', async () => {
      // The file offers two; the write confirms one. The tile must say one.
      vi.mocked(enhancedCsvImportService.importTransactions).mockResolvedValueOnce(parsedAs(twoRows));
      vi.mocked(dataPort.importTransactions).mockResolvedValueOnce({
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
      vi.mocked(dataPort.importTransactions).mockResolvedValueOnce({
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
      expect(dataPort.importTransactions).toHaveBeenCalledTimes(2);
      expect(vi.mocked(dataPort.importTransactions).mock.calls.map(call => call[0]))
        .toEqual(['acc-1', 'acc-2']);
    });

    it('keeps one account\'s failure from cancelling another account\'s rows', async () => {
      // Separate accounts have nothing to do with each other; refusing to file
      // the working one helps nobody, so long as the failure is named.
      vi.mocked(enhancedCsvImportService.importTransactions).mockResolvedValueOnce(
        parsedAs([...twoRows, { ...twoRows[0], description: 'TRANSFER IN', accountId: 'acc-2' }])
      );
      vi.mocked(dataPort.importTransactions)
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
      expect(dataPort.importTransactions).toHaveBeenCalledWith(
        'acc-1',
        [expect.objectContaining({ description: 'GROCERY STORE' })],
        { onProgress: expect.any(Function) }
      );
    });

    it('says when nothing at all said which account these rows belong to', async () => {
      // Neither the file nor the user: the mapped Account column produced no
      // id, and no destination was chosen. Both cures are named.
      vi.mocked(enhancedCsvImportService.importTransactions).mockResolvedValueOnce(
        parsedAs(twoRows.map(row => ({ ...row, accountId: undefined })))
      );

      await runImport();

      await waitFor(() => {
        expect(screen.getByText('Nothing was imported')).toBeInTheDocument();
      });
      expect(screen.getByText(/Nothing says which account these belong in/)).toBeInTheDocument();
      expect(screen.getByText(/Import these transactions into/)).toBeInTheDocument();
      expect(dataPort.importTransactions).not.toHaveBeenCalled();
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

    /**
     * Pressing Import used to leave the wizard completely still until the write
     * came back — no count, no bar, nothing to say the click was even taken. The
     * only action available to somebody watching that is to press it again.
     */
    describe('while the write is running', () => {
      /** A write held open, so the in-flight state can be looked at. */
      const heldWrite = () => {
        let release: (() => void) | null = null;
        const finished = new Promise<void>(resolve => { release = resolve; });
        vi.mocked(dataPort.importTransactions).mockImplementationOnce(async (_accountId, rows) => {
          await finished;
          return { inserted: rows.length, alreadyPresent: 0, total: rows.length, complete: true };
        });
        return { release: () => release?.() };
      };

      it('says it is importing, and counts the rows as they land', async () => {
        vi.mocked(enhancedCsvImportService.importTransactions).mockResolvedValueOnce(parsedAs(twoRows));
        const write = heldWrite();

        await runImport();

        // Announced politely rather than by stealing focus.
        const status = await screen.findByRole('status');
        expect(status).toHaveTextContent(/Importing/);
        expect(screen.getByRole('progressbar')).toBeInTheDocument();

        write.release();
        await waitFor(() => {
          expect(screen.getByText('Import Complete!')).toBeInTheDocument();
        });
        // The summary takes over; the progress region goes with it.
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });

      it('cannot be fired twice, and says why Back is unavailable', async () => {
        vi.mocked(enhancedCsvImportService.importTransactions).mockResolvedValueOnce(parsedAs(twoRows));
        const write = heldWrite();

        await runImport();
        await screen.findByRole('status');

        expect(screen.getByTestId('loading-button')).toBeDisabled();
        const back = screen.getByText('Back').closest('button');
        expect(back).toBeDisabled();
        expect(back).toHaveAttribute('title', 'Import in progress');

        // A second press while it runs must not start a second import.
        fireEvent.click(screen.getByTestId('loading-button'));
        write.release();
        await waitFor(() => {
          expect(screen.getByText('Import Complete!')).toBeInTheDocument();
        });
        expect(enhancedCsvImportService.importTransactions).toHaveBeenCalledTimes(1);
        expect(dataPort.importTransactions).toHaveBeenCalledTimes(1);
      });
    });

    it('counts the rows as a chunked store reports them, without waiting for the end', async () => {
      // A signed-in import posts in chunks and says so between them. The
      // wizard's job is to put those figures on screen as they arrive rather
      // than jumping from nothing to done — which is what a 900-row statement
      // looks like otherwise.
      vi.mocked(enhancedCsvImportService.importTransactions).mockResolvedValueOnce(parsedAs(twoRows));
      let release: (() => void) | null = null;
      const finished = new Promise<void>(resolve => { release = resolve; });
      vi.mocked(dataPort.importTransactions).mockImplementationOnce(async (_accountId, rows, options) => {
        options?.onProgress?.({ inserted: 1, total: rows.length });
        await finished;
        return { inserted: rows.length, alreadyPresent: 0, total: rows.length, complete: true };
      });

      await runImport();

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Importing… 1 of 2 transactions');
      });
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');

      release?.();
      await waitFor(() => {
        expect(screen.getByText('Import Complete!')).toBeInTheDocument();
      });
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
      renderWizard(true);

      const fileInput = screen.getByLabelText(/select file/i);
      expect(fileInput).not.toHaveClass('hidden');
      expect(fileInput).toHaveClass('sr-only');
      expect(fileInput).not.toBeDisabled();
      expect(fileInput).not.toHaveAttribute('tabindex', '-1');

      const label = fileInput.closest('label');
      expect(label?.className).toContain('focus-within:ring-2');
    });
  });

  describe('transaction vs account type', () => {
    it('displays transaction-specific fields for transaction import', () => {
      renderWizard(true);
      
      // Navigate to see target fields (would need to get to mapping step)
      expect(screen.getByTestId('modal-title')).toHaveTextContent('CSV Import Wizard');
    });

    /**
     * There is no account import and there never was — the branch behind the
     * old `type='account'` prop wrote nothing at all. The mapping step offers
     * exactly the fields a transaction has, so a column cannot be pointed at a
     * destination that would silently discard it.
     */
    it('offers only the fields a transaction actually has', async () => {
      const user = userEvent.setup();
      renderWizard(true);
      await user.upload(
        screen.getByLabelText(/select file/i),
        new File(['Date,Description,Amount\n2023-01-15,Test,-10.00'], 'test.csv', { type: 'text/csv' })
      );
      await waitFor(() => {
        expect(screen.getByText('Column Mapping')).toBeInTheDocument();
      });

      const target = screen.getByRole('combobox', { name: 'Target field for mapping 1' });
      expect(
        within(target).getAllByRole('option').map(option => option.textContent)
      ).toEqual([
        'Select target field...',
        'date',
        'description',
        'amount',
        'category',
        'accountName',
        'type',
        'tags',
        'notes'
      ]);
    });
  });

  /**
   * A saved profile marked for the account import could never have imported
   * anything — the branch behind it wrote nothing. Dropping it is the honest
   * outcome, but dropping it in SILENCE would be a second unasked-for change:
   * the user saved that profile and is entitled to know it has gone.
   */
  describe('a saved profile removed because its feature never existed', () => {
    it('says so, once, on the step where profiles live', async () => {
      const user = userEvent.setup();
      vi.mocked(enhancedCsvImportService.consumeDiscardedProfileNotice).mockReturnValueOnce([
        'Account opening balances'
      ]);
      renderWizard(true);
      await user.upload(
        screen.getByLabelText(/select file/i),
        new File(['Date,Description,Amount\n2023-01-15,Test,-10.00'], 'test.csv', { type: 'text/csv' })
      );
      await waitFor(() => {
        expect(screen.getByText('Column Mapping')).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          /The saved profile “Account opening balances” was for creating accounts from a CSV, which this app has never done/
        )
      ).toBeInTheDocument();
      expect(screen.getByText(/Your transaction profiles are untouched/)).toBeInTheDocument();
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
        />
      );
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
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

    it('handles bank template selection workflow: format first, then file', async () => {
      const user = userEvent.setup();
      renderWizard(true);

      await user.click(screen.getByRole('button', { name: /know your bank/i }));
      await user.click(screen.getByText('Barclays'));

      // The format alone goes nowhere — it is a set of column names.
      expect(screen.queryByText('Column Mapping')).not.toBeInTheDocument();

      await user.upload(
        screen.getByLabelText(/select file/i),
        new File(['Date,Description,Amount\n2023-01-15,Test,-10.00'], 'test.csv', { type: 'text/csv' })
      );

      await waitFor(() => {
        expect(screen.getByText('Column Mapping')).toBeInTheDocument();
      });
      // And it reports what it managed against THIS file's headings.
      expect(screen.getByText('Barclays', { selector: 'strong' })).toBeInTheDocument();
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

  /**
   * A file handed in by the Batch Import queue rather than picked here. It has
   * to reach exactly the same code the drop zone reaches — that is the whole
   * reason the queue is allowed to be a queue instead of a fourth importer.
   *
   * For a CSV that matters most of all: the columns still have to be mapped by
   * a person. A queued CSV lands on the mapping step like any other, rather
   * than being guessed at unattended.
   */
  describe('A file handed in by the batch queue', () => {
    const queuedFile = (name = 'ledger.csv'): File =>
      new File(['Date,Description,Amount\n2023-01-15,Test,-10.00'], name, { type: 'text/csv' });

    const renderWithFile = (file: File) =>
      render(
        <CSVImportWizard
          isOpen
          onClose={mockOnClose}
          initialFile={file}
        />
      );

    it('reads it on mount and stops at the mapping step for the user', async () => {
      renderWithFile(queuedFile());

      await waitFor(() => {
        expect(screen.getByText('Column Mapping')).toBeInTheDocument();
      });
      expect(enhancedCsvImportService.parseCSV).toHaveBeenCalledTimes(1);
      expect(enhancedCsvImportService.suggestMappings).toHaveBeenCalledTimes(1);
      // Not the result step, and not the write: a CSV names its columns in words
      // only its author knows, so nothing is imported before someone confirms.
      expect(screen.queryByText('Import Complete!')).not.toBeInTheDocument();
      expect(dataPort.importTransactions).not.toHaveBeenCalled();
      expect(dataPort.importTransactions).not.toHaveBeenCalled();
    });

    /**
     * The queue re-renders whenever its own state moves. Re-reading on each of
     * those would throw the user back to Map Columns, losing the mapping they
     * were partway through correcting.
     */
    it('does not re-read when the same file is handed in again', async () => {
      const file = queuedFile();
      const { rerender } = renderWithFile(file);

      await waitFor(() => {
        expect(enhancedCsvImportService.parseCSV).toHaveBeenCalledTimes(1);
      });

      rerender(
        <CSVImportWizard isOpen onClose={mockOnClose} initialFile={file} />
      );
      rerender(
        <CSVImportWizard isOpen onClose={mockOnClose} type="transaction" initialFile={file} />
      );

      expect(enhancedCsvImportService.parseCSV).toHaveBeenCalledTimes(1);
    });

    it('reads a different file that happens to share a name', async () => {
      const { rerender } = renderWithFile(queuedFile('statement.csv'));
      await waitFor(() => {
        expect(enhancedCsvImportService.parseCSV).toHaveBeenCalledTimes(1);
      });

      rerender(
        <CSVImportWizard
          isOpen
          onClose={mockOnClose}
          type="transaction"
          initialFile={queuedFile('statement.csv')}
        />
      );

      await waitFor(() => {
        expect(enhancedCsvImportService.parseCSV).toHaveBeenCalledTimes(2);
      });
    });

    it('shows the drop zone as usual when no file is handed in', () => {
      renderWizard(true);

      expect(screen.getByText('Upload CSV File')).toBeInTheDocument();
      expect(enhancedCsvImportService.parseCSV).not.toHaveBeenCalled();
    });
  });
});
