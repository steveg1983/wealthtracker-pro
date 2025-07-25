import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateBackupData, importBackupFile, createBackupFilename } from '../backupRestore';
import type { BackupData } from '../backupRestore';

describe('backupRestore', () => {
  describe('validateBackupData', () => {
    const validBackupData: BackupData = {
      accounts: [
        { id: '1', name: 'Checking', type: 'checking', balance: 1000, currency: 'USD' },
        { id: '2', name: 'Savings', type: 'savings', balance: 5000, currency: 'USD' }
      ],
      transactions: [
        { 
          id: '1', 
          date: '2024-01-15', 
          amount: 100, 
          description: 'Test', 
          type: 'income',
          category: 'Salary',
          accountId: '1'
        }
      ],
      budgets: [
        { 
          id: '1', 
          name: 'Monthly Budget', 
          amount: 3000, 
          period: 'monthly', 
          categories: ['Food', 'Transport'],
          startDate: '2024-01-01'
        }
      ],
      goals: [
        { 
          id: '1', 
          name: 'Emergency Fund', 
          targetAmount: 10000, 
          currentAmount: 2000,
          targetDate: '2024-12-31',
          accountId: '2'
        }
      ],
      categories: ['Food', 'Transport', 'Entertainment'],
      recurringTransactions: [
        {
          id: '1',
          templateTransaction: {
            id: 'template-1',
            date: '2024-01-01',
            amount: 1000,
            description: 'Rent',
            type: 'expense',
            category: 'Housing',
            accountId: '1'
          },
          frequency: 'monthly',
          nextDate: '2024-02-01',
          isActive: true
        }
      ],
      tags: ['important', 'recurring', 'fixed'],
      exportDate: '2024-01-15T10:30:00Z',
      version: '1.0.0'
    };

    it('validates correct backup data structure', () => {
      expect(validateBackupData(validBackupData)).toBe(true);
    });

    it('validates minimal backup data (required fields only)', () => {
      const minimalData = {
        accounts: [{ id: '1', name: 'Test', balance: 0 }],
        transactions: [{ id: '1', date: '2024-01-01', amount: 0 }],
        budgets: [],
        goals: [],
        version: '1.0.0'
      };

      expect(validateBackupData(minimalData)).toBe(true);
    });

    it('rejects null or undefined', () => {
      expect(validateBackupData(null)).toBe(false);
      expect(validateBackupData(undefined)).toBe(false);
    });

    it('rejects non-object types', () => {
      expect(validateBackupData('string')).toBe(false);
      expect(validateBackupData(123)).toBe(false);
      expect(validateBackupData(true)).toBe(false);
      expect(validateBackupData([])).toBe(false);
    });

    it('rejects missing required fields', () => {
      const missingAccounts = { ...validBackupData };
      delete (missingAccounts as any).accounts;
      expect(validateBackupData(missingAccounts)).toBe(false);

      const missingTransactions = { ...validBackupData };
      delete (missingTransactions as any).transactions;
      expect(validateBackupData(missingTransactions)).toBe(false);

      const missingBudgets = { ...validBackupData };
      delete (missingBudgets as any).budgets;
      expect(validateBackupData(missingBudgets)).toBe(false);

      const missingGoals = { ...validBackupData };
      delete (missingGoals as any).goals;
      expect(validateBackupData(missingGoals)).toBe(false);

      const missingVersion = { ...validBackupData };
      delete (missingVersion as any).version;
      expect(validateBackupData(missingVersion)).toBe(false);
    });

    it('rejects non-array required fields', () => {
      expect(validateBackupData({ ...validBackupData, accounts: 'not-array' })).toBe(false);
      expect(validateBackupData({ ...validBackupData, transactions: {} })).toBe(false);
      expect(validateBackupData({ ...validBackupData, budgets: null })).toBe(false);
      expect(validateBackupData({ ...validBackupData, goals: 123 })).toBe(false);
    });

    it('rejects invalid version field', () => {
      expect(validateBackupData({ ...validBackupData, version: null })).toBe(false);
      expect(validateBackupData({ ...validBackupData, version: 123 })).toBe(false);
      expect(validateBackupData({ ...validBackupData, version: {} })).toBe(false);
    });

    it('validates accounts have required fields', () => {
      const invalidAccount = {
        ...validBackupData,
        accounts: [{ name: 'Test', balance: 100 }] // missing id
      };
      expect(validateBackupData(invalidAccount)).toBe(false);

      const missingName = {
        ...validBackupData,
        accounts: [{ id: '1', balance: 100 }] // missing name
      };
      expect(validateBackupData(missingName)).toBe(false);

      const invalidBalance = {
        ...validBackupData,
        accounts: [{ id: '1', name: 'Test', balance: 'not-number' }]
      };
      expect(validateBackupData(invalidBalance)).toBe(false);
    });

    it('validates transactions have required fields', () => {
      const missingId = {
        ...validBackupData,
        transactions: [{ date: '2024-01-01', amount: 100 }]
      };
      expect(validateBackupData(missingId)).toBe(false);

      const missingDate = {
        ...validBackupData,
        transactions: [{ id: '1', amount: 100 }]
      };
      expect(validateBackupData(missingDate)).toBe(false);

      const invalidAmount = {
        ...validBackupData,
        transactions: [{ id: '1', date: '2024-01-01', amount: 'not-number' }]
      };
      expect(validateBackupData(invalidAmount)).toBe(false);
    });

    it('allows optional fields to be missing', () => {
      const withoutOptionals = {
        accounts: validBackupData.accounts,
        transactions: validBackupData.transactions,
        budgets: validBackupData.budgets,
        goals: validBackupData.goals,
        version: validBackupData.version
        // No categories, recurringTransactions, tags, or exportDate
      };

      expect(validateBackupData(withoutOptionals)).toBe(true);
    });

    it('validates empty arrays are allowed', () => {
      const emptyArrays = {
        accounts: [],
        transactions: [],
        budgets: [],
        goals: [],
        version: '1.0.0'
      };

      expect(validateBackupData(emptyArrays)).toBe(true);
    });

    it('validates accounts with various balance values', () => {
      const variousBalances = {
        ...validBackupData,
        accounts: [
          { id: '1', name: 'Zero', balance: 0 },
          { id: '2', name: 'Negative', balance: -100.50 },
          { id: '3', name: 'Large', balance: 1000000.99 }
        ]
      };

      expect(validateBackupData(variousBalances)).toBe(true);
    });

    it('validates transactions with various amount values', () => {
      const variousAmounts = {
        ...validBackupData,
        transactions: [
          { id: '1', date: '2024-01-01', amount: 0 },
          { id: '2', date: '2024-01-02', amount: -50.25 },
          { id: '3', date: '2024-01-03', amount: 99999.99 }
        ]
      };

      expect(validateBackupData(variousAmounts)).toBe(true);
    });
  });

  describe('importBackupFile', () => {
    let mockFileReader: any;

    beforeEach(() => {
      mockFileReader = {
        readAsText: vi.fn(),
        onload: null,
        onerror: null,
        result: null
      };

      // Mock FileReader constructor
      global.FileReader = vi.fn(() => mockFileReader) as any;
    });

    it('successfully imports valid backup file', async () => {
      const validData: BackupData = {
        accounts: [{ id: '1', name: 'Test', balance: 100 }],
        transactions: [{ id: '1', date: '2024-01-01', amount: 50 }],
        budgets: [],
        goals: [],
        version: '1.0.0',
        exportDate: '2024-01-15T10:00:00Z'
      };

      const file = new File([JSON.stringify(validData)], 'backup.json', { type: 'application/json' });

      const importPromise = importBackupFile(file);

      // Simulate FileReader behavior
      expect(mockFileReader.readAsText).toHaveBeenCalledWith(file);
      
      // Simulate successful read
      mockFileReader.result = JSON.stringify(validData);
      mockFileReader.onload({ target: { result: JSON.stringify(validData) } });

      const result = await importPromise;
      expect(result).toEqual(validData);
    });

    it('rejects invalid JSON', async () => {
      const file = new File(['invalid json {'], 'backup.json', { type: 'application/json' });

      const importPromise = importBackupFile(file);

      // Simulate file read
      mockFileReader.result = 'invalid json {';
      mockFileReader.onload({ target: { result: 'invalid json {' } });

      await expect(importPromise).rejects.toThrow('Failed to parse backup file');
    });

    it('rejects invalid backup data structure', async () => {
      const invalidData = {
        accounts: 'not-an-array',
        version: '1.0.0'
      };

      const file = new File([JSON.stringify(invalidData)], 'backup.json', { type: 'application/json' });

      const importPromise = importBackupFile(file);

      // Simulate file read
      mockFileReader.result = JSON.stringify(invalidData);
      mockFileReader.onload({ target: { result: JSON.stringify(invalidData) } });

      await expect(importPromise).rejects.toThrow('Invalid backup file format');
    });

    it('handles file read errors', async () => {
      const file = new File(['content'], 'backup.json', { type: 'application/json' });

      const importPromise = importBackupFile(file);

      // Simulate read error
      mockFileReader.onerror();

      await expect(importPromise).rejects.toThrow('Failed to read backup file');
    });

    it('handles missing result from FileReader', async () => {
      const file = new File(['content'], 'backup.json', { type: 'application/json' });

      const importPromise = importBackupFile(file);

      // Simulate onload with no result
      mockFileReader.onload({ target: null });

      await expect(importPromise).rejects.toThrow('Failed to parse backup file');
    });

    it('imports file with all optional fields', async () => {
      const fullData: BackupData = {
        accounts: [{ id: '1', name: 'Checking', balance: 1000 }],
        transactions: [{ id: '1', date: '2024-01-01', amount: 100 }],
        budgets: [{ id: '1', name: 'Budget', amount: 1000, period: 'monthly', categories: [] }],
        goals: [{ id: '1', name: 'Goal', targetAmount: 5000, currentAmount: 1000 }],
        categories: ['Food', 'Transport'],
        recurringTransactions: [{
          id: '1',
          templateTransaction: { id: 't1', date: '2024-01-01', amount: 100 },
          frequency: 'monthly',
          nextDate: '2024-02-01',
          isActive: true
        }],
        tags: ['tag1', 'tag2'],
        exportDate: '2024-01-15T10:00:00Z',
        version: '2.0.0'
      };

      const file = new File([JSON.stringify(fullData)], 'backup.json');

      const importPromise = importBackupFile(file);

      mockFileReader.result = JSON.stringify(fullData);
      mockFileReader.onload({ target: { result: JSON.stringify(fullData) } });

      const result = await importPromise;
      expect(result).toEqual(fullData);
    });

    it('imports large backup files', async () => {
      const largeData: BackupData = {
        accounts: Array(100).fill(null).map((_, i) => ({ 
          id: `acc${i}`, 
          name: `Account ${i}`, 
          balance: i * 1000 
        })),
        transactions: Array(1000).fill(null).map((_, i) => ({ 
          id: `trans${i}`, 
          date: '2024-01-01', 
          amount: i 
        })),
        budgets: [],
        goals: [],
        version: '1.0.0'
      };

      const file = new File([JSON.stringify(largeData)], 'large-backup.json');

      const importPromise = importBackupFile(file);

      mockFileReader.result = JSON.stringify(largeData);
      mockFileReader.onload({ target: { result: JSON.stringify(largeData) } });

      const result = await importPromise;
      expect(result.accounts).toHaveLength(100);
      expect(result.transactions).toHaveLength(1000);
    });

    it('preserves error details in rejection', async () => {
      const file = new File(['{"invalid": json}'], 'backup.json');

      const importPromise = importBackupFile(file);

      mockFileReader.result = '{"invalid": json}';
      mockFileReader.onload({ target: { result: '{"invalid": json}' } });

      try {
        await importPromise;
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to parse backup file');
      }
    });
  });

  describe('createBackupFilename', () => {
    it('creates filename with current date', () => {
      const mockDate = new Date('2024-01-15T10:30:00Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const filename = createBackupFilename();
      expect(filename).toBe('wealthtracker-backup-2024-01-15.json');

      vi.restoreAllMocks();
    });

    it('formats single digit months and days correctly', () => {
      const mockDate = new Date('2024-02-05T10:30:00Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const filename = createBackupFilename();
      expect(filename).toBe('wealthtracker-backup-2024-02-05.json');

      vi.restoreAllMocks();
    });

    it('handles end of year dates', () => {
      const mockDate = new Date('2023-12-31T23:59:59Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const filename = createBackupFilename();
      expect(filename).toBe('wealthtracker-backup-2023-12-31.json');

      vi.restoreAllMocks();
    });

    it('handles beginning of year dates', () => {
      const mockDate = new Date('2024-01-01T00:00:00Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const filename = createBackupFilename();
      expect(filename).toBe('wealthtracker-backup-2024-01-01.json');

      vi.restoreAllMocks();
    });

    it('uses local timezone date', () => {
      // Test that toISOString is called, which converts to UTC
      const mockDate = new Date('2024-06-15T23:00:00-05:00'); // 11pm EST
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const filename = createBackupFilename();
      // toISOString converts to UTC, so this would be June 16 UTC
      expect(filename).toBe('wealthtracker-backup-2024-06-16.json');

      vi.restoreAllMocks();
    });

    it('always returns consistent format', () => {
      const dates = [
        new Date('2024-01-01T12:00:00Z'),
        new Date('2024-12-31T12:00:00Z'),
        new Date('2025-06-15T12:00:00Z'),
        new Date('2023-02-28T12:00:00Z')
      ];

      dates.forEach(date => {
        vi.spyOn(global, 'Date').mockImplementation(() => date as any);
        
        const filename = createBackupFilename();
        expect(filename).toMatch(/^wealthtracker-backup-\d{4}-\d{2}-\d{2}\.json$/);
        
        vi.restoreAllMocks();
      });
    });
  });
});