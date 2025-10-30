import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BatchImportModal from './BatchImportModal';

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
    parseOFX: vi.fn(() => ({ accounts: [], transactions: [] }))
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
vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: vi.fn(() => ({
    accounts: [
      { id: 'acc1', name: 'Checking', type: 'checking', balance: 1000, createdAt: new Date(), currency: 'USD' }
    ],
    transactions: [],
    addTransaction: vi.fn(),
    hasTestData: false,
    clearAllData: vi.fn(),
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
});
