import { describe, it, expect } from 'vitest';
import {
  toDecimalAccount,
  toDecimalTransaction,
  toDecimalBudget,
  toDecimalGoal,
  toDecimalHolding,
  fromDecimalAccount,
  fromDecimalTransaction,
  fromDecimalBudget,
  fromDecimalGoal,
  fromDecimalHolding
} from '../decimal-converters';
import { toDecimal } from '@wealthtracker/utils';
import type { Account, Transaction, Budget, Goal, Holding } from '../../types';

describe('Decimal Converters', () => {
  describe('toDecimalAccount', () => {
    it('converts account with all properties', () => {
      const account: Account = {
        id: '1',
        name: 'Test Account',
        type: 'savings',
        balance: 1000.50,
        currency: 'GBP',
        institution: 'Test Bank',
        lastUpdated: new Date(),
        openingBalance: 500.25,
        holdings: [{
          id: 'h1',
          symbol: 'AAPL',
          shares: 10.5,
          value: 1500.75,
          averageCost: 142.50,
          currentPrice: 150.25,
          marketValue: 1577.625,
          gain: 77.625,
          gainPercent: 5.17
        }]
      };

      const result = toDecimalAccount(account);

      expect(result.id).toBe('1');
      expect(result.name).toBe('Test Account');
      expect(result.balance.toString()).toBe('1000.5');
      expect(result.openingBalance?.toString()).toBe('500.25');
      expect(result.holdings).toHaveLength(1);
      expect(result.holdings![0].shares.toString()).toBe('10.5');
      expect(result.holdings![0].value.toString()).toBe('1500.75');
    });

    it('handles account without optional properties', () => {
      const account: Account = {
        id: '1',
        name: 'Test Account',
        type: 'current',
        balance: 1000,
        currency: 'USD',
        institution: 'Test Bank',
        lastUpdated: new Date()
      };

      const result = toDecimalAccount(account);

      expect(result.balance.toString()).toBe('1000');
      expect(result.openingBalance).toBeUndefined();
      expect(result.holdings).toBeUndefined();
    });

    it('handles zero and negative balances', () => {
      const account: Account = {
        id: '1',
        name: 'Test Account',
        type: 'credit',
        balance: -500.50,
        currency: 'GBP',
        institution: 'Test Bank',
        lastUpdated: new Date(),
        openingBalance: 0
      };

      const result = toDecimalAccount(account);

      expect(result.balance.toString()).toBe('-500.5');
      expect(result.openingBalance?.toString()).toBe('0');
    });
  });

  describe('toDecimalTransaction', () => {
    it('converts transaction with all properties', () => {
      const transaction: Transaction = {
        id: '1',
        date: new Date(),
        amount: 125.75,
        description: 'Test Transaction',
        category: 'groceries',
        accountId: 'acc1',
        type: 'expense',
        cleared: true,
        tags: ['tag1'],
        notes: 'Test notes'
      };

      const result = toDecimalTransaction(transaction);

      expect(result.id).toBe('1');
      expect(result.amount.toString()).toBe('125.75');
      expect(result.description).toBe('Test Transaction');
      expect(result.category).toBe('groceries');
      expect(result.type).toBe('expense');
    });

    it('handles floating point precision amounts', () => {
      const transaction: Transaction = {
        id: '1',
        date: new Date(),
        amount: 0.1 + 0.2, // JavaScript floating point issue
        description: 'Test',
        category: 'test',
        accountId: 'acc1',
        type: 'expense',
        cleared: false
      };

      const result = toDecimalTransaction(transaction);

      expect(result.amount.toString()).toBe('0.30000000000000004'); // Preserves input
    });
  });

  describe('toDecimalBudget', () => {
    it('converts budget correctly', () => {
      const budget: Budget = {
        id: '1',
        categoryId: 'groceries',
        amount: 500.25,
        period: 'monthly',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        spent: 150.50
      };

      const result = toDecimalBudget(budget);

      expect(result.id).toBe('1');
      expect(result.amount.toString()).toBe('500.25');
      expect(result.category).toBe('groceries');
      expect(result.categoryId).toBe('groceries');
      expect(result.period).toBe('monthly');
      expect(result.spent).toBe(150.50);
    });
  });

  describe('toDecimalGoal', () => {
    it('converts goal correctly', () => {
      const goal: Goal = {
        id: '1',
        name: 'Emergency Fund',
        type: 'savings',
        targetAmount: 10000.00,
        currentAmount: 3500.75,
        targetDate: new Date('2024-12-31'),
        isActive: true,
        createdAt: new Date()
      };

      const result = toDecimalGoal(goal);

      expect(result.id).toBe('1');
      expect(result.targetAmount.toString()).toBe('10000');
      expect(result.currentAmount.toString()).toBe('3500.75');
      expect(result.name).toBe('Emergency Fund');
    });
  });

  describe('toDecimalHolding', () => {
    it('converts holding with all properties', () => {
      const holding: Holding = {
        id: '1',
        symbol: 'AAPL',
        shares: 10.5,
        value: 1500.75,
        averageCost: 142.50,
        currentPrice: 150.25,
        marketValue: 1577.625,
        gain: 77.625,
        gainPercent: 5.17
      };

      const result = toDecimalHolding(holding);

      expect(result.shares.toString()).toBe('10.5');
      expect(result.value.toString()).toBe('1500.75');
      expect(result.averageCost?.toString()).toBe('142.5');
      expect(result.currentPrice?.toString()).toBe('150.25');
      expect(result.marketValue?.toString()).toBe('1577.625');
      expect(result.gain?.toString()).toBe('77.625');
      expect(result.gainPercent?.toString()).toBe('5.17');
    });

    it('handles holding with minimal properties', () => {
      const holding: Holding = {
        id: '1',
        symbol: 'AAPL',
        shares: 10,
        value: 1500
      };

      const result = toDecimalHolding(holding);

      expect(result.shares.toString()).toBe('10');
      expect(result.value.toString()).toBe('1500');
      expect(result.averageCost).toBeUndefined();
      expect(result.currentPrice).toBeUndefined();
      expect(result.marketValue).toBeUndefined();
    });
  });

  describe('fromDecimalAccount', () => {
    it('converts decimal account back to regular account', () => {
      const decimalAccount = {
        id: '1',
        name: 'Test Account',
        type: 'savings' as const,
        balance: toDecimal(1000.50),
        currency: 'GBP',
        institution: 'Test Bank',
        lastUpdated: new Date(),
        openingBalance: toDecimal(500.25),
        holdings: [{
          id: 'h1',
          symbol: 'AAPL',
          shares: toDecimal(10.5),
          value: toDecimal(1500.75),
          averageCost: toDecimal(142.50),
          currentPrice: toDecimal(150.25),
          marketValue: toDecimal(1577.625),
          gain: toDecimal(77.625),
          gainPercent: toDecimal(5.17)
        }]
      };

      const result = fromDecimalAccount(decimalAccount);

      expect(result.id).toBe('1');
      expect(result.balance).toBe(1000.50);
      expect(result.openingBalance).toBe(500.25);
      expect(result.holdings).toHaveLength(1);
      expect(result.holdings![0].shares).toBe(10.5);
      expect(result.holdings![0].value).toBe(1500.75);
    });

    it('handles decimal account without optional properties', () => {
      const decimalAccount = {
        id: '1',
        name: 'Test Account',
        type: 'current' as const,
        balance: toDecimal(1000),
        currency: 'USD',
        institution: 'Test Bank',
        lastUpdated: new Date()
      };

      const result = fromDecimalAccount(decimalAccount);

      expect(result.balance).toBe(1000);
      expect(result.openingBalance).toBeUndefined();
      expect(result.holdings).toBeUndefined();
    });
  });

  describe('fromDecimalTransaction', () => {
    it('converts decimal transaction back to regular transaction', () => {
      const decimalTransaction = {
        id: '1',
        date: new Date(),
        amount: toDecimal(125.75),
        description: 'Test Transaction',
        category: 'groceries',
        accountId: 'acc1',
        type: 'expense' as const,
        cleared: true,
        tags: ['tag1'],
        notes: 'Test notes'
      };

      const result = fromDecimalTransaction(decimalTransaction);

      expect(result.id).toBe('1');
      expect(result.amount).toBe(125.75);
      expect(result.description).toBe('Test Transaction');
      expect(result.type).toBe('expense');
    });
  });

  describe('fromDecimalBudget', () => {
    it('converts decimal budget back to regular budget', () => {
      const now = new Date();
      const decimalBudget = {
        id: '1',
        category: 'groceries',
        categoryId: 'groceries',
        amount: toDecimal(500.25),
        period: 'monthly' as const,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        spent: 150.50
      };

      const result = fromDecimalBudget(decimalBudget);

      expect(result.amount).toBe(500.25);
      expect(result.categoryId).toBe('groceries');
      expect(result.category).toBeUndefined();
      expect(result.spent).toBe(150.50);
    });
  });

  describe('fromDecimalGoal', () => {
    it('converts decimal goal back to regular goal', () => {
      const decimalGoal = {
        id: '1',
        name: 'Emergency Fund',
        type: 'savings' as const,
        targetAmount: toDecimal(10000.00),
        currentAmount: toDecimal(3500.75),
        targetDate: new Date('2024-12-31'),
        isActive: true,
        createdAt: new Date()
      };

      const result = fromDecimalGoal(decimalGoal);

      expect(result.targetAmount).toBe(10000);
      expect(result.currentAmount).toBe(3500.75);
      expect(result.name).toBe('Emergency Fund');
    });
  });

  describe('fromDecimalHolding', () => {
    it('converts decimal holding back to regular holding', () => {
      const decimalHolding = {
        id: '1',
        symbol: 'AAPL',
        shares: toDecimal(10.5),
        value: toDecimal(1500.75),
        averageCost: toDecimal(142.50),
        currentPrice: toDecimal(150.25),
        marketValue: toDecimal(1577.625),
        gain: toDecimal(77.625),
        gainPercent: toDecimal(5.17)
      };

      const result = fromDecimalHolding(decimalHolding);

      expect(result.shares).toBe(10.5);
      expect(result.value).toBe(1500.75);
      expect(result.averageCost).toBe(142.50);
      expect(result.currentPrice).toBe(150.25);
      expect(result.marketValue).toBeCloseTo(1577.625, 1);
    });
  });

  describe('Round-trip Conversion', () => {
    it('maintains data integrity for account round-trip conversion', () => {
      const originalAccount: Account = {
        id: '1',
        name: 'Test Account',
        type: 'savings',
        balance: 1000.50,
        currency: 'GBP',
        institution: 'Test Bank',
        lastUpdated: new Date(),
        openingBalance: 500.25
      };

      const converted = fromDecimalAccount(toDecimalAccount(originalAccount));

      expect(converted.balance).toBe(originalAccount.balance);
      expect(converted.openingBalance).toBe(originalAccount.openingBalance);
      expect(converted.name).toBe(originalAccount.name);
      expect(converted.type).toBe(originalAccount.type);
    });

    it('maintains data integrity for transaction round-trip conversion', () => {
      const originalTransaction: Transaction = {
        id: '1',
        date: new Date(),
        amount: 125.75,
        description: 'Test Transaction',
        category: 'groceries',
        accountId: 'acc1',
        type: 'expense',
        cleared: true
      };

      const converted = fromDecimalTransaction(toDecimalTransaction(originalTransaction));

      expect(converted.amount).toBe(originalTransaction.amount);
      expect(converted.description).toBe(originalTransaction.description);
      expect(converted.type).toBe(originalTransaction.type);
    });

    it('maintains data integrity for budget round-trip conversion', () => {
      const now = new Date();
      const originalBudget: Budget = {
        id: '1',
        categoryId: 'groceries',
        amount: 500.25,
        period: 'monthly',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        spent: 150.50
      };

      const converted = fromDecimalBudget(toDecimalBudget(originalBudget));

      expect(converted.amount).toBe(originalBudget.amount);
      expect(converted.categoryId).toBe(originalBudget.categoryId);
      expect(converted.category).toBeUndefined();
      expect(converted.period).toBe(originalBudget.period);
    });

    it('maintains data integrity for goal round-trip conversion', () => {
      const originalGoal: Goal = {
        id: '1',
        name: 'Emergency Fund',
        type: 'savings',
        targetAmount: 10000.00,
        currentAmount: 3500.75,
        targetDate: new Date('2024-12-31'),
        isActive: true,
        createdAt: new Date()
      };

      const converted = fromDecimalGoal(toDecimalGoal(originalGoal));

      expect(converted.targetAmount).toBe(originalGoal.targetAmount);
      expect(converted.currentAmount).toBe(originalGoal.currentAmount);
      expect(converted.name).toBe(originalGoal.name);
    });
  });

  describe('Edge Cases', () => {
    it('handles zero values correctly', () => {
      const account: Account = {
        id: '1',
        name: 'Test',
        type: 'current',
        balance: 0,
        currency: 'USD',
        institution: 'Test',
        lastUpdated: new Date(),
        openingBalance: 0
      };

      const decimalAccount = toDecimalAccount(account);
      const converted = fromDecimalAccount(decimalAccount);

      expect(converted.balance).toBe(0);
      expect(converted.openingBalance).toBe(0);
    });

    it('handles negative values correctly', () => {
      const account: Account = {
        id: '1',
        name: 'Credit Card',
        type: 'credit',
        balance: -1500.50,
        currency: 'USD',
        institution: 'Test',
        lastUpdated: new Date()
      };

      const decimalAccount = toDecimalAccount(account);
      const converted = fromDecimalAccount(decimalAccount);

      expect(converted.balance).toBe(-1500.50);
    });

    it('handles very small decimal amounts', () => {
      const transaction: Transaction = {
        id: '1',
        date: new Date(),
        amount: 0.01,
        description: 'Penny',
        category: 'test',
        accountId: 'acc1',
        type: 'expense',
        cleared: false
      };

      const decimalTransaction = toDecimalTransaction(transaction);
      const converted = fromDecimalTransaction(decimalTransaction);

      expect(converted.amount).toBe(0.01);
    });

    it('handles very large amounts', () => {
      const goal: Goal = {
        id: '1',
        name: 'Million Dollar Goal',
        type: 'savings',
        targetAmount: 1000000.99,
        currentAmount: 500000.50,
        targetDate: new Date('2030-12-31'),
        isActive: true,
        createdAt: new Date()
      };

      const decimalGoal = toDecimalGoal(goal);
      const converted = fromDecimalGoal(decimalGoal);

      expect(converted.targetAmount).toBe(1000000.99);
      expect(converted.currentAmount).toBe(500000.50);
    });
  });

  describe('Performance Tests', () => {
    it('handles large arrays of conversions efficiently', () => {
      const transactions: Transaction[] = Array(1000).fill(null).map((_, i) => ({
        id: `${i}`,
        date: new Date(),
        amount: Math.random() * 1000,
        description: `Transaction ${i}`,
        category: 'test',
        accountId: 'acc1',
        type: Math.random() > 0.5 ? 'income' as const : 'expense' as const,
        cleared: false
      }));

      const startTime = Date.now();
      const decimalTransactions = transactions.map(toDecimalTransaction);
      const convertedBack = decimalTransactions.map(fromDecimalTransaction);
      const endTime = Date.now();

      expect(convertedBack).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });
});
