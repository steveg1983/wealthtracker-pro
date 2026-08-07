import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BatchImportModal from './BatchImportModal';
import { ofxImportService } from '../services/ofxImportService';
import type { Account } from '../types';

// Mock services
vi.mock('../services/enhancedCsvImportService', () => ({
  enhancedCsvImportService: {
    parseCSV: vi.fn(() => ({ headers: ['Date', 'Amount', 'Description'], data: [] })),
    suggestMappings: vi.fn(() => ({})),
    generatePreview: vi.fn(() => ({ transactions: [] }))
  }
}));

vi.mock('../services/ofxImportService', () => ({
  ofxImportService: {
    parseOFX: vi.fn(() => ({ accounts: [], transactions: [] })),
    importTransactions: vi.fn()
  }
}));

vi.mock('../services/qifImportService', () => ({
  qifImportService: {
    parseQIF: vi.fn(() => ({ 
      primaryAccount: { transactions: [] }, 
      otherAccounts: []
    }))
  }
}));

// Mock Modal component
vi.mock('./common/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: any) => 
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="Close modal">Close</button>
        {children}
      </div>
    ) : null,
}));

// Mock LoadingButton
vi.mock('./loading/LoadingState', () => ({
  LoadingButton: ({ loading, children, ...props }: any) => (
    <button {...props} disabled={loading}>
      {loading ? 'Processing...' : children}
    </button>
  )
}));

// Mock icons
vi.mock('./icons', () => ({
  UploadIcon: () => <div>Upload</div>,
  FileTextIcon: () => <div>File</div>,
  CheckIcon: () => <div>Check</div>,
  XIcon: () => <div>X</div>,
  AlertCircleIcon: () => <div>Alert</div>,
  ChevronRightIcon: () => <div>›</div>,
  ChevronLeftIcon: () => <div>‹</div>,
  FolderIcon: () => <div>Folder</div>,
  PlayIcon: () => <div>Play</div>,
  StopIcon: () => <div>Stop</div>,
}));

// Mock useApp hook
const mockAddTransaction = vi.fn();
const mockUpdateAccount = vi.fn();
const mockBatchAccount: Account = {
  id: 'acc1',
  name: 'Checking',
  type: 'checking',
  balance: 1000,
  currency: 'USD',
  lastUpdated: new Date('2026-01-01'),
};

vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: vi.fn(() => ({
    accounts: [mockBatchAccount],
    transactions: [],
    addTransaction: mockAddTransaction,
    updateAccount: mockUpdateAccount,
  })),
}));

describe('BatchImportModal (Simplified)', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open', () => {
    render(<BatchImportModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Batch Import Files')).toBeInTheDocument();
  });

  it('shows drop zone initially', () => {
    render(<BatchImportModal {...defaultProps} />);
    expect(screen.getByText('Drop files here or click to browse')).toBeInTheDocument();
  });

  it('accepts CSV files', async () => {
    render(<BatchImportModal {...defaultProps} />);
    
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText('test.csv')).toBeInTheDocument();
    });
  });

  it('shows file type and size', async () => {
    render(<BatchImportModal {...defaultProps} />);
    
    const file = new File(['x'.repeat(1024)], 'test.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'size', { value: 1024 });
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText('test.csv')).toBeInTheDocument();
      expect(screen.getByText(/CSV/)).toBeInTheDocument();
    });
  });

  it('rejects unsupported files', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<BatchImportModal {...defaultProps} />);
    
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    fireEvent.change(input, { target: { files: [file] } });
    
    expect(alertSpy).toHaveBeenCalledWith('Unsupported file types: test.txt');
    alertSpy.mockRestore();
  });

  it('shows import button when files selected', async () => {
    render(<BatchImportModal {...defaultProps} />);
    
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText('Import All Files')).toBeInTheDocument();
    });
  });

  it('accepts multiple file types', async () => {
    render(<BatchImportModal {...defaultProps} />);
    
    const files = [
      new File([''], 'test.csv', { type: 'text/csv' }),
      new File([''], 'test.ofx', { type: 'application/x-ofx' }),
      new File([''], 'test.qif', { type: 'application/qif' })
    ];
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files } });
    
    await waitFor(() => {
      expect(screen.getByText('test.csv')).toBeInTheDocument();
      expect(screen.getByText('test.ofx')).toBeInTheDocument();
      expect(screen.getByText('test.qif')).toBeInTheDocument();
    });
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<BatchImportModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Close modal'));
    expect(onClose).toHaveBeenCalled();
  });

  /**
   * This screen never asks which account an OFX file belongs to: files are
   * matched automatically and the result is a list of counts. So the statement
   * balance is only written when the FILE named the account — the account's
   * own recorded sort code / account number being the one in the file — and
   * never on a name-and-type guess nobody is there to check.
   */
  describe('Setting the Bank Balance from a statement', () => {
    type ImportResult = Awaited<ReturnType<typeof ofxImportService.importTransactions>>;

    const importResult = (overrides: Partial<ImportResult> = {}): ImportResult => ({
      transactions: [],
      matchedAccount: mockBatchAccount,
      ofxAccount: {
        accountId: '12345678',
        bankId: '123456',
        accountType: 'CHECKING',
        isCreditCardStatement: false,
      },
      matchConfidence: 'identifier',
      statementBalance: { amount: 5000, dateAsOf: '2026-03-31' },
      duplicates: 0,
      newTransactions: 0,
      ...overrides,
    });

    const importOfxFile = async (result: ImportResult): Promise<void> => {
      vi.mocked(ofxImportService.importTransactions).mockResolvedValue(result);

      render(<BatchImportModal {...defaultProps} />);

      const file = new File([''], 'statement.ofx', { type: 'application/x-ofx' });
      // jsdom's File has no usable text() in this environment.
      file.text = vi.fn().mockResolvedValue('OFX content');

      fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
        target: { files: [file] }
      });
      await waitFor(() => {
        expect(screen.getByText('Import All Files')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Import All Files'));
      await waitFor(() => {
        expect(screen.getByText(/Import Complete/)).toBeInTheDocument();
      });
    };

    it('sets the Bank Balance when the file named the account itself', async () => {
      await importOfxFile(importResult());

      expect(mockUpdateAccount).toHaveBeenCalledWith('acc1', {
        bankBalance: 5000,
        bankBalanceDate: '2026-03-31'
      });
    });

    it('never writes `balance` — that is the ledger, not the bank\'s figure', async () => {
      await importOfxFile(importResult());

      const written = mockUpdateAccount.mock.calls.flatMap(([, updates]) => Object.keys(updates));
      expect(written).not.toContain('balance');
    });

    it('will not set a Bank Balance on an account it merely guessed', async () => {
      await importOfxFile(importResult({ matchConfidence: 'heuristic' }));

      expect(mockUpdateAccount).not.toHaveBeenCalled();
    });

    it('does nothing when the file states no closing balance', async () => {
      await importOfxFile(importResult({ statementBalance: undefined }));

      expect(mockUpdateAccount).not.toHaveBeenCalled();
    });
  });
});
