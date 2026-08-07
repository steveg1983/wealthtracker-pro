/**
 * ImportDataModal Tests
 * Tests for the financial data import modal component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import ImportDataModal from './ImportDataModal';
import { useApp } from '../contexts/AppContextSupabase';
import { parseMNY, parseMBF, applyMappingToData } from '../utils/mnyParser';
import { parseQIF } from '../utils/qifParser';
import type { Account, Transaction } from '../types';

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
vi.mock('../utils/mnyParser', () => ({
  parseMNY: vi.fn(),
  parseMBF: vi.fn(),
  applyMappingToData: vi.fn()
}));

vi.mock('../utils/qifParser', () => ({
  parseQIF: vi.fn()
}));

// Mock AppContext
const mockAddAccount = vi.fn();
const mockAddTransaction = vi.fn();
const mockAccounts: Account[] = [
  {
    id: '1',
    name: 'Checking',
    type: 'current',
    balance: 1000,
    currency: 'GBP',
    isActive: true,
    lastUpdated: new Date('2024-01-01')
  }
];
/** The register the importer checks incoming rows against. */
let mockTransactions: Transaction[] = [];

type AppContextValue = ReturnType<typeof useApp>;

/**
 * A stand-in for the app context that implements only the slice this modal
 * touches. Asserted to the full type once, here, rather than at every call
 * site — the modal reads five of its sixty-odd members and supplying the rest
 * would say nothing about the import.
 */
const appContextDouble = (slice: Partial<AppContextValue>): AppContextValue =>
  ({ ...slice }) as AppContextValue;

vi.mock('../contexts/AppContextSupabase', () => ({
  useApp: vi.fn()
}));

