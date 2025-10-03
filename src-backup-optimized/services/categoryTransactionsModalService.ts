/**
 * Category Transactions Modal Service
 * Business logic for category transaction filtering and display
 */

import type { Transaction, Account } from '../types';

export type TransactionFilter = 'all' | 'income' | 'expense';

export interface FilterOptions {
  fromDate: string;
  toDate: string;
  searchQuery: string;
  transactionFilter: TransactionFilter;
}

class CategoryTransactionsModalService {
  /**
   * Get initial filter options
   */
  getInitialFilterOptions(): FilterOptions {
    return {
      fromDate: '',
      toDate: '',
      searchQuery: '',
      transactionFilter: 'all'
    };
  }

  /**
   * Filter transactions by category
   */
  filterByCategory(transactions: Transaction[], categoryId: string): Transaction[] {
    return transactions.filter(t => t.category === categoryId);
  }

  /**
   * Apply transaction type filter
   */
  applyTypeFilter(transactions: Transaction[], filter: TransactionFilter): Transaction[] {
    if (filter === 'income') {
      return transactions.filter(t => 
        t.type === 'income' || (t.type === 'transfer' && t.amount > 0)
      );
    } else if (filter === 'expense') {
      return transactions.filter(t => 
        t.type === 'expense' || (t.type === 'transfer' && t.amount < 0)
      );
    }
    return transactions;
  }

  /**
   * Apply date range filter
   */
  applyDateFilter(
    transactions: Transaction[],
    fromDate: string,
    toDate: string
  ): Transaction[] {
    let filtered = transactions;
    
    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter(t => new Date(t.date) >= from);
    }
    
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => new Date(t.date) <= to);
    }
    
    return filtered;
  }

  /**
   * Apply search filter
   */
  applySearchFilter(
    transactions: Transaction[],
    searchQuery: string,
    accounts: Account[],
    categoryName: string,
    formatCurrency: (amount: any) => string
  ): Transaction[] {
    if (!searchQuery.trim()) return transactions;
    
    const query = searchQuery.toLowerCase().trim();
    const queryWords = query.split(/\s+/);
    
    return transactions.filter(t => {
      const account = accounts.find(a => a.id === t.accountId);
      
      // Check description first for performance
      const descriptionLower = t.description.toLowerCase();
      if (queryWords.every(word => descriptionLower.includes(word))) {
        return true;
      }
      
      // Build searchable fields
      const searchableFields = this.getSearchableFields(
        t,
        account,
        categoryName,
        formatCurrency
      );
      
      const searchableText = searchableFields.join(' ').toLowerCase();
      return queryWords.every(word => searchableText.includes(word));
    });
  }

  /**
   * Get searchable fields for a transaction
   */
  private getSearchableFields(
    transaction: Transaction,
    account: Account | undefined,
    categoryName: string,
    formatCurrency: (amount: any) => string
  ): string[] {
    return [
      transaction.description,
      transaction.amount.toString(),
      Math.abs(transaction.amount).toString(),
      formatCurrency(Math.abs(transaction.amount)),
      account?.name || '',
      account?.institution || '',
      transaction.type,
      transaction.categoryName || categoryName,
      new Date(transaction.date).toLocaleDateString(),
      new Date(transaction.date).toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      }),
      transaction.notes || '',
      transaction.tags?.join(' ') || ''
    ];
  }

  /**
   * Sort transactions by date (newest first)
   */
  sortTransactions(transactions: Transaction[]): Transaction[] {
    return [...transactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary(transactions: Transaction[]): {
    count: number;
    total: number;
    average: number;
    income: number;
    expense: number;
  } {
    const count = transactions.length;
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    const average = count > 0 ? total / count : 0;
    
    const income = transactions
      .filter(t => t.type === 'income' || (t.type === 'transfer' && t.amount > 0))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const expense = transactions
      .filter(t => t.type === 'expense' || (t.type === 'transfer' && t.amount < 0))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    return { count, total, average, income, expense };
  }

  /**
   * Get account name
   */
  getAccountName(transaction: Transaction, accounts: Account[]): string {
    const account = accounts.find(a => a.id === transaction.accountId);
    return account?.name || 'Unknown Account';
  }

  /**
   * Format transaction date
   */
  formatTransactionDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  /**
   * Get transaction type label
   */
  getTransactionTypeLabel(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  /**
   * Check if transaction is income
   */
  isIncome(transaction: Transaction): boolean {
    return transaction.type === 'income' || 
           (transaction.type === 'transfer' && transaction.amount > 0);
  }

  /**
   * Clear all filters
   */
  clearFilters(): FilterOptions {
    return this.getInitialFilterOptions();
  }

  /**
   * Check if any filters are active
   */
  hasActiveFilters(options: FilterOptions): boolean {
    return !!(
      options.fromDate ||
      options.toDate ||
      options.searchQuery.trim() ||
      options.transactionFilter !== 'all'
    );
  }
}

export const categoryTransactionsModalService = new CategoryTransactionsModalService();
