import type { Transaction, Account, Budget, Goal } from '../types';
import Fuse from 'fuse.js';

export interface SearchOptions {
  // Text search
  query?: string;
  // Date range
  dateFrom?: Date | string;
  dateTo?: Date | string;
  // Amount range
  amountMin?: number;
  amountMax?: number;
  // Type filters
  types?: Array<'income' | 'expense' | 'transfer'>;
  // Account filters
  accountIds?: string[];
  // Category filters
  categoryIds?: string[];
  // Tag filters
  tags?: string[];
  // Status filters
  cleared?: boolean;
  recurring?: boolean;
  // Sorting
  sortBy?: 'date' | 'amount' | 'description' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  // Pagination
  page?: number;
  pageSize?: number;
}

export interface SearchResult<T> {
  item: T;
  score: number;
  matches: Array<{
    field: string;
    value: string;
    indices: ReadonlyArray<readonly [number, number]>;
  }>;
}

export interface SearchResponse<T> {
  results: SearchResult<T>[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  aggregations?: {
    totalAmount?: number;
    averageAmount?: number;
    countByType?: Record<string, number>;
    countByCategory?: Record<string, number>;
    countByAccount?: Record<string, number>;
  };
}

class SearchService {
  private transactionIndex: Fuse<Transaction> | null = null;
  private accountIndex: Fuse<Account> | null = null;
  private budgetIndex: Fuse<Budget> | null = null;
  private goalIndex: Fuse<Goal> | null = null;

  // Initialize search indices
  initializeIndices(data: {
    transactions?: Transaction[];
    accounts?: Account[];
    budgets?: Budget[];
    goals?: Goal[];
  }) {
    if (data.transactions) {
      this.transactionIndex = new Fuse(data.transactions, {
        keys: [
          { name: 'description', weight: 0.4 },
          { name: 'notes', weight: 0.2 },
          { name: 'category', weight: 0.2 },
          { name: 'tags', weight: 0.1 },
          { name: 'amount', weight: 0.1 }
        ],
        threshold: 0.3,
        includeScore: true,
        includeMatches: true,
        useExtendedSearch: true
      });
    }

    if (data.accounts) {
      this.accountIndex = new Fuse(data.accounts, {
        keys: [
          { name: 'name', weight: 0.5 },
          { name: 'institution', weight: 0.3 },
          { name: 'type', weight: 0.2 }
        ],
        threshold: 0.3,
        includeScore: true,
        includeMatches: true
      });
    }

    if (data.budgets) {
      this.budgetIndex = new Fuse(data.budgets, {
        keys: [
          { name: 'category', weight: 0.6 },
          { name: 'period', weight: 0.4 }
        ],
        threshold: 0.3,
        includeScore: true,
        includeMatches: true
      });
    }

    if (data.goals) {
      this.goalIndex = new Fuse(data.goals, {
        keys: [
          { name: 'name', weight: 0.6 },
          { name: 'type', weight: 0.4 }
        ],
        threshold: 0.3,
        includeScore: true,
        includeMatches: true
      });
    }
  }

  // Search transactions with advanced filters
  searchTransactions(
    transactions: Transaction[],
    options: SearchOptions
  ): SearchResponse<Transaction> {
    let results = transactions;
    let searchResults: SearchResult<Transaction>[] = [];

    // Text search using Fuse.js
    if (options.query && this.transactionIndex) {
      const fuseResults = this.transactionIndex.search(options.query);
      searchResults = fuseResults.map(result => ({
        item: result.item,
        score: result.score || 0,
        matches: (result.matches || []).map(match => ({
          field: match.key || '',
          value: match.value || '',
          indices: match.indices || []
        }))
      }));
      results = searchResults.map(r => r.item);
    }

    // Apply filters
    results = this.applyTransactionFilters(results, options);

    // Sort results
    results = this.sortTransactions(results, options, searchResults);

    // Calculate aggregations
    const aggregations = this.calculateAggregations(results);

    // Paginate
    const page = options.page || 1;
    const pageSize = options.pageSize || 50;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedResults = results.slice(startIndex, endIndex);

    // Build response
    const response: SearchResponse<Transaction> = {
      results: options.query && searchResults.length > 0
        ? searchResults.filter(r => paginatedResults.includes(r.item))
        : paginatedResults.map(item => ({
            item,
            score: 1,
            matches: []
          })),
      total: results.length,
      page,
      pageSize,
      hasMore: endIndex < results.length,
      aggregations
    };

    return response;
  }

