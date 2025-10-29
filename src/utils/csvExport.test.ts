/**
 * CSV Export Tests
 * Tests for CSV export utilities for transactions and accounts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exportTransactionsToCSV, exportAccountsToCSV, downloadCSV } from './csvExport';
import { toDecimal } from './decimal';
import type { Transaction, Account } from '../types';
import type { DecimalTransaction, DecimalAccount } from '../types/decimal-types';

describe('CSV Export', () => {
  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      date: new Date('2024-01-15'),
      description: 'Grocery Store',
      category: 'groceries',
      type: 'expense',
      amount: 45.50,
      accountId: 'acc-1',
      tags: ['food', 'essential'],
      notes: 'Weekly shopping',
      cleared: true
    },
    {
      id: 'tx-2', 
      date: new Date('2024-01-16'),
      description: 'Salary',
      category: 'income',
      type: 'income',
      amount: 2500.00,
      accountId: 'acc-2',
      tags: undefined,
      notes: undefined,
      cleared: false
    },
    {
      id: 'tx-3',
      date: new Date('2024-01-17'),
      description: 'Coffee, Main Street',
      category: 'dining',
      type: 'expense',
      amount: 4.25,
      accountId: 'acc-1',
      tags: ['coffee'],
      notes: 'Morning "coffee"',
      cleared: true
    }
  ];

  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      name: 'Checking Account',
      type: 'current',
      balance: 1500.75,
      currency: 'GBP',
      institution: 'HSBC',
      lastUpdated: new Date('2024-01-20')
    },
    {
      id: 'acc-2',
      name: 'Savings, High Interest',
      type: 'savings',
      balance: 5000.00,
      currency: 'USD',
      institution: 'Bank "Premier" Ltd',
      lastUpdated: new Date('2024-01-19')
    },
    {
      id: 'acc-3',
      name: 'Credit Card',
      type: 'credit',
      balance: -250.50,
      currency: undefined,
      institution: undefined,
      lastUpdated: new Date('2024-01-18')
    }
  ];

  describe('exportTransactionsToCSV', () => {
    it('exports basic transactions correctly', () => {
      const csv = exportTransactionsToCSV(mockTransactions, mockAccounts);
      const lines = csv.split('\n');
      
      expect(lines[0]).toBe('Date,Description,Category,Type,Amount,Account,Tags,Notes,Cleared');
      expect(lines[1]).toBe('2024-01-15,Grocery Store,groceries,expense,45.50,Checking Account,food;essential,Weekly shopping,Y');
      expect(lines[2]).toBe('2024-01-16,Salary,income,income,2500.00,"Savings, High Interest",,,N');
      expect(lines[3]).toBe('2024-01-17,"Coffee, Main Street",dining,expense,4.25,Checking Account,coffee,"Morning ""coffee""",Y');
    });

    it('handles transactions with decimal amounts', () => {
      const decimalTransactions: DecimalTransaction[] = [
        {
          id: 'tx-1',
          date: new Date('2024-01-15'),
          description: 'Test Transaction',
          category: 'test',
          type: 'expense',
          amount: toDecimal(123.456),
          accountId: 'acc-1',
          cleared: false
        }
      ];

      const csv = exportTransactionsToCSV(decimalTransactions, mockAccounts);
      const lines = csv.split('\n');
      
      expect(lines[1]).toContain('123.46'); // Should round to 2 decimal places
    });

    it('handles missing account references gracefully', () => {
      const transactionsWithMissingAccount: Transaction[] = [
        {
          id: 'tx-1',
          date: new Date('2024-01-15'),
          description: 'Orphaned Transaction',
          category: 'other',
          type: 'expense',
          amount: 100.00,
          accountId: 'non-existent-account',
          cleared: false
        }
      ];

      const csv = exportTransactionsToCSV(transactionsWithMissingAccount, mockAccounts);
      const lines = csv.split('\n');
      
      expect(lines[1]).toContain('Unknown'); // Should use 'Unknown' for missing account
    });

    it('formats dates consistently', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-1',
          date: new Date('2024-12-31T23:59:59.999Z'),
          description: 'New Year Transaction',
          category: 'celebration',
          type: 'expense',
          amount: 100.00,
          accountId: 'acc-1',
          cleared: false
        }
      ];

      const csv = exportTransactionsToCSV(transactions, mockAccounts);
      const lines = csv.split('\n');
      
      expect(lines[1]).toMatch(/^2024-12-31,/); // Should format as YYYY-MM-DD
    });

    it('handles empty transactions array', () => {
      const csv = exportTransactionsToCSV([], mockAccounts);
      const lines = csv.split('\n');
      
      expect(lines.length).toBe(1); // Only headers
      expect(lines[0]).toBe('Date,Description,Category,Type,Amount,Account,Tags,Notes,Cleared');
    });

    it('handles transactions with no optional fields', () => {
      const minimalTransaction: Transaction = {
        id: 'tx-1',
        date: new Date('2024-01-15'),
        description: 'Minimal Transaction',
        category: 'other',
        type: 'expense',
        amount: 50.00,
        accountId: 'acc-1',
        cleared: false
      };

      const csv = exportTransactionsToCSV([minimalTransaction], mockAccounts);
      const lines = csv.split('\n');
      
      expect(lines[1]).toBe('2024-01-15,Minimal Transaction,other,expense,50.00,Checking Account,,,N');
    });

    it('escapes CSV special characters correctly', () => {
      const specialCharTransactions: Transaction[] = [
        {
          id: 'tx-1',
          date: new Date('2024-01-15'),
          description: 'Transaction with, commas',
          category: 'test',
          type: 'expense',
          amount: 100.00,
          accountId: 'acc-1',
          notes: 'Notes with\nnewlines',
          cleared: false
        },
        {
          id: 'tx-2',
          date: new Date('2024-01-16'),
          description: 'Transaction with "quotes"',
          category: 'test',
          type: 'expense',
          amount: 200.00,
          accountId: 'acc-1',
          notes: 'Quote: "Hello World"',
          cleared: false
        }
      ];

      const csv = exportTransactionsToCSV(specialCharTransactions, mockAccounts);
      
      // Check that special characters are properly escaped
      expect(csv).toContain('"Transaction with, commas"');
      expect(csv).toContain('"Notes with\nnewlines"');
      expect(csv).toContain('"Transaction with ""quotes"""');
      expect(csv).toContain('"Quote: ""Hello World"""');
    });

    it('formats amounts with consistent decimal places', () => {
      const amountVariations: Transaction[] = [
        {
          id: 'tx-1',
          date: new Date('2024-01-15'),
          description: 'Whole number amount',
          category: 'test',
          type: 'expense',
          amount: 100,
          accountId: 'acc-1',
          cleared: false
        },
        {
          id: 'tx-2', 
          date: new Date('2024-01-16'),
          description: 'Single decimal',
          category: 'test',
          type: 'expense',
          amount: 50.5,
          accountId: 'acc-1',
          cleared: false
        },
        {
          id: 'tx-3',
          date: new Date('2024-01-17'),
          description: 'Multiple decimals',
          category: 'test',
          type: 'expense', 
          amount: 25.123,
          accountId: 'acc-1',
          cleared: false
        }
      ];

      const csv = exportTransactionsToCSV(amountVariations, mockAccounts);
      const lines = csv.split('\n');
      
      expect(lines[1]).toContain('100.00');
      expect(lines[2]).toContain('50.50');
      expect(lines[3]).toContain('25.12'); // Should round to 2 decimal places
    });

    it('handles large transaction lists efficiently', () => {
      // Generate a large number of transactions
      const largeTransactionList: Transaction[] = [];
      for (let i = 0; i < 1000; i++) {
        largeTransactionList.push({
          id: `tx-${i}`,
          date: new Date('2024-01-15'),
          description: `Transaction ${i}`,
          category: 'test',
          type: 'expense',
          amount: i + 0.99,
          accountId: 'acc-1',
          cleared: i % 2 === 0
        });
      }

      const startTime = Date.now();
      const csv = exportTransactionsToCSV(largeTransactionList, mockAccounts);
      const endTime = Date.now();
      
      const lines = csv.split('\n');
      expect(lines.length).toBe(1001); // 1000 transactions + header
      expect(endTime - startTime).toBeLessThan(500); // Should be reasonably fast
    });
  });

  describe('exportAccountsToCSV', () => {
    it('exports basic accounts correctly', () => {
      const csv = exportAccountsToCSV(mockAccounts);
      const lines = csv.split('\n');
      
      expect(lines[0]).toBe('Name,Type,Balance,Currency,Institution,Last Updated');
      expect(lines[1]).toBe('Checking Account,current,1500.75,GBP,HSBC,2024-01-20');
      expect(lines[2]).toBe('"Savings, High Interest",savings,5000.00,USD,"Bank ""Premier"" Ltd",2024-01-19');
      expect(lines[3]).toBe('Credit Card,credit,-250.50,GBP,,2024-01-18');
    });

    it('handles accounts with decimal balances', () => {
      const decimalAccounts: DecimalAccount[] = [
        {
          id: 'acc-1',
          name: 'Test Account',
          type: 'current',
          balance: toDecimal(1234.567),
          currency: 'GBP',
          lastUpdated: new Date('2024-01-20')
        }
      ];

      const csv = exportAccountsToCSV(decimalAccounts);
      const lines = csv.split('\n');
      
      expect(lines[1]).toContain('1234.57'); // Should round to 2 decimal places
    });

    it('uses default values for missing optional fields', () => {
      const minimalAccount: Account = {
        id: 'acc-1',
        name: 'Minimal Account',
        type: 'current',
        balance: 1000.00,
        lastUpdated: new Date('2024-01-20')
      };

      const csv = exportAccountsToCSV([minimalAccount]);
      const lines = csv.split('\n');
      
      expect(lines[1]).toBe('Minimal Account,current,1000.00,GBP,,2024-01-20');
    });

    it('handles empty accounts array', () => {
      const csv = exportAccountsToCSV([]);
      const lines = csv.split('\n');
      
      expect(lines.length).toBe(1); // Only headers
      expect(lines[0]).toBe('Name,Type,Balance,Currency,Institution,Last Updated');
    });

    it('escapes CSV special characters in account data', () => {
      const specialCharAccounts: Account[] = [
        {
          id: 'acc-1',
          name: 'Account, with comma',
          type: 'current',
          balance: 1000.00,
          currency: 'GBP',
          institution: 'Bank\nwith newline',
          lastUpdated: new Date('2024-01-20')
        },
        {
          id: 'acc-2',
          name: 'Account with "quotes"',
          type: 'savings',
          balance: 2000.00,
          currency: 'USD',
          institution: 'Institution "Premium" Branch',
          lastUpdated: new Date('2024-01-19')
        }
      ];

      const csv = exportAccountsToCSV(specialCharAccounts);
      
      // Check that special characters are properly escaped
      expect(csv).toContain('"Account, with comma"');
      expect(csv).toContain('"Bank\nwith newline"');
      expect(csv).toContain('"Account with ""quotes"""');
      expect(csv).toContain('"Institution ""Premium"" Branch"');
    });

    it('formats balances with consistent decimal places', () => {
      const balanceVariations: Account[] = [
        {
          id: 'acc-1',
          name: 'Whole Balance',
          type: 'current',
          balance: 1000,
          lastUpdated: new Date('2024-01-20')
        },
        {
          id: 'acc-2',
          name: 'Single Decimal',
          type: 'savings',
          balance: 500.5,
          lastUpdated: new Date('2024-01-20')
        },
        {
          id: 'acc-3',
          name: 'Multiple Decimals',
          type: 'investment',
          balance: 750.123,
          lastUpdated: new Date('2024-01-20')
        }
      ];

      const csv = exportAccountsToCSV(balanceVariations);
      const lines = csv.split('\n');
      
      expect(lines[1]).toContain('1000.00');
      expect(lines[2]).toContain('500.50');
      expect(lines[3]).toContain('750.12'); // Should round to 2 decimal places
    });

    it('formats dates consistently', () => {
      const accounts: Account[] = [
        {
          id: 'acc-1',
          name: 'Test Account',
          type: 'current',
          balance: 1000.00,
          lastUpdated: new Date('2024-12-31T23:59:59.999Z')
        }
      ];

      const csv = exportAccountsToCSV(accounts);
      const lines = csv.split('\n');
      
      expect(lines[1]).toMatch(/2024-12-31$/); // Should format as YYYY-MM-DD
    });
  });

  describe('downloadCSV', () => {
    let mockCreateObjectURL: any;
    let mockRevokeObjectURL: any;
    let mockDocument: any;
    let mockLink: any;

    beforeEach(() => {
      // Mock Blob constructor
      global.Blob = vi.fn((content, options) => ({
        size: content[0].length,
        type: options.type
      })) as any;

      // Mock URL methods
      mockCreateObjectURL = vi.fn(() => 'mock-blob-url');
      mockRevokeObjectURL = vi.fn();
      global.URL = {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL
      } as any;

      // Mock DOM elements
      mockLink = {
        setAttribute: vi.fn(),
        click: vi.fn(),
        style: {}
      };

      mockDocument = {
        createElement: vi.fn(() => mockLink),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn()
        }
      };

      global.document = mockDocument as any;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('creates and downloads a CSV file', () => {
      const content = 'Name,Value\nTest,123';
      const filename = 'test-export.csv';

      downloadCSV(content, filename);

      // Check that blob is created correctly
      expect(global.Blob).toHaveBeenCalledWith([content], { type: 'text/csv;charset=utf-8;' });
      
      // Check that object URL is created
      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Object));
      
      // Check that link element is created and configured
      expect(mockDocument.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'mock-blob-url');
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', filename);
      expect(mockLink.style.visibility).toBe('hidden');
      
      // Check that link is added to DOM, clicked, and removed
      expect(mockDocument.body.appendChild).toHaveBeenCalledWith(mockLink);
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockDocument.body.removeChild).toHaveBeenCalledWith(mockLink);
      
      // Check that URL is revoked
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('mock-blob-url');
    });

    it('handles empty content', () => {
      const content = '';
      const filename = 'empty-export.csv';

      expect(() => downloadCSV(content, filename)).not.toThrow();
      
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('handles special characters in filename', () => {
      const content = 'test content';
      const filename = 'export with spaces & symbols.csv';

      downloadCSV(content, filename);

      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', filename);
    });

    it('handles large CSV content', () => {
      // Create a large CSV content
      const largeContent = Array(10000).fill('line,data,content').join('\n');
      const filename = 'large-export.csv';

      expect(() => downloadCSV(largeContent, filename)).not.toThrow();
      
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('integration tests', () => {
    it('exports and formats complex data correctly', () => {
      const complexTransactions: Transaction[] = [
        {
          id: 'tx-1',
          date: new Date('2024-01-15T10:30:00Z'),
          description: 'Complex "Transaction" with, special characters\nand newlines',
          category: 'mixed/category',
          type: 'expense',
          amount: 1234.567,
          accountId: 'acc-1',
          tags: ['tag1', 'tag,with,commas', 'tag"with"quotes'],
          notes: 'Notes with\nmultiple\nlines and "quotes"',
          cleared: true
        }
      ];

      const complexAccounts: Account[] = [
        {
          id: 'acc-1',
          name: 'Complex "Account" Name, with special chars',
          type: 'current',
          balance: 9876.543,
          currency: 'GBP',
          institution: 'Institution\nwith\nnewlines and "quotes"',
          lastUpdated: new Date('2024-01-20T15:45:30Z')
        }
      ];

      const csv = exportTransactionsToCSV(complexTransactions, complexAccounts);
      
      // Should properly escape and format all special characters
      expect(csv).toContain('"Complex ""Transaction"" with, special characters\nand newlines"');
      expect(csv).toContain('"tag1;tag,with,commas;tag""with""quotes"');
      expect(csv).toContain('"Notes with\nmultiple\nlines and ""quotes"""');
      expect(csv).toContain('1234.57'); // Proper decimal formatting
      expect(csv).toContain('2024-01-15'); // Proper date formatting
    });

    it('maintains data integrity in round-trip scenarios', () => {
      const originalTransactions = mockTransactions;
      const originalAccounts = mockAccounts;

      const csv = exportTransactionsToCSV(originalTransactions, originalAccounts);
      const lines = csv.split('\n');
      
      // Verify all original transactions are represented
      expect(lines.length).toBe(originalTransactions.length + 1); // +1 for header
      
      // Verify data integrity by checking key fields
      originalTransactions.forEach((tx, index) => {
        const line = lines[index + 1]; // +1 to skip header
        const account = originalAccounts.find(a => a.id === tx.accountId);
        
        expect(line).toContain(tx.description);
        expect(line).toContain(tx.category);
        expect(line).toContain(tx.type);
        expect(line).toContain(tx.amount.toFixed(2));
        expect(line).toContain(account?.name || 'Unknown');
        expect(line).toContain(tx.cleared ? 'Y' : 'N');
      });
    });
  });
});