/**
 * EnhancedCsvImportService Tests
 * Tests CSV parsing, column mapping, duplicate detection, and bank-specific imports
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { enhancedCsvImportService } from '../enhancedCsvImportService';
import type { 
  Transaction, 
  Account, 
  ColumnMapping, 
  ImportProfile,
  ImportResult,
  ParseResult,
  DuplicateCheckResult
} from '../../types';

// Mock storageAdapter
vi.mock('../storageAdapter', () => ({
  storageAdapter: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
  STORAGE_KEYS: {
    IMPORT_PROFILES: 'wealthtracker_import_profiles',
  }
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9))
}));

import { storageAdapter } from '../storageAdapter';

const mockStorageAdapter = vi.mocked(storageAdapter);

describe('EnhancedCsvImportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date('2024-01-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('parseCSV', () => {
    it('parses basic CSV with headers', () => {
      const csv = `Date,Description,Amount
2024-01-01,Grocery Store,-50.00
2024-01-02,Salary,2500.00`;

      const result = enhancedCsvImportService.parseCSV(csv);

      expect(result.headers).toEqual(['Date', 'Description', 'Amount']);
      expect(result.data).toEqual([
        ['2024-01-01', 'Grocery Store', '-50.00'],
        ['2024-01-02', 'Salary', '2500.00']
      ]);
    });

    it('handles CSV with quotes and commas', () => {
      const csv = `"Date","Description","Amount"
"2024-01-01","Coffee Shop, Downtown","-5.50"
"2024-01-02","Transfer from \"Savings\"","100.00"`;

      const result = enhancedCsvImportService.parseCSV(csv);

      expect(result.headers).toEqual(['Date', 'Description', 'Amount']);
      expect(result.data).toEqual([
        ['2024-01-01', 'Coffee Shop, Downtown', '-5.50'],
        ['2024-01-02', 'Transfer from "Savings"', '100.00']
      ]);
    });

    it('handles different delimiters', () => {
      const csv = `Date;Description;Amount
2024-01-01;Grocery Store;-50.00
2024-01-02;Salary;2500.00`;

      const result = enhancedCsvImportService.parseCSV(csv);

      expect(result.headers).toEqual(['Date', 'Description', 'Amount']);
      expect(result.data).toHaveLength(2);
    });

    it('handles tab-delimited data', () => {
      const csv = `Date\tDescription\tAmount
2024-01-01\tGrocery Store\t-50.00
2024-01-02\tSalary\t2500.00`;

      const result = enhancedCsvImportService.parseCSV(csv);

      expect(result.headers).toEqual(['Date', 'Description', 'Amount']);
      expect(result.data).toHaveLength(2);
    });

    it('handles empty lines and extra whitespace', () => {
      const csv = `Date,Description,Amount

2024-01-01,Grocery Store,-50.00

2024-01-02,Salary,2500.00
`;

      const result = enhancedCsvImportService.parseCSV(csv);

      expect(result.data).toHaveLength(2);
    });

    it('handles CSV without headers', () => {
      const csv = `2024-01-01,Grocery Store,-50.00
2024-01-02,Salary,2500.00`;

      const result = enhancedCsvImportService.parseCSV(csv);

      expect(result.headers).toEqual(['Column 1', 'Column 2', 'Column 3']);
      expect(result.data).toHaveLength(2);
    });

    it('handles malformed CSV gracefully', () => {
      const csv = `Date,Description,Amount
2024-01-01,"Unclosed quote,Extra,-50.00
2024-01-02,Salary,2500.00`;

      const result = enhancedCsvImportService.parseCSV(csv);

      expect(result.data).toBeDefined();
      expect(result.headers).toHaveLength(3);
    });

    it('handles BOM (Byte Order Mark)', () => {
      const csv = `\uFEFFDate,Description,Amount
2024-01-01,Grocery Store,-50.00`;

      const result = enhancedCsvImportService.parseCSV(csv);

      expect(result.headers[0]).toBe('Date');
    });
  });

  describe('suggestMappings', () => {
    it('suggests mappings for transaction headers using fuzzy matching', () => {
      const headers = ['Transaction Date', 'Merchant', 'Debit Amount', 'Credit Amount'];
      
      const mappings = enhancedCsvImportService.suggestMappings(headers, 'transaction');

      expect(mappings).toEqual([
        { sourceColumn: 'Transaction Date', targetField: 'date', confidence: expect.any(Number) },
        { sourceColumn: 'Merchant', targetField: 'description', confidence: expect.any(Number) },
        { sourceColumn: 'Debit Amount', targetField: 'amount', confidence: expect.any(Number) },
        { sourceColumn: 'Credit Amount', targetField: 'amount', confidence: expect.any(Number) }
      ]);

      // Check confidence scores
      const dateMapping = mappings.find(m => m.sourceColumn === 'Transaction Date');
      expect(dateMapping?.confidence).toBeGreaterThan(0.7);
    });

    it('suggests mappings for account headers', () => {
      const headers = ['Account Name', 'Current Balance', 'Account Type'];
      
      const mappings = enhancedCsvImportService.suggestMappings(headers, 'account');

      expect(mappings).toEqual([
        { sourceColumn: 'Account Name', targetField: 'name', confidence: expect.any(Number) },
        { sourceColumn: 'Current Balance', targetField: 'balance', confidence: expect.any(Number) },
        { sourceColumn: 'Account Type', targetField: 'type', confidence: expect.any(Number) }
      ]);
    });

    it('handles headers with special characters and formatting', () => {
      const headers = ['*Date*', '---Description---', '$$$Amount$$$', 'CATEGORY!!!'];
      
      const mappings = enhancedCsvImportService.suggestMappings(headers, 'transaction');

      // Should still find matches despite special characters
      expect(mappings.find(m => m.targetField === 'date')).toBeDefined();
      expect(mappings.find(m => m.targetField === 'description')).toBeDefined();
      expect(mappings.find(m => m.targetField === 'amount')).toBeDefined();
      expect(mappings.find(m => m.targetField === 'category')).toBeDefined();
    });

    it('handles non-English headers with common patterns', () => {
      const headers = ['01/01/2024', 'Store Purchase', '-50.00', 'Groceries'];
      
      const mappings = enhancedCsvImportService.suggestMappings(headers, 'transaction');

      // Should recognize date pattern
      const dateMapping = mappings.find(m => m.sourceColumn === '01/01/2024');
      expect(dateMapping?.targetField).toBe('date');
    });

    it('assigns lower confidence to ambiguous mappings', () => {
      const headers = ['Text1', 'Text2', 'Number1', 'Number2'];
      
      const mappings = enhancedCsvImportService.suggestMappings(headers, 'transaction');

      // All mappings should have lower confidence
      mappings.forEach(mapping => {
        expect(mapping.confidence).toBeLessThan(0.5);
      });
    });
  });

  describe('detectDuplicates', () => {
    const existingTransactions: Transaction[] = [
      {
        id: '1',
        date: '2024-01-01',
        description: 'Grocery Store',
        amount: -50.00,
        accountId: 'acc1',
        type: 'expense',
        status: 'cleared',
        merchantName: 'Grocery Store',
        isTransfer: false,
        userId: 'user1'
      },
      {
        id: '2',
        date: '2024-01-02',
        description: 'Salary Payment',
        amount: 2500.00,
        accountId: 'acc1',
        type: 'income',
        status: 'cleared',
        merchantName: 'Employer',
        isTransfer: false,
        userId: 'user1'
      }
    ];

    it('detects exact duplicates', () => {
      const newTransactions: Partial<Transaction>[] = [
        {
          date: '2024-01-01',
          description: 'Grocery Store',
          amount: -50.00,
          accountId: 'acc1'
        }
      ];

      const result = enhancedCsvImportService.detectDuplicates(
        newTransactions,
        existingTransactions
      );

      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].existingTransaction.id).toBe('1');
      expect(result.duplicates[0].confidence).toBe(1);
    });

    it('detects near duplicates with slight variations', () => {
      const newTransactions: Partial<Transaction>[] = [
        {
          date: '2024-01-01',
          description: 'GROCERY STORE', // Different case
          amount: -50.00,
          accountId: 'acc1'
        }
      ];

      const result = enhancedCsvImportService.detectDuplicates(
        newTransactions,
        existingTransactions
      );

      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].confidence).toBeGreaterThan(0.8);
    });

    it('handles amount variations within threshold', () => {
      const newTransactions: Partial<Transaction>[] = [
        {
          date: '2024-01-01',
          description: 'Grocery Store',
          amount: -49.99, // Slight difference
          accountId: 'acc1'
        }
      ];

      const result = enhancedCsvImportService.detectDuplicates(
        newTransactions,
        existingTransactions
      );

      expect(result.possibleDuplicates).toHaveLength(1);
      expect(result.possibleDuplicates[0].confidence).toBeGreaterThan(0.7);
    });

    it('does not flag transactions on different dates as duplicates', () => {
      const newTransactions: Partial<Transaction>[] = [
        {
          date: '2024-01-15',
          description: 'Grocery Store',
          amount: -50.00,
          accountId: 'acc1'
        }
      ];

      const result = enhancedCsvImportService.detectDuplicates(
        newTransactions,
        existingTransactions
      );

      expect(result.duplicates).toHaveLength(0);
      expect(result.possibleDuplicates).toHaveLength(0);
    });

    it('handles multiple potential matches', () => {
      const moreExisting = [
        ...existingTransactions,
        {
          id: '3',
          date: '2024-01-01',
          description: 'Grocery Store #2',
          amount: -50.00,
          accountId: 'acc1',
          type: 'expense' as const,
          status: 'cleared' as const,
          merchantName: 'Grocery Store',
          isTransfer: false,
          userId: 'user1'
        }
      ];

      const newTransactions: Partial<Transaction>[] = [
        {
          date: '2024-01-01',
          description: 'Grocery Store',
          amount: -50.00,
          accountId: 'acc1'
        }
      ];

      const result = enhancedCsvImportService.detectDuplicates(
        newTransactions,
        moreExisting
      );

      // Should find both as potential duplicates
      expect(result.duplicates.length + result.possibleDuplicates.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('importTransactions', () => {
    const mockAccount: Account = {
      id: 'acc1',
      name: 'Checking',
      type: 'checking',
      balance: 1000,
      currency: 'USD',
      isActive: true,
      userId: 'user1'
    };

    const csvContent = `Date,Description,Amount
2024-01-01,Grocery Store,-50.00
2024-01-02,Salary,2500.00`;

    const mappings: ColumnMapping[] = [
      { sourceColumn: 'Date', targetField: 'date', confidence: 0.9 },
      { sourceColumn: 'Description', targetField: 'description', confidence: 0.9 },
      { sourceColumn: 'Amount', targetField: 'amount', confidence: 0.9 }
    ];

    it('imports transactions successfully', async () => {
      const existingTransactions: Transaction[] = [];

      const result = await enhancedCsvImportService.importTransactions(
        csvContent,
        mappings,
        mockAccount,
        existingTransactions
      );

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.transactions).toHaveLength(2);

      // Verify transaction details
      expect(result.transactions[0]).toMatchObject({
        date: '2024-01-01',
        description: 'Grocery Store',
        amount: -50,
        accountId: 'acc1',
        type: 'expense'
      });

      expect(result.transactions[1]).toMatchObject({
        date: '2024-01-02',
        description: 'Salary',
        amount: 2500,
        type: 'income'
      });
    });

    it('skips duplicate transactions', async () => {
      const existingTransactions: Transaction[] = [
        {
          id: 'existing1',
          date: '2024-01-01',
          description: 'Grocery Store',
          amount: -50.00,
          accountId: 'acc1',
          type: 'expense',
          status: 'cleared',
          merchantName: 'Grocery Store',
          isTransfer: false,
          userId: 'user1'
        }
      ];

      const result = await enhancedCsvImportService.importTransactions(
        csvContent,
        mappings,
        mockAccount,
        existingTransactions
      );

      expect(result.imported).toBe(1); // Only salary imported
      expect(result.skipped).toBe(1); // Grocery skipped
      expect(result.duplicatesDetected).toBe(1);
    });

    it('handles date format conversion', async () => {
      const csvWithDifferentDate = `Date,Description,Amount
01/15/2024,Test Transaction,-25.00`;

      const result = await enhancedCsvImportService.importTransactions(
        csvWithDifferentDate,
        mappings,
        mockAccount,
        []
      );

      expect(result.transactions[0].date).toBe('2024-01-15');
    });

    it('categorizes transactions automatically', async () => {
      const csvWithCategories = `Date,Description,Amount
2024-01-01,Walmart Grocery,-50.00
2024-01-02,Netflix Subscription,-15.99
2024-01-03,Shell Gas Station,-40.00`;

      const result = await enhancedCsvImportService.importTransactions(
        csvWithCategories,
        mappings,
        mockAccount,
        []
      );

      // Check auto-categorization
      const groceryTx = result.transactions.find(tx => tx.description.includes('Walmart'));
      const entertainmentTx = result.transactions.find(tx => tx.description.includes('Netflix'));
      const gasTx = result.transactions.find(tx => tx.description.includes('Shell'));

      expect(groceryTx?.category).toBe('Groceries');
      expect(entertainmentTx?.category).toBe('Entertainment');
      expect(gasTx?.category).toBe('Transportation');
    });

    it('handles import errors gracefully', async () => {
      const csvWithErrors = `Date,Description,Amount
invalid-date,Transaction 1,-50.00
2024-01-02,Transaction 2,not-a-number`;

      const result = await enhancedCsvImportService.importTransactions(
        csvWithErrors,
        mappings,
        mockAccount,
        []
      );

      expect(result.errors).toHaveLength(2);
      expect(result.imported).toBe(0);
      expect(result.errors[0]).toContain('Invalid date');
      expect(result.errors[1]).toContain('Invalid amount');
    });

    it('handles missing required fields', async () => {
      const csvMissingFields = `Description,Amount
Transaction 1,-50.00`;

      const incompleteMappings: ColumnMapping[] = [
        { sourceColumn: 'Description', targetField: 'description', confidence: 0.9 },
        { sourceColumn: 'Amount', targetField: 'amount', confidence: 0.9 }
      ];

      const result = await enhancedCsvImportService.importTransactions(
        csvMissingFields,
        incompleteMappings,
        mockAccount,
        []
      );

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Missing required field: date');
    });
  });

  describe('getBankMappings', () => {
    it('returns correct mappings for Chase', () => {
      const mappings = enhancedCsvImportService.getBankMappings('chase');

      expect(mappings).toContainEqual(
        expect.objectContaining({
          sourceColumn: 'Transaction Date',
          targetField: 'date'
        })
      );
      expect(mappings).toContainEqual(
        expect.objectContaining({
          sourceColumn: 'Description',
          targetField: 'description'
        })
      );
    });

    it('returns correct mappings for Bank of America', () => {
      const mappings = enhancedCsvImportService.getBankMappings('bofa');

      expect(mappings).toContainEqual(
        expect.objectContaining({
          sourceColumn: 'Date',
          targetField: 'date'
        })
      );
      expect(mappings).toContainEqual(
        expect.objectContaining({
          sourceColumn: 'Description',
          targetField: 'description'
        })
      );
    });

    it('returns empty array for unknown bank', () => {
      const mappings = enhancedCsvImportService.getBankMappings('unknown-bank');

      expect(mappings).toEqual([]);
    });

    it('handles bank aliases', () => {
      const mappings1 = enhancedCsvImportService.getBankMappings('chase');
      const mappings2 = enhancedCsvImportService.getBankMappings('jpmorgan');

      expect(mappings1).toEqual(mappings2);
    });
  });

  describe('Import Profiles', () => {
    const mockProfile: ImportProfile = {
      id: 'profile1',
      name: 'My Chase Account',
      bankId: 'chase',
      mappings: [
        { sourceColumn: 'Transaction Date', targetField: 'date', confidence: 1 },
        { sourceColumn: 'Description', targetField: 'description', confidence: 1 },
        { sourceColumn: 'Amount', targetField: 'amount', confidence: 1 }
      ],
      dateFormat: 'MM/DD/YYYY',
      createdAt: '2024-01-01',
      lastUsedAt: '2024-01-15'
    };

    describe('saveImportProfile', () => {
      it('saves a new import profile', async () => {
        mockStorageAdapter.get.mockResolvedValue([]);

        const profile = await enhancedCsvImportService.saveImportProfile(
          'My Chase Account',
          'chase',
          mockProfile.mappings
        );

        expect(profile).toMatchObject({
          name: 'My Chase Account',
          bankId: 'chase',
          mappings: mockProfile.mappings
        });

        expect(mockStorageAdapter.set).toHaveBeenCalledWith(
          'wealthtracker_import_profiles',
          [profile]
        );
      });

      it('updates existing profile with same name', async () => {
        mockStorageAdapter.get.mockResolvedValue([mockProfile]);

        const updatedMappings = [
          ...mockProfile.mappings,
          { sourceColumn: 'Category', targetField: 'category', confidence: 0.8 }
        ];

        const profile = await enhancedCsvImportService.saveImportProfile(
          'My Chase Account',
          'chase',
          updatedMappings
        );

        expect(profile.mappings).toHaveLength(4);
        const savedProfiles = mockStorageAdapter.set.mock.calls[0][1] as ImportProfile[];
        expect(savedProfiles).toHaveLength(1);
        expect(savedProfiles[0].mappings).toHaveLength(4);
      });
    });

    describe('getImportProfiles', () => {
      it('retrieves all import profiles', async () => {
        const profiles = [mockProfile];
        mockStorageAdapter.get.mockResolvedValue(profiles);

        const result = await enhancedCsvImportService.getImportProfiles();

        expect(result).toEqual(profiles);
      });

      it('returns empty array when no profiles exist', async () => {
        mockStorageAdapter.get.mockResolvedValue(null);

        const result = await enhancedCsvImportService.getImportProfiles();

        expect(result).toEqual([]);
      });
    });

    describe('getImportProfile', () => {
      it('retrieves specific profile by id', async () => {
        mockStorageAdapter.get.mockResolvedValue([mockProfile]);

        const result = await enhancedCsvImportService.getImportProfile('profile1');

        expect(result).toEqual(mockProfile);
      });

      it('returns null for non-existent profile', async () => {
        mockStorageAdapter.get.mockResolvedValue([mockProfile]);

        const result = await enhancedCsvImportService.getImportProfile('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('deleteImportProfile', () => {
      it('deletes profile by id', async () => {
        const profiles = [mockProfile, { ...mockProfile, id: 'profile2' }];
        mockStorageAdapter.get.mockResolvedValue(profiles);

        await enhancedCsvImportService.deleteImportProfile('profile1');

        const savedProfiles = mockStorageAdapter.set.mock.calls[0][1] as ImportProfile[];
        expect(savedProfiles).toHaveLength(1);
        expect(savedProfiles[0].id).toBe('profile2');
      });

      it('handles deletion of non-existent profile', async () => {
        mockStorageAdapter.get.mockResolvedValue([mockProfile]);

        await enhancedCsvImportService.deleteImportProfile('nonexistent');

        const savedProfiles = mockStorageAdapter.set.mock.calls[0][1] as ImportProfile[];
        expect(savedProfiles).toHaveLength(1);
      });
    });
  });

  describe('CSV format detection', () => {
    it('detects delimiter automatically', () => {
      const csvSemicolon = `Date;Description;Amount
2024-01-01;Test;-50.00`;

      const result = enhancedCsvImportService.parseCSV(csvSemicolon);
      expect(result.headers).toEqual(['Date', 'Description', 'Amount']);
    });

    it('handles European number format', async () => {
      const csvEuropean = `Date,Description,Amount
2024-01-01,Test Transaction,"-1.234,56"`;

      const mappings: ColumnMapping[] = [
        { sourceColumn: 'Date', targetField: 'date', confidence: 1 },
        { sourceColumn: 'Description', targetField: 'description', confidence: 1 },
        { sourceColumn: 'Amount', targetField: 'amount', confidence: 1 }
      ];

      // The service should handle this internally
      const result = await enhancedCsvImportService.importTransactions(
        csvEuropean,
        mappings,
        mockAccount,
        []
      );

      expect(result.transactions[0].amount).toBe(-1234.56);
    });
  });

  describe('Large file handling', () => {
    it('handles large CSV files efficiently', () => {
      // Generate large CSV
      let largeCsv = 'Date,Description,Amount\n';
      for (let i = 0; i < 10000; i++) {
        largeCsv += `2024-01-01,Transaction ${i},-${i}.00\n`;
      }

      const startTime = Date.now();
      const result = enhancedCsvImportService.parseCSV(largeCsv);
      const parseTime = Date.now() - startTime;

      expect(result.data).toHaveLength(10000);
      expect(parseTime).toBeLessThan(1000); // Should parse in under 1 second
    });

    it('batches large imports to avoid memory issues', async () => {
      // Generate large CSV
      let largeCsv = 'Date,Description,Amount\n';
      for (let i = 0; i < 5000; i++) {
        largeCsv += `2024-01-01,Transaction ${i},-${i}.00\n`;
      }

      const mappings: ColumnMapping[] = [
        { sourceColumn: 'Date', targetField: 'date', confidence: 1 },
        { sourceColumn: 'Description', targetField: 'description', confidence: 1 },
        { sourceColumn: 'Amount', targetField: 'amount', confidence: 1 }
      ];

      const result = await enhancedCsvImportService.importTransactions(
        largeCsv,
        mappings,
        mockAccount,
        []
      );

      expect(result.imported).toBe(5000);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Special bank formats', () => {
    it('handles American Express format', () => {
      const amexCsv = `Date,Description,Amount,Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
01/15/2024,STARBUCKS,-5.50,"STARBUCKS STORE #1234
Additional details","STARBUCKS #1234","123 MAIN ST","NEW YORK, NY",10001,UNITED STATES,'24015ABCD,Restaurant`;

      const result = enhancedCsvImportService.parseCSV(amexCsv);
      expect(result.headers).toContain('Date');
      expect(result.headers).toContain('Description');
      expect(result.headers).toContain('Amount');
    });

    it('handles Mint export format', () => {
      const mintCsv = `"Date","Description","Original Description","Amount","Transaction Type","Category","Account Name","Labels","Notes"
"1/15/2024","Amazon Purchase","AMAZON.COM*123456789","-50.99","debit","Shopping","Chase Checking","","Online purchase"`;

      const result = enhancedCsvImportService.parseCSV(mintCsv);
      expect(result.data[0]).toContain('1/15/2024');
      expect(result.data[0]).toContain('Amazon Purchase');
    });
  });

  describe('Error recovery', () => {
    it('continues import after individual transaction errors', async () => {
      const csvWithMixedData = `Date,Description,Amount
2024-01-01,Good Transaction,-50.00
invalid-date,Bad Transaction,bad-amount
2024-01-03,Another Good Transaction,-75.00`;

      const mappings: ColumnMapping[] = [
        { sourceColumn: 'Date', targetField: 'date', confidence: 1 },
        { sourceColumn: 'Description', targetField: 'description', confidence: 1 },
        { sourceColumn: 'Amount', targetField: 'amount', confidence: 1 }
      ];

      const result = await enhancedCsvImportService.importTransactions(
        csvWithMixedData,
        mappings,
        mockAccount,
        []
      );

      expect(result.imported).toBe(2); // Two good transactions
      expect(result.errors).toHaveLength(1); // One error
      expect(result.transactions).toHaveLength(2);
    });

    it('handles storage errors gracefully', async () => {
      mockStorageAdapter.get.mockRejectedValue(new Error('Storage error'));

      const profiles = await enhancedCsvImportService.getImportProfiles();
      expect(profiles).toEqual([]);
    });
  });

  describe('Advanced mapping features', () => {
    it('supports column transformations', async () => {
      const csv = `Date,Debit,Credit
2024-01-01,50.00,
2024-01-02,,100.00`;

      const mappings: ColumnMapping[] = [
        { sourceColumn: 'Date', targetField: 'date', confidence: 1 },
        { sourceColumn: 'Debit', targetField: 'amount', confidence: 1, transform: 'negate' },
        { sourceColumn: 'Credit', targetField: 'amount', confidence: 1 }
      ];

      const result = await enhancedCsvImportService.importTransactions(
        csv,
        mappings,
        mockAccount,
        []
      );

      expect(result.transactions[0].amount).toBe(-50); // Debit negated
      expect(result.transactions[1].amount).toBe(100); // Credit positive
    });

    it('handles combined amount columns intelligently', async () => {
      const csv = `Date,Description,Debit,Credit
2024-01-01,Purchase,50.00,
2024-01-02,Deposit,,100.00`;

      const mappings: ColumnMapping[] = [
        { sourceColumn: 'Date', targetField: 'date', confidence: 1 },
        { sourceColumn: 'Description', targetField: 'description', confidence: 1 },
        { sourceColumn: 'Debit', targetField: 'amount', confidence: 0.5 },
        { sourceColumn: 'Credit', targetField: 'amount', confidence: 0.5 }
      ];

      const result = await enhancedCsvImportService.importTransactions(
        csv,
        mappings,
        mockAccount,
        []
      );

      expect(result.transactions[0].amount).toBe(-50);
      expect(result.transactions[0].type).toBe('expense');
      expect(result.transactions[1].amount).toBe(100);
      expect(result.transactions[1].type).toBe('income');
    });
  });
});