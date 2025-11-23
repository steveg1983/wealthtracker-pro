/**
 * SearchService Tests
 * Comprehensive tests for the search service with advanced filtering and indexing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchService } from './searchService';
import type { Transaction, Account, Budget, Goal } from '../types';

// Mock Fuse.js
vi.mock('fuse.js', () => {
  return {
    default: vi.fn().mockImplementation((data, options) => {
      return {
        search: vi.fn((query) => {
          // Simple mock search - returns items that contain the query
          return data
            .filter((item: any) => {
              const searchableText = options.keys
                .map((key: any) => item[key.name || key])
                .join(' ')
                .toLowerCase();
              return searchableText.includes(query.toLowerCase());
            })
            .map((item: any) => ({
              item,
              score: 0.1,
              matches: [
                {
                  key: options.keys[0].name || options.keys[0],
                  value: item[options.keys[0].name || options.keys[0]],
                  indices: [[0, query.length - 1]]
                }
              ]
            }));
        })
      };
    })
  };
});

// Mock data
const mockTransactions: Transaction[] = [
  {
    id: '1',
    accountId: 'acc1',
    date: '2024-01-15',
    description: 'Grocery Store',
    amount: 125.50,
    type: 'expense',
    category: 'Food',
    tags: ['groceries', 'weekly'],
    cleared: true,
    recurring: false,
    notes: 'Weekly shopping'
  },
  {
    id: '2',
    accountId: 'acc2',
    date: '2024-01-14',
    description: 'Salary Deposit',
    amount: 3000.00,
    type: 'income',
    category: 'Salary',
    tags: ['paycheck'],
    cleared: true,
    recurring: true
  },
  {
    id: '3',
    accountId: 'acc1',
    date: '2024-01-13',
    description: 'Transfer to Savings',
    amount: 500.00,
    type: 'transfer',
    category: 'Transfer',
    cleared: false,
    recurring: false
  },
  {
    id: '4',
    accountId: 'acc1',
    date: '2024-01-10',
    description: 'Coffee Shop',
    amount: 5.50,
    type: 'expense',
    category: 'Food',
    tags: ['coffee'],
    cleared: true,
    recurring: false
  }
];

const mockAccounts: Account[] = [
  {
    id: 'acc1',
    name: 'Checking Account',
    institution: 'Bank of America',
    type: 'checking',
    balance: 5000,
    currency: 'USD',
    isActive: true
  },
  {
    id: 'acc2',
    name: 'Savings Account',
    institution: 'Chase',
    type: 'savings',
    balance: 10000,
    currency: 'USD',
    isActive: true
  }
];

const mockBudgets: Budget[] = [
  {
    id: 'b1',
    category: 'Food',
    amount: 500,
    period: 'monthly',
    startDate: '2024-01-01',
    isActive: true
  },
  {
    id: 'b2',
    category: 'Transportation',
    amount: 200,
    period: 'monthly',
    startDate: '2024-01-01',
    isActive: true
  }
];

const mockGoals: Goal[] = [
  {
    id: 'g1',
    name: 'Emergency Fund',
    type: 'savings',
    targetAmount: 10000,
    currentAmount: 5000,
    targetDate: '2024-12-31',
    isActive: true
  },
  {
    id: 'g2',
    name: 'Vacation Fund',
    type: 'savings',
    targetAmount: 3000,
    currentAmount: 1000,
    targetDate: '2024-06-30',
    isActive: true
  }
];

describe('SearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchService.initializeIndices({
      transactions: mockTransactions,
      accounts: mockAccounts,
      budgets: mockBudgets,
      goals: mockGoals
    });
  });

  describe('initializeIndices', () => {
    it('initializes all search indices', () => {
      // Re-initialize to test
      searchService.initializeIndices({
        transactions: mockTransactions,
        accounts: mockAccounts,
        budgets: mockBudgets,
        goals: mockGoals
      });

      // Verify indices are created (tested through search functionality)
      const results = searchService.searchAll('test', {
        transactions: mockTransactions,
        accounts: mockAccounts,
        budgets: mockBudgets,
        goals: mockGoals
      });

      expect(results).toHaveProperty('transactions');
      expect(results).toHaveProperty('accounts');
      expect(results).toHaveProperty('budgets');
      expect(results).toHaveProperty('goals');
    });

    it('handles partial initialization', () => {
      searchService.initializeIndices({
        transactions: mockTransactions
      });

      const results = searchService.searchAll('Grocery', {
        transactions: mockTransactions
      });

      expect(results.transactions).toHaveLength(1);
      expect(results.accounts).toHaveLength(0);
    });
  });

  describe('searchTransactions', () => {
    describe('text search', () => {
      it('searches by description', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          query: 'Grocery'
        });

        expect(result.results).toHaveLength(1);
        expect(result.results[0].item.description).toBe('Grocery Store');
        expect(result.results[0].score).toBeLessThan(1);
        expect(result.results[0].matches).toHaveLength(1);
      });

      it('returns all transactions when no query provided', () => {
        const result = searchService.searchTransactions(mockTransactions, {});

        expect(result.results).toHaveLength(4);
        expect(result.total).toBe(4);
      });

      it('handles case-insensitive search', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          query: 'SALARY'
        });

        expect(result.results).toHaveLength(1);
        expect(result.results[0].item.description).toBe('Salary Deposit');
      });
    });

    describe('date filters', () => {
      it('filters by date range', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          dateFrom: '2024-01-14',
          dateTo: '2024-01-15'
        });

        expect(result.results).toHaveLength(2);
        expect(result.results.map(r => r.item.id)).toContain('1');
        expect(result.results.map(r => r.item.id)).toContain('2');
      });

      it('filters by dateFrom only', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          dateFrom: '2024-01-14'
        });

        expect(result.results).toHaveLength(2);
      });

      it('filters by dateTo only', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          dateTo: '2024-01-13'
        });

        expect(result.results).toHaveLength(2);
      });
    });

    describe('amount filters', () => {
      it('filters by amount range', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          amountMin: 100,
          amountMax: 1000
        });

        expect(result.results).toHaveLength(2);
        expect(result.results.every(r => 
          r.item.amount >= 100 && r.item.amount <= 1000
        )).toBe(true);
      });

      it('filters by minimum amount', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          amountMin: 500
        });

        expect(result.results).toHaveLength(2);
        expect(result.results.every(r => r.item.amount >= 500)).toBe(true);
      });

      it('filters by maximum amount', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          amountMax: 100
        });

        expect(result.results).toHaveLength(1);
        expect(result.results[0].item.amount).toBe(5.50);
      });
    });

    describe('type filters', () => {
      it('filters by transaction type', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          types: ['expense']
        });

        expect(result.results).toHaveLength(2);
        expect(result.results.every(r => r.item.type === 'expense')).toBe(true);
      });

      it('filters by multiple types', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          types: ['income', 'transfer']
        });

        expect(result.results).toHaveLength(2);
        expect(result.results.some(r => r.item.type === 'income')).toBe(true);
        expect(result.results.some(r => r.item.type === 'transfer')).toBe(true);
      });
    });

    describe('account and category filters', () => {
      it('filters by account', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          accountIds: ['acc1']
        });

        expect(result.results).toHaveLength(3);
        expect(result.results.every(r => r.item.accountId === 'acc1')).toBe(true);
      });

      it('filters by category', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          categoryIds: ['Food']
        });

        expect(result.results).toHaveLength(2);
        expect(result.results.every(r => r.item.category === 'Food')).toBe(true);
      });
    });

    describe('tag filters', () => {
      it('filters by tags', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          tags: ['groceries']
        });

        expect(result.results).toHaveLength(1);
        expect(result.results[0].item.tags).toContain('groceries');
      });

      it('filters by multiple tags (OR logic)', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          tags: ['groceries', 'coffee']
        });

        expect(result.results).toHaveLength(2);
      });
    });

    describe('status filters', () => {
      it('filters by cleared status', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          cleared: false
        });

        expect(result.results).toHaveLength(1);
        expect(result.results[0].item.cleared).toBe(false);
      });

      it('filters by recurring status', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          recurring: true
        });

        expect(result.results).toHaveLength(1);
        expect(result.results[0].item.recurring).toBe(true);
      });
    });

    describe('sorting', () => {
      it('sorts by date descending by default', () => {
        const result = searchService.searchTransactions(mockTransactions, {});

        expect(result.results[0].item.date).toBe('2024-01-15');
        expect(result.results[result.results.length - 1].item.date).toBe('2024-01-10');
      });

      it('sorts by date ascending', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          sortBy: 'date',
          sortOrder: 'asc'
        });

        expect(result.results[0].item.date).toBe('2024-01-10');
        expect(result.results[result.results.length - 1].item.date).toBe('2024-01-15');
      });

      it('sorts by amount', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          sortBy: 'amount',
          sortOrder: 'desc'
        });

        expect(result.results[0].item.amount).toBe(3000);
        expect(result.results[result.results.length - 1].item.amount).toBe(5.50);
      });

      it('sorts by description alphabetically', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          sortBy: 'description',
          sortOrder: 'asc'
        });

        expect(result.results[0].item.description).toBe('Coffee Shop');
        expect(result.results[result.results.length - 1].item.description).toBe('Transfer to Savings');
      });

      it('sorts by relevance when query provided', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          query: 'Grocery',
          sortBy: 'relevance'
        });

        expect(result.results[0].item.description).toBe('Grocery Store');
      });
    });

    describe('pagination', () => {
      it('paginates results', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          page: 1,
          pageSize: 2
        });

        expect(result.results).toHaveLength(2);
        expect(result.total).toBe(4);
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(2);
        expect(result.hasMore).toBe(true);
      });

      it('handles last page', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          page: 2,
          pageSize: 3
        });

        expect(result.results).toHaveLength(1);
        expect(result.hasMore).toBe(false);
      });

      it('uses default pagination values', () => {
        const result = searchService.searchTransactions(mockTransactions, {});

        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(50);
      });
    });

    describe('aggregations', () => {
      it('calculates total amount correctly', () => {
        const result = searchService.searchTransactions(mockTransactions, {});

        // Income: 3000, Expenses: -125.50 - 5.50, Transfer: 500 (neutral)
        expect(result.aggregations?.totalAmount).toBe(3000 - 125.50 - 5.50 + 500);
      });

      it('calculates average amount', () => {
        const result = searchService.searchTransactions(mockTransactions, {});

        const expectedAvg = result.aggregations!.totalAmount! / 4;
        expect(result.aggregations?.averageAmount).toBe(expectedAvg);
      });

      it('counts by type', () => {
        const result = searchService.searchTransactions(mockTransactions, {});

        expect(result.aggregations?.countByType).toEqual({
          expense: 2,
          income: 1,
          transfer: 1
        });
      });

      it('counts by category', () => {
        const result = searchService.searchTransactions(mockTransactions, {});

        expect(result.aggregations?.countByCategory).toEqual({
          Food: 2,
          Salary: 1,
          Transfer: 1
        });
      });

      it('counts by account', () => {
        const result = searchService.searchTransactions(mockTransactions, {});

        expect(result.aggregations?.countByAccount).toEqual({
          acc1: 3,
          acc2: 1
        });
      });
    });

    describe('combined filters', () => {
      it('applies multiple filters together', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          query: 'Shop',
          types: ['expense'],
          cleared: true,
          amountMax: 100
        });

        expect(result.results).toHaveLength(1);
        expect(result.results[0].item.description).toBe('Coffee Shop');
      });

      it('returns empty results when filters too restrictive', () => {
        const result = searchService.searchTransactions(mockTransactions, {
          types: ['income'],
          amountMax: 10
        });

        expect(result.results).toHaveLength(0);
        expect(result.total).toBe(0);
      });
    });
  });

  describe('searchAll', () => {
    it('searches across all entity types', () => {
      const results = searchService.searchAll('Fund', {
        transactions: mockTransactions,
        accounts: mockAccounts,
        budgets: mockBudgets,
        goals: mockGoals
      });

      expect(results.goals).toHaveLength(2); // Emergency Fund, Vacation Fund
      expect(results.transactions).toHaveLength(0);
      expect(results.accounts).toHaveLength(0);
      expect(results.budgets).toHaveLength(0);
    });

    it('returns empty results for empty query', () => {
      const results = searchService.searchAll('', {
        transactions: mockTransactions,
        accounts: mockAccounts,
        budgets: mockBudgets,
        goals: mockGoals
      });

      expect(results.transactions).toHaveLength(0);
      expect(results.accounts).toHaveLength(0);
      expect(results.budgets).toHaveLength(0);
      expect(results.goals).toHaveLength(0);
    });

    it('finds matches in multiple entity types', () => {
      const results = searchService.searchAll('Savings', {
        transactions: mockTransactions,
        accounts: mockAccounts,
        budgets: mockBudgets,
        goals: mockGoals
      });

      expect(results.transactions).toHaveLength(1); // Transfer to Savings
      expect(results.accounts).toHaveLength(1); // Savings Account
      expect(results.goals).toHaveLength(2); // Both goals are savings type
    });
  });

  describe('getSuggestions', () => {
    it('returns suggestions based on partial input', () => {
      const suggestions = searchService.getSuggestions('Gr', {
        transactions: mockTransactions,
        accounts: mockAccounts,
        categories: [
          { id: 'c1', name: 'Groceries' },
          { id: 'c2', name: 'Gas' }
        ]
      });

      expect(suggestions).toContain('Grocery Store');
      expect(suggestions).toContain('Groceries');
    });

    it('returns empty array for short input', () => {
      const suggestions = searchService.getSuggestions('G', {
        transactions: mockTransactions
      });

      expect(suggestions).toHaveLength(0);
    });

    it('limits suggestions to 10', () => {
      const manyTransactions = Array.from({ length: 20 }, (_, i) => ({
        ...mockTransactions[0],
        id: `t${i}`,
        description: `Store ${i}`
      }));

      const suggestions = searchService.getSuggestions('Store', {
        transactions: manyTransactions
      });

      expect(suggestions).toHaveLength(10);
    });

    it('returns unique suggestions', () => {
      const duplicateTransactions = [
        { ...mockTransactions[0], id: 't1', description: 'Same Store' },
        { ...mockTransactions[0], id: 't2', description: 'Same Store' }
      ];

      const suggestions = searchService.getSuggestions('Same', {
        transactions: duplicateTransactions
      });

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toBe('Same Store');
    });

    it('searches across all provided data types', () => {
      const suggestions = searchService.getSuggestions('Che', {
        transactions: mockTransactions,
        accounts: mockAccounts,
        categories: [{ id: 'c1', name: 'Checks' }]
      });

      expect(suggestions).toContain('Checking Account');
      expect(suggestions).toContain('Checks');
    });
  });

  describe('parseNaturalLanguageQuery', () => {
    describe('date parsing', () => {
      it('parses "last week"', () => {
        const _today = new Date();
        const options = searchService.parseNaturalLanguageQuery('groceries last week');

        expect(options.dateFrom).toBeInstanceOf(Date);
        expect(options.dateTo).toBeInstanceOf(Date);
        expect(options.query).toBe('groceries');
        
        // Verify date range is roughly 7 days
        const daysDiff = Math.round(
          (options.dateTo!.getTime() - options.dateFrom!.getTime()) / (1000 * 60 * 60 * 24)
        );
        expect(daysDiff).toBe(7);
      });

      it('parses "last month"', () => {
        const options = searchService.parseNaturalLanguageQuery('transactions last month');

        expect(options.dateFrom).toBeInstanceOf(Date);
        expect(options.dateTo).toBeInstanceOf(Date);
        expect(options.query).toBe('transactions');
      });

      it('parses "this month"', () => {
        const options = searchService.parseNaturalLanguageQuery('all transactions this month');
        const now = new Date();

        expect(options.dateFrom?.getDate()).toBe(1);
        expect(options.dateFrom?.getMonth()).toBe(now.getMonth());
        expect(options.query).toBe('all transactions');
      });

      it('parses "this year"', () => {
        const options = searchService.parseNaturalLanguageQuery('all transactions this year');
        const now = new Date();

        expect(options.dateFrom?.getFullYear()).toBe(now.getFullYear());
        expect(options.dateFrom?.getMonth()).toBe(0);
        expect(options.dateTo?.getMonth()).toBe(11);
        expect(options.query).toBe('all transactions');
      });
    });

    describe('amount parsing', () => {
      it('parses "over $100"', () => {
        const options = searchService.parseNaturalLanguageQuery('transactions over $100');

        expect(options.amountMin).toBe(100);
        expect(options.query).toBe('transactions');
      });

      it('parses "above 50.50"', () => {
        const options = searchService.parseNaturalLanguageQuery('transactions above 50.50');

        expect(options.amountMin).toBe(50.50);
        expect(options.query).toBe('transactions');
      });

      it('parses "under $500"', () => {
        const options = searchService.parseNaturalLanguageQuery('purchases under $500');

        expect(options.amountMax).toBe(500);
        expect(options.query).toBe('purchases');
      });

      it('parses "less than 1000"', () => {
        const options = searchService.parseNaturalLanguageQuery('less than 1000');

        expect(options.amountMax).toBe(1000);
        expect(options.query).toBeUndefined(); // No remaining query after parsing
      });

      it('parses both min and max amounts', () => {
        const options = searchService.parseNaturalLanguageQuery('transactions over $100 under $500');

        expect(options.amountMin).toBe(100);
        expect(options.amountMax).toBe(500);
        expect(options.query).toBe('transactions');
      });
    });

    describe('type parsing', () => {
      it('parses "income"', () => {
        const options = searchService.parseNaturalLanguageQuery('income from client');

        expect(options.types).toEqual(['income']);
        expect(options.query).toBe('from client');
      });

      it('parses "expense"', () => {
        const options = searchService.parseNaturalLanguageQuery('grocery expense');

        expect(options.types).toEqual(['expense']);
        expect(options.query).toBe('grocery');
      });

      it('parses "transfer"', () => {
        const options = searchService.parseNaturalLanguageQuery('transfer to savings');

        expect(options.types).toEqual(['transfer']);
        expect(options.query).toBe('to savings');
      });
    });

    describe('status parsing', () => {
      it('parses "uncleared"', () => {
        const options = searchService.parseNaturalLanguageQuery('uncleared transactions');

        expect(options.cleared).toBe(false);
        expect(options.query).toBe('transactions');
      });

      it('parses "pending"', () => {
        const options = searchService.parseNaturalLanguageQuery('pending deposits');

        expect(options.cleared).toBe(false);
        expect(options.query).toBe('deposits');
      });

      it('parses "cleared"', () => {
        const options = searchService.parseNaturalLanguageQuery('cleared transactions');

        expect(options.cleared).toBe(true);
        expect(options.query).toBe('transactions');
      });
    });

    describe('complex queries', () => {
      it('parses multiple criteria', () => {
        const options = searchService.parseNaturalLanguageQuery(
          'grocery expense over $50 last month cleared'
        );

        expect(options.query).toBe('grocery');
        expect(options.types).toEqual(['expense']);
        expect(options.amountMin).toBe(50);
        expect(options.cleared).toBe(true);
        expect(options.dateFrom).toBeInstanceOf(Date);
        expect(options.dateTo).toBeInstanceOf(Date);
      });

      it('handles case insensitivity', () => {
        const options = searchService.parseNaturalLanguageQuery(
          'INCOME OVER $1000 THIS MONTH'
        );

        expect(options.types).toEqual(['income']);
        expect(options.amountMin).toBe(1000);
        expect(options.dateFrom).toBeInstanceOf(Date);
      });

      it('preserves remaining query after parsing', () => {
        const options = searchService.parseNaturalLanguageQuery(
          'coffee shop expense under $10'
        );

        expect(options.query).toBe('coffee shop');
        expect(options.types).toEqual(['expense']);
        expect(options.amountMax).toBe(10);
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty transaction array', () => {
      const result = searchService.searchTransactions([], {
        query: 'test'
      });

      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.aggregations?.totalAmount).toBe(0);
    });

    it('handles transactions without optional fields', () => {
      const minimalTransactions: Transaction[] = [{
        id: 't1',
        accountId: 'a1',
        date: '2024-01-01',
        description: 'Test',
        amount: 100,
        type: 'expense',
        category: 'Test'
      }];

      const result = searchService.searchTransactions(minimalTransactions, {
        tags: ['test']
      });

      expect(result.results).toHaveLength(0); // No tags field
    });

    it('handles invalid date strings gracefully', () => {
      const options = searchService.parseNaturalLanguageQuery('invalid date range');

      expect(options.dateFrom).toBeUndefined();
      expect(options.dateTo).toBeUndefined();
      expect(options.query).toBe('invalid date range');
    });

    it('handles very large page numbers', () => {
      const result = searchService.searchTransactions(mockTransactions, {
        page: 1000,
        pageSize: 10
      });

      expect(result.results).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });
});