  // Apply transaction filters
  private applyTransactionFilters(
    transactions: Transaction[],
    options: SearchOptions
  ): Transaction[] {
    let filtered = transactions;

    // Date range filter
    if (options.dateFrom || options.dateTo) {
      const fromDate = options.dateFrom ? new Date(options.dateFrom) : null;
      const toDate = options.dateTo ? new Date(options.dateTo) : null;
      
      filtered = filtered.filter(t => {
        const transactionDate = new Date(t.date);
        if (fromDate && transactionDate < fromDate) return false;
        if (toDate && transactionDate > toDate) return false;
        return true;
      });
    }

    // Amount range filter
    if (options.amountMin !== undefined || options.amountMax !== undefined) {
      filtered = filtered.filter(t => {
        if (options.amountMin !== undefined && t.amount < options.amountMin) return false;
        if (options.amountMax !== undefined && t.amount > options.amountMax) return false;
        return true;
      });
    }

    // Type filter
    if (options.types && options.types.length > 0) {
      filtered = filtered.filter(t => options.types!.includes(t.type));
    }

    // Account filter
    if (options.accountIds && options.accountIds.length > 0) {
      filtered = filtered.filter(t => options.accountIds!.includes(t.accountId));
    }

    // Category filter
    if (options.categoryIds && options.categoryIds.length > 0) {
      filtered = filtered.filter(t => options.categoryIds!.includes(t.category));
    }

    // Tag filter
    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(t => 
        t.tags && t.tags.some(tag => options.tags!.includes(tag))
      );
    }

    // Status filters
    if (options.cleared !== undefined) {
      filtered = filtered.filter(t => t.cleared === options.cleared);
    }

    if (options.recurring !== undefined) {
      filtered = filtered.filter(t => {
        const flag = (t as any).isRecurring ?? (t as any).recurring ?? false;
        return flag === options.recurring;
      });
    }

    return filtered;
  }

