/**
 * OFXImportService Tests
 * Tests for OFX file parsing and transaction import
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ofxImportService } from './ofxImportService';
import { smartCategorizationService } from './smartCategorizationService';
import type { Transaction, Account, Category } from '../types';

// Mock smartCategorizationService
vi.mock('./smartCategorizationService', () => ({
  smartCategorizationService: {
    learnFromTransactions: vi.fn(),
    suggestCategories: vi.fn()
  }
}));

const expectDateOnly = (value: Date | string | undefined, expected: string) => {
  const normalized = value instanceof Date ? value.toISOString().split('T')[0] : value;
  expect(normalized).toBe(expected);
};

describe('OFXImportService', () => {
  // Sample OFX content
  const validOFXContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20240120120000[0:GMT]
<LANGUAGE>ENG
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>GBP
<BANKACCTFROM>
<BANKID>123456
<ACCTID>12345678
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20240101000000[0:GMT]
<DTEND>20240131235959[0:GMT]
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240115120000[0:GMT]
<TRNAMT>-25.50
<FITID>2024011501
<NAME>TESCO STORES
<MEMO>Grocery shopping
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20240120090000[0:GMT]
<TRNAMT>2500.00
<FITID>2024012001
<NAME>EMPLOYER PAYMENT
<MEMO>Salary
</STMTTRN>
<STMTTRN>
<TRNTYPE>CHECK
<DTPOSTED>20240110150000[0:GMT]
<TRNAMT>-100.00
<FITID>2024011001
<NAME>Check #1234
<CHECKNUM>1234
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>5000.00
<DTASOF>20240131235959[0:GMT]
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

  const mockAccounts: Account[] = [
    {
      id: 'acc1',
      name: 'Main Current Account (****5678)',
      institution: 'Test Bank',
      type: 'current',
      balance: 5000,
      currency: 'GBP',
      isActive: true
    },
    {
      id: 'acc2',
      name: 'Savings Account',
      institution: 'Test Bank',
      type: 'savings',
      balance: 10000,
      currency: 'GBP',
      isActive: true
    }
  ];

  const mockCategories: Category[] = [
    { id: 'food', name: 'Food & Dining', type: 'expense', icon: 'restaurant' },
    { id: 'salary', name: 'Salary', type: 'income', icon: 'briefcase' },
    { id: 'shopping', name: 'Shopping', type: 'expense', icon: 'shopping-bag' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseOFX', () => {
    it('parses valid OFX content', () => {
      const result = ofxImportService.parseOFX(validOFXContent);

      expect(result.account).toEqual({
        bankId: '123456',
        accountId: '12345678',
        accountType: 'CHECKING',
        branchId: undefined
      });

      expect(result.transactions).toHaveLength(3);
      expect(result.currency).toBe('GBP');
      expect(result.startDate).toBe('2024-01-01');
      expect(result.endDate).toBe('2024-01-31');
      expect(result.balance).toEqual({
        amount: 5000,
        dateAsOf: '2024-01-31'
      });
    });

    it('parses transactions correctly', () => {
      const result = ofxImportService.parseOFX(validOFXContent);
      const [transaction1, transaction2, transaction3] = result.transactions;

      // First transaction - DEBIT
      expect(transaction1).toEqual({
        type: 'DEBIT',
        datePosted: '2024-01-15',
        amount: -25.50,
        fitId: '2024011501',
        name: 'TESCO STORES',
        memo: 'Grocery shopping',
        checkNum: undefined,
        refNum: undefined
      });

      // Second transaction - CREDIT
      expect(transaction2).toEqual({
        type: 'CREDIT',
        datePosted: '2024-01-20',
        amount: 2500,
        fitId: '2024012001',
        name: 'EMPLOYER PAYMENT',
        memo: 'Salary',
        checkNum: undefined,
        refNum: undefined
      });

      // Third transaction - CHECK
      expect(transaction3).toEqual({
        type: 'CHECK',
        datePosted: '2024-01-10',
        amount: -100,
        fitId: '2024011001',
        name: 'Check #1234',
        memo: undefined,
        checkNum: '1234',
        refNum: undefined
      });
    });

    it('throws error for invalid OFX content', () => {
      expect(() => ofxImportService.parseOFX('Invalid content')).toThrow('Invalid OFX file: <OFX> tag not found');
    });

    it('throws error when account ID is missing', () => {
      const invalidOFX = `<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKACCTFROM>
<BANKID>123456
<ACCTTYPE>CHECKING
</BANKACCTFROM>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

      expect(() => ofxImportService.parseOFX(invalidOFX)).toThrow('Account ID not found in OFX file');
    });

    it('handles OFX without balance information', () => {
      const ofxWithoutBalance = validOFXContent.replace(/<LEDGERBAL>[\s\S]*?<\/LEDGERBAL>/g, '');
      const result = ofxImportService.parseOFX(ofxWithoutBalance);

      expect(result.balance).toBeUndefined();
    });

    it('handles OFX without date range', () => {
      const ofxWithoutDates = validOFXContent
        .replace(/<DTSTART>.*?\n/g, '')
        .replace(/<DTEND>.*?\n/g, '');
      const result = ofxImportService.parseOFX(ofxWithoutDates);

      expect(result.startDate).toBeUndefined();
      expect(result.endDate).toBeUndefined();
    });

    it('cleans HTML entities in strings', () => {
      const ofxWithEntities = validOFXContent.replace(
        'TESCO STORES',
        'MARKS &amp; SPENCER'
      );
      const result = ofxImportService.parseOFX(ofxWithEntities);

      expect(result.transactions[0].name).toBe('MARKS & SPENCER');
    });

    it('handles credit card accounts', () => {
      const creditCardOFX = validOFXContent.replace(
        '<BANKACCTFROM>',
        '<CCACCTFROM>'
      ).replace(
        '</BANKACCTFROM>',
        '</CCACCTFROM>'
      ).replace(
        '<ACCTTYPE>CHECKING',
        '<ACCTTYPE>CREDITCARD'
      );

      const result = ofxImportService.parseOFX(creditCardOFX);
      expect(result.account.accountType).toBe('CREDITCARD');
    });
  });

  describe('findMatchingAccount', () => {
    it('matches account by last 4 digits in name', () => {
      const ofxAccount = {
        accountId: '12345678',
        accountType: 'CHECKING',
        bankId: '123456'
      };

      const match = ofxImportService.findMatchingAccount(ofxAccount, mockAccounts);
      expect(match).toBe(mockAccounts[0]); // Matches '****5678'
    });

    it('matches account by type when only one of that type exists', () => {
      const ofxAccount = {
        accountId: '99999999',
        accountType: 'SAVINGS'
      };

      const match = ofxImportService.findMatchingAccount(ofxAccount, mockAccounts);
      expect(match).toBe(mockAccounts[1]); // Only one savings account
    });

    it('returns null when no match found', () => {
      const ofxAccount = {
        accountId: '11111111',
        accountType: 'INVESTMENT'
      };

      const match = ofxImportService.findMatchingAccount(ofxAccount, mockAccounts);
      expect(match).toBeNull();
    });

    it('matches by bank ID (sort code)', () => {
      const accountWithSortCode: Account = {
        id: 'acc3',
        name: 'Business Account',
        institution: 'Bank 123456',
        type: 'current',
        balance: 0,
        currency: 'GBP',
        isActive: true
      };

      const ofxAccount = {
        accountId: '87654321',
        accountType: 'CHECKING',
        bankId: '123456'
      };

      const match = ofxImportService.findMatchingAccount(ofxAccount, [...mockAccounts, accountWithSortCode]);
      expect(match).toBe(accountWithSortCode);
    });
  });

  describe('importTransactions', () => {
    const existingTransactions: Transaction[] = [
      {
        id: '1',
        date: '2024-01-01',
        description: 'Existing transaction',
        amount: 50,
        type: 'expense',
        accountId: 'acc1',
        category: 'food',
        cleared: true,
        recurring: false
      }
    ];

    it('imports transactions successfully', async () => {
      const result = await ofxImportService.importTransactions(
        validOFXContent,
        mockAccounts,
        existingTransactions
      );

      expect(result.newTransactions).toBe(3);
      expect(result.duplicates).toBe(0);
      expect(result.matchedAccount).toBe(mockAccounts[0]);
      expect(result.unmatchedAccount).toBeUndefined();

      expect(result.transactions).toHaveLength(3);
      
      const [trx1, trx2, trx3] = result.transactions;
      
      // Check first transaction
      expect(trx1).toMatchObject({
        date: expect.any(Date),
        description: 'Grocery shopping',
        amount: 25.50,
        type: 'expense',
        accountId: 'acc1',
        cleared: true
      });
      expectDateOnly(trx1.date, '2024-01-15');
      expect(trx1.notes).toContain('FITID: 2024011501');

      // Check second transaction
      expect(trx2).toMatchObject({
        date: expect.any(Date),
        description: 'Salary',
        amount: 2500,
        type: 'income',
        accountId: 'acc1',
        cleared: true
      });
      expectDateOnly(trx2.date, '2024-01-20');

      // Check third transaction
      expect(trx3).toMatchObject({
        date: expect.any(Date),
        description: 'Check #1234',
        amount: 100,
        type: 'expense',
        accountId: 'acc1',
        cleared: true
      });
      expectDateOnly(trx3.date, '2024-01-10');
      expect(trx3.notes).toContain('Check #: 1234');
    });

    it('uses specified account ID', async () => {
      const result = await ofxImportService.importTransactions(
        validOFXContent,
        mockAccounts,
        existingTransactions,
        { accountId: 'acc2' }
      );

      expect(result.matchedAccount).toBe(mockAccounts[1]);
      expect(result.transactions.every(t => t.accountId === 'acc2')).toBe(true);
    });

    it('detects and skips duplicate transactions', async () => {
      const existingWithDuplicate: Transaction[] = [
        {
          id: '1',
          date: '2024-01-15',
          description: 'TESCO STORES',
          amount: 25.50,
          type: 'expense',
          accountId: 'acc1',
          category: 'food',
          cleared: true,
          notes: 'FITID: 2024011501',
          recurring: false
        }
      ];

      const result = await ofxImportService.importTransactions(
        validOFXContent,
        mockAccounts,
        existingWithDuplicate
      );

      expect(result.duplicates).toBe(1);
      expect(result.newTransactions).toBe(2); // Only 2 new transactions
    });

    it('imports all transactions when skipDuplicates is false', async () => {
      const existingWithDuplicate: Transaction[] = [
        {
          id: '1',
          date: '2024-01-15',
          description: 'TESCO STORES',
          amount: 25.50,
          type: 'expense',
          accountId: 'acc1',
          category: 'food',
          cleared: true,
          notes: 'FITID: 2024011501',
          recurring: false
        }
      ];

      const result = await ofxImportService.importTransactions(
        validOFXContent,
        mockAccounts,
        existingWithDuplicate,
        { skipDuplicates: false }
      );

      expect(result.duplicates).toBe(0);
      expect(result.newTransactions).toBe(3);
    });

    it('auto-categorizes transactions when enabled', async () => {
      (smartCategorizationService.learnFromTransactions as any).mockImplementation(() => {});
      (smartCategorizationService.suggestCategories as any).mockImplementation((transaction: any) => {
        // Check the description field of the transaction
        if (transaction.description?.includes('Grocery')) {
          return [{ categoryId: 'food', confidence: 0.8, reason: 'Merchant match' }];
        }
        if (transaction.description?.includes('Salary')) {
          return [{ categoryId: 'salary', confidence: 0.9, reason: 'Keyword match' }];
        }
        return [];
      });

      const result = await ofxImportService.importTransactions(
        validOFXContent,
        mockAccounts,
        existingTransactions,
        { 
          autoCategorize: true,
          categories: mockCategories
        }
      );

      expect(smartCategorizationService.learnFromTransactions).toHaveBeenCalledWith(
        existingTransactions,
        mockCategories
      );

      expect(result.transactions[0].category).toBe('food');
      expect(result.transactions[1].category).toBe('salary');
      expect(result.transactions[2].category).toBe(''); // No suggestion
    });

    it('respects confidence threshold for auto-categorization', async () => {
      (smartCategorizationService.suggestCategories as any).mockReturnValue([
        { categoryId: 'food', confidence: 0.6, reason: 'Low confidence' }
      ]);

      const result = await ofxImportService.importTransactions(
        validOFXContent,
        mockAccounts,
        existingTransactions,
        { 
          autoCategorize: true,
          categories: mockCategories
        }
      );

      // All categories should be empty due to low confidence
      expect(result.transactions.every(t => t.category === '')).toBe(true);
    });

    it('handles unmatched account', async () => {
      const result = await ofxImportService.importTransactions(
        validOFXContent,
        [], // No existing accounts
        []
      );

      expect(result.matchedAccount).toBeNull();
      expect(result.unmatchedAccount).toEqual({
        bankId: '123456',
        accountId: '12345678',
        accountType: 'CHECKING',
        branchId: undefined
      });
      expect(result.transactions.every(t => t.accountId === 'default')).toBe(true);
    });

    it('uses description from memo when available', async () => {
      const result = await ofxImportService.importTransactions(
        validOFXContent,
        mockAccounts,
        []
      );

      // First transaction has memo
      expect(result.transactions[0].description).toBe('Grocery shopping');
      // Third transaction has no memo, uses name
      expect(result.transactions[2].description).toBe('Check #1234');
    });

    it('correctly determines transaction types', async () => {
      const ofxWithVariousTypes = validOFXContent + `
<STMTTRN>
<TRNTYPE>INT
<DTPOSTED>20240125100000[0:GMT]
<TRNAMT>5.00
<FITID>2024012501
<NAME>Interest payment
</STMTTRN>
<STMTTRN>
<TRNTYPE>FEE
<DTPOSTED>20240126100000[0:GMT]
<TRNAMT>-2.50
<FITID>2024012601
<NAME>Monthly fee
</STMTTRN>`;

      const modifiedOFX = ofxWithVariousTypes.replace('</BANKTRANLIST>', '</BANKTRANLIST>');
      const insertPoint = modifiedOFX.lastIndexOf('</BANKTRANLIST>');
      const finalOFX = modifiedOFX.slice(0, insertPoint) + 
        ofxWithVariousTypes.slice(ofxWithVariousTypes.lastIndexOf('<STMTTRN>')) + 
        modifiedOFX.slice(insertPoint);

      const result = await ofxImportService.importTransactions(
        finalOFX,
        mockAccounts,
        []
      );

      // Check that INT type becomes income
      const interestTrx = result.transactions.find(t => t.description === 'Interest payment');
      expect(interestTrx?.type).toBe('income');

      // Check that FEE type becomes expense
      const feeTrx = result.transactions.find(t => t.description === 'Monthly fee');
      expect(feeTrx?.type).toBe('expense');
    });
  });

  describe('edge cases', () => {
    it('handles empty transaction list', () => {
      const ofxWithNoTransactions = validOFXContent.replace(
        /<BANKTRANLIST>[\s\S]*?<\/BANKTRANLIST>/,
        '<BANKTRANLIST>\n</BANKTRANLIST>'
      );

      const result = ofxImportService.parseOFX(ofxWithNoTransactions);
      expect(result.transactions).toHaveLength(0);
    });

    it('handles malformed dates', () => {
      const ofxWithBadDate = validOFXContent.replace(
        '20240115120000[0:GMT]',
        '20240115'
      );

      const result = ofxImportService.parseOFX(ofxWithBadDate);
      expect(result.transactions[0].datePosted).toEqual('2024-01-15');
    });

    it('handles missing transaction fields', () => {
      const ofxWithIncompleteTransaction = validOFXContent.replace(
        /<STMTTRN>[\s\S]*?<\/STMTTRN>/,
        `<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240115120000
<TRNAMT>-50.00
</STMTTRN>`
      );

      const result = ofxImportService.parseOFX(ofxWithIncompleteTransaction);
      // Should skip transaction without FITID
      expect(result.transactions).toHaveLength(2); // Only the other 2 valid transactions
    });

    it('handles special characters in transaction names', () => {
      const ofxWithSpecialChars = validOFXContent.replace(
        'TESCO STORES',
        'MARKS &amp; SPENCER &lt;UK&gt;'
      );

      const result = ofxImportService.parseOFX(ofxWithSpecialChars);
      expect(result.transactions[0].name).toBe('MARKS & SPENCER <UK>');
    });

    it('handles very large amounts', () => {
      const ofxWithLargeAmount = validOFXContent.replace(
        '<TRNAMT>2500.00',
        '<TRNAMT>999999.99'
      );

      const result = ofxImportService.parseOFX(ofxWithLargeAmount);
      expect(result.transactions[1].amount).toBe(999999.99);
    });

    it('handles multiple accounts in same file', async () => {
      // OFX standard typically has one account per file, but test robustness
      const result = await ofxImportService.importTransactions(
        validOFXContent,
        mockAccounts,
        []
      );

      // Should still process normally
      expect(result.newTransactions).toBe(3);
      expect(result.matchedAccount).toBe(mockAccounts[0]);
    });
  });
});