describe('ImportDataModal', () => {
  const mockOnClose = vi.fn();

  // Helper to create File objects with required methods
  const createFile = (content: string, name: string, type: string = 'text/plain') => {
    const file = new File([content], name, { type });
    // Mock the text method
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue(content),
      writable: true
    });
    // Mock the arrayBuffer method
    Object.defineProperty(file, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(content.length)),
      writable: true
    });
    return file;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransactions = [];
    // addAccount's real contract is Promise<Account>: the modal awaits the
    // created account and uses its id to route imported transactions.
    mockAddAccount.mockImplementation(async (account: { name: string }) => ({
      id: `created-${account.name}`,
      ...account
    }));
    // Set default return values for mocks
    vi.mocked(parseQIF).mockReturnValue({
      accounts: [],
      transactions: []
    });
    vi.mocked(parseMNY).mockResolvedValue({
      accounts: [],
      transactions: []
    });
    vi.mocked(parseMBF).mockResolvedValue({
      accounts: [],
      transactions: []
    });
    // Set default mock for useApp. The OFX path reads the register and the
    // category tree too — it is the shared importer, which recognises rows the
    // user already holds and files what it can. Read at CALL time, so a test
    // can seed the register before rendering.
    vi.mocked(useApp).mockImplementation(() => appContextDouble({
      addAccount: mockAddAccount,
      addTransaction: mockAddTransaction,
      accounts: mockAccounts,
      transactions: mockTransactions,
      categories: []
    }));
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
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
      vi.mocked(parseQIF).mockReturnValue({
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
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Make file.text take time to simulate slow file reading  
      Object.defineProperty(file, 'text', {
        value: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('content'), 50))),
        writable: true
      });
      
      vi.mocked(parseQIF).mockReturnValue({
        accounts: [],
        transactions: []
      });
      
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
      // Set up the parseQIF mock before rendering
      vi.mocked(parseQIF).mockReturnValue({
        accounts: [{ name: 'Test Account', type: 'checking', balance: 1000 }],
        transactions: [{ date: new Date(), amount: 100, description: 'Test', type: 'income', category: 'Other' }]
      });
      
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('QIF content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        expect(vi.mocked(parseQIF)).toHaveBeenCalledWith('QIF content');
        expect(screen.getByText('Found 1 accounts and 1 transactions')).toBeInTheDocument();
      });
    });

    /**
     * OFX now goes through ofxImportService — the one OFX reader the app has —
     * rather than a second parser that lived in this component and had drifted
     * away from it. These cover what routing it back through the service
     * bought, and what it must not have cost.
     */
    const ofxStatement = (rows: string, ledger = '1000.00') => `
      OFXHEADER:100
      <OFX>
        <BANKMSGSRSV1><STMTTRNRS><STMTRS>
          <BANKACCTFROM>
            <BANKID>112233</BANKID>
            <ACCTID>99887766</ACCTID>
            <ACCTTYPE>CHECKING</ACCTTYPE>
          </BANKACCTFROM>
          <BANKTRANLIST>${rows}</BANKTRANLIST>
          <LEDGERBAL><BALAMT>${ledger}</BALAMT><DTASOF>20240131</DTASOF></LEDGERBAL>
        </STMTRS></STMTTRNRS></BANKMSGSRSV1>
      </OFX>
    `;

    const uploadOfx = async (content: string) => {
      const file = createFile(content, 'statement.ofx');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: [file], writable: false });
      fireEvent.change(input);
    };

    it('parses OFX files', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);

      await uploadOfx(ofxStatement(`
        <STMTTRN>
          <TRNTYPE>DEBIT</TRNTYPE>
          <DTPOSTED>20240115</DTPOSTED>
          <TRNAMT>-50.00</TRNAMT>
          <FITID>SEQ-0001</FITID>
          <NAME>Store Purchase</NAME>
        </STMTTRN>
      `));

      await waitFor(() => {
        expect(screen.getByText('Found 1 accounts and 1 transactions')).toBeInTheDocument();
      });

      // SIGNED CONVENTION: the OFX debit (-50.00) must reach addTransaction as a
      // signed-negative expense, not a positive magnitude, so the ledger's raw
      // balance sum subtracts it.
      fireEvent.click(screen.getByText('Import Data'));

      await waitFor(() => {
        expect(mockAddTransaction).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'expense', amount: -50.00 })
        );
      });
    });

    it('describes a row the way the shared OFX reader does', async () => {
      // Two things the in-file parser got wrong. It preferred <NAME>, so a row
      // whose memo says what the payment WAS came in as the bank's generic
      // channel label ("CARD PAYMENT"). And on an empty <MEMO></MEMO> the
      // shared reader must return '' rather than falling through to a
      // line-terminated read that captures the literal text "</MEMO>".
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);

      await uploadOfx(ofxStatement(`
        <STMTTRN>
          <TRNTYPE>DEBIT</TRNTYPE>
          <DTPOSTED>20240115</DTPOSTED>
          <TRNAMT>-12.00</TRNAMT>
          <FITID>SEQ-0002</FITID>
          <NAME>CARD PAYMENT</NAME>
          <MEMO>Corner Shop</MEMO>
        </STMTTRN>
        <STMTTRN>
          <TRNTYPE>DEBIT</TRNTYPE>
          <DTPOSTED>20240116</DTPOSTED>
          <TRNAMT>-3.20</TRNAMT>
          <FITID>SEQ-0009</FITID>
          <NAME>Newsagent</NAME>
          <MEMO></MEMO>
        </STMTTRN>
      `));

      await waitFor(() => {
        expect(screen.getByText(/Found 1 accounts and 2 transactions/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Import Data'));

      await waitFor(() => {
        expect(mockAddTransaction).toHaveBeenCalledTimes(2);
      });
      const descriptions = mockAddTransaction.mock.calls.map(call => call[0].description);
      expect(descriptions).toEqual(['Corner Shop', 'Newsagent']);
      expect(descriptions).not.toContain('</MEMO>');
      expect(descriptions).not.toContain('CARD PAYMENT');
    });

    it('leaves out a row the register already holds', async () => {
      // Same account, same day, same amount — importing it again is the same
      // payment twice. The old in-file parser checked for nothing at all.
      mockTransactions = [
        {
          id: 'existing-1',
          accountId: '1',
          date: new Date(2024, 0, 15),
          amount: -50,
          type: 'expense',
          description: 'Store Purchase',
          category: '',
          notes: 'FITID: SEQ-0001'
        }
      ];

      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);

      await uploadOfx(ofxStatement(`
        <STMTTRN>
          <TRNTYPE>DEBIT</TRNTYPE>
          <DTPOSTED>20240115</DTPOSTED>
          <TRNAMT>-50.00</TRNAMT>
          <FITID>SEQ-0001</FITID>
          <NAME>Store Purchase</NAME>
        </STMTTRN>
        <STMTTRN>
          <TRNTYPE>DEBIT</TRNTYPE>
          <DTPOSTED>20240116</DTPOSTED>
          <TRNAMT>-8.40</TRNAMT>
          <FITID>SEQ-0003</FITID>
          <NAME>Coffee Stand</NAME>
        </STMTTRN>
      `));

      await waitFor(() => {
        expect(screen.getByText(/1 already in this account, left out/)).toBeInTheDocument();
      });
      // And the note before the button says so rather than the opposite.
      expect(screen.getByText(/will not record the same payment twice/)).toBeInTheDocument();

      fireEvent.click(screen.getByText('Import Data'));

      await waitFor(() => {
        expect(mockAddTransaction).toHaveBeenCalledTimes(1);
      });
      expect(mockAddTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Coffee Stand' })
      );
    });

    it('files an OFX row as uncategorised rather than filing it under "DEBIT"', async () => {
      // The old in-file parser put the OFX TRNTYPE into the category field, so
      // every imported row was filed under a category id that does not exist.
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);

      await uploadOfx(ofxStatement(`
        <STMTTRN>
          <TRNTYPE>DEBIT</TRNTYPE>
          <DTPOSTED>20240115</DTPOSTED>
          <TRNAMT>-50.00</TRNAMT>
          <FITID>SEQ-0004</FITID>
          <NAME>Store Purchase</NAME>
        </STMTTRN>
      `));

      await waitFor(() => {
        expect(screen.getByText(/Found 1 accounts/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Import Data'));

      await waitFor(() => {
        expect(mockAddTransaction).toHaveBeenCalledTimes(1);
      });
      const imported = mockAddTransaction.mock.calls[0][0];
      expect(imported.category).not.toBe('DEBIT');
      expect(imported.category).toBe('');
      // The bank's own order within the statement survives the import.
      expect(imported.statementSequence).toBe(0);
    });

    it('routes the statement to the account it matched instead of inventing one', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);

      await uploadOfx(ofxStatement(`
        <STMTTRN>
          <TRNTYPE>DEBIT</TRNTYPE>
          <DTPOSTED>20240115</DTPOSTED>
          <TRNAMT>-50.00</TRNAMT>
          <FITID>SEQ-0005</FITID>
          <NAME>Store Purchase</NAME>
        </STMTTRN>
      `));

      await waitFor(() => {
        expect(screen.getByText(/Found 1 accounts/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Import Data'));

      await waitFor(() => {
        expect(mockAddTransaction).toHaveBeenCalledWith(
          expect.objectContaining({ accountId: '1' })
        );
      });
      expect(mockAddAccount).not.toHaveBeenCalled();
    });

    it('still creates the account a statement describes when nothing matches it', async () => {
      // The Legacy Import's reason to exist: bring a file in whether or not the
      // account is already there.
      vi.mocked(useApp).mockReturnValue(appContextDouble({
        addAccount: mockAddAccount,
        addTransaction: mockAddTransaction,
        accounts: [],
        transactions: [],
        categories: []
      }));
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);

      await uploadOfx(ofxStatement(`
        <STMTTRN>
          <TRNTYPE>DEBIT</TRNTYPE>
          <DTPOSTED>20240115</DTPOSTED>
          <TRNAMT>-50.00</TRNAMT>
          <FITID>SEQ-0006</FITID>
          <NAME>Store Purchase</NAME>
        </STMTTRN>
      `));

      await waitFor(() => {
        expect(screen.getByText(/Found 1 accounts/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Import Data'));

      await waitFor(() => {
        expect(mockAddAccount).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Account 99887766', type: 'current', balance: 1000 })
        );
      });
      expect(mockAddTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: 'created-Account 99887766' })
      );
    });

    it('survives a row it cannot read instead of losing the whole statement', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);

      // `new Decimal('N/A')` THROWS. Reading TRNAMT through it would have cost
      // the user every transaction in the file over one malformed tag.
      await uploadOfx(ofxStatement(`
        <STMTTRN>
          <TRNTYPE>DEBIT</TRNTYPE>
          <DTPOSTED>20240115</DTPOSTED>
          <TRNAMT>-50.00</TRNAMT>
          <FITID>SEQ-0007</FITID>
          <NAME>Store Purchase</NAME>
        </STMTTRN>
        <STMTTRN>
          <TRNTYPE>DEBIT</TRNTYPE>
          <DTPOSTED>20240116</DTPOSTED>
          <TRNAMT>N/A</TRNAMT>
          <FITID>SEQ-0008</FITID>
          <NAME>Corrupt Row</NAME>
        </STMTTRN>
      `));

      // The lost row is named for its consequence, not merely counted.
      await waitFor(() => {
        expect(
          screen.getByText('One row in this file could not be read and will be missing from the register.')
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Import Data'));

      await waitFor(() => {
        expect(mockAddTransaction).toHaveBeenCalledTimes(1);
        expect(mockAddTransaction).toHaveBeenCalledWith(
          expect.objectContaining({ description: 'Store Purchase', amount: -50.00 })
        );
      });
      // No NaN amount may ever reach the ledger.
      const amounts = mockAddTransaction.mock.calls.map(call => call[0].amount);
      expect(amounts.some(Number.isNaN)).toBe(false);
    });

    it('handles MNY files with mapping', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('binary content', 'test.mny', 'application/octet-stream');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
      vi.mocked(parseMNY).mockResolvedValue({
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
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
      vi.mocked(parseQIF).mockImplementation(() => {
        throw new Error('Invalid QIF format');
      });
      
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
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
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
      // Set up mock before rendering
      vi.mocked(parseQIF).mockReturnValue({
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
      
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
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
      // Set up mock before rendering
      vi.mocked(parseQIF).mockReturnValue({
        accounts: [
          { name: 'My Checking', type: 'checking', balance: 1000 },
          { name: 'My Savings', type: 'savings', balance: 5000 }
        ],
        transactions: []
      });
      
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
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
      // Set up mock before rendering
      vi.mocked(parseQIF).mockReturnValue({
        accounts: Array(10).fill(null).map((_, i) => ({ 
          name: `Account ${i}`, 
          type: 'checking', 
          balance: 1000 
        })),
        transactions: []
      });
      
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
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
      // Set up mock before rendering
      vi.mocked(parseQIF).mockReturnValue({
        accounts: [],
        transactions: [
          { date: new Date('2024-01-01'), amount: 100, description: 'First', type: 'income', category: 'Other' },
          { date: new Date('2024-12-31'), amount: 200, description: 'Last', type: 'expense', category: 'Other' }
        ]
      });
      
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
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
      // Set up mock before rendering
      vi.mocked(parseQIF).mockReturnValue({
        accounts: [{ name: 'Test', type: 'checking', balance: 1000 }],
        transactions: []
      });
      
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
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
      
      // The button element is the one containing "Import Data" text
      const importButton = screen.getByText('Import Data').closest('button');
      expect(importButton).toBeDisabled();
      expect(importButton).toHaveClass('cursor-not-allowed');
    });

    it('imports accounts and transactions', async () => {
      // Set up mock before rendering
      vi.mocked(parseQIF).mockReturnValue({
        accounts: [{ name: 'New Account', type: 'checking', balance: 1000 }],
        transactions: [
          { date: new Date(), amount: 100, description: 'Test', type: 'income', category: 'Other' }
        ]
      });
      
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
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

    it('routes each transaction to its parser-resolved account, not accounts[0]', async () => {
      // 'Checking' already exists (id '1'); 'Holiday Savings' is new and gets
      // the id returned by addAccount. Writing everything to accounts[0]
      // double-counts multi-account imports.
      vi.mocked(parseQIF).mockReturnValue({
        accounts: [
          { name: 'Checking', type: 'checking', balance: 1000 },
          { name: 'Holiday Savings', type: 'savings', balance: 5000 }
        ],
        transactions: [
          { date: new Date('2024-01-05'), amount: -25, description: 'Groceries', type: 'expense', category: 'Food', accountName: 'Checking' },
          { date: new Date('2024-01-06'), amount: 100, description: 'Interest', type: 'income', category: 'Other', accountName: 'Holiday Savings' },
          { date: new Date('2024-01-07'), amount: 10, description: 'Orphan', type: 'income', category: 'Other' }
        ]
      });

      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);

      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(input);

      await waitFor(() => {
        const importButton = screen.getByText('Import Data').closest('button');
        expect(importButton).not.toBeDisabled();
      });

      fireEvent.click(screen.getByText('Import Data'));

      await waitFor(() => {
        // Only the new account is created.
        expect(mockAddAccount).toHaveBeenCalledTimes(1);
        expect(mockAddTransaction).toHaveBeenCalledTimes(3);
        // Existing account resolved to its real id.
        expect(mockAddTransaction).toHaveBeenCalledWith(
          expect.objectContaining({ description: 'Groceries', accountId: '1' })
        );
        // New account resolved to the id addAccount returned.
        expect(mockAddTransaction).toHaveBeenCalledWith(
          expect.objectContaining({ description: 'Interest', accountId: 'created-Holiday Savings' })
        );
        // Unresolvable transaction falls back to the first account.
        expect(mockAddTransaction).toHaveBeenCalledWith(
          expect.objectContaining({ description: 'Orphan', accountId: '1' })
        );
      });

      // The parser-internal accountName field must not leak into the ledger payload.
      expect(mockAddTransaction).not.toHaveBeenCalledWith(
        expect.objectContaining({ accountName: expect.anything() })
      );
    });

    it('shows success message after import', async () => {
      // Set up mock before rendering
      vi.mocked(parseQIF).mockReturnValue({
        accounts: [{ name: 'Test', type: 'checking', balance: 1000 }],
        transactions: []
      });
      
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      // Wait for the import button to be enabled
      await waitFor(() => {
        const importButton = screen.getByText('Import Data').closest('button');
        expect(importButton).not.toBeDisabled();
      });
      
      // Click the import button
      fireEvent.click(screen.getByText('Import Data'));
      
      // Wait for success message
      await waitFor(() => {
        expect(screen.getByText(/Successfully imported/)).toBeInTheDocument();
        expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();
      });
    });

    it('skips existing accounts', async () => {
      // Set up mock before rendering
      vi.mocked(parseQIF).mockReturnValue({
        accounts: [{ name: 'Checking', type: 'checking', balance: 2000 }], // Same name as existing
        transactions: []
      });
      
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
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

  describe('MNY Mapping', () => {
    it('shows mapping modal for MNY files', async () => {
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('binary', 'test.mny', 'application/octet-stream');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
      vi.mocked(parseMNY).mockResolvedValue({
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
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
      vi.mocked(parseMNY).mockResolvedValue({
        accounts: [],
        transactions: [],
        needsMapping: true,
        rawData: [{ col1: 'data' }]
      });
      
      vi.mocked(applyMappingToData).mockReturnValue({
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
        expect(vi.mocked(applyMappingToData)).toHaveBeenCalled();
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
      // Set up mock before rendering
      vi.mocked(parseQIF).mockReturnValue({
        accounts: [{ name: 'Test', type: 'checking', balance: 1000 }],
        transactions: []
      });
      
      render(<ImportDataModal isOpen={true} onClose={mockOnClose} />);
      
      const file = createFile('content', 'test.qif');
      const input = screen.getByText('Choose File').parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
      
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      
      fireEvent.change(input);
      
      // Wait for the import button to be enabled
      await waitFor(() => {
        const importButton = screen.getByText('Import Data').closest('button');
        expect(importButton).not.toBeDisabled();
      });
      
      // Click the import button
      fireEvent.click(screen.getByText('Import Data'));
      
      // Wait for success message which appears after import
      await waitFor(() => {
        expect(screen.getByText(/Successfully imported/)).toBeInTheDocument();
      });
      
      // The modal closes after 2 seconds, so wait for that
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      }, { timeout: 3000 });
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
