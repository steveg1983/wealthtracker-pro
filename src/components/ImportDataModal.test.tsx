/**
 * ImportDataModal Tests
 * Tests for the financial data import modal component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';
import '@testing-library/jest-dom';
import ImportDataModal from './ImportDataModal';

// Mock all icon components
vi.mock('./icons/UploadIcon', () => ({
  UploadIcon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="upload-icon" className={className} style={{ fontSize: size }}>📤</span>
  )
}));

vi.mock('./icons/FileTextIcon', () => ({
  FileTextIcon: ({ size }: { size?: number }) => (
    <span data-testid="file-text-icon" style={{ fontSize: size }}>📄</span>
  )
}));

vi.mock('./icons/AlertCircleIcon', () => ({
  AlertCircleIcon: ({ size }: { size?: number }) => (
    <span data-testid="alert-circle-icon" style={{ fontSize: size }}>⚠️</span>
  )
}));

vi.mock('./icons/CheckCircleIcon', () => ({
  CheckCircleIcon: ({ size }: { size?: number }) => (
    <span data-testid="check-circle-icon" style={{ fontSize: size }}>✅</span>
  )
}));

vi.mock('./icons/InfoIcon', () => ({
  InfoIcon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="info-icon" className={className} style={{ fontSize: size }}>ℹ️</span>
  )
}));

vi.mock('./icons/AlertTriangleIcon', () => ({
  AlertTriangleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="alert-triangle-icon" className={className} style={{ fontSize: size }}>⚠️</span>
  )
}));

// Mock X icon for Modal close button
vi.mock('./icons', () => ({
  X: ({ size }: { size?: number }) => <span data-testid="x-icon" style={{ fontSize: size }}>✕</span>,
}));

// Mock Modal components
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
  },
  ModalBody: ({ children }: any) => (
    <div data-testid="modal-body">{children}</div>
  ),
  ModalFooter: ({ children }: any) => (
    <div data-testid="modal-footer">{children}</div>
  )
}));

// Mock MnyMappingModal
vi.mock('./MnyMappingModal', () => ({
  default: ({ isOpen, onClose, rawData, onMappingComplete }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="mny-mapping-modal">
        <button onClick={onClose}>Close Mapping</button>
        <button onClick={() => onMappingComplete({
          date: 'Date',
          amount: 'Amount',
          description: 'Description',
          category: 'Category'
        }, rawData)}>Apply Mapping</button>
      </div>
    );
  }
}));

// Mock parsing utilities
const mockParseMNY = vi.fn();
const mockParseMBF = vi.fn();
const mockApplyMappingToData = vi.fn();

vi.mock('../utils/mnyParser', () => ({
  parseMNY: (buffer: ArrayBuffer) => mockParseMNY(buffer),
  parseMBF: (buffer: ArrayBuffer) => mockParseMBF(buffer),
  applyMappingToData: (data: any, mapping: any) => mockApplyMappingToData(data, mapping)
}));

const mockParseQIF = vi.fn();
vi.mock('../utils/qifParser', () => ({
  parseQIF: (content: string) => mockParseQIF(content)
}));

// Mock AppContext
const mockAddAccount = vi.fn();
const mockAddTransaction = vi.fn();
const mockClearAllData = vi.fn();
const mockAccounts = [
  { id: '1', name: 'Checking', type: 'current', balance: 1000, currency: 'GBP', isActive: true }
];

vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    addAccount: mockAddAccount,
    addTransaction: mockAddTransaction,
    accounts: mockAccounts,
    hasTestData: false,
    clearAllData: mockClearAllData
  })
}));

describe('ImportDataModal', () => {
  const mockOnClose = vi.fn();

  // Helper to create File objects with required methods
  const createFile = (content: string, name: string, type: string = 'text/plain') => {
    const file = new File([content], name, { type });
    file.text = vi.fn().mockResolvedValue(content);
    file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(content.length));
    return file;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Rendering', () => {
    it('does not render when closed', () => {
      render(<ImportDataModal isOpen={false} onClose={mockOnClose} />);
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
    });

    it('renders when open', () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Import Financial Data')).toBeInTheDocument();
    });

    it('shows supported formats information', () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByText(/QIF/)).toBeInTheDocument();
      expect(screen.getByText(/OFX/)).toBeInTheDocument();
      expect(screen.getByText(/MNY/)).toBeInTheDocument();
      expect(screen.getByText(/MBF/)).toBeInTheDocument();
    });

    it('shows Money file import info box', () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByText('Money File Import:')).toBeInTheDocument();
      expect(screen.getByText(/we'll show you the data/)).toBeInTheDocument();
    });
  });

  describe('File Upload', () => {
    it('shows upload area with icon', () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByTestId('upload-icon')).toBeInTheDocument();
      expect(screen.getByText('Choose File')).toBeInTheDocument();
      expect(screen.getByText('No file selected')).toBeInTheDocument();
    });

    it('accepts correct file types', () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]');
      expect(input).toHaveAttribute('accept', '.mny,.mbf,.qif,.ofx,.csv');
    });

    it('shows selected file name', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      mockParseQIF.mockResolvedValue({
        accounts: [],
        transactions: []
      });
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        expect(screen.getByText('test.qif')).toBeInTheDocument();
      });
    });

    it('shows parsing spinner while processing', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      // Make file.text take time to simulate slow file reading  
      file.text = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('content'), 50)));
      
      mockParseQIF.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({
        accounts: [],
        transactions: []
      }), 100)));
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      expect(screen.getByText('Parsing file...')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.queryByText('Parsing file...')).not.toBeInTheDocument();
      });
    });
  });

  describe('File Parsing', () => {
    it('parses QIF files', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = new File(['QIF content'], 'test.qif', { type: 'text/plain' });
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      mockParseQIF.mockResolvedValue({
        accounts: [{ name: 'Test Account', type: 'checking', balance: 1000 }],
        transactions: [{ date: new Date(), amount: 100, description: 'Test', type: 'income', category: 'Other' }]
      });
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        expect(mockParseQIF).toHaveBeenCalledWith('QIF content');
        expect(screen.getByText('Found 1 accounts and 1 transactions')).toBeInTheDocument();
      });
    });

    it('parses OFX files', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const ofxContent = `
        <OFX>
          <ACCTID>12345</ACCTID>
          <ACCTTYPE>CHECKING</ACCTTYPE>
          <BALAMT>1000.00</BALAMT>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20240115</DTPOSTED>
            <TRNAMT>-50.00</TRNAMT>
            <NAME>Store Purchase</NAME>
          </STMTTRN>
        </OFX>
      `;
      
      const file = createFile(ofxContent, 'test.ofx');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        expect(screen.getByText('Found 1 accounts and 1 transactions')).toBeInTheDocument();
      });
    });

    it('handles MNY files with mapping', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('binary content', 'test.mny', 'application/octet-stream');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      mockParseMNY.mockResolvedValue({
        accounts: [],
        transactions: [],
        needsMapping: true,
        rawData: [{ col1: 'data1', col2: 'data2' }]
      });
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        expect(screen.getByTestId('mny-mapping-modal')).toBeInTheDocument();
      });
    });

    it('handles parsing errors', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('invalid content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      mockParseQIF.mockRejectedValue(new Error('Invalid QIF format'));
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        expect(screen.getByText('Invalid QIF format')).toBeInTheDocument();
        expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
      });
    });

    it('rejects unsupported file formats', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.txt');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        expect(screen.getByText(/Unsupported file format/)).toBeInTheDocument();
      });
    });
  });

  describe('Preview Display', () => {
    it('shows account and transaction counts', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      mockParseQIF.mockResolvedValue({
        accounts: [
          { name: 'Checking', type: 'checking', balance: 1000 },
          { name: 'Savings', type: 'savings', balance: 5000 }
        ],
        transactions: Array(10).fill({ 
          date: new Date(), 
          amount: 100, 
          description: 'Test', 
          type: 'income', 
          category: 'Other' 
        })
      });
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // accounts count
        expect(screen.getByText('10')).toBeInTheDocument(); // transactions count
      });
    });

    it('shows account details in preview', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      mockParseQIF.mockResolvedValue({
        accounts: [
          { name: 'My Checking', type: 'checking', balance: 1000 },
          { name: 'My Savings', type: 'savings', balance: 5000 }
        ],
        transactions: []
      });
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        expect(screen.getByText(/My Checking \(checking\)/)).toBeInTheDocument();
        expect(screen.getByText(/My Savings \(savings\)/)).toBeInTheDocument();
      });
    });

    it('truncates long account lists', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      mockParseQIF.mockResolvedValue({
        accounts: Array(10).fill(null).map((_, i) => ({ 
          name: `Account ${i}`, 
          type: 'checking', 
          balance: 1000 
        })),
        transactions: []
      });
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        expect(screen.getByText(/Account 0/)).toBeInTheDocument();
        expect(screen.getByText(/and 5 more/)).toBeInTheDocument();
      });
    });

    it('shows date range for transactions', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      mockParseQIF.mockResolvedValue({
        accounts: [],
        transactions: [
          { date: new Date('2024-01-01'), amount: 100, description: 'First', type: 'income', category: 'Other' },
          { date: new Date('2024-12-31'), amount: 200, description: 'Last', type: 'expense', category: 'Other' }
        ]
      });
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        expect(screen.getByText(/Date range:/)).toBeInTheDocument();
        expect(screen.getByText(/1\/1\/2024/)).toBeInTheDocument();
        expect(screen.getByText(/12\/31\/2024/)).toBeInTheDocument();
      });
    });
  });

  describe('Import Functionality', () => {
    it('enables import button when data is ready', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      mockParseQIF.mockResolvedValue({
        accounts: [{ name: 'Test', type: 'checking', balance: 1000 }],
        transactions: []
      });
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        const importButton = screen.getByText('Import Data');
        expect(importButton).not.toHaveClass('cursor-not-allowed');
      });
    });

    it('disables import button without data', () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const importButton = screen.getByText('Import Data');
      expect(importButton).toHaveClass('cursor-not-allowed');
      expect(importButton.parentElement).toBeDisabled();
    });

    it('imports accounts and transactions', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      mockParseQIF.mockResolvedValue({
        accounts: [{ name: 'New Account', type: 'checking', balance: 1000 }],
        transactions: [
          { date: new Date(), amount: 100, description: 'Test', type: 'income', category: 'Other' }
        ]
      });
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        expect(screen.getByText('Import Data')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Import Data'));
      
      await waitFor(() => {
        expect(mockAddAccount).toHaveBeenCalledWith({
          name: 'New Account',
          type: 'current',
          balance: 1000,
          currency: 'GBP',
          institution: 'Imported',
          lastUpdated: expect.any(Date)
        });
        expect(mockAddTransaction).toHaveBeenCalledTimes(1);
      });
    });

    it('shows success message after import', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      mockParseQIF.mockResolvedValue({
        accounts: [{ name: 'Test', type: 'checking', balance: 1000 }],
        transactions: []
      });
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Import Data'));
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Successfully imported/)).toBeInTheDocument();
        expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
      });
    });

    it('skips existing accounts', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      mockParseQIF.mockResolvedValue({
        accounts: [{ name: 'Checking', type: 'checking', balance: 2000 }], // Same name as existing
        transactions: []
      });
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Import Data'));
      });
      
      await waitFor(() => {
        expect(mockAddAccount).not.toHaveBeenCalled();
      });
    });
  });

  describe('Test Data Warning', () => {
    it('shows warning when test data exists', async () => {
      const { rerender } = render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      // Simulate having test data
      vi.mocked(vi.fn()).mockImplementation(() => ({
        useApp: () => ({
          addAccount: mockAddAccount,
          addTransaction: mockAddTransaction,
          accounts: mockAccounts,
          hasTestData: true,
          clearAllData: mockClearAllData
        })
      }));
      
      rerender(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      mockParseQIF.mockResolvedValue({
        accounts: [{ name: 'Test', type: 'checking', balance: 1000 }],
        transactions: []
      });
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Import Data'));
      });
      
      await waitFor(() => {
        expect(screen.getByText('Test Data Detected')).toBeInTheDocument();
      });
    });
  });

  describe('MNY Mapping', () => {
    it('shows mapping modal for MNY files', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('binary', 'test.mny', 'application/octet-stream');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      mockParseMNY.mockResolvedValue({
        accounts: [],
        transactions: [],
        needsMapping: true,
        rawData: [{ col1: 'data' }]
      });
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        expect(screen.getByTestId('mny-mapping-modal')).toBeInTheDocument();
      });
    });

    it('applies mapping when complete', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('binary', 'test.mny', 'application/octet-stream');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      mockParseMNY.mockResolvedValue({
        accounts: [],
        transactions: [],
        needsMapping: true,
        rawData: [{ col1: 'data' }]
      });
      
      mockApplyMappingToData.mockReturnValue({
        accounts: [{ name: 'Mapped Account', type: 'checking', balance: 1000 }],
        transactions: []
      });
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        expect(screen.getByTestId('mny-mapping-modal')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Apply Mapping'));
      
      await waitFor(() => {
        expect(mockApplyMappingToData).toHaveBeenCalled();
        expect(screen.getByText(/Mapped 1 accounts/)).toBeInTheDocument();
      });
    });
  });

  describe('Modal Actions', () => {
    it('calls onClose when cancel clicked', () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      fireEvent.click(screen.getByText('Cancel'));
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('closes modal after successful import', async () => {
      vi.useFakeTimers();
      
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]')!;
      
      mockParseQIF.mockResolvedValue({
        accounts: [{ name: 'Test', type: 'checking', balance: 1000 }],
        transactions: []
      });
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Import Data'));
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Successfully imported/)).toBeInTheDocument();
      });
      
      // Fast-forward the 2000ms setTimeout for closing the modal
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });
      
      expect(mockOnClose).toHaveBeenCalled();
      
      vi.useRealTimers();
    });
  });

  describe('Accessibility', () => {
    it('has accessible modal structure', () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'modal-title');
    });

    it('has accessible file input', () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
    });

    it('has accessible buttons', () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });
});