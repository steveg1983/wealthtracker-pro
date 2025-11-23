/**
 * QIFImportService Tests
 * Tests for QIF (Quicken Interchange Format) file parsing and import
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { qifImportService } from './qifImportService';
import { smartCategorizationService } from './smartCategorizationService';
import type { Transaction, Category } from '../types';

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

describe('QIFImportService', () => {
  // Sample QIF content
  const validQIFContent = `!Type:Bank
D01/15/2024
T-25.50
PTesco Stores
MGrocery shopping
LFood & Dining
CX
^
D01/20/2024
T2500.00
PEmployer Payment
MSalary deposit
LSalary
C*
^
D01/10/2024
T-100.00
PCheck #1234
MRent payment
LHousing
N1234
^
D12/25/23
T-150.00
POnline Purchase
MAMAZON.COM
LShopping
^`;

  const mockCategories: Category[] = [
    { id: 'food', name: 'Food & Dining', type: 'expense', icon: 'restaurant' },
    { id: 'salary', name: 'Salary', type: 'income', icon: 'briefcase' },
    { id: 'housing', name: 'Housing', type: 'expense', icon: 'home' },
    { id: 'shopping', name: 'Shopping', type: 'expense', icon: 'shopping-bag' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseQIF', () => {
    it('parses valid QIF content', () => {
      const result = qifImportService.parseQIF(validQIFContent);

      expect(result.accountType).toBe('Bank');
      expect(result.transactions).toHaveLength(4);
    });

    it('parses transactions correctly', () => {
      const result = qifImportService.parseQIF(validQIFContent);
      const [trx1, trx2, trx3, trx4] = result.transactions;

      // First transaction
      expect(trx1).toEqual({
        date: '2024-01-15',
        amount: -25.50,
        payee: 'Tesco Stores',
        memo: 'Grocery shopping',
        category: 'Food & Dining',
        cleared: true
      });

      // Second transaction
      expect(trx2).toEqual({
        date: '2024-01-20',
        amount: 2500,
        payee: 'Employer Payment',
        memo: 'Salary deposit',
        category: 'Salary',
        cleared: true
      });

      // Third transaction with check number
      expect(trx3).toEqual({
        date: '2024-01-10',
        amount: -100,
        payee: 'Check #1234',
        memo: 'Rent payment',
        category: 'Housing',
        checkNumber: '1234'
      });

      // Fourth transaction with 2-digit year
      expect(trx4).toEqual({
        date: '2023-12-25',
        amount: -150,
        payee: 'Online Purchase',
        memo: 'AMAZON.COM',
        category: 'Shopping'
      });
    });

    it('handles different date formats', () => {
      const qifWithVariousDates = `!Type:Bank
D1/5/2024
T-10.00
PTest 1
^
D12/25'23
T-20.00
PTest 2
^
D06/30/2024
T-30.00
PTest 3
^`;

      const result = qifImportService.parseQIF(qifWithVariousDates);
      
      expect(result.transactions[0].date).toBe('2024-01-05');
      expect(result.transactions[1].date).toBe('2023-12-25');
      expect(result.transactions[2].date).toBe('2024-06-30');
    });

    it('handles different amount formats', () => {
      const qifWithVariousAmounts = `!Type:Bank
D01/01/2024
T1,234.56
PPositive with comma
^
D01/02/2024
T-987.65
PNegative with minus
^
D01/03/2024
T(543.21)
PNegative with parentheses
^
D01/04/2024
T£100.00
PWith currency symbol
^`;

      const result = qifImportService.parseQIF(qifWithVariousAmounts);
      
      expect(result.transactions[0].amount).toBe(1234.56);
      expect(result.transactions[1].amount).toBe(-987.65);
      expect(result.transactions[2].amount).toBe(-543.21);
      expect(result.transactions[3].amount).toBe(100);
    });

    it('handles investment account type', () => {
      const investmentQIF = `!Type:Invst
D01/15/2024
NBuy
YAAPL
I150.50
Q10
U1505.00
T1505.00
^`;

      const result = qifImportService.parseQIF(investmentQIF);
      expect(result.accountType).toBe('Invst');
      expect(result.transactions[0].amount).toBe(1505);
    });

    it('handles transactions without optional fields', () => {
      const minimalQIF = `!Type:Bank
D01/01/2024
T-50.00
^
D01/02/2024
T100.00
PPayee Only
^`;

      const result = qifImportService.parseQIF(minimalQIF);
      
      expect(result.transactions[0]).toEqual({
        date: '2024-01-01',
        amount: -50
      });
      
      expect(result.transactions[1]).toEqual({
        date: '2024-01-02',
        amount: 100,
        payee: 'Payee Only'
      });
    });

    it('handles categories with brackets', () => {
      const qifWithBrackets = `!Type:Bank
D01/01/2024
T-50.00
L[Food & Dining]
^
D01/02/2024
T-100.00
L[Housing]/Rent
^`;

      const result = qifImportService.parseQIF(qifWithBrackets);
      
      expect(result.transactions[0].category).toBe('Food & Dining');
      expect(result.transactions[1].category).toBe('Housing/Rent');
    });

    it('handles empty content', () => {
      const result = qifImportService.parseQIF('');
      expect(result.transactions).toHaveLength(0);
      expect(result.accountType).toBeUndefined();
    });

    it('handles content without type declaration', () => {
      const qifWithoutType = `D01/01/2024
T-50.00
PTest Transaction
^`;

      const result = qifImportService.parseQIF(qifWithoutType);
      expect(result.accountType).toBeUndefined();
      expect(result.transactions).toHaveLength(1);
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
      const result = await qifImportService.importTransactions(
        validQIFContent,
        'acc1',
        existingTransactions
      );

      expect(result.newTransactions).toBe(4);
      expect(result.duplicates).toBe(0);
      expect(result.transactions).toHaveLength(4);

      const [trx1, trx2, trx3, _trx4] = result.transactions;

      // Check first transaction
      expect(trx1).toMatchObject({
        date: expect.any(Date),
        description: 'Tesco Stores - Grocery shopping',
        amount: 25.50,
        type: 'expense',
        accountId: 'acc1',
        category: 'Food & Dining',
        cleared: true
      });
      expectDateOnly(trx1.date, '2024-01-15');

      // Check second transaction
      expect(trx2).toMatchObject({
        date: expect.any(Date),
        description: 'Employer Payment - Salary deposit',
        amount: 2500,
        type: 'income',
        accountId: 'acc1',
        category: 'Salary',
        cleared: true
      });
      expectDateOnly(trx2.date, '2024-01-20');

      // Check third transaction with check number
      expect(trx3).toMatchObject({
        date: expect.any(Date),
        description: 'Check #1234 - Rent payment',
        amount: 100,
        type: 'expense',
        accountId: 'acc1',
        category: 'Housing',
        cleared: false,
        notes: 'Check #: 1234'
      });
      expectDateOnly(trx3.date, '2024-01-10');
    });

    it('detects and skips duplicate transactions', async () => {
      const existingWithDuplicate: Transaction[] = [
        {
          id: '1',
          date: '2024-01-15',
          description: 'Tesco Stores purchase',
          amount: 25.50,
          type: 'expense',
          accountId: 'acc1',
          category: 'food',
          cleared: true,
          recurring: false
        }
      ];

      const result = await qifImportService.importTransactions(
        validQIFContent,
        'acc1',
        existingWithDuplicate
      );

      expect(result.duplicates).toBe(1);
      expect(result.newTransactions).toBe(3);
    });

    it('auto-categorizes transactions when enabled', async () => {
      const qifWithoutCategories = `!Type:Bank
D01/01/2024
T-25.00
PGrocery Store
^
D01/02/2024
T3000.00
PPayroll
^`;

      (smartCategorizationService.learnFromTransactions as any).mockImplementation(() => {});
      (smartCategorizationService.suggestCategories as any).mockImplementation((transaction: any) => {
        if (transaction.description?.includes('Grocery')) {
          return [{ categoryId: 'food', confidence: 0.8, reason: 'Merchant match' }];
        }
        if (transaction.description?.includes('Payroll')) {
          return [{ categoryId: 'salary', confidence: 0.9, reason: 'Keyword match' }];
        }
        return [];
      });

      const result = await qifImportService.importTransactions(
        qifWithoutCategories,
        'acc1',
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
    });

    it('preserves existing categories when auto-categorize is enabled', async () => {
      (smartCategorizationService.suggestCategories as any).mockReturnValue([
        { categoryId: 'different', confidence: 0.9, reason: 'Test' }
      ]);

      const result = await qifImportService.importTransactions(
        validQIFContent,
        'acc1',
        existingTransactions,
        {
          autoCategorize: true,
          categories: mockCategories
        }
      );

      // Should keep original categories from QIF
      expect(result.transactions[0].category).toBe('Food & Dining');
      expect(result.transactions[1].category).toBe('Salary');
    });

    it('handles transactions with only payee', async () => {
      const qifPayeeOnly = `!Type:Bank
D01/01/2024
T-50.00
PSimple Payee
^`;

      const result = await qifImportService.importTransactions(
        qifPayeeOnly,
        'acc1',
        []
      );

      expect(result.transactions[0].description).toBe('Simple Payee');
    });

    it('handles transactions with only memo', async () => {
      const qifMemoOnly = `!Type:Bank
D01/01/2024
T-50.00
MJust a memo
^`;

      const result = await qifImportService.importTransactions(
        qifMemoOnly,
        'acc1',
        []
      );

      expect(result.transactions[0].description).toBe('Just a memo');
    });

    it('handles transactions with neither payee nor memo', async () => {
      const qifMinimal = `!Type:Bank
D01/01/2024
T-50.00
^`;

      const result = await qifImportService.importTransactions(
        qifMinimal,
        'acc1',
        []
      );

      expect(result.transactions[0].description).toBe('QIF Transaction');
    });

    it('handles same payee and memo', async () => {
      const qifSamePayeeMemo = `!Type:Bank
D01/01/2024
T-50.00
PSame Text
MSame Text
^`;

      const result = await qifImportService.importTransactions(
        qifSamePayeeMemo,
        'acc1',
        []
      );

      expect(result.transactions[0].description).toBe('Same Text');
    });

    it('correctly determines transaction type from amount', async () => {
      const result = await qifImportService.importTransactions(
        validQIFContent,
        'acc1',
        []
      );

      // Negative amounts should be expenses
      expect(result.transactions[0].type).toBe('expense'); // -25.50
      expect(result.transactions[2].type).toBe('expense'); // -100
      expect(result.transactions[3].type).toBe('expense'); // -150

      // Positive amounts should be income
      expect(result.transactions[1].type).toBe('income'); // 2500
    });

    it('handles year boundary correctly for 2-digit years', () => {
      // Mock current year as 2024
      vi.setSystemTime(new Date('2024-06-15'));

      const qifWith2DigitYears = `!Type:Bank
D12/31/23
T-100.00
PEnd of 2023
^
D01/01/24
T-200.00
PStart of 2024
^
D12/31/99
T-300.00
POld transaction
^
D01/01/35
T-400.00
PFuture transaction
^`;

      const result = qifImportService.parseQIF(qifWith2DigitYears);

      expect(result.transactions[0].date).toBe('2023-12-31');
      expect(result.transactions[1].date).toBe('2024-01-01');
      expect(result.transactions[2].date).toBe('1999-12-31'); // More than 10 years ahead
      expect(result.transactions[3].date).toBe('1935-01-01'); // Actually 35 is interpreted as 1935

      vi.useRealTimers();
    });
  });

  describe('edge cases', () => {
    it('handles malformed transactions', async () => {
      const malformedQIF = `!Type:Bank
D01/01/2024
PSome payee without amount
^
T-50.00
PAmount without date
^
D01/02/2024
T-75.00
PValid transaction
^`;

      const result = await qifImportService.importTransactions(
        malformedQIF,
        'acc1',
        []
      );

      // Should only import the valid transaction
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(75);
    });

    it('handles special characters in text fields', async () => {
      const qifWithSpecialChars = `!Type:Bank
D01/01/2024
T-50.00
PMark's & Spencer
MPayment for "special" items
L[Special/Category]
^`;

      const result = await qifImportService.importTransactions(
        qifWithSpecialChars,
        'acc1',
        []
      );

      expect(result.transactions[0].description).toBe('Mark\'s & Spencer - Payment for "special" items');
      expect(result.transactions[0].category).toBe('Special/Category');
    });

    it('handles very large amounts', async () => {
      const qifWithLargeAmount = `!Type:Bank
D01/01/2024
T999999.99
PLarge deposit
^
D01/02/2024
T-888888.88
PLarge withdrawal
^`;

      const result = await qifImportService.importTransactions(
        qifWithLargeAmount,
        'acc1',
        []
      );

      expect(result.transactions[0].amount).toBe(999999.99);
      expect(result.transactions[1].amount).toBe(888888.88);
    });

    it('handles Windows line endings', async () => {
      const qifWithCRLF = "!Type:Bank\r\nD01/01/2024\r\nT-50.00\r\nPTest\r\n^\r\n";

      const result = await qifImportService.importTransactions(
        qifWithCRLF,
        'acc1',
        []
      );

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(50);
    });

    it('handles multiple cleared status indicators', () => {
      const qifWithClearedStatus = `!Type:Bank
D01/01/2024
T-50.00
CX
^
D01/02/2024
T-60.00
C*
^
D01/03/2024
T-70.00
C
^
D01/04/2024
T-80.00
CR
^`;

      const result = qifImportService.parseQIF(qifWithClearedStatus);

      expect(result.transactions[0].cleared).toBe(true); // X
      expect(result.transactions[1].cleared).toBe(true); // *
      expect(result.transactions[2].cleared).toBe(false); // empty
      expect(result.transactions[3].cleared).toBe(false); // R (reconciled, but we treat as not cleared)
    });

    it('handles missing transaction end marker', () => {
      const qifWithoutEndMarker = `!Type:Bank
D01/01/2024
T-50.00
PIncomplete transaction`;

      const result = qifImportService.parseQIF(qifWithoutEndMarker);

      // Should still parse the transaction
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(-50);
    });
  });
});
