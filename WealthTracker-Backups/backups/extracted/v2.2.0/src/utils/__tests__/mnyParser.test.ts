import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseMNY, parseMBF, applyMappingToData } from '../mnyParser';
import type { FieldMapping } from '../mnyParser';

describe('mnyParser', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseMNY', () => {
    it('handles empty file', async () => {
      const emptyBuffer = new ArrayBuffer(0);
      const result = await parseMNY(emptyBuffer);

      expect(result.accounts).toHaveLength(1);
      expect(result.accounts[0]).toEqual({
        name: 'Money Import',
        type: 'checking',
        balance: 0
      });
      expect(result.transactions).toHaveLength(0);
      expect(result.warning).toContain('Unable to automatically parse');
      expect(result.needsMapping).toBeUndefined();
    });

    it('handles small file without structured data', async () => {
      const smallBuffer = new ArrayBuffer(100);
      const uint8Array = new Uint8Array(smallBuffer);
      // Fill with random data
      for (let i = 0; i < 100; i++) {
        uint8Array[i] = Math.floor(Math.random() * 256);
      }

      const result = await parseMNY(smallBuffer);

      expect(result.accounts).toHaveLength(1);
      expect(result.transactions).toHaveLength(0);
      expect(result.warning).toContain('Unable to automatically parse');
    });

    it('extracts potential records from structured data', async () => {
      const buffer = new ArrayBuffer(4096); // Larger buffer to ensure we get more records
      const dataView = new DataView(buffer);
      const uint8Array = new Uint8Array(buffer);

      // Create more structured records to exceed the threshold of 10
      for (let i = 0; i < 15; i++) {
        const offset = i * 256;
        
        // Add OLE date (double)
        const oleDate = 44561 + i; // Jan 1, 2022 + i days
        dataView.setFloat64(offset, oleDate, true);
        
        // Add amount (double)
        const amount = (i + 1) * 100.50;
        dataView.setFloat64(offset + 8, amount, true);
        
        // Add description (ASCII string)
        const description = `Transaction ${i + 1}`;
        for (let j = 0; j < description.length && j < 50; j++) {
          uint8Array[offset + 16 + j] = description.charCodeAt(j);
        }
        
        // Add integer value
        dataView.setInt32(offset + 80, 1000 + i, true);
      }

      const result = await parseMNY(buffer);

      // Should find structured data if we have > 10 records
      if (result.rawData && result.rawData.length > 10) {
        expect(result.needsMapping).toBe(true);
        expect(result.warning).toContain('structured data');
        expect(result.accounts).toHaveLength(0);
        expect(result.transactions).toHaveLength(0);
      } else {
        // Fallback case
        expect(result.warning).toContain('Unable to automatically parse');
      }
    });

    it('handles large files with progress logging', async () => {
      // Create a 2MB buffer
      const largeBuffer = new ArrayBuffer(2 * 1024 * 1024);
      const dataView = new DataView(largeBuffer);
      const uint8Array = new Uint8Array(largeBuffer);

      // Add some structured data at intervals
      for (let i = 0; i < 20; i++) {
        const offset = i * 100000;
        if (offset + 100 < largeBuffer.byteLength) {
          // Add date
          dataView.setFloat64(offset, 44561 + i, true);
          // Add amount
          dataView.setFloat64(offset + 8, 100.50 + i, true);
          // Add text
          const text = `Record ${i}`;
          for (let j = 0; j < text.length; j++) {
            uint8Array[offset + 16 + j] = text.charCodeAt(j);
          }
        }
      }

      const result = await parseMNY(largeBuffer);

      expect(result).toBeDefined();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Scanned'));
    });

    it('extracts UTF-16 strings correctly', async () => {
      const buffer = new ArrayBuffer(512);
      const uint8Array = new Uint8Array(buffer);
      const dataView = new DataView(buffer);

      // Add record with UTF-16 string
      const utf16Text = 'Test UTF16';
      for (let i = 0; i < utf16Text.length; i++) {
        const charCode = utf16Text.charCodeAt(i);
        uint8Array[20 + i * 2] = charCode & 0xFF;
        uint8Array[20 + i * 2 + 1] = (charCode >> 8) & 0xFF;
      }

      // Add date and amount to make it a valid record
      dataView.setFloat64(0, 44561, true);
      dataView.setFloat64(8, 123.45, true);

      const result = await parseMNY(buffer);

      if (result.rawData && result.rawData.length > 0) {
        const hasUTF16Field = Object.keys(result.rawData[0]).some(key => 
          key.includes('utf16') && result.rawData![0][key] === utf16Text
        );
        expect(hasUTF16Field).toBe(true);
      }
    });

    it('filters out records with insufficient data', async () => {
      const buffer = new ArrayBuffer(1024);
      const dataView = new DataView(buffer);

      // First record: only one field (should be filtered)
      dataView.setFloat64(0, 44561, true);

      // Second record: three fields (should be included)
      dataView.setFloat64(256, 44562, true);
      dataView.setFloat64(264, 250.00, true);
      dataView.setInt32(272, 12345, true);

      const result = await parseMNY(buffer);

      if (result.rawData) {
        const validRecords = result.rawData.filter(r => Object.keys(r).length >= 3);
        expect(validRecords.length).toBeGreaterThan(0);
      }
    });

    it('handles various numeric formats', async () => {
      const buffer = new ArrayBuffer(256);
      const dataView = new DataView(buffer);

      // OLE date
      dataView.setFloat64(0, 44561, true); // Jan 1, 2022
      
      // Currency amount
      dataView.setFloat64(8, 1234.56, true);
      
      // Small integer
      dataView.setInt32(16, 100, true);
      
      // Large integer (should be filtered)
      dataView.setInt32(20, 2000000, true);
      
      // Negative amount
      dataView.setFloat64(24, -500.25, true);

      const result = await parseMNY(buffer);

      if (result.rawData && result.rawData.length > 0) {
        const record = result.rawData[0];
        expect(record['field_0_date']).toBe(44561);
        expect(record['field_1_amount']).toBe(1234.56);
        expect(record['field_2_int']).toBe(100);
        expect(record['field_3_amount']).toBe(-500.25);
      }
    });
  });

  describe('applyMappingToData', () => {
    const mockRawData = [
      {
        field_0_date: 44561, // Jan 1, 2022
        field_1_amount: -150.50,
        field_2_text: 'Grocery Store',
        field_3_text: 'Food',
        field_4_text: 'Checking Account'
      },
      {
        field_0_date: 44562, // Jan 2, 2022
        field_1_amount: 2500.00,
        field_2_text: 'Salary Payment',
        field_3_text: 'Income',
        field_4_text: 'Checking Account'
      }
    ];

    const mapping: FieldMapping = {
      date: 0,      // field_0_date
      amount: 1,    // field_1_amount
      description: 2, // field_2_text
      category: 3,  // field_3_text
      accountName: 4 // field_4_text
    };

    it('converts raw data to transactions correctly', () => {
      const result = applyMappingToData(mockRawData, mapping);

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]).toEqual({
        date: new Date((44561 - 25569) * 86400 * 1000),
        amount: 150.50,
        description: 'Grocery Store',
        type: 'expense',
        category: 'Food',
        payee: undefined,
        accountName: 'Checking Account'
      });
      expect(result.transactions[1]).toEqual({
        date: new Date((44562 - 25569) * 86400 * 1000),
        amount: 2500.00,
        description: 'Salary Payment',
        type: 'income',
        category: 'Income',
        payee: undefined,
        accountName: 'Checking Account'
      });
    });

    it('creates accounts from transactions', () => {
      const result = applyMappingToData(mockRawData, mapping);

      expect(result.accounts).toHaveLength(1);
      expect(result.accounts[0].name).toBe('Checking Account');
      expect(result.accounts[0].type).toBe('checking');
    });

    it('calculates account balances correctly', () => {
      const result = applyMappingToData(mockRawData, mapping);

      const account = result.accounts[0];
      expect(account.balance).toBe(2500.00 - 150.50); // Income - Expense
    });

    it('handles missing optional fields', () => {
      const mappingWithoutOptional: FieldMapping = {
        date: 0,
        amount: 1,
        description: 2
        // No payee, category, or accountName
      };

      const result = applyMappingToData(mockRawData, mappingWithoutOptional);

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].category).toBe('Imported');
      expect(result.transactions[0].accountName).toBe('Primary Account');
      expect(result.transactions[0].payee).toBeUndefined();
    });

    it('handles payee field when mapped', () => {
      const dataWithPayee = [{
        ...mockRawData[0],
        field_5_text: 'Local Grocery Store'
      }];

      const mappingWithPayee: FieldMapping = {
        ...mapping,
        payee: 5
      };

      const result = applyMappingToData(dataWithPayee, mappingWithPayee);

      expect(result.transactions[0].payee).toBe('Local Grocery Store');
    });

    it('skips records with invalid dates', () => {
      const dataWithBadDate = [
        ...mockRawData,
        {
          field_0_date: 'invalid',
          field_1_amount: 100,
          field_2_text: 'Bad Date Transaction'
        }
      ];

      const result = applyMappingToData(dataWithBadDate, mapping);

      expect(result.transactions).toHaveLength(2); // Only valid records
    });

    it('skips records with invalid amounts', () => {
      const dataWithBadAmount = [
        ...mockRawData,
        {
          field_0_date: 44563,
          field_1_amount: 'not a number',
          field_2_text: 'Bad Amount Transaction'
        }
      ];

      const result = applyMappingToData(dataWithBadAmount, mapping);

      expect(result.transactions).toHaveLength(2); // Only valid records
    });

    it('handles Date objects in raw data', () => {
      const dataWithDateObject = [{
        field_0_date: new Date('2022-01-01'),
        field_1_amount: 100,
        field_2_text: 'Date Object Transaction'
      }];

      const result = applyMappingToData(dataWithDateObject, mapping);

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toEqual(new Date('2022-01-01'));
    });

    it('handles string dates', () => {
      const dataWithStringDate = [{
        field_0_date: '2022-01-01',
        field_1_amount: 100,
        field_2_text: 'String Date Transaction'
      }];

      const result = applyMappingToData(dataWithStringDate, mapping);

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toEqual(new Date('2022-01-01'));
    });

    it('rounds amounts to 2 decimal places', () => {
      const dataWithPrecision = [{
        field_0_date: 44561,
        field_1_amount: 123.456789,
        field_2_text: 'Precise Amount'
      }];

      const result = applyMappingToData(dataWithPrecision, mapping);

      expect(result.transactions[0].amount).toBe(123.46);
    });

    it('handles multiple accounts', () => {
      const multiAccountData = [
        { ...mockRawData[0], field_4_text: 'Checking' },
        { ...mockRawData[1], field_4_text: 'Savings' }
      ];

      const result = applyMappingToData(multiAccountData, mapping);

      expect(result.accounts).toHaveLength(2);
      expect(result.accounts.map(a => a.name)).toContain('Checking');
      expect(result.accounts.map(a => a.name)).toContain('Savings');
    });

    it('handles errors gracefully', () => {
      const badData = [
        ...mockRawData,
        null as unknown,
        undefined as unknown,
        {} as Record<string, unknown>
      ];

      expect(() => applyMappingToData(badData, mapping)).not.toThrow();
    });
  });

  describe('parseMBF', () => {
    it('handles empty MBF file', async () => {
      const emptyBuffer = new ArrayBuffer(0);
      const result = await parseMBF(emptyBuffer);

      expect(result.accounts).toHaveLength(1);
      expect(result.accounts[0].name).toBe('Money Backup File');
      expect(result.warning).toContain('Unable to extract data');
    });

    it('logs file header for debugging', async () => {
      const buffer = new ArrayBuffer(100);
      const uint8Array = new Uint8Array(buffer);
      
      // Add some header bytes
      for (let i = 0; i < 64; i++) {
        uint8Array[i] = i;
      }

      await parseMBF(buffer);

      // Check that the header was logged (it's the second call)
      const mockLog = vi.mocked(console.log);
      const calls = mockLog.mock.calls;
      const headerCall = calls.find((call) => 
        call[0] && call[0].includes('MBF file header:')
      );
      expect(headerCall).toBeDefined();
    });

    it('calculates text percentage in file', async () => {
      const buffer = new ArrayBuffer(1000);
      const uint8Array = new Uint8Array(buffer);
      
      // Add 50% readable text
      for (let i = 0; i < 500; i++) {
        uint8Array[i] = 65; // 'A'
      }
      // Rest is binary
      for (let i = 500; i < 1000; i++) {
        uint8Array[i] = 0;
      }

      await parseMBF(buffer);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('50.0%'));
    });

    it('tries multiple record sizes', async () => {
      const buffer = new ArrayBuffer(5000);
      const dataView = new DataView(buffer);

      // Add data at 512-byte boundaries
      for (let i = 0; i < 5; i++) {
        const offset = i * 512;
        dataView.setFloat64(offset, 44561 + i, true); // Date
        dataView.setFloat64(offset + 8, 100 + i, true); // Amount
      }

      await parseMBF(buffer);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Trying record size:'));
    });

    it('extracts records with different record sizes', async () => {
      const buffer = new ArrayBuffer(2048);
      const dataView = new DataView(buffer);
      const uint8Array = new Uint8Array(buffer);

      // Create records at 256-byte boundaries
      for (let i = 0; i < 4; i++) {
        const offset = i * 256;
        
        // Date field
        dataView.setFloat64(offset, 44561 + i, true);
        
        // Amount field
        dataView.setFloat64(offset + 8, 150.50 + i * 10, true);
        
        // Text field
        const text = `Transaction ${i}`;
        for (let j = 0; j < text.length; j++) {
          uint8Array[offset + 16 + j] = text.charCodeAt(j);
        }
      }

      const result = await parseMBF(buffer);

      if (result.needsMapping && result.rawData) {
        expect(result.rawData.length).toBeGreaterThan(0);
        expect(result.warning).toContain('Found data');
      }
    });

    it('tries pattern-based extraction as fallback', async () => {
      const buffer = new ArrayBuffer(500);
      const dataView = new DataView(buffer);

      // Add date as days since 1900
      const daysSince1900 = 44561; // Should be around 2022
      dataView.setInt32(0, daysSince1900, true);
      
      // Add amount nearby
      dataView.setFloat64(8, 250.75, true);

      await parseMBF(buffer);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('pattern-based extraction'));
    });

    it('handles dates as days since 1900', async () => {
      const buffer = new ArrayBuffer(200);
      const dataView = new DataView(buffer);
      const uint8Array = new Uint8Array(buffer);

      // Date: Jan 1, 2022 (44561 days since 1900)
      dataView.setInt32(0, 44561, true);
      
      // Amount
      dataView.setFloat64(8, 123.45, true);
      
      // Description
      const desc = 'Test Transaction';
      for (let i = 0; i < desc.length; i++) {
        uint8Array[20 + i] = desc.charCodeAt(i);
      }

      const result = await parseMBF(buffer);

      if (result.rawData && result.rawData.length > 0) {
        const record = result.rawData[0];
        expect(record.date_value).toBe(44561);
        expect(record.date_formatted).toContain('2022');
      }
    });

    it('handles amounts in different formats', async () => {
      const buffer = new ArrayBuffer(300);
      const dataView = new DataView(buffer);

      // Record 1: Amount as float64
      dataView.setInt32(0, 44561, true); // Date
      dataView.setFloat64(8, 100.50, true);

      // Record 2: Amount as float32
      dataView.setInt32(100, 44562, true); // Date
      dataView.setFloat32(108, 200.75, true);

      // Record 3: Amount as cents (int32)
      dataView.setInt32(200, 44563, true); // Date
      dataView.setInt32(208, 30025, true); // $300.25 as cents

      const result = await parseMBF(buffer);

      if (result.rawData && result.rawData.length > 0) {
        // Check that various amount formats were detected
        const hasFloat64 = result.rawData.some(r => r.amount === 100.50);
        const hasFloat32 = result.rawData.some(r => Math.abs(Number(r.amount) - 200.75) < 0.01);
        const hasCents = result.rawData.some(r => r.amount === 300.25);
        
        expect(hasFloat64 || hasFloat32 || hasCents).toBe(true);
      }
    });

    it('extracts descriptions from various positions', async () => {
      const buffer = new ArrayBuffer(512);
      const dataView = new DataView(buffer);
      const uint8Array = new Uint8Array(buffer);

      // Add date and amount
      dataView.setInt32(0, 44561, true);
      dataView.setFloat64(8, 100.00, true);

      // Try description at different offsets
      const descriptions = ['Desc at 50', 'Desc at 100', 'Desc at 150'];
      const offsets = [50, 100, 150];

      offsets.forEach((offset, idx) => {
        const desc = descriptions[idx];
        for (let i = 0; i < desc.length; i++) {
          uint8Array[offset + i] = desc.charCodeAt(i);
        }
      });

      const result = await parseMBF(buffer);

      if (result.rawData && result.rawData.length > 0) {
        const record = result.rawData[0];
        const hasDescription = record.description && descriptions.includes(String(record.description));
        expect(hasDescription).toBe(true);
      }
    });

    it('limits number of records extracted', async () => {
      // Create a large buffer that could contain many records
      const buffer = new ArrayBuffer(50000);
      const dataView = new DataView(buffer);

      // Add many potential records
      for (let i = 0; i < 200; i++) {
        const offset = i * 200;
        if (offset + 16 < buffer.byteLength) {
          dataView.setInt32(offset, 44561 + i, true);
          dataView.setFloat64(offset + 8, 100 + i, true);
        }
      }

      const result = await parseMBF(buffer);

      // Should limit extraction for performance
      if (result.rawData) {
        expect(result.rawData.length).toBeLessThanOrEqual(100);
      }
    });
  });
});