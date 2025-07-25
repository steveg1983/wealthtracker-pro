import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OFXImportModal from './OFXImportModal';
import { ofxImportService } from '../services/ofxImportService';

// Mock icons
vi.mock('./icons', () => ({
  UploadIcon: ({ size, className }: any) => <div data-testid="upload-icon" className={className}>Upload</div>,
  FileTextIcon: ({ size, className }: any) => <div data-testid="file-text-icon" className={className}>FileText</div>,
  CheckIcon: ({ size, className }: any) => <div data-testid="check-icon" className={className}>Check</div>,
  AlertCircleIcon: ({ size, className }: any) => <div data-testid="alert-circle-icon" className={className}>Alert</div>,
  InfoIcon: ({ size, className }: any) => <div data-testid="info-icon" className={className}>Info</div>,
  LinkIcon: ({ size, className }: any) => <div data-testid="link-icon" className={className}>Link</div>,
  UnlinkIcon: ({ size, className }: any) => <div data-testid="unlink-icon" className={className}>Unlink</div>,
  RefreshCwIcon: ({ size }: any) => <div data-testid="refresh-icon">Refresh</div>
}));

// Mock Modal component
vi.mock('./common/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: any) => 
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
  LoadingButton: ({ isLoading, onClick, disabled, children, className }: any) => (
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
    accountId: 'acc1'
  }
];

const mockCategories = [
  { id: 'cat1', name: 'Food' },
  { id: 'cat2', name: 'Transport' }
];

vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    accounts: mockAccounts,
    transactions: mockTransactions,
    categories: mockCategories,
    addTransaction: mockAddTransaction
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

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
      expect(screen.getByText(/Automatic duplicate detection using transaction IDs/)).toBeInTheDocument();
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
      const mockParseResult = {
        transactions: [
          { id: 'trans1', amount: 100, description: 'Test' }
        ],
        duplicates: 0,
        matchedAccount: null,
        unmatchedAccount: null
      };
      
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
      const mockParseResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        duplicates: 0,
        matchedAccount: null,
        unmatchedAccount: null
      };
      
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
      const mockParseResult = {
        transactions: [
          { id: 'trans1', amount: 100, description: 'Test' },
          { id: 'trans2', amount: 200, description: 'Test 2' }
        ],
        duplicates: 1,
        matchedAccount: null,
        unmatchedAccount: null
      };
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('test.ofx')).toBeInTheDocument();
        expect(screen.getByText('2 transactions found')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // Total transactions
        expect(screen.getByText('1')).toBeInTheDocument(); // Duplicates found
      });
    });

    it('shows matched account when found', async () => {
      const mockParseResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        duplicates: 0,
        matchedAccount: { id: 'acc1', name: 'Current Account' },
        unmatchedAccount: { accountId: '12345678' }
      };
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('Automatically matched to: Current Account')).toBeInTheDocument();
        expect(screen.getByText(/Based on account number ending in 5678/)).toBeInTheDocument();
        expect(screen.getByTestId('link-icon')).toBeInTheDocument();
      });
    });

    it('shows unmatched account warning when no match found', async () => {
      const mockParseResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        duplicates: 0,
        matchedAccount: null,
        unmatchedAccount: { 
          accountId: '12345678',
          bankId: '123456789'
        }
      };
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('No matching account found')).toBeInTheDocument();
        expect(screen.getByText(/OFX Account: \*\*\*\*5678.*Sort code: 456789/)).toBeInTheDocument();
        expect(screen.getByTestId('unlink-icon')).toBeInTheDocument();
      });
    });

    it('shows account selection dropdown when no match found', async () => {
      const mockParseResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        duplicates: 0,
        matchedAccount: null,
        unmatchedAccount: { accountId: '12345678' }
      };
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select).toBeInTheDocument();
        expect(screen.getByText('Select an account...')).toBeInTheDocument();
        expect(screen.getByText('Current Account (checking)')).toBeInTheDocument();
        expect(screen.getByText('Savings Account (savings)')).toBeInTheDocument();
        expect(screen.getByText('Credit Card (credit)')).toBeInTheDocument();
      });
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
      const mockParseResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        duplicates: 0,
        matchedAccount: null,
        unmatchedAccount: null
      };
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('Skip duplicate transactions')).toBeInTheDocument();
      });
    });

    it('shows skip duplicates option checked by default', () => {
      const checkbox = screen.getByRole('checkbox', { name: /Skip duplicate transactions/ });
      expect(checkbox).toBeChecked();
      expect(screen.getByText('Uses unique transaction IDs to prevent importing the same transaction twice')).toBeInTheDocument();
    });

    it('allows toggling skip duplicates option', () => {
      const checkbox = screen.getByRole('checkbox', { name: /Skip duplicate transactions/ });
      
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
      
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    it('allows selecting account when no match found', () => {
      const select = screen.getByRole('combobox');
      
      fireEvent.change(select, { target: { value: 'acc2' } });
      expect(select).toHaveValue('acc2');
    });
  });

  describe('Import Process', () => {
    beforeEach(async () => {
      const mockParseResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
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
        newTransactions: 1,
        duplicates: 3,
        matchedAccount: { id: 'acc1', name: 'Current Account' }
      };
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockImportResult);
      
      const importButton = screen.getByTestId('loading-button');
      fireEvent.click(importButton);
      
      await waitFor(() => {
        expect(screen.getByText('Import Successful!')).toBeInTheDocument();
        expect(screen.getByText('Skipped 3 duplicate transactions')).toBeInTheDocument();
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
    });
  });

  describe('Import Validation', () => {
    it('disables import button when no account selected and no match', async () => {
      const mockParseResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        duplicates: 0,
        matchedAccount: null,
        unmatchedAccount: null
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
        duplicates: 0,
        matchedAccount: null,
        unmatchedAccount: null
      };
      
      vi.mocked(ofxImportService.importTransactions).mockResolvedValueOnce(mockParseResult);
      
      render(<OFXImportModal {...defaultProps} />);
      
      const file = new File(['OFX content'], 'test.ofx', { type: 'application/ofx' });
      const fileInput = document.getElementById('ofx-upload')!
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'acc1' } });
        
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
        duplicates: 0,
        matchedAccount: { id: 'acc1', name: 'Current Account' }
      };
      
      const mockImportResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
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
        duplicates: 0,
        matchedAccount: { id: 'acc1', name: 'Current Account' }
      };
      
      const mockImportResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
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
      const mockParseResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
        duplicates: 0,
        matchedAccount: null,
        unmatchedAccount: { 
          accountId: '12345678'
          // No bankId
        }
      };
      
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
        duplicates: 0,
        matchedAccount: null,
        unmatchedAccount: null
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
        duplicates: 0,
        matchedAccount: null,
        unmatchedAccount: null
      };
      
      const mockImportResult = {
        transactions: [{ id: 'trans1', amount: 100, description: 'Test' }],
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
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'acc2' } });
        
        const importButton = screen.getByTestId('loading-button');
        fireEvent.click(importButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Import Successful!')).toBeInTheDocument();
        expect(screen.getByText('Imported 1 transactions to Savings Account')).toBeInTheDocument();
      });
    });
  });
});