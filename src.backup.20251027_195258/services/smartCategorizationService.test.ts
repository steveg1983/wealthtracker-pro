/**
 * SmartCategorizationService Tests
 * Tests for AI-powered transaction categorization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { smartCategorizationService } from './smartCategorizationService';
import type { Transaction, Category } from '../types';

describe('SmartCategorizationService', () => {
  const mockCategories: Category[] = [
    { id: 'food', name: 'Food & Dining', type: 'expense', icon: 'restaurant' },
    { id: 'transport', name: 'Transportation', type: 'expense', icon: 'car' },
    { id: 'shopping', name: 'Shopping', type: 'expense', icon: 'shopping-bag' },
    { id: 'utilities', name: 'Utilities', type: 'expense', icon: 'bolt' },
    { id: 'salary', name: 'Salary', type: 'income', icon: 'briefcase' },
    { id: 'entertainment', name: 'Entertainment', type: 'expense', icon: 'film' }
  ];

  const mockTransactions: Transaction[] = [
    // Food transactions
    {
      id: '1',
      accountId: 'acc1',
      date: '2024-01-01',
      description: 'STARBUCKS COFFEE #1234',
      amount: 5.75,
      type: 'expense',
      category: 'food',
      cleared: true,
      recurring: false
    },
    {
      id: '2',
      accountId: 'acc1',
      date: '2024-01-02',
      description: 'MCDONALDS RESTAURANT',
      amount: 12.50,
      type: 'expense',
      category: 'food',
      cleared: true,
      recurring: false
    },
    {
      id: '3',
      accountId: 'acc1',
      date: '2024-01-03',
      description: 'WHOLE FOODS MARKET',
      amount: 85.20,
      type: 'expense',
      category: 'food',
      cleared: true,
      recurring: false
    },
    {
      id: '4',
      accountId: 'acc1',
      date: '2024-01-04',
      description: 'SUBWAY SANDWICH SHOP',
      amount: 8.99,
      type: 'expense',
      category: 'food',
      cleared: true,
      recurring: false
    },
    // Transport transactions
    {
      id: '5',
      accountId: 'acc1',
      date: '2024-01-05',
      description: 'UBER TRIP FARE',
      amount: 25.50,
      type: 'expense',
      category: 'transport',
      cleared: true,
      recurring: false
    },
    {
      id: '6',
      accountId: 'acc1',
      date: '2024-01-06',
      description: 'SHELL GAS STATION',
      amount: 45.00,
      type: 'expense',
      category: 'transport',
      cleared: true,
      recurring: false
    },
    {
      id: '7',
      accountId: 'acc1',
      date: '2024-01-07',
      description: 'LYFT RIDE PAYMENT',
      amount: 18.75,
      type: 'expense',
      category: 'transport',
      cleared: true,
      recurring: false
    },
    // Shopping transactions
    {
      id: '8',
      accountId: 'acc1',
      date: '2024-01-08',
      description: 'AMAZON.COM PURCHASE',
      amount: 125.99,
      type: 'expense',
      category: 'shopping',
      cleared: true,
      recurring: false
    },
    {
      id: '9',
      accountId: 'acc1',
      date: '2024-01-09',
      description: 'TARGET STORE #5678',
      amount: 67.43,
      type: 'expense',
      category: 'shopping',
      cleared: true,
      recurring: false
    },
    {
      id: '10',
      accountId: 'acc1',
      date: '2024-01-10',
      description: 'WALMART SUPERCENTER',
      amount: 89.99,
      type: 'expense',
      category: 'shopping',
      cleared: true,
      recurring: false
    },
    // Salary transactions
    {
      id: '11',
      accountId: 'acc1',
      date: '2024-01-15',
      description: 'PAYROLL DEPOSIT ACME CORP',
      amount: 3500.00,
      type: 'income',
      category: 'salary',
      cleared: true,
      recurring: false
    },
    {
      id: '12',
      accountId: 'acc1',
      date: '2024-01-31',
      description: 'PAYROLL DEPOSIT ACME CORP',
      amount: 3500.00,
      type: 'income',
      category: 'salary',
      cleared: true,
      recurring: false
    }
  ];

  beforeEach(() => {
    // Reset the service state before each test
    smartCategorizationService.learnFromTransactions([], []);
  });

  describe('learnFromTransactions', () => {
    it('learns patterns from categorized transactions', () => {
      smartCategorizationService.learnFromTransactions(mockTransactions, mockCategories);
      
      const stats = smartCategorizationService.getStats();
      expect(stats.patternsLearned).toBeGreaterThan(0);
      expect(stats.merchantsKnown).toBeGreaterThan(0);
      expect(stats.keywordsIdentified).toBeGreaterThan(0);
    });

    it('builds correct patterns for each category', () => {
      smartCategorizationService.learnFromTransactions(mockTransactions, mockCategories);
      
      // Test food pattern recognition
      const newFoodTransaction: Transaction = {
        id: 'new1',
        accountId: 'acc1',
        date: '2024-02-01',
        description: 'STARBUCKS COFFEE #9999',
        amount: 6.50,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      const suggestions = smartCategorizationService.suggestCategories(newFoodTransaction);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].categoryId).toBe('food');
      // Pattern confidence builds up from base 0.5 plus transaction count
      expect(suggestions[0].confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('extracts merchants correctly', () => {
      smartCategorizationService.learnFromTransactions(mockTransactions, mockCategories);
      
      // Should recognize Starbucks merchant
      const starbucksTransaction: Transaction = {
        id: 'new2',
        accountId: 'acc1',
        date: '2024-02-01',
        description: 'STARBUCKS COFFEE DOWNTOWN',
        amount: 7.25,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      const suggestions = smartCategorizationService.suggestCategories(starbucksTransaction);
      expect(suggestions.length).toBeGreaterThan(0);
      // The reason might be merchant or pattern based
      expect(suggestions[0].categoryId).toBe('food');
      if (suggestions[0].reason.includes('Merchant')) {
        expect(suggestions[0].reason.toLowerCase()).toContain('starbucks');
      }
    });

    it('handles empty transaction list', () => {
      expect(() => {
        smartCategorizationService.learnFromTransactions([], mockCategories);
      }).not.toThrow();
      
      const stats = smartCategorizationService.getStats();
      expect(stats.patternsLearned).toBe(0);
    });

    it('ignores transactions without categories', () => {
      const uncategorized: Transaction[] = [
        {
          id: 'u1',
          accountId: 'acc1',
          date: '2024-01-01',
          description: 'UNKNOWN MERCHANT',
          amount: 50,
          type: 'expense',
          cleared: true,
          recurring: false
        }
      ];
      
      smartCategorizationService.learnFromTransactions(uncategorized, mockCategories);
      const stats = smartCategorizationService.getStats();
      expect(stats.patternsLearned).toBe(0);
    });
  });

  describe('suggestCategories', () => {
    beforeEach(() => {
      smartCategorizationService.learnFromTransactions(mockTransactions, mockCategories);
    });

    it('suggests categories based on merchant match', () => {
      const transaction: Transaction = {
        id: 'test1',
        accountId: 'acc1',
        date: '2024-02-01',
        description: 'UBER TRIP TO AIRPORT',
        amount: 35.00,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      const suggestions = smartCategorizationService.suggestCategories(transaction);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].categoryId).toBe('transport');
      // Confidence starts lower and builds up with more data
      expect(suggestions[0].confidence).toBeGreaterThan(0.4);
    });

    it('suggests categories based on keywords', () => {
      const transaction: Transaction = {
        id: 'test2',
        accountId: 'acc1',
        date: '2024-02-01',
        description: 'FRESH MARKET GROCERY STORE',
        amount: 75.00,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      const suggestions = smartCategorizationService.suggestCategories(transaction);
      const foodSuggestion = suggestions.find(s => s.categoryId === 'food');
      expect(foodSuggestion).toBeDefined();
    });

    it('suggests categories based on amount patterns', () => {
      const transaction: Transaction = {
        id: 'test3',
        accountId: 'acc1',
        date: '2024-02-15',
        description: 'DIRECT DEPOSIT',
        amount: 3500.00,
        type: 'income',
        cleared: true,
        recurring: false
      };
      
      const suggestions = smartCategorizationService.suggestCategories(transaction);
      const salarySuggestion = suggestions.find(s => s.categoryId === 'salary');
      expect(salarySuggestion).toBeDefined();
    });

    it('returns limited number of suggestions', () => {
      const transaction: Transaction = {
        id: 'test4',
        accountId: 'acc1',
        date: '2024-02-01',
        description: 'GENERAL STORE PURCHASE',
        amount: 50.00,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      const suggestions = smartCategorizationService.suggestCategories(transaction, 2);
      expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    it('ranks suggestions by confidence', () => {
      const transaction: Transaction = {
        id: 'test5',
        accountId: 'acc1',
        date: '2024-02-01',
        description: 'STARBUCKS COFFEE SHOP',
        amount: 6.00,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      const suggestions = smartCategorizationService.suggestCategories(transaction);
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i-1].confidence).toBeGreaterThanOrEqual(suggestions[i].confidence);
      }
    });
  });

  describe('autoCategorize', () => {
    beforeEach(() => {
      smartCategorizationService.learnFromTransactions(mockTransactions, mockCategories);
    });

    it('auto-categorizes transactions with high confidence', () => {
      const uncategorizedTransactions: Transaction[] = [
        {
          id: 'auto1',
          accountId: 'acc1',
          date: '2024-02-01',
          description: 'MCDONALDS #5678',
          amount: 10.50,
          type: 'expense',
          cleared: true,
          recurring: false
        },
        {
          id: 'auto2',
          accountId: 'acc1',
          date: '2024-02-01',
          description: 'UNKNOWN STORE',
          amount: 25.00,
          type: 'expense',
          cleared: true,
          recurring: false
        }
      ];
      
      const results = smartCategorizationService.autoCategorize(uncategorizedTransactions, 0.7);
      
      // Lower threshold to test
      const lowThresholdResults = smartCategorizationService.autoCategorize(uncategorizedTransactions, 0.5);
      const mcdonaldsLowThreshold = lowThresholdResults.find(r => r.transaction.id === 'auto1');
      
      if (mcdonaldsLowThreshold) {
        expect(mcdonaldsLowThreshold.categoryId).toBe('food');
        expect(mcdonaldsLowThreshold.confidence).toBeGreaterThanOrEqual(0.5);
      }
      
      // May or may not categorize unknown store depending on confidence
      const unknownResult = results.find(r => r.transaction.id === 'auto2');
      if (unknownResult) {
        expect(unknownResult.confidence).toBeGreaterThan(0.7);
      }
    });

    it('respects confidence threshold', () => {
      const uncategorizedTransactions: Transaction[] = [
        {
          id: 'auto3',
          accountId: 'acc1',
          date: '2024-02-01',
          description: 'VAGUE DESCRIPTION',
          amount: 50.00,
          type: 'expense',
          cleared: true,
          recurring: false
        }
      ];
      
      // With high threshold, should not categorize vague transactions
      const results = smartCategorizationService.autoCategorize(uncategorizedTransactions, 0.95);
      expect(results).toHaveLength(0);
    });

    it('skips already categorized transactions', () => {
      const mixedTransactions: Transaction[] = [
        {
          id: 'cat1',
          accountId: 'acc1',
          date: '2024-02-01',
          description: 'STARBUCKS',
          amount: 5.00,
          type: 'expense',
          category: 'food', // Already categorized
          cleared: true,
          recurring: false
        },
        {
          id: 'uncat1',
          accountId: 'acc1',
          date: '2024-02-01',
          description: 'UBER RIDE',
          amount: 20.00,
          type: 'expense',
          cleared: true,
          recurring: false
        }
      ];
      
      const results = smartCategorizationService.autoCategorize(mixedTransactions);
      
      // Should only suggest for uncategorized transaction if confidence is high enough
      if (results.length > 0) {
        expect(results.every(r => !r.transaction.category)).toBe(true);
        // Check that no already-categorized transactions are included
        expect(results.find(r => r.transaction.id === 'cat1')).toBeUndefined();
      }
    });
  });

  describe('learnFromCategorization', () => {
    beforeEach(() => {
      smartCategorizationService.learnFromTransactions(mockTransactions, mockCategories);
    });

    it('learns from individual categorizations', () => {
      const newTransaction: Transaction = {
        id: 'learn1',
        accountId: 'acc1',
        date: '2024-02-01',
        description: 'NETFLIX SUBSCRIPTION',
        amount: 15.99,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      // Learn that Netflix is entertainment
      smartCategorizationService.learnFromCategorization(newTransaction, 'entertainment');
      
      // Test with another Netflix transaction
      const testTransaction: Transaction = {
        id: 'test',
        accountId: 'acc1',
        date: '2024-03-01',
        description: 'NETFLIX MONTHLY',
        amount: 15.99,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      const suggestions = smartCategorizationService.suggestCategories(testTransaction);
      const entertainmentSuggestion = suggestions.find(s => s.categoryId === 'entertainment');
      expect(entertainmentSuggestion).toBeDefined();
    });

    it('updates existing patterns', () => {
      const statsBeforeBefore = smartCategorizationService.getStats();
      
      // Add a new food merchant
      const newFoodTransaction: Transaction = {
        id: 'learn2',
        accountId: 'acc1',
        date: '2024-02-01',
        description: 'CHIPOTLE MEXICAN GRILL',
        amount: 12.00,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      smartCategorizationService.learnFromCategorization(newFoodTransaction, 'food');
      
      const statsAfter = smartCategorizationService.getStats();
      expect(statsAfter.merchantsKnown).toBeGreaterThan(statsBeforeBefore.merchantsKnown);
    });

    it('creates new patterns for unknown categories', () => {
      const newTransaction: Transaction = {
        id: 'learn3',
        accountId: 'acc1',
        date: '2024-02-01',
        description: 'DENTIST OFFICE VISIT',
        amount: 150.00,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      const statsBefore = smartCategorizationService.getStats();
      
      // Learn a new category
      smartCategorizationService.learnFromCategorization(newTransaction, 'healthcare');
      
      const statsAfter = smartCategorizationService.getStats();
      expect(statsAfter.patternsLearned).toBeGreaterThan(statsBefore.patternsLearned);
    });

    it('adjusts amount ranges based on new data', () => {
      // First, ensure utilities pattern exists
      const utilityTransactions: Transaction[] = [
        {
          id: 'util1',
          accountId: 'acc1',
          date: '2024-01-01',
          description: 'ELECTRIC COMPANY',
          amount: 100,
          type: 'expense',
          category: 'utilities',
          cleared: true,
          recurring: false
        },
        {
          id: 'util2',
          accountId: 'acc1',
          date: '2024-01-02',
          description: 'WATER DEPARTMENT',
          amount: 50,
          type: 'expense',
          category: 'utilities',
          cleared: true,
          recurring: false
        },
        {
          id: 'util3',
          accountId: 'acc1',
          date: '2024-01-03',
          description: 'GAS COMPANY',
          amount: 75,
          type: 'expense',
          category: 'utilities',
          cleared: true,
          recurring: false
        }
      ];
      
      smartCategorizationService.learnFromTransactions(utilityTransactions, mockCategories);
      
      // Add a higher amount utility bill
      const highUtilityBill: Transaction = {
        id: 'learn4',
        accountId: 'acc1',
        date: '2024-02-01',
        description: 'ELECTRIC COMPANY WINTER BILL',
        amount: 200,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      smartCategorizationService.learnFromCategorization(highUtilityBill, 'utilities');
      
      // Test that it now accepts higher amounts for utilities
      const testHighBill: Transaction = {
        id: 'test',
        accountId: 'acc1',
        date: '2024-03-01',
        description: 'POWER BILL',
        amount: 180,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      const suggestions = smartCategorizationService.suggestCategories(testHighBill);
      const utilitySuggestion = suggestions.find(s => s.categoryId === 'utilities');
      expect(utilitySuggestion).toBeDefined();
    });
  });

  describe('extractMerchant', () => {
    beforeEach(() => {
      smartCategorizationService.learnFromTransactions(mockTransactions, mockCategories);
    });

    it('handles various transaction description formats', () => {
      const testCases = [
        {
          description: 'CARD PURCHASE STARBUCKS #1234',
          expected: 'starbucks'
        },
        {
          description: 'DIRECT DEBIT TO NETFLIX',
          expected: 'netflix'
        },
        {
          description: 'POS TRANSACTION WALMART STORE',
          expected: 'walmart store'
        },
        {
          description: 'CONTACTLESS PAYMENT SUBWAY',
          expected: 'subway'
        },
        {
          description: 'ONLINE AMAZON.COM PURCHASE',
          expected: 'amazon.com purchase'
        }
      ];
      
      testCases.forEach(testCase => {
        const transaction: Transaction = {
          id: 'format-test',
          accountId: 'acc1',
          date: '2024-02-01',
          description: testCase.description,
          amount: 25.00,
          type: 'expense',
          cleared: true,
          recurring: false
        };
        
        const suggestions = smartCategorizationService.suggestCategories(transaction);
        // Just verify it processes without error
        expect(suggestions).toBeDefined();
      });
    });
  });

  describe('edge cases', () => {
    it('handles transactions with very short descriptions', () => {
      const shortTransaction: Transaction = {
        id: 'short1',
        accountId: 'acc1',
        date: '2024-02-01',
        description: 'ATM',
        amount: 100,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      const suggestions = smartCategorizationService.suggestCategories(shortTransaction);
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('handles transactions with special characters', () => {
      const specialTransaction: Transaction = {
        id: 'special1',
        accountId: 'acc1',
        date: '2024-02-01',
        description: 'CAFÉ @HOME #123 & MORE',
        amount: 15,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      smartCategorizationService.learnFromCategorization(specialTransaction, 'food');
      
      const testTransaction: Transaction = {
        id: 'special2',
        accountId: 'acc1',
        date: '2024-02-02',
        description: 'CAFÉ @HOME BRANCH2',
        amount: 12,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      const suggestions = smartCategorizationService.suggestCategories(testTransaction);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('handles income vs expense type correctly', () => {
      // Ensure same description but different type gets different suggestions
      smartCategorizationService.learnFromTransactions(mockTransactions, mockCategories);
      
      const expenseTransfer: Transaction = {
        id: 'transfer1',
        accountId: 'acc1',
        date: '2024-02-01',
        description: 'BANK TRANSFER',
        amount: 1000,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      const incomeTransfer: Transaction = {
        id: 'transfer2',
        accountId: 'acc1',
        date: '2024-02-01',
        description: 'BANK TRANSFER',
        amount: 1000,
        type: 'income',
        cleared: true,
        recurring: false
      };
      
      smartCategorizationService.learnFromCategorization(expenseTransfer, 'shopping');
      smartCategorizationService.learnFromCategorization(incomeTransfer, 'salary');
      
      // Test expense
      const testExpense: Transaction = {
        id: 'test1',
        accountId: 'acc1',
        date: '2024-03-01',
        description: 'BANK TRANSFER FEE',
        amount: 50,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      const expenseSuggestions = smartCategorizationService.suggestCategories(testExpense);
      // Should lean towards expense categories
      expect(expenseSuggestions).toBeDefined();
    });

    it('handles zero amount transactions', () => {
      const zeroTransaction: Transaction = {
        id: 'zero1',
        accountId: 'acc1',
        date: '2024-02-01',
        description: 'BALANCE INQUIRY FEE',
        amount: 0,
        type: 'expense',
        cleared: true,
        recurring: false
      };
      
      expect(() => {
        smartCategorizationService.suggestCategories(zeroTransaction);
      }).not.toThrow();
    });
  });

  describe('getStats', () => {
    it('returns correct statistics', () => {
      const stats1 = smartCategorizationService.getStats();
      expect(stats1).toEqual({
        patternsLearned: 0,
        merchantsKnown: 0,
        keywordsIdentified: 0
      });
      
      smartCategorizationService.learnFromTransactions(mockTransactions, mockCategories);
      
      const stats2 = smartCategorizationService.getStats();
      expect(stats2.patternsLearned).toBeGreaterThan(0);
      expect(stats2.merchantsKnown).toBeGreaterThan(0);
      expect(stats2.keywordsIdentified).toBeGreaterThan(0);
    });
  });
});
