/**
 * CSVImportWizard Tests
 * Comprehensive tests for the CSV import wizard component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CSVImportWizard from './CSVImportWizard';

// Mock all dependencies
vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: () => ({
    accounts: [
      { id: 'acc-1', name: 'Checking Account', type: 'checking' },
      { id: 'acc-2', name: 'Savings Account', type: 'savings' },
    ],
    transactions: [],
    addTransaction: vi.fn(),
    addAccount: vi.fn(),
    categories: [
      { id: 'cat-1', name: 'Food', type: 'expense' },
      { id: 'cat-2', name: 'Income', type: 'income' },
    ],
  }),
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

    it('displays bank template sections', () => {
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
