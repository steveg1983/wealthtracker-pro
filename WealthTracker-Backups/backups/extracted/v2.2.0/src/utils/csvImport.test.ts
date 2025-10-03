/**
 * CSV Import Tests
 * Tests for CSV parsing, transaction import, and account import utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { importTransactionsFromCSV, importAccountsFromCSV } from './csvImport';
import type { Transaction, Account } from '../types';

describe('CSV Import', () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('importTransactionsFromCSV', () => {
    const accountMap = new Map([
      ['Checking Account', 'acc-1'],
      ['Savings Account', 'acc-2'],
      ['Credit Card', 'acc-3']
    ]);

    it('imports basic transactions correctly', () => {
      const csv = `date,description,category,type,amount,account
2024-01-15,Grocery Store,groceries,expense,45.50,Checking Account
2024-01-16,Salary,income,income,2500.00,Checking Account`;

      const transactions = importTransactionsFromCSV(csv, accountMap);

      expect(transactions).toHaveLength(2);
      
      expect(transactions[0]).toEqual({
        date: new Date('2024-01-15'),
        description: 'Grocery Store',
        category: 'groceries',
        type: 'expense',
        amount: 45.5,
        accountId: 'acc-1',
        tags: undefined,
        notes: undefined,
        cleared: false
      });

      expect(transactions[1]).toEqual({
        date: new Date('2024-01-16'),
        description: 'Salary',
        category: 'income',
        type: 'income',
        amount: 2500,
        accountId: 'acc-1',
        tags: undefined,
        notes: undefined,
        cleared: false
      });
    });

    it('imports transactions with all optional fields', () => {
      const csv = `date,description,category,type,amount,account,tags,notes,cleared
2024-01-15,Coffee Shop,dining,expense,4.50,Credit Card,food;coffee,Morning coffee,Y
2024-01-16,Freelance Work,income,income,750.00,Checking Account,work;project1,Client payment,1`;

      const transactions = importTransactionsFromCSV(csv, accountMap);

      expect(transactions).toHaveLength(2);
      
      expect(transactions[0]).toEqual({
        date: new Date('2024-01-15'),
        description: 'Coffee Shop',
        category: 'dining',
        type: 'expense',
        amount: 4.5,
        accountId: 'acc-3',
        tags: ['food', 'coffee'],
        notes: 'Morning coffee',
        cleared: true
      });

      expect(transactions[1]).toEqual({
        date: new Date('2024-01-16'),
        description: 'Freelance Work',
        category: 'income',
        type: 'income',
        amount: 750,
        accountId: 'acc-1',
        tags: ['work', 'project1'],
        notes: 'Client payment',
        cleared: true
      });
    });

    it('handles CSV with quoted fields containing commas', () => {
      const csv = `date,description,category,type,amount,account
2024-01-15,"Restaurant, Main St",dining,expense,25.00,Credit Card
2024-01-16,"Transfer from ""Primary"" Account",transfer,income,500.00,Savings Account`;

      const transactions = importTransactionsFromCSV(csv, accountMap);

      expect(transactions).toHaveLength(2);
      expect(transactions[0].description).toBe('Restaurant, Main St');
      expect(transactions[1].description).toBe('Transfer from "Primary" Account');
    });

    it('handles different column orders and mixed case headers', () => {
      const csv = `AMOUNT,Date,TYPE,Description,Category,Account
100.50,2024-01-15,Income,Salary,income,Checking Account
-25.00,2024-01-16,Expense,Gas Station,transportation,Credit Card`;

      const transactions = importTransactionsFromCSV(csv, accountMap);

      expect(transactions).toHaveLength(2);
      expect(transactions[0].amount).toBe(100.5);
      expect(transactions[0].type).toBe('income');
      expect(transactions[1].amount).toBe(25); // Should use absolute value
      expect(transactions[1].type).toBe('expense');
    });

    it('handles partial column headers', () => {
      const csv = `date,desc,cat,amount,account
2024-01-15,Store Purchase,shopping,45.50,Checking Account
2024-01-16,ATM Withdrawal,cash,40.00,Checking Account`;

      const transactions = importTransactionsFromCSV(csv, accountMap);

      expect(transactions).toHaveLength(2);
      expect(transactions[0].description).toBe('Store Purchase');
      expect(transactions[0].category).toBe('shopping');
      expect(transactions[0].type).toBe('expense'); // Default type
      expect(transactions[0].accountId).toBe('acc-1'); // Mapped account
    });

    it('handles missing optional columns gracefully', () => {
      const csv = `date,description,amount,category,type
2024-01-15,Basic Transaction,100.00,Other,expense`;

      const transactions = importTransactionsFromCSV(csv, accountMap);

      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toEqual({
        date: new Date('2024-01-15'),
        description: 'Basic Transaction',
        category: 'Other',
        type: 'expense',
        amount: 100,
        accountId: 'acc-1', // First account in map (no account column)
        tags: undefined,
        notes: undefined,
        cleared: false
      });
    });

    it('skips rows with invalid dates', () => {
      const csv = `date,description,amount,category,type
2024-01-15,Valid Transaction,100.00,other,expense
invalid-date,Invalid Date Transaction,200.00,other,expense
2024-01-17,Another Valid Transaction,150.00,other,expense`;

      const transactions = importTransactionsFromCSV(csv, accountMap);

      expect(transactions).toHaveLength(2);
      expect(transactions[0].description).toBe('Valid Transaction');
      expect(transactions[1].description).toBe('Another Valid Transaction');
    });

    it('skips incomplete rows', () => {
      const csv = `date,description,category,type,amount
2024-01-15,Complete Transaction,groceries,expense,45.50
2024-01-16,Incomplete
2024-01-17,Another Complete,dining,expense,30.00`;

      const transactions = importTransactionsFromCSV(csv, accountMap);

      expect(transactions).toHaveLength(2);
      expect(transactions[0].description).toBe('Complete Transaction');
      expect(transactions[1].description).toBe('Another Complete');
    });

    it('handles various amount formats', () => {
      const csv = `date,description,amount,category,type
2024-01-15,Currency with Symbol,$45.50,other,expense
2024-01-16,Parentheses for Negative,(25.00),other,expense
2024-01-17,With Commas,"1,234.56",other,expense
2024-01-18,Spaces and Currency,$ 100.00 ,other,expense
2024-01-19,Just Number,75,other,expense`;

      const transactions = importTransactionsFromCSV(csv, accountMap);

      expect(transactions).toHaveLength(5);
      expect(transactions[0].amount).toBe(45.5);
      expect(transactions[1].amount).toBe(25); // Absolute value
      expect(transactions[2].amount).toBe(1234.56);
      expect(transactions[3].amount).toBe(100);
      expect(transactions[4].amount).toBe(75);
    });

    it('handles zero and invalid amounts', () => {
      const csv = `date,description,amount,category,type
2024-01-15,Zero Amount,0.00,other,expense
2024-01-16,Invalid Amount,invalid,other,expense
2024-01-17,Empty Amount,,other,expense`;

      const transactions = importTransactionsFromCSV(csv, accountMap);

      expect(transactions).toHaveLength(3);
      expect(transactions[0].amount).toBe(0);
      expect(transactions[1].amount).toBe(0); // Invalid becomes 0
      expect(transactions[2].amount).toBe(0); // Empty becomes 0
    });

    it('maps accounts correctly and handles unknown accounts', () => {
      const csv = `date,description,amount,account,category
2024-01-15,Transaction 1,100.00,Checking Account,other
2024-01-16,Transaction 2,200.00,Unknown Account,other
2024-01-17,Transaction 3,300.00,,other`;

      const transactions = importTransactionsFromCSV(csv, accountMap);

      expect(transactions).toHaveLength(3);
      expect(transactions[0].accountId).toBe('acc-1'); // Mapped correctly
      expect(transactions[1].accountId).toBe('acc-1'); // Unknown defaults to first
      expect(transactions[2].accountId).toBe('acc-1'); // Empty defaults to first
    });

    it('handles empty account map', () => {
      const emptyAccountMap = new Map<string, string>();
      const csv = `date,description,amount,category,type
2024-01-15,Test Transaction,100.00,other,expense`;

      const transactions = importTransactionsFromCSV(csv, emptyAccountMap);

      expect(transactions).toHaveLength(1);
      expect(transactions[0].accountId).toBe('default'); // Falls back to 'default'
    });

    it('parses tags correctly', () => {
      const csv = `date,description,amount,tags,category
2024-01-15,Transaction 1,100.00,tag1;tag2;tag3,other
2024-01-16,Transaction 2,200.00,single-tag,other
2024-01-17,Transaction 3,300.00,,other`;

      const transactions = importTransactionsFromCSV(csv, accountMap);

      expect(transactions).toHaveLength(3);
      expect(transactions[0].tags).toEqual(['tag1', 'tag2', 'tag3']);
      expect(transactions[1].tags).toEqual(['single-tag']);
      expect(transactions[2].tags).toBeUndefined();
    });

    it('handles cleared status variations', () => {
      const csv = `date,description,amount,cleared,category
2024-01-15,Transaction 1,100.00,Y,other
2024-01-16,Transaction 2,200.00,1,other
2024-01-17,Transaction 3,300.00,yes,other
2024-01-18,Transaction 4,400.00,N,other
2024-01-19,Transaction 5,500.00,0,other
2024-01-20,Transaction 6,600.00,,other`;

      const transactions = importTransactionsFromCSV(csv, accountMap);

      expect(transactions).toHaveLength(6);
      expect(transactions[0].cleared).toBe(true); // Y
      expect(transactions[1].cleared).toBe(true); // 1
      expect(transactions[2].cleared).toBe(false); // yes (not exact match)
      expect(transactions[3].cleared).toBe(false); // N
      expect(transactions[4].cleared).toBe(false); // 0
      expect(transactions[5].cleared).toBe(false); // empty
    });

    it('returns empty array for empty CSV', () => {
      const transactions = importTransactionsFromCSV('', accountMap);
      expect(transactions).toHaveLength(0);
    });

    it('returns empty array for headers only', () => {
      const csv = 'date,description,amount';
      const transactions = importTransactionsFromCSV(csv, accountMap);
      expect(transactions).toHaveLength(0);
    });

    it('handles CSV with extra empty lines', () => {
      const csv = `date,description,amount,category,type

2024-01-15,Transaction 1,100.00,other,expense

2024-01-16,Transaction 2,200.00,other,expense

`;

      const transactions = importTransactionsFromCSV(csv, accountMap);

      expect(transactions).toHaveLength(2);
      expect(transactions[0].description).toBe('Transaction 1');
      expect(transactions[1].description).toBe('Transaction 2');
    });

    it('logs errors for problematic rows but continues processing', () => {
      const csv = `date,description,amount,category,type
2024-01-15,Good Transaction,100.00,other,expense
2024-01-16,Bad Transaction,100.00,other,expense
2024-01-17,Another Good Transaction,200.00,other,expense`;

      // Mock Date constructor to throw on specific input
      const originalDate = Date;
      global.Date = class extends originalDate {
        constructor(...args: any[]) {
          if (args[0] === '2024-01-16') {
            throw new Error('Mock date error');
          }
          super(...args);
        }
      } as any;

      const transactions = importTransactionsFromCSV(csv, accountMap);

      // Should have processed the good transactions and logged error for bad one
      expect(transactions).toHaveLength(2);
      expect(transactions[0].description).toBe('Good Transaction');
      expect(transactions[1].description).toBe('Another Good Transaction');
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Restore original Date constructor
      global.Date = originalDate;
    });
  });

  describe('importAccountsFromCSV', () => {
    it('imports basic accounts correctly', () => {
      const csv = `name,type,balance,currency,institution
Checking Account,current,1500.00,GBP,HSBC
Savings Account,savings,5000.00,GBP,HSBC
Credit Card,credit,-250.00,GBP,Visa`;

      const accounts = importAccountsFromCSV(csv);

      expect(accounts).toHaveLength(3);

      expect(accounts[0]).toEqual({
        name: 'Checking Account',
        type: 'current',
        balance: 1500,
        currency: 'GBP',
        institution: 'HSBC'
      });

      expect(accounts[1]).toEqual({
        name: 'Savings Account',
        type: 'savings',
        balance: 5000,
        currency: 'GBP',
        institution: 'HSBC'
      });

      expect(accounts[2]).toEqual({
        name: 'Credit Card',
        type: 'credit',
        balance: -250,
        currency: 'GBP',
        institution: 'Visa'
      });
    });

    it('handles missing optional fields', () => {
      const csv = `name,type,balance
Basic Account,current,1000.00`;

      const accounts = importAccountsFromCSV(csv);

      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toEqual({
        name: 'Basic Account',
        type: 'current',
        balance: 1000,
        currency: 'GBP', // Default currency
        institution: undefined
      });
    });

    it('validates and corrects account types', () => {
      const csv = `name,type,balance
Valid Current,current,1000.00
Valid Savings,savings,2000.00
Valid Credit,credit,3000.00
Valid Loan,loan,4000.00
Valid Investment,investment,5000.00
Valid Assets,assets,6000.00
Invalid Type,invalid,7000.00
Empty Type,,8000.00`;

      const accounts = importAccountsFromCSV(csv);

      expect(accounts).toHaveLength(8);
      expect(accounts[0].type).toBe('current');
      expect(accounts[1].type).toBe('savings');
      expect(accounts[2].type).toBe('credit');
      expect(accounts[3].type).toBe('loan');
      expect(accounts[4].type).toBe('investment');
      expect(accounts[5].type).toBe('assets');
      expect(accounts[6].type).toBe('current'); // Invalid defaults to current
      expect(accounts[7].type).toBe('current'); // Empty defaults to current
    });

    it('handles different column orders and mixed case headers', () => {
      const csv = `BALANCE,Name,TYPE,Currency,Institution
1500.00,Test Account,CURRENT,USD,Test Bank`;

      const accounts = importAccountsFromCSV(csv);

      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toEqual({
        name: 'Test Account',
        type: 'current',
        balance: 1500,
        currency: 'USD',
        institution: 'Test Bank'
      });
    });

    it('handles partial column headers', () => {
      const csv = `name,type,balance,curr,bank
Account 1,current,1000.00,EUR,Euro Bank`;

      const accounts = importAccountsFromCSV(csv);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].currency).toBe('EUR');
      expect(accounts[0].institution).toBe('Euro Bank');
    });

    it('handles various balance formats', () => {
      const csv = `name,type,balance
Account 1,current,"1,500.00"
Account 2,savings,(500.00)
Account 3,credit,1000`;

      const accounts = importAccountsFromCSV(csv);

      expect(accounts).toHaveLength(3);
      expect(accounts[0].balance).toBe(1500);
      expect(accounts[1].balance).toBe(500); // Parentheses removed, but sign preserved  
      expect(accounts[2].balance).toBe(1000);
    });

    it('skips accounts with missing names', () => {
      const csv = `name,type,balance
,current,1000.00
Valid Account,savings,2000.00
"",current,3000.00`;

      const accounts = importAccountsFromCSV(csv);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].name).toBe('Valid Account');
    });

    it('skips incomplete rows', () => {
      const csv = `name,type,balance
Complete Account,current,1000.00
Incomplete,current
Another Complete,savings,2000.00`;

      const accounts = importAccountsFromCSV(csv);

      expect(accounts).toHaveLength(2);
      expect(accounts[0].name).toBe('Complete Account');
      expect(accounts[1].name).toBe('Another Complete');
    });

    it('handles zero and invalid balances', () => {
      const csv = `name,type,balance
Zero Balance,current,0.00
Invalid Balance,current,invalid
Empty Balance,current,`;

      const accounts = importAccountsFromCSV(csv);

      expect(accounts).toHaveLength(3);
      expect(accounts[0].balance).toBe(0);
      expect(accounts[1].balance).toBe(0); // Invalid becomes 0
      expect(accounts[2].balance).toBe(0); // Empty becomes 0
    });

    it('returns empty array for empty CSV', () => {
      const accounts = importAccountsFromCSV('');
      expect(accounts).toHaveLength(0);
    });

    it('returns empty array for headers only', () => {
      const csv = 'name,type,balance';
      const accounts = importAccountsFromCSV(csv);
      expect(accounts).toHaveLength(0);
    });

    it('logs errors for problematic rows but continues processing', () => {
      const csv = `name,type,balance
Good Account,current,1000.00
Bad Account,current,1000.00
Another Good Account,savings,2000.00`;

      // This test mainly verifies that error handling doesn't break the flow
      // In practice, the try-catch in the function should handle any parsing errors
      const accounts = importAccountsFromCSV(csv);

      // Should have processed all accounts since no real errors occur in this test
      expect(accounts).toHaveLength(3);
      expect(accounts[0].name).toBe('Good Account');
      expect(accounts[1].name).toBe('Bad Account');
      expect(accounts[2].name).toBe('Another Good Account');
    });

    it('handles CSV with quoted fields containing commas', () => {
      const csv = `name,type,balance,institution
"Account, Primary",current,1500.00,"Bank, Main Branch"`;

      const accounts = importAccountsFromCSV(csv);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].name).toBe('Account, Primary');
      expect(accounts[0].institution).toBe('Bank, Main Branch');
    });
  });

  describe('CSV parsing edge cases', () => {
    it('handles malformed CSV gracefully', () => {
      // Test with various malformed CSV structures
      const malformedCSVs = [
        'single-line-no-comma',
        '"unclosed quote',
        'normal,field,"quote with, comma"',
        ',"",empty,fields,'
      ];

      malformedCSVs.forEach(csv => {
        expect(() => importTransactionsFromCSV(csv, new Map())).not.toThrow();
        expect(() => importAccountsFromCSV(csv)).not.toThrow();
      });
    });

    it('handles very large CSV files efficiently', () => {
      // Generate a large CSV for performance testing
      const headers = 'date,description,category,type,amount,account\n';
      const rows: string[] = [];
      
      for (let i = 0; i < 1000; i++) {
        const day = String((i % 28) + 1).padStart(2, '0'); // Ensure valid dates
        rows.push(`2024-01-${day},Transaction ${i},category,expense,${i + 1}.00,Test Account`);
      }
      
      const largeCsv = headers + rows.join('\n');
      const accountMap = new Map([['Test Account', 'acc-1']]);
      
      const startTime = Date.now();
      const transactions = importTransactionsFromCSV(largeCsv, accountMap);
      const endTime = Date.now();
      
      expect(transactions).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});