  // Sort transactions
  private sortTransactions(
    transactions: Transaction[],
    options: SearchOptions,
    searchResults: SearchResult<Transaction>[]
  ): Transaction[] {
    const sortBy = options.sortBy || 'date';
    const sortOrder = options.sortOrder || 'desc';

    return [...transactions].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'description':
          comparison = a.description.localeCompare(b.description);
          break;
        case 'relevance':
          if (searchResults.length > 0) {
            const scoreA = searchResults.find(r => r.item.id === a.id)?.score || 1;
            const scoreB = searchResults.find(r => r.item.id === b.id)?.score || 1;
            comparison = scoreA - scoreB; // Lower score is better in Fuse.js
          }
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  // Calculate aggregations
  private calculateAggregations(transactions: Transaction[]): SearchResponse<Transaction>['aggregations'] {
    const totalAmount = transactions.reduce((sum, t) => 
      sum + (t.type === 'expense' ? -t.amount : t.amount), 0
    );

    const countByType = transactions.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const countByCategory = transactions.reduce((acc, t) => {
      if (t.category) {
        acc[t.category] = (acc[t.category] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const countByAccount = transactions.reduce((acc, t) => {
      acc[t.accountId] = (acc[t.accountId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAmount,
      averageAmount: transactions.length > 0 ? totalAmount / transactions.length : 0,
      countByType,
      countByCategory,
      countByAccount
    };
  }

  // Search across all entities
  searchAll(query: string, data: {
    transactions?: Transaction[];
    accounts?: Account[];
    budgets?: Budget[];
    goals?: Goal[];
  }): {
    transactions: SearchResult<Transaction>[];
    accounts: SearchResult<Account>[];
    budgets: SearchResult<Budget>[];
    goals: SearchResult<Goal>[];
  } {
    const results = {
      transactions: [] as SearchResult<Transaction>[],
      accounts: [] as SearchResult<Account>[],
      budgets: [] as SearchResult<Budget>[],
      goals: [] as SearchResult<Goal>[]
    };

    if (!query) return results;

    // Search transactions
    if (this.transactionIndex && data.transactions) {
      const transactionResults = this.transactionIndex.search(query);
      results.transactions = transactionResults.map(r => ({
        item: r.item,
        score: r.score || 0,
        matches: (r.matches || []).map(m => ({
          field: m.key || '',
          value: m.value || '',
          indices: m.indices || []
        }))
      }));
    }

    // Search accounts
    if (this.accountIndex && data.accounts) {
      const accountResults = this.accountIndex.search(query);
      results.accounts = accountResults.map(r => ({
        item: r.item,
        score: r.score || 0,
        matches: (r.matches || []).map(m => ({
          field: m.key || '',
          value: m.value || '',
          indices: m.indices || []
        }))
      }));
    }

    // Search budgets
    if (this.budgetIndex && data.budgets) {
      const budgetResults = this.budgetIndex.search(query);
      results.budgets = budgetResults.map(r => ({
        item: r.item,
        score: r.score || 0,
        matches: (r.matches || []).map(m => ({
          field: m.key || '',
          value: m.value || '',
          indices: m.indices || []
        }))
      }));
    }

    // Search goals
    if (this.goalIndex && data.goals) {
      const goalResults = this.goalIndex.search(query);
      results.goals = goalResults.map(r => ({
        item: r.item,
        score: r.score || 0,
        matches: (r.matches || []).map(m => ({
          field: m.key || '',
          value: m.value || '',
          indices: m.indices || []
        }))
      }));
    }

    return results;
  }

  // Get search suggestions based on partial input
  getSuggestions(
    partial: string,
    data: { transactions?: Transaction[]; accounts?: Account[]; categories?: { id: string; name: string }[] }
  ): string[] {
    const suggestions = new Set<string>();
    
    if (!partial || partial.length < 2) return [];

    const lowerPartial = partial.toLowerCase();

    // Get suggestions from transaction descriptions
    data.transactions?.forEach(t => {
      if (t.description.toLowerCase().includes(lowerPartial)) {
        suggestions.add(t.description);
      }
    });

    // Get suggestions from categories
    data.categories?.forEach(c => {
      if (c.name.toLowerCase().includes(lowerPartial)) {
        suggestions.add(c.name);
      }
    });

    // Get suggestions from account names
    data.accounts?.forEach(a => {
      if (a.name.toLowerCase().includes(lowerPartial)) {
        suggestions.add(a.name);
      }
    });

    return Array.from(suggestions).slice(0, 10);
  }

  // Build search query from natural language
  parseNaturalLanguageQuery(query: string): SearchOptions {
    const options: SearchOptions = {};
    const lowerQuery = query.toLowerCase();

    // Parse date ranges
    const datePatterns = {
      'last week': () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        return { dateFrom: start, dateTo: end };
      },
      'last month': () => {
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        return { dateFrom: start, dateTo: end };
      },
      'this month': () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { dateFrom: start, dateTo: end };
      },
      'this year': () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31);
        return { dateFrom: start, dateTo: end };
      }
    };

    // Check for date patterns
    for (const [pattern, getDates] of Object.entries(datePatterns)) {
      if (lowerQuery.includes(pattern)) {
        const dates = getDates();
        options.dateFrom = dates.dateFrom;
        options.dateTo = dates.dateTo;
        query = query.replace(new RegExp(pattern, 'gi'), '').trim();
      }
    }

    // Parse amount ranges
    const amountMatch = query.match(/(?:over|above|greater than|>)\s*\$?(\d+(?:\.\d+)?)/i);
    if (amountMatch) {
      options.amountMin = parseFloat(amountMatch[1]);
      query = query.replace(amountMatch[0], '').trim();
    }

    const underMatch = query.match(/(?:under|below|less than|<)\s*\$?(\d+(?:\.\d+)?)/i);
    if (underMatch) {
      options.amountMax = parseFloat(underMatch[1]);
      query = query.replace(underMatch[0], '').trim();
    }

    // Parse transaction types
    if (lowerQuery.includes('income')) {
      options.types = ['income'];
      query = query.replace(/income/gi, '').trim();
    } else if (lowerQuery.includes('expense')) {
      options.types = ['expense'];
      query = query.replace(/expense/gi, '').trim();
    } else if (lowerQuery.includes('transfer')) {
      options.types = ['transfer'];
      query = query.replace(/transfer/gi, '').trim();
    }

    // Parse status
    if (lowerQuery.includes('uncleared') || lowerQuery.includes('pending')) {
      options.cleared = false;
      query = query.replace(/uncleared|pending/gi, '').trim();
    } else if (lowerQuery.includes('cleared')) {
      options.cleared = true;
      query = query.replace(/cleared/gi, '').trim();
    }

    // The remaining query is used for text search
    if (query.trim()) {
      options.query = query.trim();
    }

    return options;
  }
}

// Export singleton instance
export const searchService = new SearchService();
