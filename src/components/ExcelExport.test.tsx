/**
 * ExcelExport Tests
 * Tests for the Excel export functionality component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ExcelExport from './ExcelExport';
import type { Transaction, Account, Budget, Category } from '../types';
import { toDecimal } from '../utils/decimal';

// Mock all icons
const mockIcons = [
  'DownloadIcon', 'FileTextIcon', 'SettingsIcon', 
  'CalendarIcon', 'TagIcon', 'WalletIcon', 'PieChartIcon', 
  'BarChart3Icon', 'ArrowRightLeftIcon'
];

mockIcons.forEach(icon => {
  vi.mock(`./icons/${icon}`, () => ({
    default: () => <span data-testid={`${icon.toLowerCase()}`}>{icon}</span>
  }));
});

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
    amount: toDecimal(50),
    type: 'expense',
    category: 'Food',
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
    category: 'Work',
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
  { id: '1', category: 'Food', amount: toDecimal(500), period: 'monthly', isActive: true },
  { id: '2', category: 'Transport', amount: toDecimal(200), period: 'monthly', isActive: true }
];

const mockCategories: Category[] = [
  { id: '1', name: 'Food', type: 'expense', icon: '🍔', color: '#FF0000', isActive: true },
  { id: '2', name: 'Transport', type: 'expense', icon: '🚗', color: '#00FF00', isActive: true },
  { id: '3', name: 'Work', type: 'income', icon: '💼', color: '#0000FF', isActive: true }
];

// Mock hooks
const mockFormatCurrency = vi.fn((value: any) => {
  const num = typeof value === 'object' && value?.toNumber ? value.toNumber() : Number(value);
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD' 
  }).format(num);
});

vi.mock('../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: mockFormatCurrency,
    getCurrencySymbol: () => '$',
    displayCurrency: 'USD'
  })
}));

vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    transactions: mockTransactions,
    accounts: mockAccounts,
    budgets: mockBudgets,
    categories: mockCategories
  })
}));

// Mock alert
global.alert = vi.fn();

describe('ExcelExport', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(screen.getByText('Export to Excel')).toBeInTheDocument();
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
      
      expect(startDate.value).toBe(firstOfMonth.toISOString().split('T')[0]);
      expect(endDate.value).toBe(now.toISOString().split('T')[0]);
    });

    it('can change date range', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      const startDate = screen.getByLabelText('Start Date');
      fireEvent.change(startDate, { target: { value: '2024-01-01' } });
      
      expect((startDate as HTMLInputElement).value).toBe('2024-01-01');
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
      
      expect(options).toHaveLength(4);
      expect(options[0]).toHaveTextContent('No Grouping');
      expect(options[1]).toHaveTextContent('Group by Month');
      expect(options[2]).toHaveTextContent('Group by Category');
      expect(options[3]).toHaveTextContent('Group by Account');
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
      expect(screen.getByText('Highlight negative values')).toBeInTheDocument();
      expect(screen.getByText('Zebra striping')).toBeInTheDocument();
      expect(screen.getByText('Enable auto-filters')).toBeInTheDocument();
    });

    it('has formatting options checked by default', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      const highlightCheckbox = screen.getByRole('checkbox', { name: /Highlight negative values/i });
      const zebraCheckbox = screen.getByRole('checkbox', { name: /Zebra striping/i });
      const filterCheckbox = screen.getByRole('checkbox', { name: /Enable auto-filters/i });
      
      expect(highlightCheckbox).toBeChecked();
      expect(zebraCheckbox).toBeChecked();
      expect(filterCheckbox).toBeChecked();
    });

    it('can toggle formatting options', () => {
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      const zebraCheckbox = screen.getByRole('checkbox', { name: /Zebra striping/i });
      
      fireEvent.click(zebraCheckbox);
      expect(zebraCheckbox).not.toBeChecked();
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
      render(<ExcelExport isOpen={true} onClose={mockOnClose} />);
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
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
      
      // Mock import failure
      global.import = vi.fn(() => Promise.reject(new Error('Failed to load XLSX')));
      
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Failed to export Excel file. Please try again.');
      });
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
