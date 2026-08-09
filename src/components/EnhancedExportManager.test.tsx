/**
 * Advanced Export — what the file actually contains.
 *
 * The three template cards with no generate branch (Tax Summary, Investment
 * Performance, Net Worth Statement) are gone; what is left is asserted here to
 * write category NAMES, no fake Balance column, quoted CSV, and Decimal money.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PreferencesProvider } from '../contexts/PreferencesContext';
import { ToastProvider } from '../contexts/ToastContext';
import { __setAppContextValue, __resetAppContextValue } from '../test/mocks/AppContextSupabase';
import type { Account, Budget, Category, Transaction } from '../types';

const mockWriteFile = vi.fn();
const mockAoaToSheet = vi.fn((rows: unknown[][]) => ({ rows }));
const mockBookNew = vi.fn(() => ({}));
const mockBookAppendSheet = vi.fn();

vi.mock('xlsx', () => ({
  utils: {
    book_new: mockBookNew,
    aoa_to_sheet: mockAoaToSheet,
    book_append_sheet: mockBookAppendSheet
  },
  writeFile: mockWriteFile
}));

const accounts: Account[] = [
  {
    id: 'acc-1',
    name: 'Everyday, Account',
    type: 'current',
    balance: 100,
    currency: 'GBP',
    lastUpdated: new Date('2025-03-01')
  }
];

const categories: Category[] = [
  { id: 'cat-spending', name: 'Spending', type: 'expense', level: 'sub' },
  { id: 'cat-food', name: 'Food', type: 'expense', level: 'detail', parentId: 'cat-spending' }
];

// 0.1 + 0.2 in floats is 0.30000000000000004. In money it is 30p.
const transactions: Transaction[] = [
  {
    id: 'tx-1',
    date: new Date(),
    amount: -0.1,
    description: 'Corner shop',
    category: 'cat-food',
    accountId: 'acc-1',
    type: 'expense'
  },
  {
    id: 'tx-2',
    date: new Date(),
    amount: -0.2,
    description: 'Market',
    category: 'cat-food',
    accountId: 'acc-1',
    type: 'expense'
  }
];

const budgets: Budget[] = [
  {
    id: 'b-1',
    categoryId: 'cat-food',
    amount: 50,
    period: 'monthly',
    isActive: true,
    spent: 0,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01')
  }
];

const capturedDownloads: string[] = [];

describe('EnhancedExportManager', () => {
  let EnhancedExportManager: typeof import('./EnhancedExportManager').default;

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedDownloads.length = 0;
    __setAppContextValue({ accounts, transactions, transactionSplits: [], budgets, categories });
    ({ default: EnhancedExportManager } = await import('./EnhancedExportManager'));

    // Capture the file's text instead of asking jsdom to download it: jsdom's
    // Blob has no text() to read it back with.
    vi.stubGlobal('Blob', vi.fn((parts: unknown[]) => {
      capturedDownloads.push(String(parts[0]));
      return { type: 'text/csv' };
    }));
    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    __resetAppContextValue();
  });

  const open = (): void => {
    render(
      <PreferencesProvider>
        <ToastProvider>
          <EnhancedExportManager />
        </ToastProvider>
      </PreferencesProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /Advanced Export/i }));
  };

  describe('templates', () => {
    it('offers only the reports it can generate', () => {
      open();

      expect(screen.getByText('Monthly Statement')).toBeInTheDocument();
      expect(screen.getByText('Budget Analysis')).toBeInTheDocument();
      // Each of these was a card whose reportType had no branch: choosing one
      // produced a PDF with a title, a summary, and nothing else.
      expect(screen.queryByText('Tax Summary')).not.toBeInTheDocument();
      expect(screen.queryByText('Investment Performance')).not.toBeInTheDocument();
      expect(screen.queryByText('Net Worth Statement')).not.toBeInTheDocument();
    });

    it('does not offer options that no generator reads', () => {
      open();

      expect(screen.queryByText(/Include charts/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Include transaction notes/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeInTheDocument();
    });
  });

  describe('Excel', () => {
    const exportExcel = async (): Promise<unknown[][]> => {
      open();
      fireEvent.click(screen.getByText('Excel'));
      fireEvent.click(screen.getByRole('button', { name: /^Export$/i }));

      await waitFor(() => {
        expect(mockWriteFile).toHaveBeenCalled();
      });

      return mockAoaToSheet.mock.calls.map(call => call[0]).flat();
    };

    it('writes category NAMES, never ids', async () => {
      const rows = await exportExcel();
      const cells = JSON.stringify(rows);

      expect(cells).toContain('Spending : Food');
      expect(cells).not.toContain('cat-food');
    });

    /**
     * The Transactions sheet used to carry a Balance column whose every row
     * was a literal 0, with a comment saying the running balance would be
     * worked out "in production". A column of zeros in a financial export is
     * worse than no column: nothing tells the reader it is not their balance.
     */
    it('has no Balance column rather than a column of zeros', async () => {
      const rows = await exportExcel();
      const header = rows.find(row => Array.isArray(row) && row[0] === 'Date');

      expect(header).toEqual(['Date', 'Description', 'Category', 'Account', 'Amount', 'Type']);
    });

    it('totals the period in Decimal', async () => {
      const rows = await exportExcel();
      const expensesRow = rows.find(row => Array.isArray(row) && row[0] === 'Total Expenses:');

      // Float addition of 0.1 and 0.2 gives 0.30000000000000004.
      expect(expensesRow?.[1]).toBe(0.3);
    });
  });

  describe('CSV', () => {
    it('quotes every field, so a comma in a name cannot shift a column', async () => {
      open();
      fireEvent.click(screen.getByText('CSV'));
      fireEvent.click(screen.getByRole('button', { name: /^Export$/i }));

      await waitFor(() => {
        expect(capturedDownloads).toHaveLength(1);
      });

      const [header, firstRow] = capturedDownloads[0].split('\n');

      expect(header).toBe('"Date","Description","Category","Account","Amount","Type"');
      // The account name contains a comma; it stays in one column.
      expect(firstRow).toContain('"Everyday, Account"');
      expect(firstRow).toContain('"Spending : Food"');
      expect(firstRow?.split('","')).toHaveLength(header.split('","').length);
    });
  });

  describe('failures', () => {
    /**
     * A failed export used to reach console.error and nowhere else: the
     * spinner stopped, no file appeared, and nothing was said.
     */
    it('tells the user when the export fails', async () => {
      mockWriteFile.mockImplementationOnce(() => {
        throw new Error('The disk said no.');
      });

      open();
      fireEvent.click(screen.getByText('Excel'));
      fireEvent.click(screen.getByRole('button', { name: /^Export$/i }));

      expect(await screen.findByText(/The disk said no\./)).toBeInTheDocument();
    });
  });
});
