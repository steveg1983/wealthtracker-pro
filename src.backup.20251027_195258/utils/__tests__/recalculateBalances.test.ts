import { describe, it, expect } from 'vitest';
import { recalculateAccountBalances } from '../recalculateBalances';
import type { Account, Transaction } from '../../types';
import { createMockTransaction } from '../../test/utils/renderWithProviders';

describe('recalculateBalances', () => {
  describe('recalculateAccountBalances', () => {
    it('calculates balance with income transactions', () => {
      const accounts: Account[] = [{
        id: '1',
        name: 'Test Account',
        type: 'current',
        balance: 1000, // This will be recalculated
        currency: 'GBP',
        institution: 'Test Bank',
        lastUpdated: new Date('2023-01-01'),
        openingBalance: 500
      }];

      const transactions: Transaction[] = [
        {
          id: 't1',
          accountId: '1',
          amount: 200,
          type: 'income',
          description: 'Salary',
          category: 'salary',
          date: new Date('2023-01-15'),
          cleared: true
        },
        {
          id: 't2',
          accountId: '1',
          amount: 100,
          type: 'income',
          description: 'Bonus',
          category: 'bonus',
          date: new Date('2023-01-20'),
          cleared: true
        }
      ];

      const result = recalculateAccountBalances(accounts, transactions);

      expect(result).toHaveLength(1);
      expect(result[0].balance).toBe(800); // 500 + 200 + 100
      expect(result[0].id).toBe('1');
      expect(result[0].name).toBe('Test Account');
      expect(result[0].lastUpdated).not.toEqual(new Date('2023-01-01')); // Should be updated
    });

    it('calculates balance with expense transactions', () => {
      const accounts: Account[] = [{
        id: '1',
        name: 'Test Account',
        type: 'current',
        balance: 1000,
        currency: 'GBP',
        institution: 'Test Bank',
        lastUpdated: new Date(),
        openingBalance: 1000
      }];

      const transactions: Transaction[] = [
        {
          id: 't1',
          accountId: '1',
          amount: 150,
          type: 'expense',
          description: 'Groceries',
          category: 'groceries',
          date: new Date(),
          cleared: true
        },
        {
          id: 't2',
          accountId: '1',
          amount: 50,
          type: 'expense',
          description: 'Gas',
          category: 'transport',
          date: new Date(),
          cleared: true
        }
      ];

      const result = recalculateAccountBalances(accounts, transactions);

      expect(result[0].balance).toBe(800); // 1000 - 150 - 50
    });

    it('calculates balance with mixed transaction types', () => {
      const accounts: Account[] = [{
        id: '1',
        name: 'Test Account',
        type: 'current',
        balance: 0,
        currency: 'USD',
        institution: 'Test Bank',
        lastUpdated: new Date(),
        openingBalance: 1000
      }];

      const transactions: Transaction[] = [
        {
          id: 't1',
          accountId: '1',
          amount: 500,
          type: 'income',
          description: 'Salary',
          category: 'salary',
          date: new Date(),
          cleared: true
        },
        {
          id: 't2',
          accountId: '1',
          amount: 200,
          type: 'expense',
          description: 'Rent',
          category: 'housing',
          date: new Date(),
          cleared: true
        },
        {
          id: 't3',
          accountId: '1',
          amount: 100,
          type: 'transfer',
          description: 'Transfer In',
          category: 'transfer',
          date: new Date(),
          cleared: true
        }
      ];

      const result = recalculateAccountBalances(accounts, transactions);

      expect(result[0].balance).toBe(1400); // 1000 + 500 - 200 + 100
    });

    it('handles transfer transactions correctly', () => {
      const accounts: Account[] = [{
        id: '1',
        name: 'Account 1',
        type: 'current',
        balance: 0,
        currency: 'USD',
        institution: 'Bank',
        lastUpdated: new Date(),
        openingBalance: 1000
      }];

      const transactions: Transaction[] = [
        {
          id: 't1',
          accountId: '1',
          amount: 200, // Positive = money coming in
          type: 'transfer',
          description: 'Transfer from savings',
          category: 'transfer',
          date: new Date(),
          cleared: true
        },
        {
          id: 't2',
          accountId: '1',
          amount: -150, // Negative = money going out
          type: 'transfer',
          description: 'Transfer to investment',
          category: 'transfer',
          date: new Date(),
          cleared: true
        }
      ];

      const result = recalculateAccountBalances(accounts, transactions);

      expect(result[0].balance).toBe(1050); // 1000 + 200 + (-150)
    });

    it('handles multiple accounts independently', () => {
      const accounts: Account[] = [
        {
          id: '1',
          name: 'Checking',
          type: 'current',
          balance: 0,
          currency: 'USD',
          institution: 'Bank A',
          lastUpdated: new Date(),
          openingBalance: 500
        },
        {
          id: '2',
          name: 'Savings',
          type: 'savings',
          balance: 0,
          currency: 'USD',
          institution: 'Bank A',
          lastUpdated: new Date(),
          openingBalance: 2000
        }
      ];

      const transactions: Transaction[] = [
        {
          id: 't1',
          accountId: '1',
          amount: 100,
          type: 'income',
          description: 'Income for checking',
          category: 'salary',
          date: new Date(),
          cleared: true
        },
        {
          id: 't2',
          accountId: '2',
          amount: 300,
          type: 'income',
          description: 'Interest for savings',
          category: 'interest',
          date: new Date(),
          cleared: true
        },
        {
          id: 't3',
          accountId: '1',
          amount: 50,
          type: 'expense',
          description: 'Checking expense',
          category: 'fees',
          date: new Date(),
          cleared: true
        }
      ];

      const result = recalculateAccountBalances(accounts, transactions);

      expect(result).toHaveLength(2);
      expect(result[0].balance).toBe(550); // Checking: 500 + 100 - 50
      expect(result[1].balance).toBe(2300); // Savings: 2000 + 300
    });

    it('handles account with no opening balance', () => {
      const accounts: Account[] = [{
        id: '1',
        name: 'New Account',
        type: 'current',
        balance: 0,
        currency: 'USD',
        institution: 'Bank',
        lastUpdated: new Date()
        // No openingBalance property
      }];

      const transactions: Transaction[] = [
        {
          id: 't1',
          accountId: '1',
          amount: 1000,
          type: 'income',
          description: 'Initial deposit',
          category: 'deposit',
          date: new Date(),
          cleared: true
        }
      ];

      const result = recalculateAccountBalances(accounts, transactions);

      expect(result[0].balance).toBe(1000); // 0 + 1000 (no opening balance defaults to 0)
    });

    it('handles account with no transactions', () => {
      const accounts: Account[] = [{
        id: '1',
        name: 'Empty Account',
        type: 'current',
        balance: 999, // This will be reset to opening balance
        currency: 'USD',
        institution: 'Bank',
        lastUpdated: new Date(),
        openingBalance: 500
      }];

      const transactions: Transaction[] = [];

      const result = recalculateAccountBalances(accounts, transactions);

      expect(result[0].balance).toBe(500); // Just the opening balance
      expect(result[0].lastUpdated).toBeInstanceOf(Date);
    });

    it('handles account with transactions from other accounts only', () => {
      const accounts: Account[] = [{
        id: '1',
        name: 'My Account',
        type: 'current',
        balance: 999,
        currency: 'USD',
        institution: 'Bank',
        lastUpdated: new Date(),
        openingBalance: 750
      }];

      const transactions: Transaction[] = [
        {
          id: 't1',
          accountId: '2', // Different account
          amount: 100,
          type: 'income',
          description: 'Someone elses transaction',
          category: 'salary',
          date: new Date(),
          cleared: true
        }
      ];

      const result = recalculateAccountBalances(accounts, transactions);

      expect(result[0].balance).toBe(750); // Just opening balance, no transactions for this account
    });

    it('rounds balance to 2 decimal places', () => {
      const accounts: Account[] = [{
        id: '1',
        name: 'Test Account',
        type: 'current',
        balance: 0,
        currency: 'USD',
        institution: 'Bank',
        lastUpdated: new Date(),
        openingBalance: 100
      }];

      const transactions: Transaction[] = [
        {
          id: 't1',
          accountId: '1',
          amount: 33.333,
          type: 'income',
          description: 'Irregular amount',
          category: 'other',
          date: new Date(),
          cleared: true
        },
        {
          id: 't2',
          accountId: '1',
          amount: 66.667,
          type: 'income',
          description: 'Another irregular amount',
          category: 'other',
          date: new Date(),
          cleared: true
        }
      ];

      const result = recalculateAccountBalances(accounts, transactions);

      expect(result[0].balance).toBe(200); // 100 + 33.333 + 66.667 = 200.000 (rounded)
    });

    it('handles decimal precision issues correctly', () => {
      const accounts: Account[] = [{
        id: '1',
        name: 'Test Account',
        type: 'current',
        balance: 0,
        currency: 'USD',
        institution: 'Bank',
        lastUpdated: new Date(),
        openingBalance: 0
      }];

      const transactions: Transaction[] = [
        {
          id: 't1',
          accountId: '1',
          amount: 0.1,
          type: 'income',
          description: 'Small amount 1',
          category: 'other',
          date: new Date(),
          cleared: true
        },
        {
          id: 't2',
          accountId: '1',
          amount: 0.2,
          type: 'income',
          description: 'Small amount 2',
          category: 'other',
          date: new Date(),
          cleared: true
        }
      ];

      const result = recalculateAccountBalances(accounts, transactions);

      expect(result[0].balance).toBe(0.3); // Should handle floating point correctly
    });

    it('preserves account properties other than balance and lastUpdated', () => {
      const originalDate = new Date('2023-01-01');
      const accounts: Account[] = [{
        id: 'preserve-test',
        name: 'Preserve Properties',
        type: 'savings',
        balance: 0,
        currency: 'EUR',
        institution: 'European Bank',
        lastUpdated: originalDate,
        openingBalance: 1000,
        sortingCode: '123456',
        accountNumber: '12345678',
        isActive: true
      }];

      const transactions: Transaction[] = [{
        id: 't1',
        accountId: 'preserve-test',
        amount: 100,
        type: 'income',
        description: 'Test transaction',
        category: 'test',
        date: new Date(),
        cleared: true
      }];

      const result = recalculateAccountBalances(accounts, transactions);

      expect(result[0].id).toBe('preserve-test');
      expect(result[0].name).toBe('Preserve Properties');
      expect(result[0].type).toBe('savings');
      expect(result[0].currency).toBe('EUR');
      expect(result[0].institution).toBe('European Bank');
      expect(result[0].openingBalance).toBe(1000);
      expect(result[0].sortingCode).toBe('123456');
      expect(result[0].accountNumber).toBe('12345678');
      expect(result[0].isActive).toBe(true);
      expect(result[0].balance).toBe(1100);
      expect(result[0].lastUpdated).not.toEqual(originalDate);
    });

    it('handles large numbers of transactions efficiently', () => {
      const accounts: Account[] = [{
        id: '1',
        name: 'High Volume Account',
        type: 'current',
        balance: 0,
        currency: 'USD',
        institution: 'Bank',
        lastUpdated: new Date(),
        openingBalance: 10000
      }];

      // Create 1000 small transactions
      const transactions: Transaction[] = Array(1000).fill(null).map((_, i) => ({
        id: `t${i}`,
        accountId: '1',
        amount: i % 2 === 0 ? 10 : -5, // Alternate between income and expense
        type: (i % 2 === 0 ? 'income' : 'expense') as 'income' | 'expense',
        description: `Transaction ${i}`,
        category: 'test',
        date: new Date(),
        cleared: true
      }));

      const startTime = Date.now();
      const result = recalculateAccountBalances(accounts, transactions);
      const endTime = Date.now();

      expect(result[0].balance).toBe(17500); // 10000 + (500 * 10) + (500 * 5) - all treated as positive amounts based on type
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });

    it('handles edge case with zero opening balance and zero transactions', () => {
      const accounts: Account[] = [{
        id: '1',
        name: 'Zero Account',
        type: 'current',
        balance: 999,
        currency: 'USD',
        institution: 'Bank',
        lastUpdated: new Date(),
        openingBalance: 0
      }];

      const transactions: Transaction[] = [];

      const result = recalculateAccountBalances(accounts, transactions);

      expect(result[0].balance).toBe(0);
    });

    it('handles negative opening balance (credit accounts)', () => {
      const accounts: Account[] = [{
        id: '1',
        name: 'Credit Card',
        type: 'credit',
        balance: 0,
        currency: 'USD',
        institution: 'Bank',
        lastUpdated: new Date(),
        openingBalance: -1000 // Credit balance
      }];

      const transactions: Transaction[] = [
        {
          id: 't1',
          accountId: '1',
          amount: 200,
          type: 'expense', // Charge on credit card
          description: 'Purchase',
          category: 'shopping',
          date: new Date(),
          cleared: true
        },
        {
          id: 't2',
          accountId: '1',
          amount: 500,
          type: 'income', // Payment on credit card
          description: 'Payment',
          category: 'payment',
          date: new Date(),
          cleared: true
        }
      ];

      const result = recalculateAccountBalances(accounts, transactions);

      expect(result[0].balance).toBe(-700); // -1000 - 200 + 500
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles empty accounts array', () => {
      const result = recalculateAccountBalances([], []);
      expect(result).toEqual([]);
    });

    it('handles empty transactions array', () => {
      const accounts: Account[] = [{
        id: '1',
        name: 'Solo Account',
        type: 'current',
        balance: 123.45,
        currency: 'USD',
        institution: 'Bank',
        lastUpdated: new Date(),
        openingBalance: 100
      }];

      const result = recalculateAccountBalances(accounts, []);

      expect(result[0].balance).toBe(100);
    });

    it('handles unknown transaction types gracefully', () => {
      const accounts: Account[] = [{
        id: '1',
        name: 'Test Account',
        type: 'current',
        balance: 0,
        currency: 'USD',
        institution: 'Bank',
        lastUpdated: new Date(),
        openingBalance: 1000
      }];

      const unknownTypeTransaction = createMockTransaction({
        id: 't1',
        accountId: '1',
        amount: 100,
        type: 'income',
        description: 'Unknown transaction type',
        category: 'other',
        date: new Date(),
        cleared: true
      });
      (unknownTypeTransaction as Record<string, unknown>).type = 'unknown_type';

      const transactions: Transaction[] = [
        unknownTypeTransaction,
        createMockTransaction({
          id: 't2',
          accountId: '1',
          amount: 50,
          type: 'income',
          description: 'Valid income',
          category: 'salary',
          date: new Date(),
          cleared: true
        })
      ];

      const result = recalculateAccountBalances(accounts, transactions);

      // Unknown transaction type should be ignored, only income should be added
      expect(result[0].balance).toBe(1050); // 1000 + 50 (unknown type ignored)
    });

    it('maintains immutability - does not modify original arrays', () => {
      const originalAccounts: Account[] = [{
        id: '1',
        name: 'Test Account',
        type: 'current',
        balance: 500,
        currency: 'USD',
        institution: 'Bank',
        lastUpdated: new Date('2023-01-01'),
        openingBalance: 1000
      }];

      const originalTransactions: Transaction[] = [{
        id: 't1',
        accountId: '1',
        amount: 100,
        type: 'income',
        description: 'Test transaction',
        category: 'test',
        date: new Date(),
        cleared: true
      }];

      // Make deep copies to verify immutability (convert dates back)
      const accountsCopy = JSON.parse(JSON.stringify(originalAccounts));
      accountsCopy[0].lastUpdated = new Date(accountsCopy[0].lastUpdated);
      const transactionsCopy = JSON.parse(JSON.stringify(originalTransactions));
      transactionsCopy[0].date = new Date(transactionsCopy[0].date);

      const result = recalculateAccountBalances(originalAccounts, originalTransactions);

      // Verify original arrays weren't modified
      expect(originalAccounts).toEqual(accountsCopy);
      expect(originalTransactions).toEqual(transactionsCopy);

      // Verify result is different
      expect(result[0].balance).not.toBe(originalAccounts[0].balance);
      expect(result[0].lastUpdated).not.toEqual(originalAccounts[0].lastUpdated);
    });
  });
});
