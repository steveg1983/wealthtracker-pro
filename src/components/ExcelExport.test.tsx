/**
 * ExcelExport Tests
 * Tests for the Excel export functionality component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Transaction, Account, Budget, Category } from '../types';
import { toDecimal } from '../utils/decimal';
import { formatCurrency as formatCurrencyDecimal } from '../utils/currency-decimal';

vi.mock('./icons', () => ({
  DownloadIcon: ({ size }: { size?: number }) => <span data-testid="download-icon" style={{ fontSize: size }}>⬇</span>,
  FileTextIcon: ({ size }: { size?: number }) => <span data-testid="filetext-icon" style={{ fontSize: size }}>📄</span>,
  SettingsIcon: ({ size }: { size?: number }) => <span data-testid="settings-icon" style={{ fontSize: size }}>⚙️</span>,
  CalendarIcon: ({ size }: { size?: number }) => <span data-testid="calendar-icon" style={{ fontSize: size }}>📅</span>,
  TagIcon: () => <span data-testid="tag-icon">🏷️</span>,
  WalletIcon: () => <span data-testid="wallet-icon">👛</span>,
  PieChartIcon: () => <span data-testid="piechart-icon">📊</span>,
  BarChart3Icon: () => <span data-testid="barchart3-icon">📊</span>,
  ArrowRightLeftIcon: () => <span data-testid="arrowrightleft-icon">↔️</span>
}));

// Mock Modal component
vi.mock('./common/Modal', () => ({
  Modal: ({ children, isOpen, onClose, title }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="modal" role="dialog" aria-labelledby="modal-title">
        <div id="modal-title">{title}</div>
        <button onClick={onClose} aria-label="Close modal">Close</button>
        {children}
      </div>
    );
  }
}));

// Mock XLSX library
const mockWriteFile = vi.fn();
const mockJsonToSheet = vi.fn(() => ({}));
const mockSheetAddJson = vi.fn();
const mockBookNew = vi.fn(() => ({}));
const mockBookAppendSheet = vi.fn();

vi.mock('xlsx', () => ({
  default: {
    utils: {
      book_new: mockBookNew,
      json_to_sheet: mockJsonToSheet,
      sheet_add_json: mockSheetAddJson,
      book_append_sheet: mockBookAppendSheet
    },
    writeFile: mockWriteFile
  }
}));

// Mock data
const mockTransactions: Transaction[] = [
  {
    id: '1',
    date: new Date('2024-01-15'),
    description: 'Grocery Store',
    // Signed convention: expenses are stored as negative amounts
    amount: toDecimal(-50),
    type: 'expense',
    category: 'cat-food',
    accountId: 'acc1',
    tags: ['groceries'],
    notes: 'Weekly shopping',
    cleared: true
  },
  {
    id: '2',
    date: new Date('2024-01-20'),
    description: 'Salary',
    amount: toDecimal(3000),
    type: 'income',
    category: 'cat-work',
    accountId: 'acc1',
    cleared: true
  }
];

const mockAccounts: Account[] = [
  { 
    id: 'acc1', 
    name: 'Checking', 
    type: 'checking', 
    balance: toDecimal(5000), 
    currency: 'USD',
    institution: 'Bank of America',
    lastUpdated: new Date('2024-01-20'),
    isActive: true 
  },
  { 
    id: 'acc2', 
    name: 'Savings', 
    type: 'savings', 
    balance: toDecimal(10000), 
    currency: 'USD',
    isActive: true,
    lastUpdated: new Date('2024-01-20')
  }
];

const mockBudgets: Budget[] = [
  { id: '1', categoryId: 'cat-food', amount: toDecimal(500), period: 'monthly', isActive: true },
  { id: '2', categoryId: 'cat-transport', amount: toDecimal(200), period: 'monthly', isActive: true }
];

// Transactions and budgets reference category IDS — a UUID in the real data,
// and the thing that must never reach a spreadsheet cell.
const mockCategories: Category[] = [
  { id: 'cat-spending', name: 'Spending', type: 'expense', level: 'sub', icon: '💷', color: '#333333', isActive: true },
  { id: 'cat-food', name: 'Food', type: 'expense', level: 'detail', parentId: 'cat-spending', icon: '🍔', color: '#FF0000', isActive: true },
  { id: 'cat-transport', name: 'Transport', type: 'expense', level: 'detail', parentId: 'cat-spending', icon: '🚗', color: '#00FF00', isActive: true },
  { id: 'cat-work', name: 'Work', type: 'income', level: 'detail', icon: '💼', color: '#0000FF', isActive: true }
];

// Mock hooks
const mockFormatCurrency = vi.fn((value: any) => formatCurrencyDecimal(value, 'USD'));

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: mockFormatCurrency,
    getCurrencySymbol: () => '$',
    displayCurrency: 'USD'
  })
}));

vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    transactions: mockTransactions,
    transactionSplits: [],
    accounts: mockAccounts,
    budgets: mockBudgets,
    categories: mockCategories
  })
}));

// Mock alert
global.alert = vi.fn();

describe('ExcelExport', () => {
  let ExcelExport: typeof import('./ExcelExport').default;
  const mockOnClose = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    ({ default: ExcelExport } = await import('./ExcelExport'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Rendering', () => {
    it('does not render when closed', () => {
      render(<ExcelExport isOpen={false} onClose={mockOnClose} />);
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('renders when open', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getAllByText('Export to Excel').length).toBeGreaterThan(0);
    });
  });

  describe('Export Options', () => {
    it('displays all export options', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByText('Transactions')).toBeInTheDocument();
      expect(screen.getByText('Accounts')).toBeInTheDocument();
      expect(screen.getByText('Budgets')).toBeInTheDocument();
      expect(screen.getByText('Categories')).toBeInTheDocument();
      expect(screen.getByText('Summary Report')).toBeInTheDocument();
    });

    it('has all options checked by default', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      const checkboxes = screen.getAllByRole('checkbox');
      const dataCheckboxes = checkboxes.slice(0, 5); // First 5 are data options
      
      dataCheckboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });
    });

    it('can toggle export options', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      const transactionsCheckbox = screen.getByRole('checkbox', { name: /Transactions/i });
      
      fireEvent.click(transactionsCheckbox);
      expect(transactionsCheckbox).not.toBeChecked();
      
      fireEvent.click(transactionsCheckbox);
      expect(transactionsCheckbox).toBeChecked();
    });

    it('shows icons for each option', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByTestId('arrowrightleft-icon')).toBeInTheDocument();
      expect(screen.getByTestId('wallet-icon')).toBeInTheDocument();
      expect(screen.getByTestId('piechart-icon')).toBeInTheDocument();
      expect(screen.getByTestId('tag-icon')).toBeInTheDocument();
      expect(screen.getByTestId('barchart3-icon')).toBeInTheDocument();
    });
  });

  describe('Date Range', () => {
    it('shows date range inputs', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
    });

    it('has default date range set', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      const startDate = screen.getByLabelText('Start Date') as HTMLInputElement;
      const endDate = screen.getByLabelText('End Date') as HTMLInputElement;
      
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // The shared picker displays UK dd/mm/yyyy; the state behind it stays ISO.
      const uk = (d: Date): string =>
        `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

      expect(startDate.value).toBe(uk(firstOfMonth));
      expect(endDate.value).toBe(uk(now));
    });

    it('can change date range', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);

      const startDate = screen.getByLabelText('Start Date');
      // Typed as a UK date; blur settles the draft, so what is left on screen
      // is the committed value rather than the raw keystrokes.
      fireEvent.change(startDate, { target: { value: '01/03/2024' } });
      fireEvent.blur(startDate);

      expect((startDate as HTMLInputElement).value).toBe('01/03/2024');
    });
  });

  describe('Grouping Options', () => {
    it('shows grouping dropdown', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByText('Transaction Grouping')).toBeInTheDocument();
      
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('has correct grouping options', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      const options = Array.from(select.options);
      
      // 'Group by Account' used to be offered here with no branch behind it:
      // choosing it fell through to no grouping and changed nothing.
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveTextContent('No Grouping');
      expect(options[1]).toHaveTextContent('Group by Month');
      expect(options[2]).toHaveTextContent('Group by Category');
    });

    it('defaults to no grouping', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('none');
    });
  });

  describe('Formatting Options', () => {
    it('shows formatting checkboxes', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByText('Formatting Options')).toBeInTheDocument();
      expect(screen.getByText('Enable auto-filters')).toBeInTheDocument();
    });

    /**
     * "Highlight negative values" and "Zebra striping" were offered here and
     * read by nothing: per-cell styling needs the paid SheetJS build and this
     * project pins the community one. An autofilter is a sheet-level property
     * the community build does honour, so it is the one that stayed.
     */
    it('offers only the formatting switch that reaches the file', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);

      expect(screen.queryByText('Highlight negative values')).not.toBeInTheDocument();
      expect(screen.queryByText('Zebra striping')).not.toBeInTheDocument();
    });

    it('has the auto-filter switch on by default, and it toggles', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);

      const filterCheckbox = screen.getByRole('checkbox', { name: /Enable auto-filters/i });
      expect(filterCheckbox).toBeChecked();

      fireEvent.click(filterCheckbox);
      expect(filterCheckbox).not.toBeChecked();
    });
  });

  describe('Export Button', () => {
    it('is enabled when at least one option is selected', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      const exportButton = screen.getByRole('button', { name: /Export to Excel/i });
      expect(exportButton).not.toBeDisabled();
    });

    it('is disabled when no options are selected', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      // Uncheck all data options
      const checkboxes = screen.getAllByRole('checkbox');
      const dataCheckboxes = checkboxes.slice(0, 5);
      
      dataCheckboxes.forEach(checkbox => {
        fireEvent.click(checkbox);
      });
      
      const exportButton = screen.getByRole('button', { name: /Export to Excel/i });
      expect(exportButton).toBeDisabled();
    });

    it('shows loading state when exporting', async () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      const exportButton = screen.getByRole('button', { name: /Export to Excel/i });
      
      // Mock the dynamic import
      const mockXLSX = {
        utils: {
          book_new: mockBookNew,
          json_to_sheet: mockJsonToSheet,
          sheet_add_json: mockSheetAddJson,
          book_append_sheet: mockBookAppendSheet
        },
        writeFile: mockWriteFile
      };
      
      vi.doMock('xlsx', () => ({ default: mockXLSX }));
      
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).toBeInTheDocument();
      });
    });
  });

  describe('Cancel Button', () => {
    it('calls onClose when clicked', () => {
      const onClose = vi.fn();
      render(<ExcelExport isOpen={true} onClose={onClose} />);
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Export Functionality', () => {
    it('handles export with all options', async () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      const exportButton = screen.getByRole('button', { name: /Export to Excel/i });
      
      // Mock the dynamic import
      const mockXLSX = {
        utils: {
          book_new: mockBookNew,
          json_to_sheet: mockJsonToSheet,
          sheet_add_json: mockSheetAddJson,
          book_append_sheet: mockBookAppendSheet
        },
        writeFile: mockWriteFile
      };
      
      // Use simple mock for dynamic import
      global.import = vi.fn(() => Promise.resolve({ default: mockXLSX }));
      
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(mockWriteFile).toHaveBeenCalled();
      });
      
      expect(mockBookNew).toHaveBeenCalled();
      expect(mockJsonToSheet).toHaveBeenCalled();
      expect(mockBookAppendSheet).toHaveBeenCalledTimes(5); // All 5 sheets
    });

    it('generates correct filename', async () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      const exportButton = screen.getByRole('button', { name: /Export to Excel/i });
      
      const mockXLSX = {
        utils: {
          book_new: mockBookNew,
          json_to_sheet: mockJsonToSheet,
          sheet_add_json: mockSheetAddJson,
          book_append_sheet: mockBookAppendSheet
        },
        writeFile: mockWriteFile
      };
      
      global.import = vi.fn(() => Promise.resolve({ default: mockXLSX }));
      
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(mockWriteFile).toHaveBeenCalled();
      });
      
      const filename = mockWriteFile.mock.calls[0][1];
      expect(filename).toMatch(/^wealth-tracker-export-\d{4}-\d{2}-\d{2}\.xlsx$/);
    });

    it('closes modal after successful export', async () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      const exportButton = screen.getByRole('button', { name: /Export to Excel/i });
      
      const mockXLSX = {
        utils: {
          book_new: mockBookNew,
          json_to_sheet: mockJsonToSheet,
          sheet_add_json: mockSheetAddJson,
          book_append_sheet: mockBookAppendSheet
        },
        writeFile: mockWriteFile
      };
      
      global.import = vi.fn(() => Promise.resolve({ default: mockXLSX }));
      
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('handles export errors', async () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      const exportButton = screen.getByRole('button', { name: /Export to Excel/i });
      
      mockWriteFile.mockImplementationOnce(() => {
        throw new Error('Failed to write file');
      });
      
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Failed to export Excel file. Please try again.');
      });
    });
  });

  /**
   * A category id is a UUID. Printed into a spreadsheet it tells the reader
   * nothing and cannot be looked up — the Category column has to carry the
   * name, in the same "Parent : Child" form the rest of the app uses.
   */
  describe('Category names', () => {
    /** The fixture transactions are dated 2024, so widen the default window. */
    const selectFixtureYear = (): void => {
      const startDate = screen.getByLabelText('Start Date');
      fireEvent.change(startDate, { target: { value: '01/01/2024' } });
      fireEvent.blur(startDate);
      const endDate = screen.getByLabelText('End Date');
      fireEvent.change(endDate, { target: { value: '31/12/2024' } });
      fireEvent.blur(endDate);
    };

    it('writes category NAMES into the Transactions sheet, never ids', async () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      selectFixtureYear();

      fireEvent.click(screen.getByRole('button', { name: /Export to Excel/i }));

      await waitFor(() => {
        expect(mockWriteFile).toHaveBeenCalled();
      });

      const rows = mockJsonToSheet.mock.calls
        .map(call => call[0])
        .filter((value): value is Array<Record<string, unknown>> => Array.isArray(value))
        .flat();

      const groceryRow = rows.find(row => row.Description === 'Grocery Store');
      expect(groceryRow?.Category).toBe('Spending : Food');

      const serialised = JSON.stringify(rows);
      expect(serialised).not.toContain('cat-food');
      expect(serialised).not.toContain('cat-work');
    });

    it('names the category a budget belongs to', async () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole('button', { name: /Export to Excel/i }));

      await waitFor(() => {
        expect(mockWriteFile).toHaveBeenCalled();
      });

      const rows = mockJsonToSheet.mock.calls
        .map(call => call[0])
        .filter((value): value is Array<Record<string, unknown>> => Array.isArray(value))
        .flat();

      const budgetRow = rows.find(row => row['Budget Amount'] !== undefined);
      expect(budgetRow?.Category).toBe('Spending : Food');
    });
  });

  describe('Data Filtering', () => {
    it('filters transactions by date range', async () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      // Change date range
      const startDate = screen.getByLabelText('Start Date');
      fireEvent.change(startDate, { target: { value: '2024-01-01' } });
      
      const endDate = screen.getByLabelText('End Date');
      fireEvent.change(endDate, { target: { value: '2024-01-16' } });
      
      const exportButton = screen.getByRole('button', { name: /Export to Excel/i });
      
      const mockXLSX = {
        utils: {
          book_new: mockBookNew,
          json_to_sheet: mockJsonToSheet,
          sheet_add_json: mockSheetAddJson,
          book_append_sheet: mockBookAppendSheet
        },
        writeFile: mockWriteFile
      };
      
      global.import = vi.fn(() => Promise.resolve({ default: mockXLSX }));
      
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(mockJsonToSheet).toHaveBeenCalled();
      });
    });
  });

  describe('Grouping', () => {
    it('can group transactions by month', async () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      const groupSelect = screen.getByRole('combobox');
      fireEvent.change(groupSelect, { target: { value: 'month' } });
      
      const exportButton = screen.getByRole('button', { name: /Export to Excel/i });
      
      const mockXLSX = {
        utils: {
          book_new: mockBookNew,
          json_to_sheet: mockJsonToSheet,
          sheet_add_json: mockSheetAddJson,
          book_append_sheet: mockBookAppendSheet
        },
        writeFile: mockWriteFile
      };
      
      global.import = vi.fn(() => Promise.resolve({ default: mockXLSX }));
      
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(mockJsonToSheet).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible modal structure', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'modal-title');
    });

    it('has accessible form controls', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date')).toBeInTheDocument();
      expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('has accessible buttons', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Export to Excel/i })).toBeInTheDocument();
    });
  });
});
